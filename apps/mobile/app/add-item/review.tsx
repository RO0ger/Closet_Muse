import { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, radius, spacing, AUTO_TAG_CONFIDENCE_THRESHOLD } from "../..//constants/theme";
import { useAppStore } from "../../lib/store";
import { Category } from "../../constants/mockData";
import ItemImage from "../../components/ItemImage";
import Badge from "../../components/Badge";
import FormField from "../../components/FormField";
import PrimaryButton from "../../components/PrimaryButton";
import { supabase } from "../../lib/supabaseClient";
import { notify } from "../../lib/platformAlert";

const CATEGORIES: Category[] = ["TOP", "BOTTOM", "FOOTWEAR", "OUTERWEAR", "ACCESSORY"];

export default function AddItemReview() {
  const insets = useSafeAreaInsets();
  const { draftItem, refreshWardrobe } = useAppStore();
  const result = draftItem?.result;
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(result?.name ?? "");
  const [category, setCategory] = useState<Category>(result?.category ?? "TOP");
  const [colour, setColour] = useState(result?.primary_colour ?? "");

  // Guards against a direct deep-link into this screen without a draft.
  useEffect(() => {
    if (!draftItem || !result) {
      router.replace("/add-item");
    }
  }, [draftItem, result]);

  if (!draftItem || !result) {
    return <View style={styles.screen} />;
  }

  const needsReview = result.confidence < AUTO_TAG_CONFIDENCE_THRESHOLD;

  async function handleConfirm() {
    setSaving(true);
    try {
      // This item row already exists (created during upload — see
      // lib/wardrobeUpload.ts). Confirming here means correcting whatever
      // the user changed and marking it READY, per UC-02's "Confirm or
      // edit tags" step — not creating a second row.
      const { error: updateError } = await supabase
        .from("wardrobe_items")
        .update({ name, category, primary_colour: colour, status: "READY" })
        .eq("item_id", draftItem!.itemId);
      if (updateError) throw new Error(updateError.message);

      if (needsReview) {
        const { error: tagError } = await supabase.from("item_tags").insert({
          item_id: draftItem!.itemId,
          tag: `${colour} ${category}`,
          source: "USER",
          confidence: 1.0,
        });
        if (tagError) throw new Error(tagError.message);
      }

      // Refetch rather than hand-rolling a WardrobeItem locally — reuses
      // lib/api.ts's mapping (signed image URL, CV confidence, etc.)
      // instead of duplicating it here.
      await refreshWardrobe();
      router.replace("/add-item/success");
    } catch (err) {
      notify("Couldn't save item", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxxl, paddingHorizontal: spacing.xl }}
    >
      <Pressable onPress={() => router.replace("/add-item")} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Cancel">
        <Ionicons name="close" size={24} color={colors.ink900} />
      </Pressable>

      <ItemImage uri={draftItem.uri} style={styles.image} />

      {needsReview ? (
        <View style={styles.reviewBanner}>
          <Ionicons name="alert-circle" size={18} color={colors.warning} />
          <Text style={styles.reviewBannerText}>
            Confidence {Math.round(result.confidence * 100)}% — below our {Math.round(AUTO_TAG_CONFIDENCE_THRESHOLD * 100)}% threshold. Please review and correct the tags below.
          </Text>
        </View>
      ) : (
        <View style={styles.readyBanner}>
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <Text style={styles.readyBannerText}>{Math.round(result.confidence * 100)}% confidence — looks good!</Text>
        </View>
      )}

      <FormField label="Item name" value={name} onChangeText={setName} placeholder="e.g. Navy Blazer" />

      <Text style={styles.sectionLabel}>Category</Text>
      <View style={styles.chipWrap}>
        {CATEGORIES.map((c) => (
          <Pressable
            key={c}
            style={[styles.chip, category === c && styles.chipActive]}
            onPress={() => setCategory(c)}
            accessibilityRole="button"
            accessibilityState={{ selected: category === c }}
          >
            <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
          </Pressable>
        ))}
      </View>

      <FormField label="Primary colour" value={colour} onChangeText={setColour} placeholder="e.g. Navy" />

      <View style={styles.metaRow}>
        <Badge label={`Formality ${result.formality}/5`} tone="neutral" />
        <Badge label={result.season.join(", ")} tone="neutral" />
      </View>

      <View style={{ marginTop: spacing.xl }}>
        <PrimaryButton label={needsReview ? "Confirm corrected tags" : "Add to wardrobe"} onPress={handleConfirm} disabled={!name.trim() || !colour.trim()} loading={saving} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.blush50 },
  closeBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  image: { width: "100%", height: 220, borderRadius: radius.xl, backgroundColor: colors.ink100, marginBottom: spacing.lg },
  reviewBanner: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.warningBg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    alignItems: "flex-start",
  },
  reviewBannerText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.warning, lineHeight: 18 },
  readyBanner: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.successBg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    alignItems: "center",
  },
  readyBannerText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.success },
  sectionLabel: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.ink700, marginBottom: spacing.sm },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.lg },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.ink100, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.coral600, borderColor: colors.coral600 },
  chipText: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.ink700 },
  chipTextActive: { color: colors.white },
  metaRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
});
