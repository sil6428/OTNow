import { TYPE_LABELS } from "../src/constants.js";

const theme = document.querySelector("#theme");
const showCompleted = document.querySelector("#show-completed");
const notifications = document.querySelector("#notifications");
const movedDates = document.querySelector("#moved-dates");
const leadSettings = document.querySelector("#lead-settings");
const courseSettings = document.querySelector("#course-settings");
const deleteData = document.querySelector("#delete-data");
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
  ({ settings, state } = await chrome.runtime.sendMessage({ type: "options:get" }));
  theme.value = settings.theme;
  applyTheme(settings.theme);
  showCompleted.checked = settings.showCompleted;
  notifications.checked = settings.notificationsEnabled;
  movedDates.checked = settings.notifyMovedDates;
  renderLeads();
  renderCourses();
}

theme.addEventListener("change", () => { settings.theme = theme.value; applyTheme(settings.theme); queueSave(); });
showCompleted.addEventListener("change", () => { settings.showCompleted = showCompleted.checked; queueSave(); });
notifications.addEventListener("change", () => { settings.notificationsEnabled = notifications.checked; queueSave(); });
movedDates.addEventListener("change", () => { settings.notifyMovedDates = movedDates.checked; queueSave(); });

deleteData.addEventListener("click", async () => {
  if (!confirm("Delete OTNow's saved deadlines, settings, and reminder history from this computer?")) return;
  await chrome.runtime.sendMessage({ type: "options:delete-data" });
  flashSaved("Local data deleted");
  await load();
});

load();
