import { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, radius, spacing } from "../../constants/theme";
import { useAppStore } from "../../lib/store";
import { Category } from "../../constants/mockData";
import ItemImage from "../../components/ItemImage";
import Badge from "../../components/Badge";
import FormField from "../../components/FormField";
import PrimaryButton from "../../components/PrimaryButton";
import { confirmAsync } from "../../lib/platformAlert";

const CATEGORIES: Category[] = ["TOP", "BOTTOM", "FOOTWEAR", "OUTERWEAR", "ACCESSORY"];

export default function ItemDetail() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { items, updateItem, removeItem } = useAppStore();
  const item = items.find((i) => i.item_id === id);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item?.name ?? "");
  const [category, setCategory] = useState<Category>(item?.category ?? "TOP");
  const [colour, setColour] = useState(item?.primary_colour ?? "");

  if (!item) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.notFound}>Item not found.</Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.backLink}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  function handleSave() {
    updateItem(item!.item_id, { name, category, primary_colour: colour, status: "READY", confidence: 1.0 });
    setEditing(false);
  }

  async function handleDelete() {
    const confirmed = await confirmAsync("Remove item", `Remove "${item!.name}" from your wardrobe?`, "Remove");
    if (confirmed) {
      removeItem(item!.item_id);
      router.back();
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: spacing.xxxl, paddingHorizontal: spacing.xl }}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={colors.ink900} />
        </Pressable>
        <Pressable onPress={handleDelete} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Delete item">
          <Ionicons name="trash-outline" size={20} color={colors.danger} />
        </Pressable>
      </View>

      <ItemImage uri={item.image} style={styles.image} />

      {editing ? (
        <>
          <FormField label="Item name" value={name} onChangeText={setName} />
          <Text style={styles.sectionLabel}>Category</Text>
          <View style={styles.chipWrap}>
            {CATEGORIES.map((c) => (
              <Pressable key={c} style={[styles.chip, category === c && styles.chipActive]} onPress={() => setCategory(c)} accessibilityRole="button">
                <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
              </Pressable>
            ))}
          </View>
          <FormField label="Primary colour" value={colour} onChangeText={setColour} />
          <PrimaryButton label="Save changes" onPress={handleSave} />
        </>
      ) : (
        <>
          <View style={styles.titleRow}>
            <Text style={styles.name}>{item.name}</Text>
            {item.status === "REVIEW_REQUIRED" && <Badge label="Needs review" tone="warning" />}
          </View>
          <View style={styles.badgeRow}>
            <Badge label={item.category} tone="coral" />
            <Badge label={item.primary_colour} tone="neutral" />
            <Badge label={`Formality ${item.formality}/5`} tone="neutral" />
          </View>
          <View style={styles.badgeRow}>
            <Badge label={item.season.join(", ")} tone="neutral" />
            <Badge label={`${Math.round(item.confidence * 100)}% confidence`} tone="ai" />
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={16} color={colors.ink500} />
            <Text style={styles.infoText}>
              {item.last_worn_at ? `Last worn ${new Date(item.last_worn_at).toLocaleDateString()}` : "Not worn yet"}
            </Text>
          </View>

          <View style={{ marginTop: spacing.xl }}>
            <PrimaryButton label="Edit tags" onPress={() => setEditing(true)} variant="outline" />
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.blush50 },
  center: { alignItems: "center", justifyContent: "center" },
  notFound: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink500, marginBottom: spacing.sm },
  backLink: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.coral600 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  image: { width: "100%", height: 280, borderRadius: radius.xl, backgroundColor: colors.ink100, marginBottom: spacing.lg },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  name: { fontFamily: fonts.displayBold, fontSize: 22, color: colors.ink900, flex: 1 },
  badgeRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm, flexWrap: "wrap" },
  infoRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
  infoText: { fontFamily: fonts.body, fontSize: 13, color: colors.ink500 },
  sectionLabel: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.ink700, marginBottom: spacing.sm },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.lg },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.ink100, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.coral600, borderColor: colors.coral600 },
  chipText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.ink700 },
  chipTextActive: { color: colors.white },
});
