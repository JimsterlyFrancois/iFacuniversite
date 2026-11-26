import { Capacitor } from "@capacitor/core";
import { LiveUpdate } from "@capawesome/capacitor-live-update";

const MANIFEST_URL = "https://i-facuniversite.vercel.app/ota/latest.json";
const MANIFEST_ORIGIN = "https://i-facuniversite.vercel.app";
const NATIVE_COMPATIBILITY = "ifac-android-live-update-v1";
const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;

let readyPromise = null;
let updateCheckPromise = null;
let lastUpdateCheckAt = 0;

function isSupportedNativeApp() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

function validateManifest(value) {
  if (!value || typeof value !== "object") return null;
  if (value.schemaVersion !== 1 || value.platform !== "android") return null;
  if (value.nativeCompatibility !== NATIVE_COMPATIBILITY) return null;
  if (typeof value.bundleId !== "string" || !/^[a-f0-9]{40,64}$/i.test(value.bundleId)) return null;
  if (typeof value.checksum !== "string" || !/^[a-f0-9]{64}$/i.test(value.checksum)) return null;
  if (typeof value.signature !== "string" || value.signature.length < 500 || value.signature.length > 1200) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value.signature)) return null;

  const expectedUrl = new URL("/ota/bundles/" + value.bundleId + ".zip", MANIFEST_ORIGIN).href;
  if (value.url !== expectedUrl) return null;

  return value;
}

async function markCurrentBundleReady() {
  if (!readyPromise) {
    readyPromise = LiveUpdate.ready().catch(error => {
      console.warn("[iFac OTA] Impossible de confirmer le démarrage du bundle courant.", error);
      return null;
    });
  }
  return readyPromise;
}

async function checkForUpdate(force = false) {
  if (!isSupportedNativeApp() || document.visibilityState === "hidden") return;
  if (updateCheckPromise) return updateCheckPromise;
  if (!force && Date.now() - lastUpdateCheckAt < UPDATE_CHECK_INTERVAL_MS) return;

  lastUpdateCheckAt = Date.now();
  updateCheckPromise = (async () => {
    try {
      const url = new URL(MANIFEST_URL);
      url.searchParams.set("_", String(Date.now()));
      const response = await fetch(url.href, {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" }
      });
      if (!response.ok) return;

      const manifest = validateManifest(await response.json());
      if (!manifest) {
        console.warn("[iFac OTA] Manifeste ignoré : format ou compatibilité invalide.");
        return;
      }

      const current = await LiveUpdate.getCurrentBundle();
      const next = await LiveUpdate.getNextBundle();
      if (current.bundleId === manifest.bundleId || next.bundleId === manifest.bundleId) return;

      const downloaded = await LiveUpdate.getBundles();
      const downloadedIds = Array.isArray(downloaded.bundleIds) ? downloaded.bundleIds : [];
      if (!downloadedIds.includes(manifest.bundleId)) {
        await LiveUpdate.downloadBundle({
          url: manifest.url,
          bundleId: manifest.bundleId,
          checksum: manifest.checksum,
          signature: manifest.signature
        });
      }

      await LiveUpdate.setNextBundle({ bundleId: manifest.bundleId });
      console.info("[iFac OTA] Mise à jour téléchargée. Elle sera appliquée au prochain lancement.");
    } catch (error) {
      console.warn("[iFac OTA] Vérification de mise à jour ignorée.", error);
    } finally {
      updateCheckPromise = null;
    }
  })();

  return updateCheckPromise;
}

export function initializeOtaUpdates() {
  if (!isSupportedNativeApp()) return undefined;

  void (async () => {
    await markCurrentBundleReady();
    await checkForUpdate(true);
  })();

  const checkOnResume = () => {
    if (document.visibilityState === "visible") void checkForUpdate(false);
  };
  window.addEventListener("focus", checkOnResume);
  document.addEventListener("visibilitychange", checkOnResume);

  return () => {
    window.removeEventListener("focus", checkOnResume);
    document.removeEventListener("visibilitychange", checkOnResume);
  };
}
