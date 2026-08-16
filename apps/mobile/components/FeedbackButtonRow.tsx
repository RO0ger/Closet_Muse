import { useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius, spacing } from "../constants/theme";
import { FeedbackAction } from "../constants/mockData";
import { useAppStore } from "../lib/store";

interface FeedbackButtonRowProps {
  outfitId: string;
  onActionConfirmed?: (action: FeedbackAction) => void;
}

const ACTIONS: { key: FeedbackAction; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { key: "worn", icon: "checkmark-circle", label: "Worn" },
  { key: "saved", icon: "bookmark", label: "Saved" },
  { key: "dismissed", icon: "close-circle", label: "Dismissed" },
];

const UNDO_WINDOW_MS = 5000;

export default function FeedbackButtonRow({ outfitId, onActionConfirmed }: FeedbackButtonRowProps) {
  const { addFeedback, removeFeedback } = useAppStore();
  const [pending, setPending] = useState<{ action: FeedbackAction; feedbackId: string } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handlePress(action: FeedbackAction) {
    if (timerRef.current) clearTimeout(timerRef.current);
    const feedbackId = await addFeedback(outfitId, action);
    setPending({ action, feedbackId });
    timerRef.current = setTimeout(() => {
      setPending(null);
      onActionConfirmed?.(action);
    }, UNDO_WINDOW_MS);
  }

  function handleUndo() {
    if (!pending) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    removeFeedback(pending.feedbackId);
    setPending(null);
  }

  if (pending) {
    return (
      <View style={styles.confirmRow}>
        <Ionicons name="checkmark-circle" size={18} color={colors.success} />
        <Text style={styles.confirmText}>Marked as {pending.action}</Text>
        <Pressable onPress={handleUndo} accessibilityRole="button" accessibilityLabel="Undo">
          <Text style={styles.undoText}>Undo</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      {ACTIONS.map((a) => (
        <Pressable
          key={a.key}
          style={styles.btn}
          onPress={() => handlePress(a.key)}
          accessibilityRole="button"
          accessibilityLabel={`Mark outfit as ${a.label}`}
        >
          <Ionicons name={a.icon} size={20} color={colors.ink700} />
          <Text style={styles.btnLabel}>{a.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  btn: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: spacing.md,
    backgroundColor: colors.ink50,
    borderRadius: radius.md,
  },
  btnLabel: { fontFamily: fonts.bodySemiBold, fontSize: 12, color: colors.ink700 },
  confirmRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    backgroundColor: colors.successBg,
    borderRadius: radius.md,
  },
  confirmText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.success },
  undoText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.coral700, marginLeft: spacing.sm },
});
