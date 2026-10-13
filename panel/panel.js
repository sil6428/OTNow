import { bucketFor, formatDate, formatTime, relativeDue } from "../src/dates.js";
import {
  announcementIdsInScope,
} from "../src/announcement-read.js";
import {
  CANVAS_ORIGIN,
  CHROME_WEB_STORE_URL,
  FEEDBACK_URL,
  GLOBAL_STATS_ORIGIN,
  REPOSITORY_URL,
  SECURITY_REPORT_URL,
  SUPPORT_URL,
  TYPE_LABELS,
} from "../src/constants.js";
import {
  completionSource,
  countPlannerTypes,
  groupCompletedItems,
  groupPlannerItems,
  plannerItemsForView,
  TYPE_GROUPS,
} from "../src/view-model.js";
import { CURRENT_RELEASE_NOTE, releasePromptMessage } from "../src/release-notes.js";

const app = document.querySelector("#app");
const refreshButton = document.querySelector("#refresh");
const themeButton = document.querySelector("#theme-toggle");
const settingsButton = document.querySelector("#settings");
const notice = document.querySelector("#notice");
const syncStatus = document.querySelector("#sync-status");
const appVersion = document.querySelector("#app-version");
const supportLink = document.querySelector("#support-link");
const feedbackLink = document.querySelector("#feedback-link");

let current = { state: null, settings: null, announcementRead: {}, releaseNoteSeen: "", globalStats: null };
const savedView = localStorage.getItem("otnow:view");
let activeView = ["completed", "courses", "insights"].includes(savedView) ? savedView : "deadlines";
let courseFilter = localStorage.getItem("otnow:course") || "all";
let typeFilter = localStorage.getItem("otnow:type") || "all";
let groupMode = localStorage.getItem("otnow:group") === "type" ? "type" : "date";
let completedTypeFilter = localStorage.getItem("otnow:completed-type") || "all";
let completedGroupMode = localStorage.getItem("otnow:completed-group") === "type" ? "type" : "date";
const searchQueries = {
  deadlines: localStorage.getItem("otnow:search:deadlines") || "",
  completed: localStorage.getItem("otnow:search:completed") || "",
};
const searchOpen = {
  deadlines: Boolean(searchQueries.deadlines),
  completed: Boolean(searchQueries.completed),
};
let announcementUndo = null;
let announcementUndoTimer = null;
let pendingFocus = null;

