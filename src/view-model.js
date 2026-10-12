import { bucketFor } from "./dates.js";

export const DATE_GROUPS = [
  ["overdue", "Overdue"],
  ["today", "Today"],
  ["week", "This week"],
  ["next", "Next week"],
  ["later", "Later"],
  ["completed", "Completed"],
];

export const TYPE_GROUPS = [
  ["announcement", "Announcements"],
  ["assignment", "Assignments"],
  ["quiz", "Quizzes"],
  ["discussion", "Discussions"],
  ["event", "Events"],
  ["note", "Planner notes"],
  ["other", "Other items"],
];

export const COMPLETED_DATE_GROUPS = [
  ["upcoming", "Due later"],
  ["recent", "Due in the last 7 days"],
  ["month", "Due earlier this month"],
  ["older", "Due before this month"],
];

export function groupPlannerItems(items, mode = "type", now = new Date()) {
  const definitions = mode === "date" ? DATE_GROUPS : TYPE_GROUPS;
  return definitions
    .map(([id, label]) => ({
      id,
      label,
      items: items
        .filter((item) => (mode === "date" ? bucketFor(item, now) : item.type) === id)
        .sort((left, right) => Date.parse(left.dueAt) - Date.parse(right.dueAt)),
    }))
    .filter((group) => group.items.length > 0);
}

function startOfDay(value) {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function completedDateBucket(item, now = new Date()) {
  const dueAt = new Date(item?.dueAt);
  if (Number.isNaN(dueAt.getTime())) return "older";
  if (dueAt.getTime() > now.getTime()) return "upcoming";
  const daysAgo = Math.floor((startOfDay(now) - startOfDay(dueAt)) / 86_400_000);
  if (daysAgo < 7) return "recent";
  if (dueAt.getFullYear() === now.getFullYear() && dueAt.getMonth() === now.getMonth()) return "month";
  return "older";
}

export function groupCompletedItems(items, mode = "date", now = new Date()) {
  const definitions = mode === "type" ? TYPE_GROUPS : COMPLETED_DATE_GROUPS;
  return definitions
    .map(([id, label]) => ({
      id,
      label,
      items: items
        .filter((item) => (mode === "type" ? item.type : completedDateBucket(item, now)) === id)
        .sort((left, right) => Date.parse(right.dueAt) - Date.parse(left.dueAt)),
    }))
    .filter((group) => group.items.length > 0);
}

export function countPlannerTypes(items) {
  const counts = Object.fromEntries(TYPE_GROUPS.map(([id]) => [id, 0]));
  for (const item of items) counts[item.type in counts ? item.type : "other"] += 1;
  return counts;
}

export function plannerItemsForView(items = [], view = "deadlines") {
  if (view === "completed") return items.filter((item) => item.status !== "open");
  return items.filter((item) => item.status === "open");
}

export function completionSource(item = {}) {
  if (item.submitted || item.canvasComplete) return "canvas";
  if (item.manuallyComplete || item.status === "done") return "otnow";
  return null;
}
