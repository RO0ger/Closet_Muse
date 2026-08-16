import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, radius, shadow, spacing } from "../../constants/theme";
import { useAppStore } from "../../lib/store";
import { confirmAsync } from "../../lib/platformAlert";

const SETTINGS: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; route: string }[] = [
  { icon: "person-outline", title: "Style Preferences", subtitle: "Aesthetics & sizes", route: "/profile/style-preferences" },
  { icon: "notifications-outline", title: "Notifications", subtitle: "Reminders & alerts", route: "/profile/notifications" },
  { icon: "lock-closed-outline", title: "Privacy & Security", subtitle: "Data management", route: "/profile/privacy-security" },
  { icon: "settings-outline", title: "App Settings", subtitle: "General preferences", route: "/profile/app-settings" },
  { icon: "help-circle-outline", title: "Help & Support", subtitle: "FAQs & contact", route: "/profile/help-support" },
];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, signOut } = useAppStore();

  async function handleSignOut() {
    const confirmed = await confirmAsync("Sign out", "Are you sure you want to sign out?", "Sign Out");
    if (confirmed) {
      await signOut();
      router.replace("/auth");
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: spacing.xxxl }}
      showsVerticalScrollIndicator={false}
    >
      <Pressable
        style={styles.profileCard}
        onPress={() => router.push("/profile/style-preferences")}
        accessibilityRole="button"
        accessibilityLabel="Edit profile"
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {profile.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
          </Text>
        </View>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={styles.name}>{profile.name}</Text>
          <Text style={styles.email}>{profile.email}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.ink300} />
      </Pressable>

      <View style={styles.statsCard}>
        <Pressable
          style={styles.statItem}
          onPress={() => router.push("/(tabs)/wardrobe")}
          accessibilityRole="button"
          accessibilityLabel={`${profile.itemsCount} items in wardrobe`}
        >
          <Text style={styles.statValue}>{profile.itemsCount}</Text>
          <Text style={styles.statLabel}>Items</Text>
        </Pressable>
        <View style={styles.statDivider} />
        <Pressable
          style={styles.statItem}
          onPress={() => router.push("/(tabs)/wardrobe")}
          accessibilityRole="button"
          accessibilityLabel={`${profile.outfitsCount} outfits`}
        >
          <Text style={styles.statValue}>{profile.outfitsCount}</Text>
          <Text style={styles.statLabel}>Outfits</Text>
        </Pressable>
        <View style={styles.statDivider} />
        <Pressable
          style={styles.statItem}
          onPress={() => router.push("/(tabs)/style-me")}
          accessibilityRole="button"
          accessibilityLabel={`${profile.daysStyled} days styled`}
        >
          <Text style={styles.statValue}>{profile.daysStyled}</Text>
          <Text style={styles.statLabel}>Days styled</Text>
        </Pressable>
      </View>

      <View style={styles.settingsSection}>
        <Text style={styles.sectionLabel}>SETTINGS</Text>
        <View style={styles.settingsCard}>
          {SETTINGS.map((item, index) => (
            <Pressable
              key={item.title}
              style={[styles.settingsRow, index !== SETTINGS.length - 1 && styles.settingsRowBorder]}
              accessibilityRole="button"
              accessibilityLabel={item.title}
              onPress={() => router.push(item.route as any)}
            >
              <View style={styles.settingsIconWrap}>
                <Ionicons name={item.icon} size={18} color={colors.ink700} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingsTitle}>{item.title}</Text>
                <Text style={styles.settingsSubtitle}>{item.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.ink300} />
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable style={styles.signOutBtn} onPress={handleSignOut} accessibilityRole="button" accessibilityLabel="Sign out">
        <Ionicons name="log-out-outline" size={18} color={colors.danger} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.blush50 },
  profileCard: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  avatar: { width: 64, height: 64, borderRadius: radius.pill, backgroundColor: colors.coral600, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.displayBold, fontSize: 22, color: colors.white },
  name: { fontFamily: fonts.displayBold, fontSize: 19, color: colors.ink900 },
  email: { fontFamily: fonts.body, fontSize: 13, color: colors.ink500, marginTop: 2 },
  statsCard: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    ...shadow.card,
  },
  statItem: { flex: 1, alignItems: "center" },
  statDivider: { width: 1, backgroundColor: colors.ink100 },
  statValue: { fontFamily: fonts.displayBold, fontSize: 22, color: colors.coral600 },
  statLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.ink500, marginTop: 4 },
  settingsSection: { paddingHorizontal: spacing.lg, marginTop: spacing.xl },
  sectionLabel: { fontFamily: fonts.bodySemiBold, fontSize: 11, letterSpacing: 0.8, color: colors.ink500, marginBottom: spacing.sm },
  settingsCard: { backgroundColor: colors.white, borderRadius: radius.lg, overflow: "hidden", ...shadow.card },
  settingsRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.md },
  settingsRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.ink50 },
  settingsIconWrap: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.ink50, alignItems: "center", justifyContent: "center" },
  settingsTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.ink900 },
  settingsSubtitle: { fontFamily: fonts.body, fontSize: 12, color: colors.ink500, marginTop: 1 },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    ...shadow.card,
  },
  signOutText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.danger },
});
