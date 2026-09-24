import { bucketFor, formatDate, formatTime, relativeDue } from "../src/dates.js";
import { CANVAS_ORIGIN, TYPE_LABELS } from "../src/constants.js";
import { countPlannerTypes, groupPlannerItems, TYPE_GROUPS } from "../src/view-model.js";

const app = document.querySelector("#app");
const refreshButton = document.querySelector("#refresh");
const themeButton = document.querySelector("#theme-toggle");
const settingsButton = document.querySelector("#settings");
const notice = document.querySelector("#notice");
const syncStatus = document.querySelector("#sync-status");

let current = { state: null, settings: null };
let activeView = localStorage.getItem("otnow:view") === "courses" ? "courses" : "deadlines";
let courseFilter = localStorage.getItem("otnow:course") || "all";
let typeFilter = localStorage.getItem("otnow:type") || "all";
let groupMode = localStorage.getItem("otnow:group") === "date" ? "date" : "type";

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
  screen.append(element("div", "state-icon", "OT"), element("h1", "", title), element("p", "", message));
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

function renderViewTabs(state) {
  const tabs = element("nav", "view-tabs");
  tabs.setAttribute("aria-label", "OTNow sections");
  const openCount = state.items.filter((item) => item.status === "open").length;
  const choices = [
    ["deadlines", "Deadlines", openCount],
    ["courses", "Courses", state.courses.length],
  ];
  for (const [id, label, count] of choices) {
    const button = element("button", `view-tab${activeView === id ? " active" : ""}`);
    button.type = "button";
    button.setAttribute("aria-selected", String(activeView === id));
    button.append(element("span", "", label), element("span", "tab-count", String(count)));
    button.addEventListener("click", () => {
      activeView = id;
      localStorage.setItem("otnow:view", id);
      render();
    });
    tabs.append(button);
  }
  return tabs;
}

function renderOverview(items) {
  const now = new Date();
  const open = items.filter((item) => item.status === "open");
  const overdue = open.filter((item) => bucketFor(item, now) === "overdue").length;
  const dueToday = open.filter((item) => bucketFor(item, now) === "today").length;
  const next = open.find((item) => Date.parse(item.dueAt) >= now.getTime());
  const overview = element("section", "overview");
  const copy = element("div", "overview-copy");
  copy.append(
    element("h1", "", "Deadlines"),
    element("p", "", next ? `Next: ${next.courseCode} · ${next.title}` : "No upcoming dated coursework."),
  );
  const status = element("div", "overview-status");
  status.append(
    element("strong", "", String(open.length)),
    element("span", "", "open"),
    element("strong", dueToday ? "is-warning" : "", String(dueToday)),
    element("span", "", "today"),
    element("strong", overdue ? "is-danger" : "", String(overdue)),
    element("span", "", "overdue"),
  );
  overview.append(copy, status);
  return overview;
}

function selectControl(label, value, options, onChange) {
  const field = element("label", "control");
  field.append(element("span", "control-label", label));
  const select = element("select");
  for (const option of options) {
    const entry = element("option", "", option.label);
    entry.value = option.value;
    entry.selected = option.value === value;
    select.append(entry);
  }
  select.addEventListener("change", () => onChange(select.value));
  field.append(select);
  return field;
}

function renderControls(courses, items) {
  const controls = element("section", "controls");
  const courseOptions = [
    { value: "all", label: "All courses" },
    ...courses.map((course) => ({ value: course.id, label: course.code })),
  ];
  const courseItems = courseFilter === "all" ? items : items.filter((item) => item.courseId === courseFilter);
  const typeCounts = countPlannerTypes(courseItems);
  const typeOptions = [
    { value: "all", label: `All types (${courseItems.length})` },
    ...TYPE_GROUPS.map(([id, label]) => ({ value: id, label: `${label} (${typeCounts[id]})` })),
  ];
  controls.append(
    selectControl("Course", courseFilter, courseOptions, (value) => {
      courseFilter = value;
      localStorage.setItem("otnow:course", value);
      render();
    }),
    selectControl("Type", typeFilter, typeOptions, (value) => {
      typeFilter = value;
      localStorage.setItem("otnow:type", value);
      render();
    }),
    selectControl("Group", groupMode, [
      { value: "type", label: "By type" },
      { value: "date", label: "By date" },
    ], (value) => {
      groupMode = value;
      localStorage.setItem("otnow:group", value);
      render();
    }),
  );
  return controls;
}

