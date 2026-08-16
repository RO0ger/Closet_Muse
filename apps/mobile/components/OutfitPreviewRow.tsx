import { View, StyleSheet } from "react-native";
import { colors, radius, spacing } from "../constants/theme";
import { WardrobeItem } from "../constants/mockData";
import ItemImage from "./ItemImage";

interface OutfitPreviewRowProps {
  itemIds: { top: string; bottom: string; footwear: string; outerwear?: string };
  items: WardrobeItem[];
  size?: number;
}

export default function OutfitPreviewRow({ itemIds, items, size = 64 }: OutfitPreviewRowProps) {
  const ids = [itemIds.outerwear, itemIds.top, itemIds.bottom, itemIds.footwear].filter(Boolean) as string[];
  return (
    <View style={styles.row}>
      {ids.map((id) => {
        const item = items.find((i) => i.item_id === id);
        if (!item) return null;
        return <ItemImage key={id} uri={item.image} style={[styles.thumb, { width: size, height: size }]} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.sm },
  thumb: {
    borderRadius: radius.md,
    backgroundColor: colors.ink100,
  },
});
