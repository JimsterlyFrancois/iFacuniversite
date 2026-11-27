import assert from "node:assert/strict";
import test from "node:test";
import { hasNativeDependencyChanges, shouldBuildAndroidRelease } from "./should-build-android-release.mjs";

test("web-only package updates do not trigger a signed Android release", () => {
  assert.equal(hasNativeDependencyChanges(
    { dependencies: { react: "^19.1.0", express: "^5.1.0" } },
    { dependencies: { react: "^19.2.0", express: "^5.2.0" } }
  ), false);
});

test("Capacitor plugin updates trigger a signed Android release", () => {
  assert.equal(hasNativeDependencyChanges(
    { dependencies: { "@capacitor/core": "^8.0.0" } },
    { dependencies: { "@capacitor/core": "^8.1.0" } }
  ), true);
});

test("adding the OTA plugin triggers a signed Android release", () => {
  assert.equal(hasNativeDependencyChanges(
    { dependencies: { react: "^19.1.0" } },
    { dependencies: { react: "^19.1.0", "@capawesome/capacitor-live-update": "^8.10.0" } }
  ), true);
});

test("workflow edits still trigger a release", () => {
  assert.equal(shouldBuildAndroidRelease({
    eventName: "push",
    refType: "branch",
    before: "a".repeat(40),
    changedFiles: [".github/workflows/android-release.yml"]
  }), true);
});

test("manual workflow dispatch always builds a release", () => {
  assert.equal(shouldBuildAndroidRelease({ eventName: "workflow_dispatch" }), true);
});


test("native session storage changes trigger a signed Android release", () => {
  assert.equal(shouldBuildAndroidRelease({
    eventName: "push",
    refType: "branch",
    before: "a".repeat(40),
    changedFiles: ["client/src/nativeStorage.js"]
  }), true);
});