function renderItem(item, now) {
  const itemBucket = bucketFor(item, now);
  const row = element("article", `item${itemBucket === "overdue" ? " is-overdue" : ""}${item.status !== "open" ? " is-complete" : ""}`);
  row.style.setProperty("--course-color", item.color || "#0077ca");

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
  meta.append(element("span", "course-code", item.courseCode), element("span", "item-type", TYPE_LABELS[item.type] || TYPE_LABELS.other));
  const title = element("a", "item-title", item.title);
  title.href = item.url;
  title.target = "_blank";
  title.rel = "noreferrer";
  main.append(meta, title);
  if (item.moved) {
    const moved = element("div", "moved");
    moved.append("Moved from ", element("s", "", `${formatDate(item.moved.from)} ${formatTime(item.moved.from)}`));
    main.append(moved);
  }

  const due = element("div", "due");
  const primary = item.status === "submitted" ? "Submitted" : item.status === "done" ? "Done" : relativeDue(item.dueAt);
  due.append(element("strong", "", primary), element("span", "", `${formatDate(item.dueAt)} · ${formatTime(item.dueAt)}`));
  row.append(check, main, due);
  return row;
}

function renderDeadlineGroups(items) {
  const now = new Date();
  const groups = groupPlannerItems(items, groupMode, now);
  if (!groups.length) return element("div", "empty", "No matching dated coursework.");
  const output = document.createDocumentFragment();
  for (const groupData of groups) {
    const group = element("section", "group");
    const heading = element("div", "group-heading");
    heading.append(element("h2", "", groupData.label), element("span", "", String(groupData.items.length)));
    const list = element("div", "items");
    groupData.items.forEach((item) => list.append(renderItem(item, now)));
    group.append(heading, list);
    output.append(group);
  }
  return output;
}

function canvasCourseUrl(courseId, section = "") {
  const base = `${CANVAS_ORIGIN}/courses/${encodeURIComponent(courseId)}`;
  return section ? `${base}/${section}` : base;
}

function courseLink(label, url, primary = false) {
  const link = element("a", primary ? "course-link primary" : "course-link", label);
  link.href = url;
  link.target = "_blank";
  link.rel = "noreferrer";
  return link;
}

function renderCourseDirectory(courses, items) {
  const section = element("section", "course-directory");
  const header = element("div", "section-intro");
  header.append(
    element("h1", "", "Courses"),
    element("p", "", "Open the official Canvas pages for course material. OTNow does not copy files or module content."),
  );
  section.append(header);
  const list = element("div", "course-list");
  for (const course of courses) {
    const openItems = items.filter((item) => item.courseId === course.id && item.status === "open").length;
    const row = element("article", "course-row");
    row.style.setProperty("--course-color", course.color || "#0077ca");
    const identity = element("div", "course-identity");
    identity.append(element("span", "course-dot"), element("div", "course-name"));
    identity.lastElementChild.append(element("strong", "", course.code), element("span", "", course.name));
    const count = element("div", "course-open-count", `${openItems} open`);
    const links = element("div", "course-links");
    links.append(
      courseLink("Home", canvasCourseUrl(course.id), true),
      courseLink("Modules", canvasCourseUrl(course.id, "modules")),
      courseLink("Assignments", canvasCourseUrl(course.id, "assignments")),
      courseLink("Quizzes", canvasCourseUrl(course.id, "quizzes")),
      courseLink("Discussions", canvasCourseUrl(course.id, "discussion_topics")),
      courseLink("Files", canvasCourseUrl(course.id, "files")),
      courseLink("Grades", canvasCourseUrl(course.id, "grades")),
    );
    row.append(identity, count, links);
    list.append(row);
  }
  if (!courses.length) list.append(element("div", "empty", "No active Canvas courses were returned."));
  section.append(list);
  return section;
}

function renderReady(state, settings) {
  if (courseFilter !== "all" && !state.courses.some((course) => course.id === courseFilter)) courseFilter = "all";
  app.replaceChildren(renderViewTabs(state));

  if (activeView === "courses") {
    app.append(renderCourseDirectory(state.courses, state.items));
    return;
  }

  const statusItems = state.items.filter((item) => settings.showCompleted || item.status === "open");
  const visibleItems = statusItems
    .filter((item) => courseFilter === "all" || item.courseId === courseFilter)
    .filter((item) => typeFilter === "all" || item.type === typeFilter);

  app.append(renderOverview(state.items), renderControls(state.courses, statusItems));
  const sourceNote = element("p", "source-note", "Assignments, quizzes, discussions, events, planner notes, and other dated Canvas items are included when Canvas returns them.");
  app.append(sourceNote, renderDeadlineGroups(visibleItems));
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
    showState("Reading Canvas", "OTNow is collecting your active courses and dated coursework.");
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
