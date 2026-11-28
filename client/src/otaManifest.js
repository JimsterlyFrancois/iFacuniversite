export const OTA_MANIFEST_ORIGIN = "https://i-facuniversite.vercel.app";
export const OTA_NATIVE_COMPATIBILITY = "ifac-android-live-update-v1";
export const OTA_RETRY_BASE_MS = 15000;
export const OTA_RETRY_MAX_MS = 5 * 60 * 1000;

export function validateOtaManifest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (value.schemaVersion !== 1 || value.platform !== "android") return null;
  if (value.nativeCompatibility !== OTA_NATIVE_COMPATIBILITY) return null;
  if (typeof value.bundleId !== "string" || !/^[a-f0-9]{40,64}$/i.test(value.bundleId)) return null;
  if (typeof value.checksum !== "string" || !/^[a-f0-9]{64}$/i.test(value.checksum)) return null;
  if (typeof value.signature !== "string" || value.signature.length < 500 || value.signature.length > 1200) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value.signature)) return null;

  let expectedUrl;
  try {
    expectedUrl = new URL(`/ota/bundles/${value.bundleId}.zip`, OTA_MANIFEST_ORIGIN).href;
  } catch {
    return null;
  }
  if (value.url !== expectedUrl) return null;

  return value;
}

export function getOtaRetryDelay(failureCount) {
  const failures = Number.isFinite(Number(failureCount)) ? Math.max(1, Math.floor(Number(failureCount))) : 1;
  const exponent = Math.min(failures - 1, 5);
  return Math.min(OTA_RETRY_BASE_MS * (2 ** exponent), OTA_RETRY_MAX_MS);
}
