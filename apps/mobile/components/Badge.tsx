import { View, Text, StyleSheet } from "react-native";
import { colors, fonts, radius, spacing } from "../constants/theme";

type Tone = "coral" | "ai" | "success" | "warning" | "danger" | "neutral";

interface BadgeProps {
  label: string;
  tone?: Tone;
}

const TONE_STYLES: Record<Tone, { bg: string; fg: string }> = {
  coral: { bg: colors.coral100, fg: colors.coral700 },
  ai: { bg: colors.ai100, fg: colors.ai700 }, // AI-generated content only — see theme.ts
  success: { bg: colors.successBg, fg: colors.success },
  warning: { bg: colors.warningBg, fg: colors.warning },
  danger: { bg: colors.dangerBg, fg: colors.danger },
  neutral: { bg: colors.ink100, fg: colors.ink700 },
};

export default function Badge({ label, tone = "neutral" }: BadgeProps) {
  const t = TONE_STYLES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={[styles.text, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  text: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.3,
  },
});
