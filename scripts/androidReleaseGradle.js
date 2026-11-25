export function configureGroovyReleaseGradle(source) {
  if (typeof source !== "string" || !source.trim()) throw new Error("empty_gradle_file");
  if (source.includes("ifacRelease")) throw new Error("release_signing_already_configured");
  if (!/android\s*\{/.test(source)) throw new Error("android_block_not_found");
  if (!/defaultConfig\s*\{/.test(source)) throw new Error("default_config_block_not_found");
  if (!/buildTypes\s*\{\s*release\s*\{/.test(source)) throw new Error("release_build_type_not_found");

  let result = source.replace(/android\s*\{/, `android {
    signingConfigs {
        ifacRelease {
            storeFile file(System.getenv("ANDROID_KEYSTORE_PATH"))
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }
    }`);

  result = result.replace(/defaultConfig\s*\{/, `defaultConfig {
        versionCode Integer.parseInt(System.getenv("ANDROID_VERSION_CODE"))
        versionName System.getenv("ANDROID_VERSION_NAME")`);

  result = result.replace(/buildTypes\s*\{\s*release\s*\{/, `buildTypes {
        release {
            signingConfig signingConfigs.ifacRelease`);
  return result;
}

export function configureKotlinReleaseGradle(source) {
  if (typeof source !== "string" || !source.trim()) throw new Error("empty_gradle_file");
  if (source.includes("ifacRelease")) throw new Error("release_signing_already_configured");
  if (!/android\s*\{/.test(source)) throw new Error("android_block_not_found");
  if (!/defaultConfig\s*\{/.test(source)) throw new Error("default_config_block_not_found");
  if (!/buildTypes\s*\{\s*getByName\("release"\)\s*\{/.test(source)) {
    throw new Error("release_build_type_not_found");
  }

  let result = source.replace(/android\s*\{/, `android {
    signingConfigs {
        create("ifacRelease") {
            storeFile = file(System.getenv("ANDROID_KEYSTORE_PATH"))
            storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias = System.getenv("ANDROID_KEY_ALIAS")
            keyPassword = System.getenv("ANDROID_KEY_PASSWORD")
        }
    }`);

  result = result.replace(/defaultConfig\s*\{/, `defaultConfig {
        versionCode = System.getenv("ANDROID_VERSION_CODE").toInt()
        versionName = System.getenv("ANDROID_VERSION_NAME")`);

  result = result.replace(
    /buildTypes\s*\{\s*getByName\("release"\)\s*\{/,
    `buildTypes {
        getByName("release") {
            signingConfig = signingConfigs.getByName("ifacRelease")`
  );
  return result;
}
