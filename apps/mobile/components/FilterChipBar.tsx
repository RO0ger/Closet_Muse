import { ScrollView, Pressable, Text, StyleSheet } from "react-native";
import { colors, fonts, radius, spacing } from "../constants/theme";

interface FilterChipBarProps<T extends string> {
  options: readonly T[];
  active: T;
  onChange: (value: T) => void;
  labelFor?: (value: T) => string;
}

export default function FilterChipBar<T extends string>({ options, active, onChange, labelFor }: FilterChipBarProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {options.map((opt) => {
        const isActive = opt === active;
        return (
          <Pressable
            key={opt}
            style={[styles.chip, isActive && styles.chipActive]}
            onPress={() => onChange(opt)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`Filter by ${labelFor ? labelFor(opt) : opt}`}
          >
            <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{labelFor ? labelFor(opt) : opt}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.sm,
    paddingRight: spacing.xl,
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.ink100,
    backgroundColor: colors.white,
  },
  chipActive: {
    backgroundColor: colors.coral600,
    borderColor: colors.coral600,
  },
  chipText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.ink700,
  },
  chipTextActive: {
    color: colors.white,
  },
});
