import { View, Text, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, radius, spacing } from "@/constants/theme";
import PrimaryButton from "@/components/PrimaryButton";

export default function AuthSuccess() {
  const insets = useSafeAreaInsets();

  function handleContinue() {
    // Session already exists from the real supabase.auth.signUp() call in
    // the previous step — nothing further to "complete" here.
    router.replace("/(tabs)/home");
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom + spacing.xl }]}>
      <View style={styles.center}>
        <View style={styles.iconWrap}>
          <Ionicons name="checkmark" size={40} color={colors.white} />
        </View>
        <Text style={styles.title}>You're all set!</Text>
        <Text style={styles.subtitle}>Your ClosetMuse account is ready. Add a few wardrobe items to get your first AI-styled outfit.</Text>
      </View>
      <View style={{ paddingHorizontal: spacing.xl }}>
        <PrimaryButton label="Go to my wardrobe" onPress={handleContinue} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.blush50, justifyContent: "space-between" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xxl },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: radius.pill,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
  },
  title: { fontFamily: fonts.displayBold, fontSize: 24, color: colors.ink900, marginBottom: spacing.sm },
  subtitle: { fontFamily: fonts.body, fontSize: 14, color: colors.ink500, textAlign: "center", lineHeight: 20 },
});
