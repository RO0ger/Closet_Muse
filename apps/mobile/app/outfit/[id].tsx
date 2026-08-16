import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, radius, shadow, spacing } from "../../constants/theme";
import { useAppStore } from "../../lib/store";
import { useWeather } from "../../lib/useWeather";
import { reconstructOutfit } from "../../lib/recommendationEngine";
import ItemImage from "../../components/ItemImage";
import Badge from "../../components/Badge";
import FeedbackButtonRow from "../../components/FeedbackButtonRow";

const BREAKDOWN_LABELS: Record<string, string> = {
  compatibility: "Compatibility",
  formality: "Formality match",
  variety: "Variety",
  preference: "Your preference",
};

export default function OutfitDetail() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { items, feedback, updateItem } = useAppStore();
  const { weather } = useWeather();
  const outfit = id ? reconstructOutfit(id, items, weather, feedback) : null;
  const getItem = (itemId: string) => items.find((i) => i.item_id === itemId);

  if (!outfit) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.notFound}>This outfit is no longer available.</Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.backLink}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const pieces = [
    outfit.itemIds.outerwear ? getItem(outfit.itemIds.outerwear) : null,
    getItem(outfit.itemIds.top),
    getItem(outfit.itemIds.bottom),
    getItem(outfit.itemIds.footwear),
  ].filter(Boolean);

  function handleFeedback(action: "worn" | "saved" | "dismissed") {
    if (action === "worn") {
      const today = new Date().toISOString().slice(0, 10);
      [outfit!.itemIds.top, outfit!.itemIds.bottom, outfit!.itemIds.footwear, outfit!.itemIds.outerwear]
        .filter(Boolean)
        .forEach((itemId) => updateItem(itemId as string, { last_worn_at: today }));
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: spacing.xxxl, paddingHorizontal: spacing.xl }}>
      <Pressable onPress={() => router.back()} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Go back">
        <Ionicons name="arrow-back" size={22} color={colors.ink900} />
      </Pressable>

      <View style={styles.headerRow}>
        <Text style={styles.title}>{outfit.label}</Text>
        <Badge label={`${outfit.score}% Match`} tone="ai" />
      </View>
      <Text style={styles.explanation}>{outfit.explanation}</Text>

      <View style={styles.piecesGrid}>
        {pieces.map((p) => (
          <Pressable
            key={p!.item_id}
            style={styles.pieceCard}
            onPress={() => router.push(`/item/${p!.item_id}`)}
            accessibilityRole="button"
            accessibilityLabel={`View ${p!.name}`}
          >
            <ItemImage uri={p!.image} style={styles.pieceImage} />
            <Text style={styles.pieceName} numberOfLines={1}>{p!.name}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Why this works</Text>
      <View style={styles.breakdownCard}>
        {Object.entries(outfit.breakdown).map(([key, value]) => (
          <View key={key} style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>{BREAKDOWN_LABELS[key] ?? key}</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${Math.round(value * 100)}%` }]} />
            </View>
            <Text style={styles.breakdownValue}>{Math.round(value * 100)}%</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Give feedback</Text>
      <FeedbackButtonRow outfitId={outfit.outfit_id} onActionConfirmed={handleFeedback} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.blush50 },
  center: { alignItems: "center", justifyContent: "center" },
  notFound: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink500, marginBottom: spacing.sm },
  backLink: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.coral600 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  title: { fontFamily: fonts.displayBold, fontSize: 24, color: colors.ink900 },
  explanation: { fontFamily: fonts.body, fontSize: 14, color: colors.ink500, lineHeight: 20, marginBottom: spacing.lg },
  piecesGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.xl },
  pieceCard: { width: "23.5%", backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.xs, ...shadow.card },
  pieceImage: { width: "100%", aspectRatio: 1, borderRadius: radius.sm, backgroundColor: colors.ink100, marginBottom: 4 },
  pieceName: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.ink700, textAlign: "center" },
  sectionLabel: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.ink900, marginBottom: spacing.md },
  breakdownCard: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md, marginBottom: spacing.xl, ...shadow.card },
  breakdownRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  breakdownLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.ink700, width: 100 },
  barTrack: { flex: 1, height: 6, backgroundColor: colors.ink100, borderRadius: radius.pill, overflow: "hidden" },
  barFill: { height: "100%", backgroundColor: colors.ai600, borderRadius: radius.pill },
  breakdownValue: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.ink900, width: 34, textAlign: "right" },
});
