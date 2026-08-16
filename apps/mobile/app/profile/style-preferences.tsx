import { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, radius, spacing } from "../../constants/theme";
import { useAppStore } from "../../lib/store";
import FormField from "../../components/FormField";
import PrimaryButton from "../../components/PrimaryButton";
import { notify } from "../../lib/platformAlert";

const STYLE_OPTIONS = ["Smart casual", "Streetwear", "Classic", "Minimalist", "Bold & colourful"] as const;
const CLIMATE_OPTIONS = [
  { key: "low", label: "Low", hint: "Rarely feel the cold" },
  { key: "medium", label: "Medium", hint: "Average" },
  { key: "high", label: "High", hint: "Feel the cold easily" },
] as const;

export default function StylePreferencesScreen() {
  const insets = useSafeAreaInsets();
  const { profile, updateProfile } = useAppStore();
  const [style, setStyle] = useState<string>(profile.preferred_style);
  const [sizeTop, setSizeTop] = useState(profile.size_top);
  const [sizeBottom, setSizeBottom] = useState(profile.size_bottom);
  const [climate, setClimate] = useState<"low" | "medium" | "high">(profile.climate_sensitivity);

  async function handleSave() {
    try {
      await updateProfile({ preferred_style: style, size_top: sizeTop, size_bottom: sizeBottom, climate_sensitivity: climate });
      notify("Saved", "Your style preferences have been updated.");
      router.back();
    } catch (err) {
      notify("Couldn't save preferences", err instanceof Error ? err.message : "Please try again.");
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxxl, paddingHorizontal: spacing.xl }}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={colors.ink900} />
        </Pressable>
        <Text style={styles.title}>Style Preferences</Text>
        <View style={styles.backBtn} />
      </View>

      <Text style={styles.sectionLabel}>Preferred style</Text>
      <View style={styles.chipWrap}>
        {STYLE_OPTIONS.map((opt) => (
          <Pressable
            key={opt}
            style={[styles.chip, style === opt && styles.chipActive]}
            onPress={() => setStyle(opt)}
            accessibilityRole="button"
            accessibilityState={{ selected: style === opt }}
          >
            <Text style={[styles.chipText, style === opt && styles.chipTextActive]}>{opt}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.row}>
        <View style={{ flex: 1, marginRight: spacing.sm }}>
          <FormField label="Top size" value={sizeTop} onChangeText={setSizeTop} placeholder="e.g. M" />
        </View>
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <FormField label="Bottom size" value={sizeBottom} onChangeText={setSizeBottom} placeholder="e.g. 32" />
        </View>
      </View>

      <Text style={styles.sectionLabel}>Climate sensitivity</Text>
      <View style={{ gap: spacing.sm, marginBottom: spacing.xl }}>
        {CLIMATE_OPTIONS.map((opt) => (
          <Pressable
            key={opt.key}
            style={[styles.climateRow, climate === opt.key && styles.climateRowActive]}
            onPress={() => setClimate(opt.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: climate === opt.key }}
          >
            <View>
              <Text style={styles.climateLabel}>{opt.label}</Text>
              <Text style={styles.climateHint}>{opt.hint}</Text>
            </View>
            <Ionicons
              name={climate === opt.key ? "radio-button-on" : "radio-button-off"}
              size={20}
              color={climate === opt.key ? colors.coral600 : colors.ink300}
            />
          </Pressable>
        ))}
      </View>

      <PrimaryButton label="Save changes" onPress={handleSave} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.blush50 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.lg },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.displayBold, fontSize: 19, color: colors.ink900 },
  sectionLabel: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.ink700, marginBottom: spacing.sm },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.lg },
  chip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.ink100, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.coral600, borderColor: colors.coral600 },
  chipText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.ink700 },
  chipTextActive: { color: colors.white },
  row: { flexDirection: "row" },
  climateRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.ink100, padding: spacing.md },
  climateRowActive: { borderColor: colors.coral600 },
  climateLabel: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.ink900 },
  climateHint: { fontFamily: fonts.body, fontSize: 12, color: colors.ink500, marginTop: 2 },
});
