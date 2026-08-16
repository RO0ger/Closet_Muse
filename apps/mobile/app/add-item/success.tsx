import { View, Text, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, radius, spacing } from "../../constants/theme";
import PrimaryButton from "../../components/PrimaryButton";
import { useAppStore } from "../../lib/store";

export default function AddItemSuccess() {
  const insets = useSafeAreaInsets();
  const { setDraftItem } = useAppStore();

  function handleDone() {
    setDraftItem(null);
    router.dismissAll();
    router.replace("/(tabs)/wardrobe");
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom + spacing.xl }]}>
      <View style={styles.center}>
        <View style={styles.iconWrap}>
          <Ionicons name="checkmark" size={40} color={colors.white} />
        </View>
        <Text style={styles.title}>Added to your wardrobe!</Text>
        <Text style={styles.subtitle}>This item is now available for AI outfit recommendations.</Text>
      </View>
      <View style={{ paddingHorizontal: spacing.xl }}>
        <PrimaryButton label="Done" onPress={handleDone} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.blush50, justifyContent: "space-between" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xxl },
  iconWrap: { width: 80, height: 80, borderRadius: radius.pill, backgroundColor: colors.success, alignItems: "center", justifyContent: "center", marginBottom: spacing.xl },
  title: { fontFamily: fonts.displayBold, fontSize: 22, color: colors.ink900, marginBottom: spacing.sm, textAlign: "center" },
  subtitle: { fontFamily: fonts.body, fontSize: 14, color: colors.ink500, textAlign: "center", lineHeight: 20 },
});
