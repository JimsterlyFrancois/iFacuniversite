import test from "node:test";
import assert from "node:assert/strict";
import { getOtaRetryDelay, OTA_MANIFEST_ORIGIN, OTA_NATIVE_COMPATIBILITY, validateOtaManifest } from "./otaManifest.js";

const bundleId = "ebfcbc86eb9cd3937d7cb26c7ee3a8ebca260b55";
const validManifest = {
  schemaVersion: 1,
  platform: "android",
  nativeCompatibility: OTA_NATIVE_COMPATIBILITY,
  bundleId,
  checksum: "a".repeat(64),
  signature: "A".repeat(600),
  url: new URL(`/ota/bundles/${bundleId}.zip`, OTA_MANIFEST_ORIGIN).href
};

test("accepts a valid signed Android OTA manifest", () => {
  assert.equal(validateOtaManifest(validManifest), validManifest);
});

test("rejects an OTA manifest with the wrong app compatibility", () => {
  assert.equal(validateOtaManifest({ ...validManifest, nativeCompatibility: "other-app" }), null);
});

test("rejects an OTA URL outside the configured host and bundle path", () => {
  assert.equal(validateOtaManifest({ ...validManifest, url: "https://example.com/fake.zip" }), null);
});

test("rejects a manifest with an invalid checksum or signature", () => {
  assert.equal(validateOtaManifest({ ...validManifest, checksum: "bad" }), null);
  assert.equal(validateOtaManifest({ ...validManifest, signature: "bad" }), null);
});

test("retries quickly at first, then uses a bounded backoff", () => {
  assert.equal(getOtaRetryDelay(1), 15000);
  assert.equal(getOtaRetryDelay(2), 30000);
  assert.equal(getOtaRetryDelay(3), 60000);
  assert.equal(getOtaRetryDelay(20), 300000);
});
