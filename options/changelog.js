import { CURRENT_RELEASE_NOTE, FULL_CHANGELOG_URL, releaseMilestoneMessage } from "../src/release-notes.js";

document.querySelector("#release-label").textContent = CURRENT_RELEASE_NOTE.label;
document.querySelector("#release-title").textContent = CURRENT_RELEASE_NOTE.title;
document.querySelector("#community-message").textContent = releaseMilestoneMessage();
document.querySelector("#release-summary").textContent = CURRENT_RELEASE_NOTE.summary;
document.querySelector("#community-note").textContent = `Exact anonymous opt-in snapshot from ${CURRENT_RELEASE_NOTE.community.measuredAtLabel}; it does not represent every OTNow user.`;
document.querySelector("#release-version").textContent = `Version ${CURRENT_RELEASE_NOTE.version}`;
document.querySelector("#release-date").textContent = CURRENT_RELEASE_NOTE.date;
document.querySelector("#full-changelog").href = FULL_CHANGELOG_URL;

const list = document.querySelector("#change-list");
for (const change of CURRENT_RELEASE_NOTE.items) {
  const item = document.createElement("li");
  const copy = document.createElement("div");
  const title = document.createElement("strong");
  const detail = document.createElement("span");
  title.textContent = change.title;
  detail.textContent = change.detail;
  copy.append(title, detail);
  item.append(copy);
  list.append(item);
}
