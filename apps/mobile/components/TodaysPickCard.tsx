import { View, Text, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius, spacing } from "../constants/theme";
import { OutfitCandidate, WeatherSnapshot } from "../constants/mockData";
import Badge from "./Badge";

interface TodaysPickCardProps {
  outfit: OutfitCandidate | null;
  weather: WeatherSnapshot;
  onTryAnother: () => void;
}

export default function TodaysPickCard({ outfit, weather, onTryAnother }: TodaysPickCardProps) {
  if (!outfit) {
    return (
      <View style={[styles.card, styles.emptyCard]}>
        <Ionicons name="shirt-outline" size={28} color={colors.ink300} />
        <Text style={styles.emptyText}>Add a few wardrobe items to get your first AI outfit pick.</Text>
        <Pressable style={styles.emptyCta} onPress={() => router.push("/add-item")} accessibilityRole="button">
          <Text style={styles.emptyCtaText}>Add an item</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <LinearGradient colors={["#2A2320", "#12100F"]} style={styles.card} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <Text style={styles.kicker}>TODAY'S PICK</Text>
      <Text style={styles.title}>
        {outfit.explanation.startsWith("Pairs") ? `Smart pick for ${Math.round(weather.temperature_c)}°C` : outfit.label}
      </Text>
      <Text style={styles.subtitle} numberOfLines={2}>
        AI recommendation based on today's weather and items in your wardrobe.
      </Text>
      <View style={styles.chipRow}>
        <Badge label={`${Math.round(weather.temperature_c)}°C ${weather.condition_text}`} tone="neutral" />
        <Badge label={`${outfit.score}% Match`} tone="ai" />
      </View>
      <View style={styles.ctaRow}>
        <Pressable
          style={styles.primaryCta}
          onPress={() => router.push({ pathname: "/outfit/[id]", params: { id: outfit.outfit_id } })}
          accessibilityRole="button"
          accessibilityLabel="View outfit details"
        >
          <Ionicons name="sparkles" size={16} color={colors.white} />
          <Text style={styles.primaryCtaText}>View Outfit</Text>
        </Pressable>
        <Pressable style={styles.secondaryCta} onPress={onTryAnother} accessibilityRole="button" accessibilityLabel="Try another outfit">
          <Ionicons name="refresh" size={16} color={colors.white} />
          <Text style={styles.secondaryCtaText}>Try Another</Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  kicker: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: "rgba(255,255,255,0.65)",
    marginBottom: 6,
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 22,
    color: colors.white,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  chipRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg, flexWrap: "wrap" },
  ctaRow: { flexDirection: "row", gap: spacing.sm },
  primaryCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.coral600,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  primaryCtaText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.white },
  secondaryCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  secondaryCtaText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.white },

  emptyCard: {
    backgroundColor: colors.ink50,
    alignItems: "center",
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.ink500,
    textAlign: "center",
    paddingHorizontal: spacing.lg,
  },
  emptyCta: {
    marginTop: spacing.sm,
    backgroundColor: colors.coral600,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  emptyCtaText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.white },
});
