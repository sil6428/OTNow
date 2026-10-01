# Install OTNow

OTNow v1.5.0 has been submitted to the Chrome Web Store for review. After approval, the Chrome Web Store will be the preferred option because it provides one-click installation, automatic updates, no Developer mode, no unpacked extension folder to maintain, and Chrome-managed package delivery.

Until the listing is published, install the packaged GitHub release using the steps below. Manual GitHub installation will remain available afterward for development and users who specifically prefer it.

## Download the correct file

1. Open the [latest OTNow release](https://github.com/sil6428/OTNow/releases/latest).
2. Scroll to **Assets**.
3. Download the file named `otnow-X.Y.Z.zip`, where `X.Y.Z` is the current version number.

Do not download either of GitHub's automatically generated **Source code** files, and do not use the green **Code > Download ZIP** button. Those archives put the extension inside an extra folder, which makes it easy to select the wrong folder in Chrome.

## Add OTNow to Chrome

1. Right-click `otnow-X.Y.Z.zip` and select **Extract All**.
2. Move the extracted folder to a stable location that you will keep, such as `Documents\OTNow`. Do not leave the only copy in a temporary Downloads folder.
3. Open that stable folder and confirm that `manifest.json` is directly visible beside the `icons`, `options`, `panel`, and `src` folders.
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

Copies installed from GitHub update manually, but they do not need to be removed or installed again. Follow [UPDATE_GUIDE.md](UPDATE_GUIDE.md) to replace the files in the same folder and select **Reload**. Chrome Web Store copies update automatically after the store version is available.
