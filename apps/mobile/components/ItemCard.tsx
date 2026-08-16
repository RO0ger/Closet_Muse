import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { colors, fonts, radius, shadow, spacing } from "../constants/theme";
import { WardrobeItem } from "../constants/mockData";
import ItemImage from "./ItemImage";
import Badge from "./Badge";

interface ItemCardProps {
  item: WardrobeItem;
}

export default function ItemCard({ item }: ItemCardProps) {
  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/item/${item.item_id}`)}
      accessibilityRole="button"
      accessibilityLabel={`View ${item.name}`}
    >
      <ItemImage uri={item.image} style={styles.image} />
      {item.status === "REVIEW_REQUIRED" && (
        <View style={styles.reviewFlag}>
          <Badge label="Needs review" tone="warning" />
        </View>
      )}
      <Text style={styles.name} numberOfLines={1}>
        {item.name}
      </Text>
      <Badge label={item.primary_colour} tone="neutral" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "48%",
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.sm,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  image: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: radius.md,
    backgroundColor: colors.ink100,
    marginBottom: spacing.sm,
  },
  reviewFlag: {
    position: "absolute",
    top: spacing.sm + 4,
    left: spacing.sm + 4,
  },
  name: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.ink900,
    marginBottom: 4,
  },
});
