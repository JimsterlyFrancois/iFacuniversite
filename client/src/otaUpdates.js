import { Capacitor } from "@capacitor/core";
import { LiveUpdate } from "@capawesome/capacitor-live-update";
import { getOtaRetryDelay, validateOtaManifest } from "./otaManifest.js";

const MANIFEST_URL = "https://i-facuniversite.vercel.app/ota/latest.json";
const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;
const MANIFEST_TIMEOUT_MS = 15000;

let readyPromise = null;
let updateCheckPromise = null;
let lastSuccessfulCheckAt = 0;
let consecutiveFailures = 0;
let retryTimer = null;

function isSupportedNativeApp() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

function isAppVisible() {
  return typeof document === "undefined" || document.visibilityState !== "hidden";
}

async function markCurrentBundleReady() {
  if (!readyPromise) {
    readyPromise = LiveUpdate.ready()
      .then(result => {
        console.info("[iFac OTA] Bundle prêt.", {
          currentBundleId: result?.currentBundleId ?? "default",
          previousBundleId: result?.previousBundleId ?? null,
          rollback: Boolean(result?.rollback)
        });
        return result;
      })
      .catch(error => {
        console.warn("[iFac OTA] Impossible de confirmer le bundle courant.", error);
        return null;
      });
  }
  return readyPromise;
}

function scheduleRetry() {
  if (retryTimer !== null || typeof window === "undefined") return;

  const delay = getOtaRetryDelay(consecutiveFailures);
  retryTimer = window.setTimeout(() => {
    retryTimer = null;
    void checkForUpdate(true);
  }, delay);
  console.info(`[iFac OTA] Nouvelle tentative dans ${Math.round(delay / 1000)} s.`);
}

async function checkForUpdate(force = false) {
  if (!isSupportedNativeApp() || !isAppVisible()) return;
  if (updateCheckPromise) return updateCheckPromise;
  if (!force && lastSuccessfulCheckAt && Date.now() - lastSuccessfulCheckAt < UPDATE_CHECK_INTERVAL_MS) return;

  updateCheckPromise = (async () => {
    try {
      // The plugin must acknowledge the running bundle before an update can be staged.
      await markCurrentBundleReady();

      const url = new URL(MANIFEST_URL);
      url.searchParams.set("_", String(Date.now()));

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), MANIFEST_TIMEOUT_MS);
      let response;
      try {
        response = await fetch(url.href, {
          method: "GET",
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: controller.signal
        });
      } finally {
        window.clearTimeout(timeout);
      }

      if (!response.ok) throw new Error(`ota_manifest_http_${response.status}`);

      const manifest = validateOtaManifest(await response.json());
      if (!manifest) throw new Error("ota_manifest_invalid");

      const [current, next] = await Promise.all([
        LiveUpdate.getCurrentBundle(),
        LiveUpdate.getNextBundle()
      ]);

      if (current?.bundleId === manifest.bundleId || next?.bundleId === manifest.bundleId) {
        lastSuccessfulCheckAt = Date.now();
        consecutiveFailures = 0;
        return;
      }

      const downloaded = await LiveUpdate.getBundles();
      const downloadedIds = Array.isArray(downloaded?.bundleIds) ? downloaded.bundleIds : [];

      if (!downloadedIds.includes(manifest.bundleId)) {
        await LiveUpdate.downloadBundle({
          url: manifest.url,
          bundleId: manifest.bundleId,
          checksum: manifest.checksum,
          signature: manifest.signature
        });
      }

      await LiveUpdate.setNextBundle({ bundleId: manifest.bundleId });
      lastSuccessfulCheckAt = Date.now();
      consecutiveFailures = 0;

      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
        retryTimer = null;
      }

      console.info("[iFac OTA] Mise à jour téléchargée et vérifiée. Elle sera activée à la prochaine ouverture complète de l’application.");
    } catch (error) {
      consecutiveFailures += 1;
      console.warn("[iFac OTA] Vérification ou téléchargement impossible.", error);
      scheduleRetry();
    } finally {
      updateCheckPromise = null;
    }
  })();

  return updateCheckPromise;
}

export function initializeOtaUpdates() {
  if (!isSupportedNativeApp()) return undefined;

  void markCurrentBundleReady().then(() => checkForUpdate(true));

  const checkOnResume = () => {
    if (isAppVisible()) void checkForUpdate(consecutiveFailures > 0);
  };
  const checkOnOnline = () => {
    consecutiveFailures = Math.max(consecutiveFailures, 1);
    void checkForUpdate(true);
  };

  window.addEventListener("focus", checkOnResume);
  window.addEventListener("online", checkOnOnline);
  document.addEventListener("visibilitychange", checkOnResume);

  return () => {
    window.removeEventListener("focus", checkOnResume);
    window.removeEventListener("online", checkOnOnline);
    document.removeEventListener("visibilitychange", checkOnResume);
    if (retryTimer !== null) {
      window.clearTimeout(retryTimer);
      retryTimer = null;
    }
  };
}
