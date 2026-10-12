// Bump this ID whenever a meaningful local preview changes. Before a Store
// release, consolidate the preview notes and use the final version as the ID.
export const CURRENT_RELEASE_NOTE = Object.freeze({
  id: "1.6.0-local-20261012-04",
  version: "1.6.0",
  date: "October 12, 2026",
  label: "Local preview",
  title: "What changed in OTNow 1.6",
  summary: "Filters take less space, Completed is easier to organize, and temporary notices now get out of the way.",
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

export const FULL_CHANGELOG_URL = "https://github.com/sil6428/OTNow/blob/main/CHANGELOG.md";
