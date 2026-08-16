import { useMemo, useState } from "react";
import { View, Text, TextInput, FlatList, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, radius, spacing } from "../../constants/theme";
import { useAppStore } from "../../lib/store";
import { Category } from "../../constants/mockData";
import ItemCard from "../../components/ItemCard";
import FilterChipBar from "../../components/FilterChipBar";
import WardrobeInsightsCard from "../../components/WardrobeInsightsCard";

const CATEGORY_FILTERS = ["All", "TOP", "BOTTOM", "FOOTWEAR", "OUTERWEAR", "ACCESSORY"] as const;
type CategoryFilter = (typeof CATEGORY_FILTERS)[number];

const CATEGORY_LABELS: Record<CategoryFilter, string> = {
  All: "All",
  TOP: "Tops",
  BOTTOM: "Bottoms",
  FOOTWEAR: "Shoes",
  OUTERWEAR: "Outerwear",
  ACCESSORY: "Accessories",
};

export default function WardrobeScreen() {
  const insets = useSafeAreaInsets();
  const { items, feedback } = useAppStore();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("All");

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchesCategory = category === "All" || item.category === (category as Category);
      const matchesSearch = item.name.toLowerCase().includes(search.trim().toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [items, search, category]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.header}>
        <Text style={styles.title}>My Wardrobe</Text>
        <Text style={styles.subtitle}>{items.length} items</Text>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.ink500} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search clothing..."
            placeholderTextColor={colors.ink300}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      <View style={styles.filterRow}>
        <FilterChipBar
          options={CATEGORY_FILTERS}
          active={category}
          onChange={setCategory}
          labelFor={(c) => CATEGORY_LABELS[c]}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.item_id}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: "space-between" }}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl }}
        ListHeaderComponent={<WardrobeInsightsCard items={items} feedback={feedback} />}
        renderItem={({ item }) => <ItemCard item={item} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="search" size={28} color={colors.ink300} />
            <Text style={styles.emptyText}>No items match your search.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.blush50 },
  header: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  title: { fontFamily: fonts.displayBold, fontSize: 26, color: colors.ink900 },
  subtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.ink500, marginTop: 2 },
  searchRow: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.ink900 },
  filterRow: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  empty: { alignItems: "center", paddingVertical: spacing.xxxl, gap: spacing.sm },
  emptyText: { fontFamily: fonts.body, fontSize: 13, color: colors.ink500 },
});