const ANNOUNCEMENT_UNDO_MS = 6_000;
const STALE_SYNC_MS = 2 * 60 * 60 * 1000;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function configureSupportLink() {
  feedbackLink.href = FEEDBACK_URL;
  if (!SUPPORT_URL) return;
  try {
    const url = new URL(SUPPORT_URL);
    if (url.protocol !== "https:" || url.hostname !== "ko-fi.com") return;
    supportLink.href = url.href;
    supportLink.hidden = false;
  } catch {
    // Keep the optional support section hidden if its URL is invalid.
  }
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

function exactSync(iso) {
  if (!iso) return "No successful sync yet";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function syncAge(iso) {
  if (!iso) return Number.POSITIVE_INFINITY;
  return Math.max(0, Date.now() - Date.parse(iso));
}

function platformName() {
  const value = navigator.userAgentData?.platform || navigator.platform || "Unknown";
  if (/win/i.test(value)) return "Windows";
  if (/mac/i.test(value)) return "macOS";
  if (/cros/i.test(value)) return "ChromeOS";
  if (/android/i.test(value)) return "Android";
  if (/linux/i.test(value)) return "Linux";
  return "Other";
}

async function browserName() {
  let name = "Chromium";
  if (await navigator.brave?.isBrave?.()) name = "Brave";
  else if (/Edg\//.test(navigator.userAgent)) name = "Microsoft Edge";
  else if (/Chrome\//.test(navigator.userAgent)) name = "Google Chrome";
  const version = navigator.userAgent.match(/(?:Edg|Chrome)\/([\d.]+)/)?.[1];
  return version ? `${name} ${version}` : name;
}

function yesNo(value) {
  return value ? "yes" : "no";
}

async function buildDiagnosticReport() {
  const state = current.state;
  const settings = current.settings;
  const deadlines = plannerItemsForView(state.items, "deadlines", current.announcementRead);
  const completed = plannerItemsForView(state.items, "completed", current.announcementRead);
  const counts = countPlannerTypes(state.items);
  const optionalStatsPermission = await chrome.permissions.contains({
    origins: [`${GLOBAL_STATS_ORIGIN}/*`],
  });
  const browser = await browserName();
  const manualCompleted = state.items.filter((item) => completionSource(item) === "otnow").length;
  const adjustedDeadlines = state.items.filter((item) => item.deadlineAdjusted).length;
  const readAnnouncements = Object.keys(current.announcementRead || {}).length;
  const viewedRelease = current.releaseNoteSeen === CURRENT_RELEASE_NOTE.id;

  return [
    "OTNow troubleshooting information",
    `Generated: ${new Date().toLocaleString()}`,
    "",
    `OTNow version: ${chrome.runtime.getManifest().version}`,
    `Browser: ${browser}`,
    `Platform: ${platformName()}`,
    `Panel size: ${window.innerWidth} x ${window.innerHeight} CSS pixels`,
    `Display scale: ${window.devicePixelRatio || 1}`,
    `Browser reports online: ${yesNo(navigator.onLine)}`,
    "",
    `Sync status: ${state.status}`,
    `Last successful sync: ${exactSync(state.lastSyncAt)}`,
    `Sync data is stale: ${yesNo(Boolean(state.stale) || syncAge(state.lastSyncAt) >= STALE_SYNC_MS)}`,
    `Last sync error category: ${state.errorKind || "none"}`,
    `First sync completed: ${yesNo(state.firstSyncComplete)}`,
    `Cached courses: ${state.courses.length}`,
    `Cached dated items: ${state.items.length}`,
    `Items in Deadlines: ${deadlines.length}`,
    `Items in Completed: ${completed.length}`,
    `Assignments / quizzes / discussions: ${counts.assignment} / ${counts.quiz} / ${counts.discussion}`,
    `Announcements / events / notes / other: ${counts.announcement} / ${counts.event} / ${counts.note} / ${counts.other}`,
    `Read announcements saved locally: ${readAnnouncements}`,
    `Manual completions currently loaded: ${manualCompleted}`,
    `Adjusted deadlines currently loaded: ${adjustedDeadlines}`,
    "",
    `Theme: ${settings.theme}`,
    `Notifications enabled: ${yesNo(settings.notificationsEnabled)}`,
    `Moved-date alerts enabled: ${yesNo(settings.notifyMovedDates)}`,
    `Muted course count: ${settings.mutedCourseIds.length}`,
    `Anonymous statistics enabled: ${yesNo(settings.shareAnonymousStats)}`,
    `Statistics permission granted: ${yesNo(optionalStatsPermission)}`,
    `Statistics choice completed: ${yesNo(settings.statsOnboardingSeen)}`,
    `Current update note acknowledged: ${yesNo(viewedRelease)}`,
    `Current panel view: ${activeView}`,
    `Deadline filters active: ${yesNo(courseFilter !== "all" || typeFilter !== "all" || Boolean(searchQueries.deadlines))}`,
    `Completed filters active: ${yesNo(courseFilter !== "all" || completedTypeFilter !== "all" || Boolean(searchQueries.completed))}`,
    "",
    "Privacy check: This report contains no names, emails, course names or codes, assignment titles, grades, due dates, URLs, Canvas IDs, extension identifiers, passwords, session data, authentication tokens, IP addresses, or full browser user-agent string.",
  ].join("\n");
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const input = document.createElement("textarea");
    input.value = text;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.append(input);
    input.select();
    const copied = document.execCommand("copy");
    input.remove();
    return copied;
  }
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

function renderSyncNotice(state) {
  const ageStale = syncAge(state.lastSyncAt) >= STALE_SYNC_MS;
  const shouldShow = state.items.length > 0 && state.status !== "syncing" && (Boolean(state.stale) || ageStale);
  notice.hidden = !shouldShow;
  notice.replaceChildren();
  if (!shouldShow) return;

  const copy = element("div", "sync-warning-copy");
  let heading = "OTNow hasn't synced recently";
  let message = "Your Canvas session may have expired. Your saved deadlines are still available.";
  if (state.errorKind === "offline") {
    heading = "You're offline";
    message = "OTNow is showing the deadlines saved during the last successful sync.";
  } else if (["signed-out", "no-tab"].includes(state.errorKind)) {
    heading = "Canvas needs to be reconnected";
    message = "Open Canvas, make sure you're signed in, and then try the sync again.";
  } else if (state.stale) {
    heading = "Canvas couldn't be refreshed";
    message = "OTNow is showing your last saved deadlines while you reconnect.";
  }
  copy.append(
    element("strong", "", heading),
    element("span", "", message),
    element("small", "", `Last successful sync: ${exactSync(state.lastSyncAt)}`),
  );

  const actions = element("div", "sync-warning-actions");
  const canvas = element("button", "sync-warning-button", "Open Canvas");
  canvas.type = "button";
  canvas.addEventListener("click", () => chrome.runtime.sendMessage({ type: "panel:open-canvas" }));
  const retry = element("button", "sync-warning-button primary", "Try again");
  retry.type = "button";
  retry.addEventListener("click", syncNow);
  actions.append(canvas, retry);
  notice.append(copy, actions);
}

function renderViewTabs(state) {
  const tabs = element("nav", "view-tabs");
  tabs.setAttribute("aria-label", "OTNow sections");
  const openCount = plannerItemsForView(state.items, "deadlines", current.announcementRead).length;
  const completedCount = plannerItemsForView(state.items, "completed", current.announcementRead).length;
  const choices = [
    ["deadlines", "Deadlines", openCount],
    ["completed", "Completed", completedCount],
    ["courses", "Courses", state.courses.length],
    ["insights", "Insights", null],
  ];
  for (const [id, label, count] of choices) {
    const button = element("button", `view-tab${activeView === id ? " active" : ""}`);
    button.type = "button";
    button.setAttribute("aria-selected", String(activeView === id));
    button.append(element("span", "", label));
    if (count != null) button.append(element("span", "tab-count", String(count)));
    button.addEventListener("click", () => {
      activeView = id;
      localStorage.setItem("otnow:view", id);
      render();
    });
    tabs.append(button);
  }
  return tabs;
}

function renderUpdateNotice(update) {
  if (update?.status !== "available") return null;
  const banner = element("section", "update-notice");
  const copy = element("div", "update-copy");
  copy.append(
    element("strong", "", `OTNow ${update.latestVersion} is available`),
    element("span", "", `You have ${update.installedVersion}.`),
  );
  const button = element("button", "update-button", "Update steps");
  button.type = "button";
  button.addEventListener("click", () => chrome.runtime.sendMessage({ type: "panel:open-update-guide" }));
  banner.append(copy, button);
  return banner;
}

function renderStatisticsPrompt(settings) {
  if (settings.statsOnboardingSeen) return null;
  const prompt = element("section", "statistics-prompt");
  prompt.setAttribute("aria-label", "Optional anonymous statistics");
  const copy = element("div", "statistics-prompt-copy");
  copy.append(
    element("strong", "", "Optional anonymous statistics"),
    element("span", "", "Help measure OTNow with anonymous totals. Nothing is shared unless you review and enable it."),
  );
  const actions = element("div", "statistics-prompt-actions");
  const review = element("button", "statistics-prompt-button primary", "Review");
  review.type = "button";
  review.addEventListener("click", () => {
    location.href = "../options/onboarding.html?source=panel";
  });
  const dismiss = element("button", "statistics-prompt-button", "Not now");
  dismiss.type = "button";
  dismiss.addEventListener("click", async () => {
    dismiss.disabled = true;
    review.disabled = true;
    const response = await chrome.runtime.sendMessage({ type: "stats:onboarding-decline" });
    if (!response?.settings) {
      dismiss.disabled = false;
      review.disabled = false;
      return;
    }
    current.settings = response.settings;
    render();
  });
  actions.append(review, dismiss);
  prompt.append(copy, actions);
  return prompt;
}

async function dismissReleaseNote() {
  const response = await chrome.runtime.sendMessage({
    type: "release-note:dismiss",
    id: CURRENT_RELEASE_NOTE.id,
  });
  if (!response?.ok) return false;
  current.releaseNoteSeen = response.releaseNoteSeen;
  return true;
}

function renderReleaseNotePrompt(settings) {
  if (!settings.statsOnboardingSeen || current.releaseNoteSeen === CURRENT_RELEASE_NOTE.id) return null;
  const prompt = element("section", "release-note-prompt");
  prompt.setAttribute("aria-label", `What changed in OTNow ${CURRENT_RELEASE_NOTE.version}`);
  const copy = element("div", "release-note-prompt-copy");
  copy.append(
    element("strong", "", CURRENT_RELEASE_NOTE.title),
    element("span", "", releasePromptMessage()),
  );
  const actions = element("div", "release-note-prompt-actions");
  const details = element("button", "release-note-prompt-button primary", "See changes");
  details.type = "button";
  details.addEventListener("click", async () => {
    details.disabled = true;
    dismiss.disabled = true;
    if (await dismissReleaseNote()) location.href = "../options/changelog.html?source=panel";
    else {
      details.disabled = false;
      dismiss.disabled = false;
    }
  });
  const dismiss = element("button", "release-note-prompt-button", "Got it");
  dismiss.type = "button";
  dismiss.addEventListener("click", async () => {
    details.disabled = true;
    dismiss.disabled = true;
    if (await dismissReleaseNote()) render();
    else {
      details.disabled = false;
      dismiss.disabled = false;
    }
  });
  actions.append(details, dismiss);
  prompt.append(copy, actions);
  return prompt;
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

function courseFilterLabel(courses) {
  if (courseFilter === "all") return "All courses";
  return courses.find((course) => course.id === courseFilter)?.code || "Selected course";
}

function typeFilterLabel(value) {
  return value === "all" ? "All types" : (TYPE_LABELS[value] || TYPE_LABELS.other);
}

function itemMatchesSearch(item, query) {
  const value = query.trim().toLocaleLowerCase();
  if (!value) return true;
  const course = current.state.courses.find((entry) => entry.id === item.courseId);
  return [item.title, item.courseCode, course?.name, TYPE_LABELS[item.type] || TYPE_LABELS.other]
    .filter(Boolean)
    .some((part) => String(part).toLocaleLowerCase().includes(value));
}

function filtersActive(view) {
  const type = view === "completed" ? completedTypeFilter : typeFilter;
  return courseFilter !== "all" || type !== "all" || Boolean(searchQueries[view]);
}

function clearListFilters(view) {
  courseFilter = "all";
  localStorage.setItem("otnow:course", "all");
  if (view === "completed") {
    completedTypeFilter = "all";
    localStorage.setItem("otnow:completed-type", "all");
  } else {
    typeFilter = "all";
    localStorage.setItem("otnow:type", "all");
  }
  searchQueries[view] = "";
  searchOpen[view] = false;
  localStorage.removeItem(`otnow:search:${view}`);
  render();
}

function renderSearch(view, label) {
  const wrap = element("section", `list-search${searchOpen[view] || searchQueries[view] ? " is-open" : ""}`);
  if (!searchOpen[view] && !searchQueries[view]) {
    const open = element("button", "list-search-toggle", `Search ${label}`);
    open.type = "button";
    open.setAttribute("aria-expanded", "false");
    open.addEventListener("click", () => {
      searchOpen[view] = true;
      render();
      focusAfterRender(`[data-search-view="${view}"]`);
    });
    wrap.append(open);
    return wrap;
  }

  const form = element("form", "list-search-form");
  form.setAttribute("role", "search");
  const input = element("input", "list-search-input");
  input.type = "search";
  input.placeholder = `Search ${label}`;
  input.value = searchQueries[view];
  input.dataset.searchView = view;
  input.setAttribute("aria-label", `Search ${label}`);
  const apply = element("button", "list-search-button primary", "Search");
  apply.type = "submit";
  const clear = element("button", "list-search-button", searchQueries[view] ? "Clear" : "Close");
  clear.type = "button";
  clear.addEventListener("click", () => {
    searchQueries[view] = "";
    searchOpen[view] = false;
    localStorage.removeItem(`otnow:search:${view}`);
    render();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    searchQueries[view] = input.value.trim();
    localStorage.setItem(`otnow:search:${view}`, searchQueries[view]);
    searchOpen[view] = Boolean(searchQueries[view]);
    render();
  });
  form.append(input, apply, clear);
  wrap.append(form);
  return wrap;
}

function renderEmptyState(message, view) {
  const empty = element("div", "empty list-empty");
  empty.append(element("p", "", message));
  if (filtersActive(view)) {
    const clear = element("button", "clear-filters", "Clear filters");
    clear.type = "button";
    clear.addEventListener("click", () => clearListFilters(view));
    empty.append(clear);
  }
  return empty;
}

function renderOrganizer(view, controls, summaryParts, searchLabel) {
  const organizer = element("details", "organizer");
  const storageKey = `otnow:organizer-open:${view}`;
  organizer.open = localStorage.getItem(storageKey) !== "false";
  organizer.addEventListener("toggle", () => localStorage.setItem(storageKey, String(organizer.open)));
  const summary = element("summary", "organizer-summary");
  const summaryDetails = [...summaryParts];
  if (searchQueries[view]) summaryDetails.push(`Search: ${searchQueries[view]}`);
  summary.append(
    element("strong", "", "Organize"),
    element("span", "", summaryDetails.join(" · ")),
  );
  organizer.append(summary, controls, renderSearch(view, searchLabel));
  return organizer;
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
  return renderOrganizer("deadlines", controls, [
    courseFilterLabel(courses),
    typeFilterLabel(typeFilter),
    groupMode === "date" ? "By date" : "By type",
  ], "deadlines");
}

function scopedCourseLabel() {
  if (courseFilter === "all") return "";
  return current.state.courses.find((course) => course.id === courseFilter)?.code || "this course";
}

function focusAfterRender(selector) {
  pendingFocus = selector;
  requestAnimationFrame(() => {
    if (!pendingFocus) return;
    document.querySelector(pendingFocus)?.focus();
    pendingFocus = null;
  });
}

function scheduleAnnouncementUndo(value) {
  if (announcementUndoTimer) clearTimeout(announcementUndoTimer);
  announcementUndo = value;
  announcementUndoTimer = setTimeout(() => {
    const status = document.querySelector("[data-announcement-status]");
    const restoreFocus = Boolean(status?.contains(document.activeElement));
    announcementUndo = null;
    announcementUndoTimer = null;
    render();
    if (restoreFocus) focusAfterRender(".view-tab.active");
  }, ANNOUNCEMENT_UNDO_MS);
}

function clearAnnouncementUndo() {
  if (announcementUndoTimer) clearTimeout(announcementUndoTimer);
  announcementUndoTimer = null;
  announcementUndo = null;
}

function renderAnnouncementActions(openItems) {
  const unreadIds = announcementIdsInScope(openItems, courseFilter, current.announcementRead, { unreadOnly: true });
  if (!unreadIds.length) return null;
  const scope = scopedCourseLabel();
  const section = element("section", "announcement-actions");
  const copy = element("div", "announcement-action-copy");
  copy.append(
    element("strong", "", "Announcements"),
    element("span", "", "Read status is saved only in OTNow and never changes Canvas."),
  );
  const actions = element("div", "announcement-action-buttons");

  const mark = element(
    "button",
    "announcement-action primary",
    `Mark ${unreadIds.length} ${scope ? `${scope} ` : ""}announcement${unreadIds.length === 1 ? "" : "s"} read`,
  );
  mark.type = "button";
  mark.addEventListener("click", async () => {
    mark.disabled = true;
    const response = await chrome.runtime.sendMessage({ type: "panel:mark-announcements-read", itemIds: unreadIds });
    if (!response?.announcementRead) {
      mark.disabled = false;
      notice.hidden = false;
      notice.textContent = response?.error || "Announcements could not be marked read.";
      return;
    }
    current.announcementRead = response.announcementRead;
    scheduleAnnouncementUndo({ previous: response.previous, count: response.count, scope, action: "read" });
    render();
    focusAfterRender("[data-announcement-status]");
  });
  actions.append(mark);

  section.append(copy, actions);
  return section;
}

function renderAnnouncementUndoNotice() {
  if (!announcementUndo) return null;
  const status = element(
    "div",
    "announcement-toast",
    `Marked ${announcementUndo.count} ${announcementUndo.scope ? `${announcementUndo.scope} ` : ""}announcement${announcementUndo.count === 1 ? "" : "s"} ${announcementUndo.action}.`,
  );
  status.tabIndex = -1;
  status.dataset.announcementStatus = "true";
  status.setAttribute("role", "status");
  const undo = element("button", "announcement-undo", "Undo");
  undo.type = "button";
  undo.addEventListener("click", async () => {
    undo.disabled = true;
    const undoState = announcementUndo;
    if (!undoState) return;
    if (announcementUndoTimer) clearTimeout(announcementUndoTimer);
    announcementUndoTimer = null;
    const response = await chrome.runtime.sendMessage({
      type: "panel:restore-announcements-read",
      previous: undoState.previous,
    });
    if (!response?.announcementRead) {
      undo.disabled = false;
      scheduleAnnouncementUndo(undoState);
      return;
    }
    current.announcementRead = response.announcementRead;
    clearAnnouncementUndo();
    render();
    focusAfterRender(".announcement-action");
  });
  status.append(" ", undo);
  return status;
}

function renderCompletedControls(courses, items) {
  const controls = element("section", "controls completed-controls");
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
    selectControl("Type", completedTypeFilter, typeOptions, (value) => {
      completedTypeFilter = value;
      localStorage.setItem("otnow:completed-type", value);
      render();
    }),
    selectControl("Group", completedGroupMode, [
      { value: "date", label: "By due date" },
      { value: "type", label: "By type" },
    ], (value) => {
      completedGroupMode = value;
      localStorage.setItem("otnow:completed-group", value);
      render();
    }),
  );
  return renderOrganizer("completed", controls, [
    courseFilterLabel(courses),
    typeFilterLabel(completedTypeFilter),
    completedGroupMode === "date" ? "By due date" : "By type",
  ], "completed items");
}

function pause(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function toggleWithMotion(row, check, item) {
  if (check.disabled) return;
  check.disabled = true;
  row.classList.add("is-settling");
  check.classList.add("springing");
  await pause(matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 240);
  await chrome.runtime.sendMessage({ type: "panel:toggle", itemId: item.id });
}

function addSwipeCompletion(row, check, item) {
  if (item.type === "announcement" || item.status !== "open" || check.disabled) return;
  let startX = 0;
  let startY = 0;
  let dragging = false;
  let distance = 0;
  row.classList.add("is-swipeable");
  const action = element("span", "swipe-action", "Done");
  action.setAttribute("aria-hidden", "true");
  row.prepend(action);
  row.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest("a,button,select")) return;
    startX = event.clientX;
    startY = event.clientY;
    distance = 0;
    dragging = true;
    row.setPointerCapture(event.pointerId);
  });
  row.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) {
      dragging = false;
      row.style.removeProperty("--swipe-x");
      return;
    }
    distance = Math.max(0, Math.min(92, dx));
    row.style.setProperty("--swipe-x", distance + "px");
    row.classList.toggle("swipe-ready", distance >= 68);
  });
  const finish = async () => {
    if (!dragging) return;
    dragging = false;
    row.classList.remove("swipe-ready");
    row.style.removeProperty("--swipe-x");
    if (distance >= 68) await toggleWithMotion(row, check, item);
  };
  row.addEventListener("pointerup", finish);
  row.addEventListener("pointercancel", finish);
}

