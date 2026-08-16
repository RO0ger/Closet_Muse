import { Alert, Platform } from "react-native";

/**
 * Shows a single-button informational message.
 * React Native's Alert.alert() is a silent no-op on web (react-native-web
 * doesn't implement it), so this falls back to window.alert() there.
 */
export function notify(title: string, message?: string) {
  if (Platform.OS === "web") {
    // eslint-disable-next-line no-alert
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

/**
 * Shows a Cancel/Confirm style dialog and resolves to whether the person
 * confirmed. Same web fallback reasoning as notify().
 */
export function confirmAsync(
  title: string,
  message: string,
  confirmLabel = "Confirm",
): Promise<boolean> {
  return new Promise((resolve) => {
    if (Platform.OS === "web") {
      // eslint-disable-next-line no-alert
      resolve(window.confirm(`${title}\n\n${message}`));
    } else {
      Alert.alert(title, message, [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        { text: confirmLabel, style: "destructive", onPress: () => resolve(true) },
      ]);
    }
  });
}
