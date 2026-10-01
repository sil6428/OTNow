import { GLOBAL_STATS_ORIGIN, TYPE_LABELS } from "../src/constants.js";

const theme = document.querySelector("#theme");
const showCompleted = document.querySelector("#show-completed");
const notifications = document.querySelector("#notifications");
const movedDates = document.querySelector("#moved-dates");
const leadSettings = document.querySelector("#lead-settings");
const courseSettings = document.querySelector("#course-settings");
const deleteData = document.querySelector("#delete-data");
const anonymousStats = document.querySelector("#anonymous-stats");
const statsStatus = document.querySelector("#stats-status");
const saved = document.querySelector("#saved");

const LEADS = [
  [-1, "Off"],
  [15, "15 minutes before"],
  [60, "1 hour before"],
  [180, "3 hours before"],
  [720, "12 hours before"],
  [1440, "1 day before"],
  [2880, "2 days before"],
  [10080, "1 week before"],
];
const types = ["assignment", "quiz", "discussion", "event", "note", "other"];
let settings;
let state;
let globalStats;
let saveTimer;

function applyTheme(value) {
  if (value === "light" || value === "dark") document.documentElement.dataset.theme = value;
  else delete document.documentElement.dataset.theme;
}

function flashSaved(text = "Saved") {
  saved.textContent = text;
  setTimeout(() => { if (saved.textContent === text) saved.textContent = ""; }, 1800);
}

async function persist() {
  settings = (await chrome.runtime.sendMessage({ type: "options:set", settings })).settings;
  flashSaved();
}

function queueSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 180);
}

function renderLeads() {
  leadSettings.replaceChildren();
  for (const type of types) {
    const row = document.createElement("div");
    row.className = "lead-row";
    const label = document.createElement("label");
    label.textContent = TYPE_LABELS[type];
    label.htmlFor = `lead-${type}`;
    const select = document.createElement("select");
    select.id = `lead-${type}`;
    for (const [value, text] of LEADS) {
      const option = document.createElement("option");
      option.value = String(value);
      option.textContent = text;
      select.append(option);
    }
    select.value = String(settings.reminderLeads[type]);
    select.addEventListener("change", () => {
      settings.reminderLeads[type] = Number(select.value);
      queueSave();
    });
    row.append(label, select);
    leadSettings.append(row);
  }
}

function renderCourses() {
  courseSettings.replaceChildren();
  for (const course of state.courses || []) {
    const row = document.createElement("label");
    row.className = "course-row";
    const name = document.createElement("span");
    name.className = "course-name";
    const code = document.createElement("strong");
    code.textContent = course.code;
    const detail = document.createElement("small");
    detail.textContent = course.name;
    name.append(code, detail);
    const enabled = document.createElement("input");
    enabled.type = "checkbox";
    enabled.checked = !settings.mutedCourseIds.includes(course.id);
    enabled.setAttribute("aria-label", `Enable reminders for ${course.code}`);
    enabled.addEventListener("change", () => {
      const muted = new Set(settings.mutedCourseIds);
      if (enabled.checked) muted.delete(course.id);
      else muted.add(course.id);
      settings.mutedCourseIds = [...muted];
      queueSave();
    });
    row.append(name, enabled);
    courseSettings.append(row);
  }
}

async function load() {
  ({ settings, state, globalStats } = await chrome.runtime.sendMessage({ type: "options:get" }));
  theme.value = settings.theme;
  applyTheme(settings.theme);
  showCompleted.checked = settings.showCompleted;
  notifications.checked = settings.notificationsEnabled;
  movedDates.checked = settings.notifyMovedDates;
  anonymousStats.checked = settings.shareAnonymousStats;
  if (globalStats.lastReportAt && settings.shareAnonymousStats) {
    statsStatus.textContent = `Last anonymous report: ${new Date(globalStats.lastReportAt).toLocaleString()}.`;
  } else if (globalStats.lastError && settings.shareAnonymousStats) {
    statsStatus.textContent = `Last report failed: ${globalStats.lastError}`;
  } else {
    statsStatus.textContent = "Anonymous global statistics are off.";
  }
  renderLeads();
  renderCourses();
}

theme.addEventListener("change", () => { settings.theme = theme.value; applyTheme(settings.theme); queueSave(); });
showCompleted.addEventListener("change", () => { settings.showCompleted = showCompleted.checked; queueSave(); });
notifications.addEventListener("change", () => { settings.notificationsEnabled = notifications.checked; queueSave(); });
movedDates.addEventListener("change", () => { settings.notifyMovedDates = movedDates.checked; queueSave(); });

anonymousStats.addEventListener("change", async () => {
  anonymousStats.disabled = true;
  try {
    if (anonymousStats.checked) {
      const granted = await chrome.permissions.request({ origins: [`${GLOBAL_STATS_ORIGIN}/*`] });
      if (!granted) throw new Error("Permission was not granted, so anonymous statistics remain off.");
      const response = await chrome.runtime.sendMessage({ type: "stats:enable" });
      if (!response?.ok) throw new Error(response?.error || "Could not enable anonymous statistics.");
      settings = response.settings;
      globalStats = response.globalStats;
      statsStatus.textContent = "Anonymous statistics are on. The first numerical report was sent successfully.";
      flashSaved("Anonymous statistics enabled");
    } else {
      const response = await chrome.runtime.sendMessage({ type: "stats:disable" });
      if (!response?.ok) throw new Error(response?.error || "Could not delete anonymous statistics.");
      settings = response.settings;
      globalStats = response.globalStats;
      await chrome.permissions.remove({ origins: [`${GLOBAL_STATS_ORIGIN}/*`] });
      statsStatus.textContent = "Anonymous statistics are off and this installation's aggregate row was deleted.";
      flashSaved("Anonymous statistics disabled");
    }
  } catch (error) {
    await load();
    statsStatus.textContent = String(error?.message || error);
  } finally {
    anonymousStats.disabled = false;
  }
});

deleteData.addEventListener("click", async () => {
  if (!confirm("Delete saved deadlines, settings, reminder history, Insights totals, and any opted-in anonymous statistics?")) return;
  const response = await chrome.runtime.sendMessage({ type: "options:delete-data" });
  if (!response?.ok) {
    flashSaved(response?.error || "Data could not be deleted");
    return;
  }
  flashSaved("OTNow data deleted");
  await load();
});

load();