function localDateTimeValue(iso) {
  const date = new Date(iso);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function openDeadlineEditor(item) {
  const canvasDueAt = item.canvasDueAt || item.dueAt;
  const suggested = new Date(Math.max(
    Date.parse(item.dueAt),
    Date.parse(canvasDueAt) + 24 * 60 * 60 * 1000,
    Date.now() + 60 * 60 * 1000,
  ));

  const dialog = element("dialog", "deadline-dialog");
  const form = element("form", "deadline-form");
  const heading = element("div", "deadline-dialog-heading");
  heading.append(
    element("h2", "", item.deadlineAdjusted ? "Update extension" : "Add an extension"),
    element("p", "", "Use the due date and time you were given. OTNow will update its groups and reminders, but Canvas will not be changed."),
  );

  const field = element("label", "deadline-field");
  field.append(element("span", "", "Approved due date"));
  const input = element("input");
  input.type = "datetime-local";
  input.required = true;
  input.min = localDateTimeValue(new Date(Date.parse(canvasDueAt) + 60_000).toISOString());
  input.value = localDateTimeValue(item.deadlineAdjusted ? item.dueAt : suggested.toISOString());
  field.append(input);

  const original = element("p", "deadline-original", `Canvas due date: ${formatDate(canvasDueAt)} at ${formatTime(canvasDueAt)}`);
  const error = element("p", "deadline-error");
  error.hidden = true;
  const actions = element("div", "deadline-actions");
  const cancel = element("button", "dialog-button", "Cancel");
  cancel.type = "button";
  cancel.addEventListener("click", () => dialog.close());
  if (item.deadlineAdjusted) {
    const reset = element("button", "dialog-button reset", "Use Canvas date");
    reset.type = "button";
    reset.addEventListener("click", async () => {
      reset.disabled = true;
      const response = await chrome.runtime.sendMessage({ type: "panel:set-deadline", itemId: item.id, dueAt: null });
      if (!response?.state) {
        reset.disabled = false;
        error.hidden = false;
        error.textContent = response?.error || "The deadline could not be reset.";
        return;
      }
      current.state = response.state;
      dialog.close();
      render();
    });
    actions.append(reset);
  }
  const save = element("button", "dialog-button primary", "Save extension");
  save.type = "submit";
  actions.append(cancel, save);

  form.append(heading, field, original, error, actions);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!input.reportValidity()) return;
    save.disabled = true;
    error.hidden = true;
    const dueAt = new Date(input.value).toISOString();
    const response = await chrome.runtime.sendMessage({ type: "panel:set-deadline", itemId: item.id, dueAt });
    if (!response?.state) {
      save.disabled = false;
      error.hidden = false;
      error.textContent = response?.error || "The extension could not be saved.";
      return;
    }
    current.state = response.state;
    dialog.close();
    render();
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  dialog.append(form);
  document.body.append(dialog);
  dialog.showModal();
  input.focus();
}

