import { useState } from "react";
import { View, Text, ScrollView, Pressable, Switch, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, radius, shadow, spacing } from "../../constants/theme";
import { useAppStore } from "../../lib/store";
import { confirmAsync, notify } from "../../lib/platformAlert";

export default function PrivacySecurityScreen() {
  const insets = useSafeAreaInsets();
  const { profile, items, sessions, feedback, signOut } = useAppStore();
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const [exporting, setExporting] = useState(false);

  async function handleExportData() {
    setExporting(true);
    // Simulates the real /export-data flow's shape (Technical PRD NFR:
    // full export fulfilled within 60s of request) — builds the actual
    // export payload from real in-memory state, just doesn't write it to
    // a file yet since there's no backend to generate a download link from.
    await new Promise((r) => setTimeout(r, 600));
    const summary = {
      profile,
      wardrobe_item_count: items.length,
      style_sessions_count: sessions.length,
      feedback_entries_count: feedback.length,
    };
    setExporting(false);
    notify(
      "Export ready",
      `Your data: ${summary.wardrobe_item_count} wardrobe items, ${summary.style_sessions_count} Style Me conversations, ${summary.feedback_entries_count} feedback entries. (Demo build — a real backend would email you a download link within 60 seconds, per the NFR target.)`,
    );
  }

  async function handleDeleteAccount() {
    const confirmed = await confirmAsync(
      "Delete account",
      "This will permanently delete your account and all wardrobe data. This cannot be undone.",
      "Delete",
    );
    if (!confirmed) return;
    await signOut();
    router.replace("/auth");
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
        <Text style={styles.title}>Privacy & Security</Text>
        <View style={styles.backBtn} />
      </View>

      <Text style={styles.sectionLabel}>Account</Text>
      <View style={styles.card}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={styles.infoValue}>{profile.email}</Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>Data</Text>
      <View style={styles.card}>
        <View style={[styles.row, styles.rowBorder]}>
          <View style={{ flex: 1, marginRight: spacing.md }}>
            <Text style={styles.rowTitle}>Share usage analytics</Text>
            <Text style={styles.rowSubtitle}>Helps improve recommendation quality</Text>
          </View>
          <Switch
            value={analyticsEnabled}
            onValueChange={setAnalyticsEnabled}
            trackColor={{ false: colors.ink100, true: colors.coral500 }}
            thumbColor={colors.white}
            accessibilityLabel="Toggle usage analytics"
          />
        </View>
        <Pressable style={styles.actionRow} onPress={handleExportData} disabled={exporting} accessibilityRole="button" accessibilityLabel="Export my data">
          <Ionicons name="download-outline" size={18} color={colors.ink700} />
          <Text style={styles.actionText}>{exporting ? "Preparing export..." : "Export my data"}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.ink300} />
        </Pressable>
      </View>

      <Text style={styles.sectionLabel}>Danger zone</Text>
      <View style={styles.card}>
        <Pressable style={styles.actionRow} onPress={handleDeleteAccount} accessibilityRole="button" accessibilityLabel="Delete my account">
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
          <Text style={[styles.actionText, { color: colors.danger }]}>Delete account</Text>
        </Pressable>
      </View>

      <Text style={styles.note}>
        Per the project's NFRs: full data export within 60 seconds of request, account deletion fully actioned within 7 days including image removal from storage. This demo build simulates the export payload and confirms the delete intent, but doesn't yet call a real backend to action either.
      </Text>
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
  infoRow: { flexDirection: "row", justifyContent: "space-between", padding: spacing.lg },
  infoLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink500 },
  infoValue: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.ink900 },
  row: { flexDirection: "row", alignItems: "center", padding: spacing.lg },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.ink50 },
  rowTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.ink900 },
  rowSubtitle: { fontFamily: fonts.body, fontSize: 12, color: colors.ink500, marginTop: 2 },
  actionRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
  actionText: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.ink900 },
  note: { fontFamily: fonts.body, fontSize: 12, color: colors.ink500, marginTop: spacing.lg, lineHeight: 17 },
});
