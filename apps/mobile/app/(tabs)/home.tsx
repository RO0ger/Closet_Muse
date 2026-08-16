import { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, radius, shadow, spacing, app } from "../../constants/theme";
import { useAppStore } from "../../lib/store";
import { useWeather } from "../../lib/useWeather";
import { generateRecommendations } from "../../lib/recommendationEngine";
import TodaysPickCard from "../../components/TodaysPickCard";
import WeatherWidget from "../../components/WeatherWidget";
import ItemCard from "../../components/ItemCard";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { items, profile, feedback } = useAppStore();
  const { weather, loading: weatherLoading, permissionDenied, canAskAgain, error: weatherError, enableLocation, refresh: refreshWeather } = useWeather();
  const [pickIndex, setPickIndex] = useState(0);

  const recommendations = useMemo(
    () => (weatherLoading ? [] : generateRecommendations(items, weather, feedback)),
    [items, weather, weatherLoading, feedback],
  );
  const activeOutfit = recommendations[pickIndex % Math.max(recommendations.length, 1)] ?? null;

  const recentItems = items.slice(0, 4);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: spacing.xxxl, paddingHorizontal: spacing.lg }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good morning</Text>
          <Text style={styles.name}>{profile.name.split(" ")[0]}</Text>
        </View>
        <Pressable
          style={styles.avatarBtn}
          onPress={() => router.push("/(tabs)/profile")}
          accessibilityRole="button"
          accessibilityLabel="Open profile"
        >
          <Text style={styles.avatarInitials}>
            {profile.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
          </Text>
        </Pressable>
      </View>

      {/* Today's Pick */}
      <View style={{ marginTop: spacing.lg }}>
        <TodaysPickCard outfit={activeOutfit} weather={weather} onTryAnother={() => setPickIndex((i) => i + 1)} />
      </View>

      {/* Weather */}
      <View style={{ marginTop: spacing.lg }}>
        <WeatherWidget
          weather={weather}
          loading={weatherLoading}
          permissionDenied={permissionDenied}
          canAskAgain={canAskAgain}
          error={weatherError}
          onEnableLocation={enableLocation}
          onRefresh={refreshWeather}
        />
      </View>

      {/* Quick shortcuts */}
      <View style={styles.shortcutRow}>
        <Pressable
          style={styles.shortcutCard}
          onPress={() => router.push("/(tabs)/style-me")}
          accessibilityRole="button"
          accessibilityLabel="Open Style Me"
        >
          <View style={[styles.shortcutIcon, { backgroundColor: colors.ai100 }]}>
            <Ionicons name="sparkles" size={20} color={colors.ai600} />
          </View>
          <Text style={styles.shortcutTitle}>Style Me</Text>
          <Text style={styles.shortcutSubtitle}>AI outfit generator</Text>
        </Pressable>
        <Pressable
          style={styles.shortcutCard}
          onPress={() => router.push("/(tabs)/wardrobe")}
          accessibilityRole="button"
          accessibilityLabel="Open My Wardrobe"
        >
          <View style={[styles.shortcutIcon, { backgroundColor: colors.coral100 }]}>
            <Ionicons name="shirt" size={20} color={colors.coral600} />
          </View>
          <Text style={styles.shortcutTitle}>My Wardrobe</Text>
          <Text style={styles.shortcutSubtitle}>{profile.itemsCount} items</Text>
        </Pressable>
      </View>

      {/* For You */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>For You</Text>
        <Pressable onPress={() => router.push("/(tabs)/wardrobe")} accessibilityRole="button" accessibilityLabel="See all wardrobe items">
          <Text style={styles.seeAll}>See all</Text>
        </Pressable>
      </View>
      <View style={styles.grid}>
        {recentItems.map((item) => (
          <ItemCard key={item.item_id} item={item} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.blush50 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  greeting: { fontFamily: fonts.body, fontSize: 13, color: colors.ink500 },
  name: { fontFamily: fonts.displayBold, fontSize: 24, color: colors.ink900 },
  avatarBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.coral600,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.white },
  shortcutRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  shortcutCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.card,
  },
  shortcutIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  shortcutTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink900 },
  shortcutSubtitle: { fontFamily: fonts.body, fontSize: 12, color: colors.ink500, marginTop: 2 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xl, marginBottom: spacing.md },
  sectionTitle: { fontFamily: fonts.displayBold, fontSize: 18, color: colors.ink900 },
  seeAll: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.coral600 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
});
