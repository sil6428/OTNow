export function versionParts(version) {
  const match = String(version || "").trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  return match ? match.slice(1).map(Number) : null;
}

export function compareVersions(left, right) {
  const leftParts = versionParts(left);
  const rightParts = versionParts(right);
  if (!leftParts || !rightParts) throw new Error("OTNow received an invalid version number.");
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] > rightParts[index] ? 1 : -1;
  }
  return 0;
}

export function readPublishedVersion(manifest) {
  if (!manifest || manifest.name !== "OTNow" || !versionParts(manifest.version)) {
    throw new Error("The OTNow repository returned an invalid manifest.");
  }
  return manifest.version;
}
