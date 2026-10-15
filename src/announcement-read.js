const RETENTION_MS = 180 * 24 * 60 * 60 * 1000;
const MAX_READ_ANNOUNCEMENTS = 500;

function validTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function normalizeAnnouncementRead(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([id, timestamp]) => id.startsWith("announcement:") && validTimestamp(timestamp))
      .sort((left, right) => Date.parse(right[1]) - Date.parse(left[1]))
      .slice(0, MAX_READ_ANNOUNCEMENTS),
  );
}

export function isAnnouncementRead(item, announcementRead = {}) {
  return item?.type === "announcement" && Boolean(announcementRead[item.id]);
}

export function filterReadAnnouncements(items = [], announcementRead = {}, showRead = false) {
  if (showRead) return [...items];
  return items.filter((item) => !isAnnouncementRead(item, announcementRead));
}

export function announcementIdsInScope(items = [], courseId = "all", announcementRead = {}, { unreadOnly = false } = {}) {
  return items
    .filter((item) => item?.type === "announcement")
    .filter((item) => courseId === "all" || item.courseId === courseId)
    .filter((item) => !unreadOnly || !announcementRead[item.id])
    .map((item) => item.id);
}

export function markAnnouncementsRead(previous = {}, itemIds = [], now = new Date()) {
  const next = normalizeAnnouncementRead(previous);
  const timestamp = now.toISOString();
  for (const id of new Set(itemIds)) {
    if (typeof id === "string" && id.startsWith("announcement:")) next[id] = timestamp;
  }
  return normalizeAnnouncementRead(next);
}

export function markAnnouncementsUnread(previous = {}, itemIds = []) {
  const next = normalizeAnnouncementRead(previous);
  for (const id of new Set(itemIds)) delete next[String(id)];
  return next;
}

export function pruneAnnouncementRead(previous = {}, items = [], now = new Date()) {
  const clean = normalizeAnnouncementRead(previous);
  const loaded = new Set(items.filter((item) => item?.type === "announcement").map((item) => item.id));
  const oldest = now.getTime() - RETENTION_MS;
  return normalizeAnnouncementRead(Object.fromEntries(
    Object.entries(clean).filter(([id, timestamp]) => loaded.has(id) || Date.parse(timestamp) >= oldest),
  ));
}
