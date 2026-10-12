// Bump this ID whenever a meaningful local preview changes. Before a Store
// release, consolidate the preview notes and use the final version as the ID.
// Keep the voice thankful and personal, but vary the opening and milestone
// wording for each patch instead of turning this into a repeated template.
export const CURRENT_RELEASE_NOTE = Object.freeze({
  id: "1.6.0-local-20261012-06",
  version: "1.6.0",
  date: "October 12, 2026",
  label: "Local preview",
  title: "Thanks for supporting OTNow",
  community: Object.freeze({
    launchedAt: "2026-10-04",
    measuredAt: "2026-10-12",
    measuredAtLabel: "October 12, 2026",
    reportingInstallations: 12,
    totalItems: 781,
  }),
  summary: "This update gives you more room for deadlines, makes Completed easier to sort, and gets temporary messages out of the way.",
  items: Object.freeze([
    Object.freeze({
      title: "More room for deadlines",
      detail: "Organization controls can collapse and new installs group deadlines by date.",
    }),
    Object.freeze({
      title: "A better Completed view",
      detail: "Filter completed work by course or type, then group it by due date or type.",
    }),
    Object.freeze({
      title: "Quieter announcements",
      detail: "Read announcements leave Deadlines for Completed, while the floating Undo disappears after six seconds.",
    }),
    Object.freeze({
      title: "Optional statistics stay optional",
      detail: "The statistics request is now a small notification and never blocks the normal OTNow panel.",
    }),
    Object.freeze({
      title: "Clearer Canvas items",
      detail: "OTNow recognizes Canvas-declared announcements and discussion assignments without guessing from titles.",
    }),
  ]),
});

function exactNumber(value) {
  return new Intl.NumberFormat("en-CA").format(Number(value) || 0);
}

function elapsedDays(start, end) {
  const startTime = Date.parse(`${start}T00:00:00Z`);
  const endTime = Date.parse(`${end}T00:00:00Z`);
  return Math.max(0, Math.round((endTime - startTime) / 86_400_000));
}

export function releaseMilestoneMessage(note = CURRENT_RELEASE_NOTE) {
  const milestone = note.community;
  const days = elapsedDays(milestone.launchedAt, milestone.measuredAt);
  return `OTNow has only been out for ${days} days. So far, ${exactNumber(milestone.reportingInstallations)} installs are sharing anonymous stats, and together they have organized ${exactNumber(milestone.totalItems)} Canvas items. That's honestly crazy. Thanks for using OTNow, and keep spreading the word.`;
}

export function releasePromptMessage(note = CURRENT_RELEASE_NOTE) {
  const milestone = note.community;
  const days = elapsedDays(milestone.launchedAt, milestone.measuredAt);
  return `Only ${days} days in: ${exactNumber(milestone.reportingInstallations)} installs sharing anonymous stats and ${exactNumber(milestone.totalItems)} Canvas items organized. Thanks for using OTNow. Keep spreading the word, and see what changed.`;
}

export const FULL_CHANGELOG_URL = "https://github.com/sil6428/OTNow/blob/main/CHANGELOG.md";
