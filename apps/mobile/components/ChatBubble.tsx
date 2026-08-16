import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius, spacing } from "../constants/theme";
import { ChatMessage, WardrobeItem } from "../constants/mockData";
import OutfitPreviewRow from "./OutfitPreviewRow";
import PackingCard from "./PackingCard";

interface ChatBubbleProps {
  message: ChatMessage & { delivery_status?: "pending" | "failed" | "succeeded" };
  outfitItemIds?: { top: string; bottom: string; footwear: string; outerwear?: string };
  items: WardrobeItem[];
  /** Kept by the list owner so virtualization never resets an expanded card. */
  packingExpanded?: boolean;
  onPackingExpansionChange?: (messageId: string, expanded: boolean) => void;
}

export default function ChatBubble({
  message,
  outfitItemIds,
  items,
  packingExpanded,
  onPackingExpansionChange,
}: ChatBubbleProps) {
  const isAssistant = message.role === "assistant";
  const isPending = message.delivery_status === "pending";

  return (
    <View style={styles.message}>
      <View style={[styles.row, isAssistant ? styles.rowLeft : styles.rowRight]}>
        {isAssistant && (
          <View style={styles.avatar}>
            <Ionicons name="sparkles" size={14} color={colors.white} />
          </View>
        )}
        <View style={[styles.bubble, isAssistant ? styles.bubbleAssistant : styles.bubbleUser]}>
          <Text style={[styles.text, isAssistant ? styles.textAssistant : styles.textUser]}>{message.content}</Text>
          {isPending && (
            <View style={styles.pending} accessibilityLabel="Style Me is thinking">
              <Ionicons name="ellipsis-horizontal" size={16} color={colors.ai600} />
              <Text style={styles.pendingText}>Thinking…</Text>
            </View>
          )}
          {isAssistant && outfitItemIds && (
            <Pressable
              style={styles.outfitPreview}
              onPress={() => message.outfit_id && router.push({ pathname: "/outfit/[id]", params: { id: message.outfit_id } })}
              accessibilityRole="button"
              accessibilityLabel="View suggested outfit"
            >
              <OutfitPreviewRow itemIds={outfitItemIds} items={items} size={48} />
              <Ionicons name="chevron-forward" size={16} color={colors.ink500} />
            </Pressable>
          )}
        </View>
      </View>
      {isAssistant && message.packing && (
        <View style={styles.packingRow}>
          <View style={styles.packingSpacer} />
          <PackingCard
            packing={message.packing}
            items={items}
            expanded={packingExpanded}
            onExpandedChange={(expanded) => onPackingExpansionChange?.(message.id, expanded)}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  message: { marginBottom: spacing.md },
  row: { flexDirection: "row", marginBottom: spacing.md, alignItems: "flex-end", gap: spacing.sm },
  rowLeft: { justifyContent: "flex-start" },
  rowRight: { justifyContent: "flex-end" },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.ai600,
    alignItems: "center",
    justifyContent: "center",
  },
  bubble: {
    maxWidth: "78%",
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  bubbleAssistant: {
    backgroundColor: colors.ai100,
    borderTopLeftRadius: 4,
  },
  bubbleUser: {
    backgroundColor: colors.coral600,
    borderTopRightRadius: 4,
  },
  text: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  textAssistant: { color: colors.ink900 },
  textUser: { color: colors.white },
  pending: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs },
  pendingText: { fontFamily: fonts.body, fontSize: 12, color: colors.ai600 },
  outfitPreview: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  packingRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  packingSpacer: { width: 28, flexShrink: 0 },
});
