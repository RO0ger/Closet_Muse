import { Pressable, Text, StyleSheet } from "react-native";
import { colors, fonts, radius, shadow, spacing } from "../constants/theme";

interface SuggestedPromptChipProps {
  label: string;
  onPress: () => void;
}

export default function SuggestedPromptChip({ label, onPress }: SuggestedPromptChipProps) {
  return (
    <Pressable style={styles.chip} onPress={onPress} accessibilityRole="button" accessibilityLabel={`Use prompt: ${label}`}>
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  text: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.ink900 },
});
