# Updating OTNow

OTNow checks its public GitHub repository for a newer version about every six hours while Chrome is running. It compares only version numbers. If a newer release exists, the side panel displays an **Update steps** button that opens this guide.

Because OTNow is installed as an unpacked extension, Chrome cannot replace its files automatically. Updating the same folder keeps the extension identity and local settings intact.

## Step-by-step update

1. Open the [latest OTNow release](https://github.com/sil6428/OTNow/releases/latest).
2. Under **Assets**, download the ZIP named `otnow-VERSION.zip`.
3. Close the OTNow side panel.
4. Find the folder from which OTNow is currently loaded. Keep using this same folder so Chrome preserves the same unpacked extension and its settings.
5. Right-click the downloaded ZIP and choose **Extract All**.
6. Open the extracted folder and confirm that `manifest.json` is at its top level.
7. Copy all extracted files and folders into the existing OTNow folder. Choose **Replace the files in the destination** when Windows asks.
8. In Chrome, open `chrome://extensions`.
9. Find **OTNow** and select **Reload**.
10. Reopen OTNow. Confirm the version shown in its footer matches the latest release.

## If the version did not change

- Confirm that you replaced files in the exact folder Chrome originally loaded.
- Confirm that `manifest.json` is directly inside that folder rather than nested one folder deeper.
- Return to `chrome://extensions` and select **Reload** again.
- Avoid removing and reinstalling OTNow unless necessary, because removing an extension can delete its locally stored settings.

Only download OTNow updates from [the official repository](https://github.com/sil6428/OTNow).
