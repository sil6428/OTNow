export function normalizeDeadlineAdjustments(saved = {}) {
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
  const clean = {};
  for (const [itemId, dueAt] of Object.entries(saved)) {
    if (!itemId || typeof dueAt !== "string" || Number.isNaN(Date.parse(dueAt))) continue;
    clean[itemId] = new Date(dueAt).toISOString();
  }
  return clean;
}

export function restoreCanvasDeadlines(items = []) {
  return items.map((item) => {
    if (!item.deadlineAdjusted || !item.canvasDueAt) return item;
    const { canvasDueAt, deadlineAdjusted, ...rest } = item;
    return { ...rest, dueAt: canvasDueAt };
  });
}

export function applyDeadlineAdjustments(items = [], saved = {}) {
  const adjustments = normalizeDeadlineAdjustments(saved);
  return items.map((item) => {
    const dueAt = adjustments[item.id];
    if (!dueAt) return item;
    return {
      ...item,
      canvasDueAt: item.dueAt,
      dueAt,
      deadlineAdjusted: true,
    };
  });
}

export function reconcileDeadlineAdjustments(items = [], saved = {}) {
  const adjustments = normalizeDeadlineAdjustments(saved);
  const itemsById = new Map(items.map((item) => [item.id, item]));
  return Object.fromEntries(Object.entries(adjustments).filter(([itemId, dueAt]) => {
    const item = itemsById.get(itemId);
    return item && Date.parse(dueAt) > Date.parse(item.dueAt);
  }));
}
