import { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { colors, fonts, radius, shadow, spacing, app } from "../../constants/theme";

const UNIT_OPTIONS = [
  { key: "celsius", label: "Celsius (°C)" },
  { key: "fahrenheit", label: "Fahrenheit (°F)" },
] as const;

export default function AppSettingsScreen() {
  const insets = useSafeAreaInsets();
  const [units, setUnits] = useState<"celsius" | "fahrenheit">("celsius");

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxxl, paddingHorizontal: spacing.xl }}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={colors.ink900} />
        </Pressable>
        <Text style={styles.title}>App Settings</Text>
        <View style={styles.backBtn} />
      </View>

      <Text style={styles.sectionLabel}>Temperature Units</Text>
      <View style={styles.card}>
        {UNIT_OPTIONS.map((opt, index) => (
          <Pressable
            key={opt.key}
            style={[styles.row, index !== UNIT_OPTIONS.length - 1 && styles.rowBorder]}
            onPress={() => setUnits(opt.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: units === opt.key }}
          >
            <Text style={styles.rowTitle}>{opt.label}</Text>
            <Ionicons
              name={units === opt.key ? "radio-button-on" : "radio-button-off"}
              size={20}
              color={units === opt.key ? colors.coral600 : colors.ink300}
            />
          </Pressable>
        ))}
      </View>
      <Text style={styles.hint}>
        Weather is currently shown in {units === "celsius" ? "Celsius" : "Fahrenheit"} throughout the app.
      </Text>

      <Text style={styles.sectionLabel}>Theme</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowTitle}>Light</Text>
          <Ionicons name="checkmark-circle" size={20} color={colors.coral600} />
        </View>
      </View>
      <Text style={styles.hint}>Dark mode isn't built yet — this is the only option for now.</Text>

      <Text style={styles.sectionLabel}>About</Text>
      <View style={styles.card}>
        <View style={[styles.row, styles.rowBorder]}>
          <Text style={styles.rowTitle}>Version</Text>
          <Text style={styles.rowValue}>{Constants.expoConfig?.version ?? "1.0.0"}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowTitle}>App</Text>
          <Text style={styles.rowValue}>{app.name}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.blush50 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.lg },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.displayBold, fontSize: 19, color: colors.ink900 },
  sectionLabel: { fontFamily: fonts.bodySemiBold, fontSize: 12, letterSpacing: 0.6, color: colors.ink500, marginBottom: spacing.sm, marginTop: spacing.lg },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, ...shadow.card },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.ink50 },
  rowTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.ink900 },
  rowValue: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink500 },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.ink500, marginTop: spacing.sm, lineHeight: 16 },
});
