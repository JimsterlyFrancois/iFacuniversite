import test from "node:test";
import assert from "node:assert/strict";
import { configureGroovyReleaseGradle, configureKotlinReleaseGradle } from "./androidReleaseGradle.js";

test("Groovy Android build config uses environment secrets and release version metadata", () => {
  const source = `android {
    defaultConfig {
        applicationId "ht.edu.ifac.universite"
        versionCode 1
        versionName "1.0"
    }
    buildTypes {
        release {
            minifyEnabled false
        }
    }
}`;
  const result = configureGroovyReleaseGradle(source);
  assert.match(result, /signingConfigs\s*\{[\s\S]*storeFile file\(System\.getenv\("ANDROID_KEYSTORE_PATH"\)\)/);
  assert.match(result, /storePassword System\.getenv\("ANDROID_KEYSTORE_PASSWORD"\)/);
  assert.match(result, /signingConfig signingConfigs\.ifacRelease/);
  assert.match(result, /versionCode Integer\.parseInt\(System\.getenv\("ANDROID_VERSION_CODE"\)\)/);
  assert.match(result, /versionName System\.getenv\("ANDROID_VERSION_NAME"\)/);
  assert.doesNotMatch(result, /my-secret-password|private-keystore-content/i);
});

test("Kotlin Android build config receives release signing without embedding credentials", () => {
  const source = `android {
    defaultConfig {
        applicationId = "ht.edu.ifac.universite"
        versionCode = 1
        versionName = "1.0"
    }
    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
        }
    }
}`;
  const result = configureKotlinReleaseGradle(source);
  assert.match(result, /create\("ifacRelease"\)/);
  assert.match(result, /storePassword = System\.getenv\("ANDROID_KEYSTORE_PASSWORD"\)/);
  assert.match(result, /signingConfig = signingConfigs\.getByName\("ifacRelease"\)/);
  assert.match(result, /versionCode = System\.getenv\("ANDROID_VERSION_CODE"\)\.toInt\(\)/);
});

test("release configuration refuses unsupported Gradle templates and duplicate injection", () => {
  assert.throws(() => configureGroovyReleaseGradle("plugins {}"), /android_block_not_found/);
  const once = configureGroovyReleaseGradle(`android { defaultConfig {} buildTypes { release {} } }`);
  assert.throws(() => configureGroovyReleaseGradle(once), /release_signing_already_configured/);
});
