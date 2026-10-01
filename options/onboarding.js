import { GLOBAL_STATS_ORIGIN } from "../src/constants.js";

const share = document.querySelector("#share");
const decline = document.querySelector("#decline");
const status = document.querySelector("#status");

chrome.runtime.sendMessage({ type: "stats:onboarding-opened" }).catch(() => {});

function busy(value) {
  share.disabled = value;
  decline.disabled = value;
}

share.addEventListener("click", async () => {
  busy(true);
  status.textContent = "Waiting for Chrome permission…";
  try {
    const granted = await chrome.permissions.request({ origins: [`${GLOBAL_STATS_ORIGIN}/*`] });
    if (!granted) {
      status.textContent = "Permission was not granted. Nothing was shared; you can enable it later in Settings.";
      busy(false);
      return;
    }
    const response = await chrome.runtime.sendMessage({ type: "stats:enable" });
    if (!response?.ok) throw new Error(response?.error || "Anonymous statistics could not be enabled.");
    status.textContent = "Anonymous statistics are enabled. You can close this tab.";
  } catch (error) {
    status.textContent = String(error?.message || error);
    busy(false);
  }
});

decline.addEventListener("click", async () => {
  busy(true);
  const response = await chrome.runtime.sendMessage({ type: "stats:onboarding-decline" });
  if (!response?.ok) {
    status.textContent = response?.error || "Your choice could not be saved.";
    busy(false);
    return;
  }
  status.textContent = "Nothing was shared. You can close this tab or enable it later in Settings.";
});
