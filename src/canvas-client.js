import { CANVAS_ORIGIN } from "./constants.js";
import { normalizeCourse, normalizePlannerItem, parseNextLink } from "./canvas-model.js";

const ALLOWED_PATHS = [
  /^\/api\/v1\/planner\/items(?:\?|$)/,
  /^\/api\/v1\/courses(?:\?|$)/,
];

function assertAllowed(path) {
  if (path.includes("..") || !ALLOWED_PATHS.some((pattern) => pattern.test(path))) {
    const error = new Error("Blocked an unexpected Canvas API path");
    error.code = "blocked-path";
    throw error;
  }
}

async function directFetch(path) {
  try {
    const response = await fetch(`${CANVAS_ORIGIN}${path}`, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const type = response.headers.get("content-type") || "";
    const output = {
      status: response.status,
      redirected: response.redirected,
      loginRedirect: /\/login(?:\?|$)/i.test(response.url || ""),
      type,
      link: response.headers.get("link"),
    };
    if (response.ok && type.includes("json")) output.json = await response.json();
    return output;
  } catch (error) {
    return { status: 0, error: String(error?.message || error) };
  }
}

async function tabFetch(path) {
  let tabs = [];
  try {
    tabs = await chrome.tabs.query({ url: `${CANVAS_ORIGIN}/*` });
  } catch {
    return { status: 0, noTab: true };
  }
  tabs.sort((left, right) => Number(right.active) - Number(left.active)
    || (right.lastAccessed || 0) - (left.lastAccessed || 0));
  for (const tab of tabs) {
    if (!tab.id || tab.discarded) continue;
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { type: "canvas:fetch", path });
      if (response) return response;
    } catch {
      // Tabs opened before the extension was installed need one reload.
    }
  }
  return { status: 0, noTab: true };
}

async function request(path) {
  assertAllowed(path);
  let response = await directFetch(path);
  if (!response?.json) {
    const throughTab = await tabFetch(path);
    if (throughTab?.json || throughTab?.status) response = throughTab;
  }

  if (response?.loginRedirect || response?.status === 401 || response?.status === 403) {
    const error = new Error("Sign in to Ontario Tech Canvas, then try again.");
    error.code = "signed-out";
    throw error;
  }
  if (response?.noTab && !response?.status) {
    const error = new Error("Open Ontario Tech Canvas once so OTNow can read your deadlines.");
    error.code = "no-tab";
    throw error;
  }
  if (!response || response.status < 200 || response.status >= 300 || !response.json) {
    const error = new Error(`Canvas could not be read${response?.status ? ` (HTTP ${response.status})` : ""}.`);
    error.code = navigator.onLine ? "unreachable" : "offline";
    throw error;
  }
  return response;
}

async function paginated(path, maxPages = 20) {
  const output = [];
  let next = path;
  let page = 0;
  while (next && page < maxPages) {
    const response = await request(next);
    if (!Array.isArray(response.json)) {
      const error = new Error("Canvas returned an unexpected response.");
      error.code = "unexpected-response";
      throw error;
    }
    output.push(...response.json);
    next = parseNextLink(response.link);
    page += 1;
  }
  return output;
}

function plannerWindow(now = new Date()) {
  const start = new Date(now);
  start.setDate(start.getDate() - 60);
  const end = new Date(now);
  end.setDate(end.getDate() + 365);
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function readCanvas(manualDone = {}, now = new Date()) {
  const rawCourses = await paginated("/api/v1/courses?enrollment_state=active&include%5B%5D=term&per_page=100");
  const courses = rawCourses
    .filter((course) => !course.access_restricted_by_date)
    .map(normalizeCourse);
  const coursesById = Object.fromEntries(courses.map((course) => [course.id, course]));
  const { start, end } = plannerWindow(now);
  const query = new URLSearchParams({ start_date: start, end_date: end, per_page: "100" });
  const rawItems = await paginated(`/api/v1/planner/items?${query}`);
  const items = rawItems
    .map((raw) => normalizePlannerItem(raw, coursesById, manualDone))
    .filter(Boolean)
    .sort((left, right) => Date.parse(left.dueAt) - Date.parse(right.dueAt));
  return { courses, items };
}