function renderItem(item, now, { completedView = false } = {}) {
  const itemBucket = bucketFor(item, now);
  const readAnnouncement = item.type === "announcement" && Boolean(current.announcementRead[item.id]);
  const row = element("article", `item${itemBucket === "overdue" ? " is-overdue" : ""}${item.status !== "open" ? " is-complete" : ""}${readAnnouncement ? " is-read-announcement" : ""}`);
  row.style.setProperty("--course-color", item.color || "#0077ca");

  const check = element("button", `check${item.status !== "open" || readAnnouncement ? " checked" : ""}`);
  check.type = "button";
  check.setAttribute("aria-label", item.type === "announcement"
    ? `Mark ${item.title} ${readAnnouncement ? "unread" : "read"}`
    : (item.status === "open" ? `Mark ${item.title} complete` : `Move ${item.title} back to Deadlines`));
  check.disabled = item.submitted || item.canvasComplete;
  check.addEventListener("click", async () => {
    if (item.type !== "announcement") {
      await toggleWithMotion(row, check, item);
      return;
    }
    check.disabled = true;
    const response = await chrome.runtime.sendMessage({
      type: readAnnouncement ? "panel:mark-announcements-unread" : "panel:mark-announcements-read",
      itemIds: [item.id],
    });
    if (!response?.announcementRead) {
      check.disabled = false;
      return;
    }
    current.announcementRead = response.announcementRead;
    scheduleAnnouncementUndo({
      previous: response.previous,
      count: response.count,
      scope: item.courseCode,
      action: readAnnouncement ? "unread" : "read",
    });
    render();
    focusAfterRender("[data-announcement-status]");
  });

  const main = element("div", "item-main");
  const meta = element("div", "item-meta");
  meta.append(element("span", "course-code", item.courseCode), element("span", "item-type", TYPE_LABELS[item.type] || TYPE_LABELS.other));
  const title = element("a", "item-title", item.title);
  title.href = item.url;
  title.target = "_blank";
  title.rel = "noreferrer";
  main.append(meta, title);
  if (readAnnouncement) main.append(element("div", "announcement-read-state", "Read in OTNow"));
  if (completedView && !readAnnouncement) {
    const source = completionSource(item);
    main.append(element(
      "div",
      `completion-source ${source === "canvas" ? "is-canvas" : "is-local"}`,
      source === "canvas" ? "Completed in Canvas" : "Checked off in OTNow",
    ));
  }
  if (item.moved) {
    const moved = element("div", "moved");
    moved.append("Moved from ", element("s", "", `${formatDate(item.moved.from)} ${formatTime(item.moved.from)}`));
    main.append(moved);
  }
  if (item.deadlineAdjusted && item.canvasDueAt) {
    main.append(element("div", "deadline-adjusted", `Extension applied · Canvas: ${formatDate(item.canvasDueAt)} ${formatTime(item.canvasDueAt)}`));
  }

  const due = element("div", "due");
  const primary = readAnnouncement && completedView
    ? "Read"
    : item.status === "submitted" ? "Submitted" : item.status === "done" ? "Done" : relativeDue(item.dueAt);
  due.append(element("strong", "", primary), element("span", "", `${formatDate(item.dueAt)} · ${formatTime(item.dueAt)}`));
  if (completedView && readAnnouncement) {
    const restore = element("button", "restore-deadline", "Mark unread");
    restore.type = "button";
    restore.addEventListener("click", () => check.click());
    due.append(restore);
  } else if (completedView && completionSource(item) === "otnow") {
    const restore = element("button", "restore-deadline", "Move back to Deadlines");
    restore.type = "button";
    restore.addEventListener("click", () => toggleWithMotion(row, check, item));
    due.append(restore);
  } else if (!completedView && item.type !== "announcement" && !item.submitted && !item.canvasComplete) {
    const adjust = element("button", `due-adjust${item.deadlineAdjusted ? " active" : ""}`, item.deadlineAdjusted ? "Edit extension" : "Add extension");
    adjust.type = "button";
    adjust.addEventListener("click", () => openDeadlineEditor(item));
    due.append(adjust);
  }
  row.append(check, main, due);
  addSwipeCompletion(row, check, item);
  return row;
}

