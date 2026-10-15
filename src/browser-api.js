export const browserApi = globalThis.browser || globalThis.chrome;

export const IS_FIREFOX_BUILD = Boolean(
  browserApi?.runtime?.getManifest?.().browser_specific_settings?.gecko,
);

export function optionalStatsPermission(origin) {
  const request = { origins: [`${origin}/*`] };
  if (IS_FIREFOX_BUILD) request.data_collection = ["technicalAndInteraction"];
  return request;
}
