import { useState } from "react";
import { View, Text, ScrollView, Pressable, Switch, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, radius, shadow, spacing } from "../../constants/theme";

interface NotificationSetting {
  key: string;
  title: string;
  subtitle: string;
  defaultValue: boolean;
}

const SETTINGS: NotificationSetting[] = [
  { key: "daily_pick", title: "Daily Outfit Reminder", subtitle: "A nudge each morning to check today's pick", defaultValue: true },
  { key: "weather_alerts", title: "Weather Alerts", subtitle: "Notify me when conditions change enough to affect my outfit", defaultValue: true },
  { key: "feedback_reminders", title: "Feedback Reminders", subtitle: "Ask whether I wore the recommended outfit", defaultValue: false },
  { key: "new_features", title: "New Features", subtitle: "Product updates and new capabilities", defaultValue: false },
  { key: "style_me_replies", title: "Style Me Replies", subtitle: "Notify when a saved conversation gets a new suggestion", defaultValue: true },
];

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const [values, setValues] = useState<Record<string, boolean>>(
    Object.fromEntries(SETTINGS.map((s) => [s.key, s.defaultValue])),
  );

  function toggle(key: string) {
    setValues((prev) => ({ ...prev, [key]: !prev[key] }));
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
        <Text style={styles.title}>Notifications</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.card}>
        {SETTINGS.map((setting, index) => (
          <View key={setting.key} style={[styles.row, index !== SETTINGS.length - 1 && styles.rowBorder]}>
            <View style={{ flex: 1, marginRight: spacing.md }}>
              <Text style={styles.rowTitle}>{setting.title}</Text>
              <Text style={styles.rowSubtitle}>{setting.subtitle}</Text>
            </View>
            <Switch
              value={values[setting.key]}
              onValueChange={() => toggle(setting.key)}
              trackColor={{ false: colors.ink100, true: colors.coral500 }}
              thumbColor={colors.white}
              accessibilityLabel={`Toggle ${setting.title}`}
            />
          </View>
        ))}
      </View>

      <Text style={styles.note}>
        These preferences are stored on this device for this demo build — a real backend would persist them per account and actually schedule push notifications.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.blush50 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.lg },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.displayBold, fontSize: 19, color: colors.ink900 },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, ...shadow.card },
  row: { flexDirection: "row", alignItems: "center", padding: spacing.lg },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.ink50 },
  rowTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.ink900 },
  rowSubtitle: { fontFamily: fonts.body, fontSize: 12, color: colors.ink500, marginTop: 2, lineHeight: 16 },
  note: { fontFamily: fonts.body, fontSize: 12, color: colors.ink500, marginTop: spacing.lg, lineHeight: 17 },
});