function renderDeadlineGroups(items, emptyMessage = "No matching dated coursework.") {
  const now = new Date();
  const groups = groupPlannerItems(items, groupMode, now);
  if (!groups.length) return renderEmptyState(emptyMessage, "deadlines");
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

function renderCompleted(items) {
  const section = element("section", "completed-view");
  const header = element("div", "section-intro");
  header.append(
    element("h1", "", "Completed"),
    element("p", "", "Review finished work. Only check-offs made in OTNow can be moved back to Deadlines."),
  );
  section.append(header, renderCompletedControls(current.state.courses, items));
  const courseItems = courseFilter === "all" ? items : items.filter((item) => item.courseId === courseFilter);
  const visibleItems = courseItems
    .filter((item) => completedTypeFilter === "all" || item.type === completedTypeFilter)
    .filter((item) => itemMatchesSearch(item, searchQueries.completed));
  if (!visibleItems.length) {
    const message = searchQueries.completed
      ? `No completed items match “${searchQueries.completed}”.`
      : courseFilter === "all"
        ? (completedTypeFilter === "all" ? "No completed dated coursework is saved yet." : "No completed items match this type.")
        : "No completed items match this course and type.";
    section.append(renderEmptyState(message, "completed"));
    return section;
  }
  const groups = groupCompletedItems(visibleItems, completedGroupMode, new Date());
  for (const groupData of groups) {
    const group = element("section", "group");
    const heading = element("div", "group-heading");
    heading.append(element("h2", "", groupData.label), element("span", "", String(groupData.items.length)));
    const list = element("div", "items");
    groupData.items.forEach((item) => list.append(renderItem(item, new Date(), { completedView: true })));
    group.append(heading, list);
    section.append(group);
  }
  return section;
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

function formatMetric(value) {
  return new Intl.NumberFormat().format(Number(value) || 0);
}

function insightRow(label, value, detail) {
  const row = element("div", "insight-row");
  const copy = element("div", "insight-copy");
  copy.append(element("strong", "", label), element("span", "", detail));
  row.append(copy, element("span", "insight-value", formatMetric(value)));
  return row;
}

function renderRating(metrics = {}, globalStats = {}, settings = {}) {
  const days = metrics.activeDays?.length || 0;
  if (days < 7 || !settings.shareAnonymousStats) return null;
  const wrap = element("section", "rating-peek");
  const copy = element("div", "rating-copy");
  copy.append(
    element("strong", "", globalStats.rating ? "Thanks for rating OTNow" : "How is OTNow working for you?"),
    element("span", "", globalStats.rating ? "Your anonymous rating can be changed anytime." : "One anonymous number. No written review or coursework data."),
  );
  const choices = element("div", "rating-choices");
  choices.setAttribute("role", "radiogroup");
  choices.setAttribute("aria-label", "Rate OTNow from 1 to 5");
  for (let value = 1; value <= 5; value += 1) {
    const button = element("button", `rating-choice${globalStats.rating === value ? " selected" : ""}`, "★");
    button.type = "button";
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", String(globalStats.rating === value));
    button.setAttribute("aria-label", `${value} out of 5`);
    button.addEventListener("click", async () => {
      choices.classList.add("is-submitting");
      const response = await chrome.runtime.sendMessage({ type: "stats:rate", rating: value });
      if (!response?.ok) {
        choices.classList.remove("is-submitting");
        notice.hidden = false;
        notice.textContent = response?.error || "The rating could not be saved.";
        return;
      }
      current.globalStats = response.globalStats;
      render();
    });
    choices.append(button);
  }
  wrap.append(copy, choices);
  return wrap;
}

function actionLink(label, href, className = "insight-action") {
  const link = element("a", className, label);
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}

function renderTroubleshooting() {
  const section = element("section", "insight-panel insight-troubleshooting");
  section.append(
    element("h2", "insight-panel-title", "Help and feedback"),
    element("p", "", "Send general feedback anytime. For a bug or sync problem, copy the troubleshooting info first and paste it into the form. It never includes coursework, account details, URLs or login data."),
  );
  const status = element("p", "diagnostic-status");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.hidden = true;
  const actions = element("div", "insight-actions");
  const copy = element("button", "insight-action", "Copy troubleshooting info");
  copy.type = "button";
  copy.addEventListener("click", async () => {
    copy.disabled = true;
    const report = await buildDiagnosticReport();
    const copied = await copyText(report);
    status.hidden = false;
    status.textContent = copied
      ? "Troubleshooting info copied. Paste it into the feedback form."
      : "The report could not be copied. Try again or describe the problem manually.";
    copy.textContent = copied ? "Copied" : "Try copying again";
    copy.disabled = false;
  });
  actions.append(
    actionLink("Open feedback form", FEEDBACK_URL, "insight-action primary"),
    copy,
    actionLink("Report a security issue privately", SECURITY_REPORT_URL, "insight-link security-link"),
  );
  section.append(status, actions);
  return section;
}

function renderAbout() {
  const section = element("section", "insight-panel insight-about");
  section.append(
    element("h2", "insight-panel-title", "About and settings"),
    element("p", "", `Version ${chrome.runtime.getManifest().version} · Unofficial and independent from Ontario Tech University and Instructure.`),
  );
  const actions = element("div", "insight-links");
  const changes = element("button", "insight-link", "What's new");
  changes.type = "button";
  changes.addEventListener("click", () => {
    location.href = "../options/changelog.html?source=insights";
  });
  const settings = element("button", "insight-link", "Settings");
  settings.type = "button";
  settings.addEventListener("click", () => chrome.runtime.sendMessage({ type: "panel:open-options" }));
  actions.append(
    settings,
    changes,
    actionLink("Privacy", `${GLOBAL_STATS_ORIGIN}/privacy`, "insight-link"),
    actionLink("Chrome Web Store", CHROME_WEB_STORE_URL, "insight-link"),
    actionLink("GitHub", REPOSITORY_URL, "insight-link"),
  );
  section.append(actions);
  return section;
}

function renderInsights(metrics = {}, globalStats = {}, settings = {}) {
  const section = element("section", "insights");
  const header = element("div", "section-intro");
  header.append(
    element("h1", "", "Insights"),
    element("p", "", "A local summary of what OTNow has organized in this Chrome profile."),
  );

  const activity = element("section", "insight-activity");
  activity.append(element("h2", "insight-section-title", "Your activity"));
  const rows = element("div", "insight-list");
  rows.append(
    insightRow("Deadlines organized", metrics.deadlinesDiscovered, "Distinct dated Canvas items found"),
    insightRow("Changed dates caught", metrics.movedDeadlinesDetected, "Due-date changes detected after a refresh"),
    insightRow("Reminders delivered", metrics.remindersSent, "Deadline notifications created"),
    insightRow("Manual check-offs", metrics.manualCompletions, "Items marked complete inside OTNow"),
  );
  activity.append(rows);

  let statisticsChoice = null;
  if (!settings.shareAnonymousStats) {
    statisticsChoice = element("section", "statistics-choice");
    const statisticsCopy = element("div", "statistics-choice-copy");
    statisticsCopy.append(
      element("strong", "", "Help measure OTNow"),
      element("span", "", "Review the optional anonymous totals. OTNow works fully without sharing them."),
    );
    const statisticsButton = element("button", "insight-action", "Review anonymous statistics");
    statisticsButton.type = "button";
    statisticsButton.addEventListener("click", () => {
      location.href = "../options/onboarding.html?source=panel&from=insights";
    });
    statisticsChoice.append(statisticsCopy, statisticsButton);
  }

  const rating = renderRating(metrics, globalStats, settings);
  section.append(header, activity);
  if (statisticsChoice) section.append(statisticsChoice);
  if (rating) section.append(rating);
  section.append(renderTroubleshooting(), renderAbout());
  return section;
}

function renderReady(state, settings) {
  if (courseFilter !== "all" && !state.courses.some((course) => course.id === courseFilter)) courseFilter = "all";
  app.replaceChildren(renderViewTabs(state));
  const updateNotice = renderUpdateNotice(state.update);
  if (updateNotice) app.append(updateNotice);
  const statisticsPrompt = renderStatisticsPrompt(settings);
  if (statisticsPrompt) app.append(statisticsPrompt);
  const releaseNotePrompt = renderReleaseNotePrompt(settings);
  if (releaseNotePrompt) app.append(releaseNotePrompt);
  const announcementUndoNotice = renderAnnouncementUndoNotice();
  if (announcementUndoNotice) app.append(announcementUndoNotice);

  if (activeView === "courses") {
    app.append(renderCourseDirectory(state.courses, state.items));
    return;
  }
  if (activeView === "insights") {
    app.append(renderInsights(state.metrics, current.globalStats, settings));
    return;
  }

  if (activeView === "completed") {
    const completedItems = plannerItemsForView(state.items, "completed", current.announcementRead);
    app.append(renderCompleted(completedItems));
    return;
  }

  const allOpenItems = state.items.filter((item) => item.status === "open");
  const statusItems = plannerItemsForView(state.items, "deadlines", current.announcementRead);
  const courseItems = statusItems.filter((item) => courseFilter === "all" || item.courseId === courseFilter);
  const visibleItems = courseItems
    .filter((item) => typeFilter === "all" || item.type === typeFilter)
    .filter((item) => itemMatchesSearch(item, searchQueries.deadlines));
  const scopeAnnouncementIds = announcementIdsInScope(allOpenItems, courseFilter, current.announcementRead);
  const unreadAnnouncementIds = announcementIdsInScope(
    allOpenItems,
    courseFilter,
    current.announcementRead,
    { unreadOnly: true },
  );
  let emptyMessage = "No matching dated coursework.";
  if (searchQueries.deadlines) {
    emptyMessage = `No deadlines match “${searchQueries.deadlines}”.`;
  } else if (typeFilter === "announcement" && !scopeAnnouncementIds.length) {
    emptyMessage = courseFilter === "all"
      ? "Canvas returned no dated announcements."
      : "Canvas returned no dated announcements for this course.";
  } else if (typeFilter === "announcement" && !unreadAnnouncementIds.length) {
    emptyMessage = "All announcements in this scope are read. Find them in Completed.";
  }

  app.append(renderOverview(statusItems), renderControls(state.courses, statusItems));
  const announcementActions = renderAnnouncementActions(statusItems);
  if (announcementActions) app.append(announcementActions);
  const sourceNote = element("p", "source-note", "Announcements, assignments, quizzes, discussions, events, planner notes, and other dated Canvas items are included when Canvas returns them.");
  app.append(sourceNote, renderDeadlineGroups(visibleItems, emptyMessage));
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
  syncStatus.title = exactSync(state.lastSyncAt);
  syncStatus.setAttribute("aria-label", `${relativeSync(state.lastSyncAt)}. Last successful sync: ${exactSync(state.lastSyncAt)}.`);
  renderSyncNotice(state);

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

async function load({ recordOpen = false } = {}) {
  appVersion.textContent = `v${chrome.runtime.getManifest().version}`;
  current = await chrome.runtime.sendMessage({ type: "panel:get" });
  if (recordOpen) {
    const response = await chrome.runtime.sendMessage({ type: "panel:opened" });
    if (response?.state) current.state = response.state;
  }
  render();
  if (current.state.status === "idle") syncNow();
}

async function syncNow() {
  refreshButton.classList.remove("success");
  refreshButton.classList.add("spinning");
  refreshButton.disabled = true;
  const result = await chrome.runtime.sendMessage({ type: "panel:sync" });
  await load();
  if (result?.status !== "error") {
    refreshButton.classList.add("success");
    setTimeout(() => refreshButton.classList.remove("success"), 1400);
  }
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
  if (changes.announcementRead) current.announcementRead = changes.announcementRead.newValue || {};
  if (changes.releaseNoteSeen) current.releaseNoteSeen = changes.releaseNoteSeen.newValue || "";
  render();
});

configureSupportLink();
load({ recordOpen: true });
setInterval(() => {
  if (current.state) {
    syncStatus.textContent = relativeSync(current.state.lastSyncAt);
    syncStatus.title = exactSync(current.state.lastSyncAt);
    syncStatus.setAttribute("aria-label", `${relativeSync(current.state.lastSyncAt)}. Last successful sync: ${exactSync(current.state.lastSyncAt)}.`);
    renderSyncNotice(current.state);
  }
}, 60_000);
