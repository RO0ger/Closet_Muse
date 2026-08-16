import { View } from "react-native";
import { Redirect } from "expo-router";
import { useAppStore } from "../lib/store";
import { colors } from "../constants/theme";

export default function Index() {
  const { hasAccount, authLoading } = useAppStore();

  if (authLoading) {
    // Session restore check in progress — avoid flashing the auth screen
    // before we know whether a valid session already exists.
    return <View style={{ flex: 1, backgroundColor: colors.blush50 }} />;
  }

  return <Redirect href={hasAccount ? "/(tabs)/home" : "/auth"} />;
}
