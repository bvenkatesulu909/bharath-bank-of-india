# Publishing BBI Banking Demo to the Google Play Store

This project has been wrapped into a native **Android app** using
[Capacitor](https://capacitorjs.com). The web app (in `public/`) is bundled
inside an Android WebView, so the app runs fully offline — exactly like the
Netlify site, using `localStorage` for data.

- **App name:** BBI Banking Demo
- **Application ID (package):** `app.bharathbank.demo`
- **Native project:** `android/` (a standard Gradle project)
- **Web assets:** bundled into `android/app/src/main/assets/public`

---

## ⚠️ Read this first — Play Store policy

Google Play review is strict about anything that looks like a real bank.
Before you submit, reduce the (real) risk of **rejection or account suspension**:

1. **Impersonation / Financial services policy.** An app that presents as
   "Bharath Bank of India" and collects **PAN / Aadhaar** can be flagged for
   impersonating an RBI-regulated institution. This is why the app is named
   **"BBI Banking Demo"**. Keep the *educational/simulator* framing everywhere:
   store title, screenshots, and in-app text ("Not a real bank — educational
   simulation, holds no real money").
2. **Remove or clearly fake identity collection.** Either drop the Aadhaar/PAN
   fields from the KYC screen, or label them explicitly as "sample/for demo
   only — do not enter real numbers."
3. **Privacy policy is mandatory.** You need a public privacy-policy URL. Since
   all data stays on-device in `localStorage` and nothing is transmitted, a
   short page stating that is enough. You can host it on the Netlify site
   (e.g. `public/privacy.html` → `https://bharath-bank-of-india-demo.netlify.app/privacy.html`).
4. **Data safety form.** In Play Console declare: no data collected/shared,
   data stored only on the device.

---

## Prerequisites (one-time machine setup)

The `.aab` **cannot be built without these** (this machine currently has none):

1. **JDK 17** — https://adoptium.net (Temurin 17). Verify: `java -version`.
2. **Android SDK** — easiest via **Android Studio**
   (https://developer.android.com/studio), which installs the SDK,
   platform-tools and build-tools. Set `ANDROID_HOME` (e.g.
   `C:\Users\User\AppData\Local\Android\Sdk`).
   - CLI-only alternative: download *commandline-tools*, then
     `sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"`.
3. **Node.js** — already installed (used to sync web assets into the app).

---

## Build the release bundle (.aab)

From `Bharath Bank Netlify/`:

```bash
# 1. Copy the latest web app into the native project
npx cap sync android

# 2. Create an UPLOAD KEYSTORE (once). Keep this file + passwords SAFE —
#    losing it means you can never update the app again.
keytool -genkey -v -keystore bbi-upload.keystore \
  -alias bbi -keyalg RSA -keysize 2048 -validity 10000

# 3. Build the signed release bundle
cd android
./gradlew bundleRelease      # Windows: gradlew.bat bundleRelease
```

Configure signing so Gradle can sign the release. Create
`android/keystore.properties` (do **not** commit it):

```properties
storeFile=../bbi-upload.keystore
storePassword=YOUR_STORE_PASSWORD
keyAlias=bbi
keyPassword=YOUR_KEY_PASSWORD
```

…and reference it in `android/app/build.gradle` inside `android { }` (add a
`signingConfigs.release` block reading `keystore.properties`, then set
`buildTypes.release.signingConfig signingConfigs.release`). See
https://capacitorjs.com/docs/android/deploying-to-google-play for the exact
snippet.

The output bundle will be at:

```
android/app/build/outputs/bundle/release/app-release.aab
```

To test on a physical device first, build an APK instead:
`./gradlew assembleRelease` → `android/app/build/outputs/apk/release/`.

---

## Submit to Google Play (manual — only you can do this)

1. **Create a Play Developer account** — https://play.google.com/console
   (one-time **$25** fee, requires your Google account + ID verification).
2. **Create app** → name "BBI Banking Demo", category *Education* (not Finance),
   free.
3. **Upload** `app-release.aab` under *Production → Create release* (or start
   with *Internal testing* to trial it privately first — recommended).
4. **Complete the required forms:**
   - Store listing: short/full description (lead with "educational demo"),
     app icon (512×512), feature graphic (1024×500), 2–8 phone screenshots.
   - Content rating questionnaire.
   - Data safety (no data collected — on-device only).
   - Privacy policy URL.
   - Target audience & ads (no ads).
5. **Roll out** and wait for Google review (can take a few days for new
   accounts).

---

## Updating the app later

1. Change the web files in `public/`.
2. Bump `versionCode` (integer, must increase) and `versionName` in
   `android/app/build.gradle`.
3. `npx cap sync android` → `cd android && ./gradlew bundleRelease`.
4. Upload the new `.aab` as a new release. **Sign with the same keystore.**

---

## What was set up for you

- `capacitor.config.ts` — appId/appName/webDir
- `android/` — full native Gradle project with the web app bundled
- `resources/` — 1024×1024 icon (foreground/background/legacy) + splash sources
- Android launcher icons generated for all densities via `@capacitor/assets`

Everything up to "install the SDK and build" is done. The build + Play Console
submission are yours because they need the Android toolchain, a keystore you
control, and your paid developer account.
