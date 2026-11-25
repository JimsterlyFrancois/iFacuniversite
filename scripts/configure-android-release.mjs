import { access, readFile, writeFile } from "node:fs/promises";
import { configureGroovyReleaseGradle, configureKotlinReleaseGradle } from "./androidReleaseGradle.js";

const required = [
  "ANDROID_KEYSTORE_PATH",
  "ANDROID_KEYSTORE_PASSWORD",
  "ANDROID_KEY_ALIAS",
  "ANDROID_KEY_PASSWORD",
  "ANDROID_VERSION_CODE",
  "ANDROID_VERSION_NAME"
];

for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing required release variable: ${name}`);
}
if (!/^\d+$/.test(process.env.ANDROID_VERSION_CODE) || Number(process.env.ANDROID_VERSION_CODE) < 1) {
  throw new Error("ANDROID_VERSION_CODE must be a positive integer.");
}
await access(process.env.ANDROID_KEYSTORE_PATH);

const gradlePaths = ["android/app/build.gradle", "android/app/build.gradle.kts"];
let selectedPath = "";
for (const candidate of gradlePaths) {
  try { await access(candidate); selectedPath = candidate; break; } catch {}
}
if (!selectedPath) throw new Error("Android app Gradle build file was not generated.");

const source = await readFile(selectedPath, "utf8");
const result = selectedPath.endsWith(".kts")
  ? configureKotlinReleaseGradle(source)
  : configureGroovyReleaseGradle(source);
await writeFile(selectedPath, result, "utf8");
process.stdout.write("Android release signing and version metadata configured.\n");
