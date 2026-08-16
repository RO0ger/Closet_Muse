import { View, Text, Pressable, ActivityIndicator, Linking, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius, shadow, spacing } from "../constants/theme";
import { WeatherSnapshot } from "../constants/mockData";
import { weatherRules } from "../lib/weather";

function iconFor(condition: string): keyof typeof Ionicons.glyphMap {
  const c = condition.toLowerCase();
  if (c.includes("rain") || c.includes("drizzle") || c.includes("shower")) return "rainy";
  if (c.includes("snow")) return "snow";
  if (c.includes("thunder")) return "thunderstorm";
  if (c.includes("fog")) return "cloud-outline";
  if (c.includes("overcast")) return "cloudy";
  if (c.includes("cloud")) return "partly-sunny";
  return "sunny";
}

interface WeatherWidgetProps {
  weather: WeatherSnapshot;
  loading: boolean;
  permissionDenied: boolean;
  canAskAgain: boolean;
  error: string | null;
  onEnableLocation: () => void;
  onRefresh: () => void;
}

export default function WeatherWidget({ weather, loading, permissionDenied, canAskAgain, error, onEnableLocation, onRefresh }: WeatherWidgetProps) {
  const rules = weatherRules(weather);

  if (loading) {
    return (
      <View style={[styles.card, styles.centerContent]}>
        <ActivityIndicator color={colors.coral600} />
        <Text style={styles.loadingText}>Getting your location...</Text>
      </View>
    );
  }

  if (permissionDenied) {
    return (
      <View style={[styles.card, styles.centerContent]}>
        <Ionicons name="location-outline" size={24} color={colors.ink300} />
        <Text style={styles.loadingText}>
          {canAskAgain ? "Enable location for local weather" : "Location access is turned off for ClosetMuse"}
        </Text>
        <Pressable
          style={styles.retryBtn}
          onPress={canAskAgain ? onEnableLocation : () => Linking.openSettings()}
          accessibilityRole="button"
          accessibilityLabel={canAskAgain ? "Enable location" : "Open device settings"}
        >
          <Text style={styles.retryText}>{canAskAgain ? "Enable Location" : "Open Settings"}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={12} color={colors.ink500} />
            <Text style={styles.location} numberOfLines={1}>{weather.location_label}</Text>
          </View>
          <View style={styles.tempRow}>
            <Text style={styles.temp}>{Math.round(weather.temperature_c)}°</Text>
            <Text style={styles.condition}>{weather.condition_text}</Text>
          </View>
        </View>
        <Pressable onPress={onRefresh} accessibilityRole="button" accessibilityLabel="Refresh weather">
          <Ionicons name={iconFor(weather.condition_text)} size={40} color={colors.coral600} />
        </Pressable>
      </View>
      {error && (
        <Text style={styles.errorText}>Couldn't refresh weather — showing last known conditions.</Text>
      )}
      <View style={styles.divider} />
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons name="water-outline" size={16} color={colors.ink500} />
          <Text style={styles.metaLabel}>Humidity</Text>
          <Text style={styles.metaValue}>{weather.humidity_pct}%</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="speedometer-outline" size={16} color={colors.ink500} />
          <Text style={styles.metaLabel}>Wind</Text>
          <Text style={styles.metaValue}>{Math.round(weather.wind_kph)} km/h</Text>
        </View>
      </View>
      <View style={styles.tipRow}>
        <Ionicons name="layers-outline" size={14} color={colors.coral600} />
        <Text style={styles.tip}>{rules.layeringTip}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.card,
  },
  centerContent: { alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.lg },
  loadingText: { fontFamily: fonts.body, fontSize: 13, color: colors.ink500, textAlign: "center" },
  retryBtn: { marginTop: spacing.xs, backgroundColor: colors.coral600, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  retryText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.white },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
  location: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink500, flexShrink: 1 },
  tempRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
  temp: { fontFamily: fonts.displayBold, fontSize: 34, color: colors.ink900 },
  condition: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink700 },
  errorText: { fontFamily: fonts.body, fontSize: 11, color: colors.warning, marginTop: spacing.xs },
  divider: { height: 1, backgroundColor: colors.ink100, marginVertical: spacing.md },
  metaRow: { flexDirection: "row", gap: spacing.xl },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaLabel: { fontFamily: fonts.body, fontSize: 13, color: colors.ink500 },
  metaValue: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.ink900 },
  tipRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.md },
  tip: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.coral700 },
});
