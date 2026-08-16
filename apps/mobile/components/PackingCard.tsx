import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius, spacing } from "../constants/theme";
import { PackingList, PackingCategory, WardrobeItem } from "../constants/mockData";
import { parseOutfitId } from "../lib/recommendationEngine";
import OutfitPreviewRow from "./OutfitPreviewRow";

interface Props {
  packing: PackingList;
  items: WardrobeItem[];
  /** Controlled by a chat-list owner when rendered in a virtualized list. */
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

function CategorySection({ cat }: { cat: PackingCategory }) {
  const missing = cat.targetCount - cat.items.length;
  return (
    <View style={cat_s.block}>
      <View style={cat_s.header}>
        <Text style={cat_s.label}>{cat.label}</Text>
        <Text style={cat_s.count}>{cat.targetCount} needed</Text>
      </View>
      {cat.items.map((item) => (
        <View key={item.item_id} style={cat_s.row}>
          <Ionicons name="shirt-outline" size={14} color={colors.ai600} />
          <Text style={cat_s.itemName} numberOfLines={1}>{item.name}</Text>
        </View>
      ))}
      {missing > 0 && (
        <View style={cat_s.missingRow}>
          <Ionicons name="alert-circle-outline" size={13} color={colors.warning} />
          <Text style={cat_s.missingText}>
            {missing} more needed — not in your wardrobe
          </Text>
        </View>
      )}
    </View>
  );
}

const cat_s = StyleSheet.create({
  block: { marginBottom: spacing.md },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
  label: { flex: 1, flexShrink: 1, fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.ink900 },
  count: { flexShrink: 1, fontFamily: fonts.body, fontSize: 11, color: colors.ink500, textAlign: "right" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingVertical: 3 },
  itemName: { fontFamily: fonts.body, fontSize: 13, color: colors.ink700, flex: 1 },
  missingRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingTop: 2 },
  missingText: { flex: 1, flexShrink: 1, fontFamily: fonts.body, fontSize: 11, color: colors.warning },
});

export default function PackingCard({ packing, items, expanded, onExpandedChange }: Props) {
  const [localExpanded, setLocalExpanded] = useState(false);
  const showSamples = expanded ?? localExpanded;
  const setShowSamples = (next: boolean) => {
    if (expanded === undefined) setLocalExpanded(next);
    onExpandedChange?.(next);
  };

  const weatherLine = `${packing.minC}°–${packing.maxC}°C${packing.rainDays > 0 ? ` · ${packing.rainDays} rainy day${packing.rainDays > 1 ? "s" : ""}` : ""}`;

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="bag-outline" size={16} color={colors.white} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.destination} numberOfLines={1}>{packing.destination}</Text>
          <Text style={styles.meta}>{packing.days} day{packing.days !== 1 ? "s" : ""} · {weatherLine}</Text>
        </View>
      </View>

      {/* Clothing categories */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>CLOTHING</Text>
        {packing.categories.map((cat, i) => (
          <CategorySection key={i} cat={cat} />
        ))}
      </View>

      {/* Essentials */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>DON'T FORGET</Text>
        {packing.essentials.map((e, i) => (
          <View key={i} style={styles.essentialRow}>
            <Ionicons name="checkmark-circle-outline" size={14} color={colors.ai600} />
            <Text style={styles.essentialText}>{e}</Text>
          </View>
        ))}
      </View>

      {/* Sample outfits */}
      {packing.sampleOutfitIds.length > 0 && (
        <View style={styles.section}>
          <Pressable
            style={styles.sampleToggle}
            onPress={() => setShowSamples(!showSamples)}
            accessibilityRole="button"
            accessibilityLabel={showSamples ? "Hide outfit ideas" : "Show outfit ideas"}
          >
            <Text style={styles.sectionTitle}>OUTFIT IDEAS FOR THE TRIP</Text>
            <Ionicons name={showSamples ? "chevron-up" : "chevron-down"} size={14} color={colors.ink500} />
          </Pressable>
          {showSamples && packing.sampleOutfitIds.map((id, i) => {
            try {
              const ids = parseOutfitId(id);
              return (
                <View key={i} style={styles.outfitRow}>
                  <OutfitPreviewRow itemIds={ids} items={items} size={44} />
                </View>
              );
            } catch {
              return null;
            }
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.ai100,
    borderRadius: radius.lg,
    overflow: "hidden",
    marginTop: spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.ai600,
    padding: spacing.md,
  },
  headerText: { flex: 1, minWidth: 0 },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.ai700,
    alignItems: "center",
    justifyContent: "center",
  },
  destination: { flexShrink: 1, fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.white },
  meta: { flexShrink: 1, fontFamily: fonts.body, fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 1 },
  section: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xs },
  sectionTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    color: colors.ai700,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
  },
  essentialRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingVertical: 3 },
  essentialText: { flex: 1, flexShrink: 1, fontFamily: fonts.body, fontSize: 13, color: colors.ink700 },
  sampleToggle: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  outfitRow: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
});
