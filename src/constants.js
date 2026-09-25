export const CANVAS_ORIGIN = "https://learn.ontariotechu.ca";

export const SYNC_ALARM = "otnow-sync";
export const REMINDER_ALARM = "otnow-reminders";
export const UPDATE_ALARM = "otnow-update-check";
export const SYNC_MINUTES = 30;
export const REMINDER_MINUTES = 5;
export const UPDATE_CHECK_MINUTES = 6 * 60;
export const UPDATE_CHECK_ENABLED = true;
export const MOVED_DATE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const REPOSITORY_URL = "https://github.com/sil6428/OTNow";
export const SUPPORT_URL = "";
export const UPDATE_MANIFEST_URL = "https://raw.githubusercontent.com/sil6428/OTNow/main/manifest.json";
export const UPDATE_GUIDE_URL = `${REPOSITORY_URL}/blob/main/UPDATE_GUIDE.md`;

export const DEFAULT_SETTINGS = {
  schemaVersion: 2,
  theme: "light",
  notificationsEnabled: true,
  notifyMovedDates: true,
  showCompleted: false,
  reminderLeads: {
    assignment: 24 * 60,
    quiz: 12 * 60,
    discussion: 12 * 60,
    event: 3 * 60,
    note: 24 * 60,
    other: 24 * 60,
  },
  mutedCourseIds: [],
};

export const TYPE_LABELS = {
  assignment: "Assignment",
  quiz: "Quiz",
  discussion: "Discussion",
  event: "Event",
  note: "Planner note",
  other: "Course item",
};

export const COURSE_COLORS = [
  "#0077ca",
  "#003c71",
  "#e75d2a",
  "#005793",
  "#5b6770",
  "#0f766e",
  "#7c3aed",
  "#15803d",
];
