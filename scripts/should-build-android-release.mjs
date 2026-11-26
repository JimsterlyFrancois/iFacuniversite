import { appendFile, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const NATIVE_FILES = new Set([
  ".github/workflows/android-release.yml",
  "capacitor.config.json",
  "client/public/ifac-logo.svg",
  "scripts/generate-android-icons.py",
  "scripts/configure-android-release.mjs",
  "scripts/should-build-android-release.mjs"
]);

const NATIVE_PACKAGE_PATTERN = /^(?:@capacitor(?:-community|-firebase)?\/|@capawesome\/|@aparajita\/|@ionic-native\/|cordova-plugin-|cordova-android$|cordova-ios$)/;

export function hasNativeDependencyChanges(previousPackage, currentPackage) {
  const names = new Set();
  for (const source of [previousPackage, currentPackage]) {
    for (const group of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
      for (const name of Object.keys(source?.[group] ?? {})) {
        if (NATIVE_PACKAGE_PATTERN.test(name)) names.add(name);
      }
    }
  }

  for (const name of names) {
    const previousVersion = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]
      .map(group => previousPackage?.[group]?.[name] ?? null)
      .find(value => value !== null) ?? null;
    const currentVersion = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]
      .map(group => currentPackage?.[group]?.[name] ?? null)
      .find(value => value !== null) ?? null;
    if (previousVersion !== currentVersion) return true;
  }
  return false;
}

export function shouldBuildAndroidRelease({
  eventName,
  refType,
  before,
  changedFiles = [],
  previousPackage,
  currentPackage
}) {
  if (eventName === "workflow_dispatch" || refType === "tag") return true;
  if (!before || /^0+$/.test(before)) return true;
  if (changedFiles.some(file => NATIVE_FILES.has(file))) return true;

  if (changedFiles.includes("package.json")) {
    if (!previousPackage || !currentPackage) return true;
    return hasNativeDependencyChanges(previousPackage, currentPackage);
  }
  return false;
}

async function main() {
  const eventName = process.env.ANDROID_RELEASE_EVENT ?? process.env.GITHUB_EVENT_NAME ?? "";
  const refType = process.env.ANDROID_RELEASE_REF_TYPE ?? process.env.GITHUB_REF_TYPE ?? "";
  const before = process.env.ANDROID_RELEASE_BEFORE ?? "";
  const sha = process.env.ANDROID_RELEASE_SHA ?? process.env.GITHUB_SHA ?? "";

  let changedFiles = [];
  let previousPackage = null;
  let currentPackage = null;

  if (eventName !== "workflow_dispatch" && before && !/^0+$/.test(before) && sha) {
    changedFiles = execFileSync("git", ["diff", "--name-only", before, sha], { encoding: "utf8" })
      .split("\n")
      .map(value => value.trim())
      .filter(Boolean);

    if (changedFiles.includes("package.json")) {
      try {
        previousPackage = JSON.parse(execFileSync("git", ["show", `${before}:package.json`], { encoding: "utf8" }));
        currentPackage = JSON.parse(await readFile("package.json", "utf8"));
      } catch {
        previousPackage = null;
        currentPackage = null;
      }
    }
  }

  const required = shouldBuildAndroidRelease({
    eventName,
    refType,
    before,
    changedFiles,
    previousPackage,
    currentPackage
  });

  console.info(required
    ? "[Android release] A native change was detected; build required."
    : "[Android release] Web-only change detected; signed APK build skipped.");

  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `required=${required}\n`);
  }
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  await main();
}
