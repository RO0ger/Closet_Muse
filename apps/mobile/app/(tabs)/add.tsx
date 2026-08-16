import { View } from "react-native";

// This screen never actually renders — the "Add" tab press is intercepted
// in app/(tabs)/_layout.tsx's listeners.tabPress and redirected to the
// /add-item modal flow instead. The file has to exist for expo-router's
// file-based Tabs.Screen name="add" to resolve.
export default function AddPlaceholder() {
  return <View />;
}
