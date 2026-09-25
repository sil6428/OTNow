# Install OTNow from GitHub

OTNow is being prepared for the Chrome Web Store. Until the store listing is available, install the packaged GitHub release using the steps below.

## Download the correct file

1. Open the [latest OTNow release](https://github.com/sil6428/OTNow/releases/latest).
2. Scroll to **Assets**.
3. Download the file named `otnow-X.Y.Z.zip`, where `X.Y.Z` is the current version number.

Do not download either of GitHub's automatically generated **Source code** files, and do not use the green **Code > Download ZIP** button. Those archives put the extension inside an extra folder, which makes it easy to select the wrong folder in Chrome.

## Add OTNow to Chrome

1. Right-click `otnow-X.Y.Z.zip` and select **Extract All**.
2. Open the extracted folder.
3. Confirm that `manifest.json` is directly visible beside the `icons`, `options`, `panel`, and `src` folders.
4. Open `chrome://extensions` in Chrome.
5. Turn on **Developer mode** in the top-right corner.
6. Select **Load unpacked**.
7. Choose the folder where `manifest.json` is directly visible.
8. Pin OTNow, open [Ontario Tech Canvas](https://learn.ontariotechu.ca), and select the OTNow toolbar icon.

If Canvas was already open, reload that tab once after installing OTNow.

## If Chrome reports a manifest error

The selected folder is probably one level too high. Open the selected folder and look for the folder that directly contains `manifest.json`, then try **Load unpacked** again.

If the downloaded file is named `OTNow-main.zip` or the release page labels it **Source code**, delete it and download `otnow-X.Y.Z.zip` from **Assets** instead.

## Updating later

Copies installed from GitHub update manually. Follow [UPDATE_GUIDE.md](UPDATE_GUIDE.md) to replace the files without losing the extension's local settings. Chrome Web Store copies will update automatically after the store version is available.
