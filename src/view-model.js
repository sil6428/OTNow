import { TYPE_LABELS } from "./constants.js";
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
  ["assignment", TYPE_LABELS.assignment],
  ["quiz", TYPE_LABELS.quiz],
  ["discussion", TYPE_LABELS.discussion],
  ["event", TYPE_LABELS.event],
  ["note", TYPE_LABELS.note],
  ["other", TYPE_LABELS.other],
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

export function countPlannerTypes(items) {
  const counts = Object.fromEntries(TYPE_GROUPS.map(([id]) => [id, 0]));
  for (const item of items) counts[item.type in counts ? item.type : "other"] += 1;
  return counts;
}
