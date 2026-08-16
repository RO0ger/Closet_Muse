const { withAndroidManifest, withInfoPlist } = require("@expo/config-plugins");

const BLOCKED_ANDROID_PERMISSIONS = new Set([
  "android.permission.ACCESS_BACKGROUND_LOCATION",
  "android.permission.READ_MEDIA_IMAGES",
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.WRITE_EXTERNAL_STORAGE",
  "android.permission.RECORD_AUDIO",
]);

/**
 * Keep permissions least-privilege even when an Expo module contributes its
 * broad defaults. This runs after the image-picker and location plugins.
 */
module.exports = function withLeastPrivilegePermissions(config) {
  config = withInfoPlist(config, (mod) => {
    delete mod.modResults.NSLocationAlwaysUsageDescription;
    delete mod.modResults.NSLocationAlwaysAndWhenInUseUsageDescription;
    delete mod.modResults.NSPhotoLibraryUsageDescription;
    delete mod.modResults.NSMicrophoneUsageDescription;
    delete mod.modResults.UIBackgroundModes;
    return mod;
  });

  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    const permissions = manifest["uses-permission"] ?? [];
    manifest["uses-permission"] = permissions.filter(
      (permission) => !BLOCKED_ANDROID_PERMISSIONS.has(permission.$?.["android:name"]),
    );
    return mod;
  });
};
