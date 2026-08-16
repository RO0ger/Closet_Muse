import { Pressable, Text, StyleSheet, ActivityIndicator } from "react-native";
import { colors, fonts, radius, shadow, spacing } from "../constants/theme";

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline";
  loading?: boolean;
  disabled?: boolean;
}

export default function PrimaryButton({ label, onPress, variant = "primary", loading, disabled }: PrimaryButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      style={[
        styles.base,
        variant === "primary" && styles.primary,
        variant === "secondary" && styles.secondary,
        variant === "outline" && styles.outline,
        isDisabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled }}
    >
      {loading ? (
        <ActivityIndicator color={variant === "outline" ? colors.coral600 : colors.white} />
      ) : (
        <Text
          style={[
            styles.label,
            variant === "outline" && { color: colors.coral600 },
            variant === "secondary" && { color: colors.ink900 },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    paddingVertical: spacing.md + 2,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: { backgroundColor: colors.coral600 },
  secondary: { backgroundColor: colors.ink100 },
  outline: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: colors.coral600 },
  disabled: { opacity: 0.5 },
  label: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.white },
});
