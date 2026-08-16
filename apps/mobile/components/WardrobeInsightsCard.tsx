import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius, spacing, shadow } from "../constants/theme";
import { WardrobeItem, FeedbackEntry } from "../constants/mockData";
import {
  categoryCounts,
  colorDistribution,
  formalitySpread,
  wearStats,
  gapRules,
  Gap,
} from "../lib/wardrobeAnalytics";

interface Props {
  items: WardrobeItem[];
  feedback: FeedbackEntry[];
}

const CATEGORY_LABELS: Record<string, string> = {
  TOP: "Tops",
  BOTTOM: "Bottoms",
  FOOTWEAR: "Shoes",
  OUTERWEAR: "Outerwear",
  ACCESSORY: "Accessories",
};

const SEVERITY_COLORS: Record<Gap["severity"], string> = {
  warning: colors.danger,
  info: colors.warning,
  suggestion: colors.coral600,
};

const SEVERITY_BG: Record<Gap["severity"], string> = {
  warning: colors.dangerBg,
  info: colors.warningBg,
  suggestion: colors.coral100,
};

const SEVERITY_ICONS: Record<Gap["severity"], string> = {
  warning: "alert-circle",
  info: "information-circle",
  suggestion: "bulb",
};

function Bar({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? count / max : 0;
  return (
    <View style={bar.row}>
      <Text style={bar.label} numberOfLines={1}>{label}</Text>
      <View style={bar.track}>
        <View style={[bar.fill, { flex: pct }]} />
        <View style={{ flex: 1 - pct }} />
      </View>
      <Text style={bar.value}>{count}</Text>
    </View>
  );
}

const bar = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
  label: { width: 76, fontFamily: fonts.body, fontSize: 12, color: colors.ink700 },
  track: { flex: 1, height: 8, borderRadius: radius.pill, backgroundColor: colors.ink100, flexDirection: "row", overflow: "hidden" },
  fill: { backgroundColor: colors.coral500, borderRadius: radius.pill },
  value: { width: 22, textAlign: "right", fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.ink700 },
});

export default function WardrobeInsightsCard({ items, feedback }: Props) {
  const [expanded, setExpanded] = useState(false);

  const readyItems = items.filter((i) => i.status === "READY");
  const gaps = gapRules(readyItems);
  const topGap = gaps[0];

  const cats = categoryCounts(readyItems);
  const catMax = Math.max(...cats.map((c) => c.count), 1);

  const colours = colorDistribution(readyItems).slice(0, 5);
  const colourMax = Math.max(...colours.map((c) => c.count), 1);

  const formality = formalitySpread(readyItems);
  const formalityMax = Math.max(...formality.map((f) => f.count), 1);

  const { mostWorn, leastWorn } = wearStats(readyItems, feedback);

  return (
    <View style={styles.card}>
      {/* Header row — always visible */}
      <Pressable style={styles.header} onPress={() => setExpanded((v) => !v)} accessibilityRole="button" accessibilityLabel={expanded ? "Collapse insights" : "Expand insights"}>
        <View style={styles.headerLeft}>
          <View style={styles.iconWrap}>
            <Ionicons name="bar-chart" size={16} color={colors.coral600} />
          </View>
          <View>
            <Text style={styles.title}>Wardrobe Insights</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {readyItems.length} items{topGap ? ` · ${topGap.message}` : " · Looking complete!"}
            </Text>
          </View>
        </View>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.ink500} />
      </Pressable>

      {expanded && (
        <View style={styles.body}>
          {/* Category breakdown */}
          <Text style={styles.sectionTitle}>By Category</Text>
          {cats.map((c) => (
            <Bar key={c.category} label={CATEGORY_LABELS[c.category]} count={c.count} max={catMax} />
          ))}

          {/* Colour distribution */}
          {colours.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Top Colours</Text>
              {colours.map((c) => (
                <View key={c.colour} style={bar.row}>
                  <Text style={bar.label} numberOfLines={1}>{c.colour.charAt(0).toUpperCase() + c.colour.slice(1)}</Text>
                  <View style={bar.track}>
                    <View style={[bar.fill, { flex: c.count / colourMax }]} />
                    <View style={{ flex: 1 - c.count / colourMax }} />
                  </View>
                  <Text style={bar.value}>{c.pct}%</Text>
                </View>
              ))}
            </>
          )}

          {/* Formality spread */}
          <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Formality Range</Text>
          {formality.map((f) => (
            <Bar key={f.level} label={f.label} count={f.count} max={formalityMax} />
          ))}

          {/* Most / Least worn */}
          {mostWorn.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Most Worn</Text>
              {mostWorn.map(({ item, wearCount }) => (
                <View key={item.item_id} style={styles.wearRow}>
                  <Text style={styles.wearName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.wearCount}>{wearCount}×</Text>
                </View>
              ))}
            </>
          )}
          {leastWorn.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>Never Worn</Text>
              {leastWorn.map(({ item }) => (
                <View key={item.item_id} style={styles.wearRow}>
                  <Text style={styles.wearName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.wearUnused}>Not worn yet</Text>
                </View>
              ))}
            </>
          )}

          {/* Gap analysis */}
          {gaps.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Wardrobe Gaps</Text>
              {gaps.map((g, i) => (
                <View key={i} style={[styles.gapCard, { backgroundColor: SEVERITY_BG[g.severity] }]}>
                  <View style={styles.gapHeader}>
                    <Ionicons name={SEVERITY_ICONS[g.severity] as any} size={15} color={SEVERITY_COLORS[g.severity]} />
                    <Text style={[styles.gapMessage, { color: SEVERITY_COLORS[g.severity] }]}>{g.message}</Text>
                  </View>
                  {g.suggestion && (
                    <Text style={styles.gapSuggestion}>{g.suggestion}</Text>
                  )}
                </View>
              ))}
            </>
          )}
          {gaps.length === 0 && (
            <View style={styles.allGood}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={styles.allGoodText}>Your wardrobe looks well-rounded!</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    overflow: "hidden",
    ...shadow.card,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: spacing.md, flex: 1 },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.coral100,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.ink900 },
  subtitle: { fontFamily: fonts.body, fontSize: 12, color: colors.ink500, marginTop: 1, maxWidth: 220 },
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, borderTopWidth: 1, borderTopColor: colors.ink100 },
  sectionTitle: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.ink500, textTransform: "uppercase", letterSpacing: 0.5, marginTop: spacing.lg, marginBottom: spacing.sm },
  wearRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.xs },
  wearName: { fontFamily: fonts.body, fontSize: 13, color: colors.ink700, flex: 1 },
  wearCount: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.coral600 },
  wearUnused: { fontFamily: fonts.body, fontSize: 12, color: colors.ink300 },
  gapCard: {
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  gapHeader: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  gapMessage: { fontFamily: fonts.bodySemiBold, fontSize: 13, flex: 1 },
  gapSuggestion: { fontFamily: fonts.body, fontSize: 12, color: colors.ink700, marginTop: spacing.xs, lineHeight: 17 },
  allGood: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingTop: spacing.md },
  allGoodText: { fontFamily: fonts.body, fontSize: 13, color: colors.success },
});
