import { CANVAS_ORIGIN, COURSE_COLORS, MOVED_DATE_TTL_MS } from "./constants.js";

const COMPLETED_WORKFLOW_STATES = new Set(["submitted", "graded", "pending_review", "complete", "completed"]);

export function normalizeType(value = "") {
  const type = String(value).toLowerCase();
  if (type.includes("quiz")) return "quiz";
  if (type.includes("discussion")) return "discussion";
  if (type.includes("assignment")) return "assignment";
  if (type.includes("calendar") || type.includes("event")) return "event";
  if (type.includes("note")) return "note";
  return "other";
}

export function dueAtFor(raw) {
  const value = raw?.plannable || {};
  return value.due_at
    || value.todo_date
    || value.end_at
    || raw?.plannable_date
    || raw?.due_at
    || null;
}

function titleFor(raw) {
  const value = raw?.plannable || {};
  return value.title || value.name || value.message || value.description || "Untitled Canvas item";
}

function absoluteCanvasUrl(value) {
  if (!value) return CANVAS_ORIGIN;
  try {
    return new URL(value, CANVAS_ORIGIN).href;
  } catch {
    return CANVAS_ORIGIN;
  }
}

export function submissionComplete(submissions) {
  if (!submissions || typeof submissions !== "object") return false;
  const workflow = String(submissions.workflow_state || "").toLowerCase();
  return Boolean(
    submissions.submitted
    || submissions.submitted_at
    || submissions.graded
    || submissions.needs_grading
    || COMPLETED_WORKFLOW_STATES.has(workflow)
  );
}

export function normalizeCourse(raw, index = 0) {
  const id = String(raw.id);
  return {
    id,
    code: raw.course_code || raw.code || raw.name || `Course ${id}`,
    name: raw.name || raw.course_code || `Course ${id}`,
    color: COURSE_COLORS[index % COURSE_COLORS.length],
  };
}

export function normalizePlannerItem(raw, coursesById = {}, manualDone = {}) {
  const dueAt = dueAtFor(raw);
  if (!dueAt || Number.isNaN(Date.parse(dueAt))) return null;

  const courseId = raw.course_id == null ? "personal" : String(raw.course_id);
  const type = normalizeType(raw.plannable_type);
  const id = `${raw.plannable_type || "item"}:${raw.plannable_id}`;
  const submitted = submissionComplete(raw.submissions);
  const canvasComplete = Boolean(raw.planner_override?.marked_complete);
  const manuallyComplete = Boolean(manualDone[id]);
  const course = coursesById[courseId];

  return {
    id,
    canvasId: String(raw.plannable_id),
    courseId,
    courseCode: course?.code || raw.context_name || "Canvas",
    courseName: course?.name || raw.context_name || "Canvas",
    color: course?.color || COURSE_COLORS[0],
    title: titleFor(raw),
    type,
    dueAt: new Date(dueAt).toISOString(),
    url: absoluteCanvasUrl(raw.html_url || raw.plannable?.html_url),
    status: submitted ? "submitted" : (canvasComplete || manuallyComplete ? "done" : "open"),
    submitted,
    canvasComplete,
    manuallyComplete,
    moved: null,
  };
}

export function mergePlannerItems(previousItems = [], nextItems = [], now = new Date()) {
  const previousById = new Map(previousItems.map((item) => [item.id, item]));
  const moved = [];
  const items = nextItems.map((item) => {
    const previous = previousById.get(item.id);
    if (!previous) return item;
    if (Date.parse(previous.dueAt) !== Date.parse(item.dueAt)) {
      const next = { ...item, moved: { from: previous.dueAt, at: now.toISOString() } };
      moved.push(next);
      return next;
    }
    if (previous.moved && now.getTime() - Date.parse(previous.moved.at) <= MOVED_DATE_TTL_MS) {
      return { ...item, moved: previous.moved };
    }
    return item;
  });
  return { items, moved };
}

export function parseNextLink(header, expectedOrigin = CANVAS_ORIGIN) {
  if (!header) return null;
  for (const part of header.split(",")) {
    const match = part.match(/<([^>]+)>;\s*rel="?next"?/i);
    if (!match) continue;
    try {
      const url = new URL(match[1], expectedOrigin);
      if (url.origin !== expectedOrigin || !url.pathname.startsWith("/api/v1/")) return null;
      return `${url.pathname}${url.search}`;
    } catch {
      return null;
    }
  }
  return null;
}
