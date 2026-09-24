import { bucketFor, formatDate, formatTime, relativeDue } from "../src/dates.js";
import { TYPE_LABELS } from "../src/constants.js";

const app = document.querySelector("#app");
const refreshButton = document.querySelector("#refresh");
const themeButton = document.querySelector("#theme-toggle");
const settingsButton = document.querySelector("#settings");
const notice = document.querySelector("#notice");
const syncStatus = document.querySelector("#sync-status");

let current = { state: null, settings: null };
let courseFilter = "all";

const GROUPS = [
  ["overdue", "Overdue"],
  ["today", "Today"],
  ["week", "This week"],
  ["next", "Next week"],
  ["later", "Later"],
  ["completed", "Completed"],
];

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function applyTheme(theme) {
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

function usingDarkTheme(theme) {
  return theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
}

function relativeSync(iso) {
  if (!iso) return "Not synced yet";
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (seconds < 45) return "Synced just now";
  if (seconds < 3600) return `Synced ${Math.round(seconds / 60)}m ago`;
  return `Synced ${Math.round(seconds / 3600)}h ago`;
}

function showState(title, message, { openCanvas = false, retry = false } = {}) {
  app.replaceChildren();
  const screen = element("section", "state-screen");
  screen.append(element("div", "state-icon", "O"), element("h1", "", title), element("p", "", message));
  const actions = element("div");
  if (openCanvas) {
    const button = element("button", "primary-button", "Open Canvas");
    button.type = "button";
    button.addEventListener("click", () => chrome.runtime.sendMessage({ type: "panel:open-canvas" }));
    actions.append(button);
  }
  if (retry) {
    const button = element("button", openCanvas ? "secondary-button" : "primary-button", "Try again");
    button.type = "button";
    button.addEventListener("click", syncNow);
    actions.append(button);
  }
  screen.append(actions);
  app.append(screen);
}

function renderFilters(courses, items) {
  const filters = element("nav", "filters");
  filters.setAttribute("aria-label", "Filter deadlines by course");
  const choices = [{ id: "all", code: "All" }, ...courses.filter((course) => items.some((item) => item.courseId === course.id))];
  for (const course of choices) {
    const button = element("button", `filter${courseFilter === course.id ? " active" : ""}`, course.code);
    button.type = "button";
    button.addEventListener("click", () => {
      courseFilter = course.id;
      render();
    });
    filters.append(button);
  }
  return filters;
}

function renderSummary(items) {
  const now = new Date();
  const open = items.filter((item) => item.status === "open");
  const overdue = open.filter((item) => bucketFor(item, now) === "overdue").length;
  const today = open.filter((item) => bucketFor(item, now) === "today").length;
  const thisWeek = open.filter((item) => ["today", "week"].includes(bucketFor(item, now))).length;
  const next = open.find((item) => Date.parse(item.dueAt) >= now.getTime());
  const summary = element("section", "summary");
  summary.append(element("div", "eyebrow", "Ontario Tech Canvas"));
  const headline = today
    ? `${today} ${today === 1 ? "deadline" : "deadlines"} due today`
    : overdue
      ? `${overdue} overdue ${overdue === 1 ? "item" : "items"}`
      : "Nothing due today";
  summary.append(element("h1", "", headline));
  summary.append(element("p", "", next ? `Next: ${next.courseCode} · ${next.title}` : "Everything in the current planner window is complete."));
  const metrics = element("div", "summary-metrics");
  for (const [value, label, danger] of [[today, "Today"], [thisWeek, "This week"], [overdue, "Overdue", true]]) {
    const metric = element("div", `metric${danger ? " danger" : ""}`);
    metric.append(element("strong", "", String(value)), element("span", "", label));
    metrics.append(metric);
  }
  summary.append(metrics);
  return summary;
}

function renderItem(item, groupId) {
  const row = element("article", `item${groupId === "overdue" ? " is-overdue" : ""}${item.status !== "open" ? " is-complete" : ""}`);
  row.style.setProperty("--course-color", item.color || "#2563eb");

  const check = element("button", `check${item.status !== "open" ? " checked" : ""}`);
  check.type = "button";
  check.setAttribute("aria-label", item.status === "open" ? `Mark ${item.title} complete` : `Mark ${item.title} incomplete`);
  check.disabled = item.submitted || item.canvasComplete;
  check.addEventListener("click", async () => {
    check.disabled = true;
    await chrome.runtime.sendMessage({ type: "panel:toggle", itemId: item.id });
  });

  const main = element("div", "item-main");
  const meta = element("div", "item-meta");
  meta.append(element("span", "course-pill", item.courseCode), element("span", "", TYPE_LABELS[item.type] || TYPE_LABELS.other));
  const title = element("a", "item-title", item.title);
  title.href = item.url;
  title.target = "_blank";
  title.rel = "noreferrer";
  main.append(meta, title);
  if (item.moved) {
    const moved = element("div", "moved");
    moved.append("Moved from ");
    const oldDate = element("s", "", `${formatDate(item.moved.from)} ${formatTime(item.moved.from)}`);
    moved.append(oldDate);
    main.append(moved);
  }

  const due = element("div", "due");
  const primary = item.status === "submitted" ? "Submitted" : item.status === "done" ? "Done" : relativeDue(item.dueAt);
  due.append(element("strong", "", primary), element("span", "", `${formatDate(item.dueAt)} · ${formatTime(item.dueAt)}`));
  row.append(check, main, due);
  return row;
}

function renderReady(state, settings) {
  const visibleItems = state.items
    .filter((item) => settings.showCompleted || item.status === "open")
    .filter((item) => courseFilter === "all" || item.courseId === courseFilter);
  app.replaceChildren(renderSummary(state.items), renderFilters(state.courses, state.items));
  if (!visibleItems.length) {
    app.append(element("div", "empty", courseFilter === "all" ? "No deadlines to show." : "No deadlines for this course."));
    return;
  }
  const now = new Date();
  for (const [id, label] of GROUPS) {
    const items = visibleItems.filter((item) => bucketFor(item, now) === id);
    if (!items.length) continue;
    const group = element("section", "group");
    const heading = element("div", "group-heading");
    heading.append(element("h2", "", label), element("span", "", String(items.length)));
    const list = element("div", "items");
    items.forEach((item) => list.append(renderItem(item, id)));
    group.append(heading, list);
    app.append(group);
  }
}

function render() {
  const { state, settings } = current;
  if (!state || !settings) return;
  applyTheme(settings.theme);
  const dark = usingDarkTheme(settings.theme);
  themeButton.classList.toggle("is-dark", dark);
  themeButton.setAttribute("aria-label", dark ? "Use light theme" : "Use dark theme");
  themeButton.title = dark ? "Use light theme" : "Use dark theme";
  refreshButton.classList.toggle("spinning", state.status === "syncing");
  refreshButton.disabled = state.status === "syncing";
  syncStatus.textContent = relativeSync(state.lastSyncAt);
  notice.hidden = !state.stale;
  if (state.stale) notice.textContent = `${state.error || "Canvas could not be refreshed."} Showing the last saved deadlines.`;

  if (state.status === "idle" || (state.status === "syncing" && !state.items.length)) {
    showState("Reading Canvas", "OTNow is collecting your current courses and deadlines.");
    return;
  }
  if (state.status === "error" && !state.items.length) {
    const signedOut = ["signed-out", "no-tab"].includes(state.errorKind);
    showState(signedOut ? "Connect Canvas" : "Canvas could not be read", state.error || "Open Canvas and try again.", { openCanvas: true, retry: true });
    return;
  }
  renderReady(state, settings);
}

async function load() {
  current = await chrome.runtime.sendMessage({ type: "panel:get" });
  render();
  if (current.state.status === "idle") syncNow();
}

async function syncNow() {
  refreshButton.classList.add("spinning");
  refreshButton.disabled = true;
  await chrome.runtime.sendMessage({ type: "panel:sync" });
  await load();
}

refreshButton.addEventListener("click", syncNow);
themeButton.addEventListener("click", async () => {
  const theme = usingDarkTheme(current.settings.theme) ? "light" : "dark";
  const response = await chrome.runtime.sendMessage({ type: "options:set", settings: { theme } });
  current.settings = response.settings;
  render();
});
settingsButton.addEventListener("click", () => chrome.runtime.sendMessage({ type: "panel:open-options" }));

matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (current.settings?.theme === "system") render();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.state) current.state = changes.state.newValue;
  if (changes.settings) current.settings = changes.settings.newValue;
  render();
});

load();
setInterval(() => {
  if (current.state) syncStatus.textContent = relativeSync(current.state.lastSyncAt);
}, 60_000);
