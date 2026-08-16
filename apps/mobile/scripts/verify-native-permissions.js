#!/usr/bin/env node

/**
 * Checks the evaluated Expo config, including config-plugin output. This is
 * deliberately run against `expo config --type introspect`, rather than only
 * reading app.json, so a plugin cannot silently add a permission back.
 */
const { execFileSync } = require("node:child_process");

const cameraCopy =
  "ClosetMuse uses your camera so you can photograph clothing and add it to your wardrobe.";
const locationCopy =
  "ClosetMuse uses your location while you use the app to show local weather and recommend outfits suited to current conditions.";
const absentIosKeys = [
  "NSPhotoLibraryUsageDescription",
  "NSMicrophoneUsageDescription",
  "NSLocationAlwaysUsageDescription",
  "NSLocationAlwaysAndWhenInUseUsageDescription",
  "UIBackgroundModes",
];
const forbiddenAndroidPermissions = new Set([
  "android.permission.ACCESS_BACKGROUND_LOCATION",
  "android.permission.RECORD_AUDIO",
  "android.permission.READ_MEDIA_IMAGES",
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.WRITE_EXTERNAL_STORAGE",
]);

const config = JSON.parse(
  execFileSync("npx", ["expo", "config", "--type", "introspect", "--json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }),
);
const infoPlist = config.ios?.infoPlist ?? {};
const androidPermissions = new Set(config.android?.permissions ?? []);
const failures = [];

if (infoPlist.NSCameraUsageDescription !== cameraCopy) {
  failures.push("NSCameraUsageDescription is missing or does not use ClosetMuse copy.");
}
if (infoPlist.NSLocationWhenInUseUsageDescription !== locationCopy) {
  failures.push("NSLocationWhenInUseUsageDescription is missing or does not use ClosetMuse copy.");
}
for (const key of absentIosKeys) {
  if (key in infoPlist) failures.push(`${key} must not be present in the generated Info.plist.`);
}
for (const permission of forbiddenAndroidPermissions) {
  if (androidPermissions.has(permission)) failures.push(`${permission} must not be declared.`);
}

if (failures.length > 0) {
  console.error("Native permission verification failed:\n- " + failures.join("\n- "));
  process.exitCode = 1;
} else {
  console.log("Native permission verification passed.");
}
