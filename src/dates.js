const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function startOfWeek(value = new Date()) {
  const date = startOfDay(value);
  const mondayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - mondayOffset);
  return date;
}

export function endOfWeek(value = new Date()) {
  const date = startOfWeek(value);
  date.setDate(date.getDate() + 6);
  date.setHours(23, 59, 59, 999);
  return date;
}

export function addDays(value, amount) {
  const date = new Date(value);
  date.setDate(date.getDate() + amount);
  return date;
}

export function sameDay(a, b) {
  const left = new Date(a);
  const right = new Date(b);
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

export function bucketFor(item, now = new Date()) {
  const due = new Date(item.dueAt);
  if (item.status !== "open") return "completed";
  if (due < now) return "overdue";
  if (sameDay(due, now)) return "today";
  if (due <= endOfWeek(now)) return "week";
  const nextWeekEnd = addDays(endOfWeek(now), 7);
  if (due <= nextWeekEnd) return "next";
  return "later";
}

export function relativeDue(iso, now = new Date()) {
  const due = new Date(iso);
  const delta = due.getTime() - now.getTime();
  const abs = Math.abs(delta);
  if (delta < 0) {
    if (abs < 60 * 60 * 1000) return `${Math.max(1, Math.round(abs / 60000))}m late`;
    if (abs < DAY_MS) return `${Math.round(abs / 3600000)}h late`;
    return `${Math.round(abs / DAY_MS)}d late`;
  }
  if (delta < 60 * 60 * 1000) return `in ${Math.max(1, Math.round(delta / 60000))}m`;
  if (delta < DAY_MS) return `in ${Math.round(delta / 3600000)}h`;
  return `in ${Math.round(delta / DAY_MS)}d`;
}

export function formatDate(iso, options = {}) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...options,
  }).format(new Date(iso));
}

export function formatTime(iso) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}
