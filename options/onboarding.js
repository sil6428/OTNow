import { GLOBAL_STATS_ORIGIN } from "../src/constants.js";

const share = document.querySelector("#share");
const decline = document.querySelector("#decline");
const status = document.querySelector("#status");
const actions = document.querySelector("#actions");
const success = document.querySelector("#success");
const successHeading = document.querySelector("#success-heading");
const successCopy = document.querySelector("#success-copy");
const statsLink = document.querySelector("#stats-link");

statsLink.href = `${GLOBAL_STATS_ORIGIN}/dashboard`;

chrome.runtime.sendMessage({ type: "stats:onboarding-opened" }).catch(() => {});

function busy(value) {
  share.disabled = value;
  decline.disabled = value;
}

function ordinal(value) {
  const number = Number(value);
  const remainder = number % 100;
  if (remainder >= 11 && remainder <= 13) return `${number}th`;
  if (number % 10 === 1) return `${number}st`;
  if (number % 10 === 2) return `${number}nd`;
  if (number % 10 === 3) return `${number}rd`;
  return `${number}th`;
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
    status.textContent = "Permission granted. Adding your anonymous signal…";
    const response = await chrome.runtime.sendMessage({ type: "stats:enable" });
    if (!response?.ok) throw new Error(response?.error || "Anonymous statistics could not be enabled.");
    const position = Number(response.report?.reportingPosition);
    if (Number.isSafeInteger(position) && position > 0) {
      successHeading.textContent = `You are the ${ordinal(position)} person to opt in.`;
      successCopy.textContent = `Your light is now signal #${position} in the public OTNow community field.`;
    }
    actions.hidden = true;
    success.hidden = false;
    status.textContent = "Anonymous statistics are enabled. You can view the public totals or close this tab.";
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
  actions.hidden = true;
});
