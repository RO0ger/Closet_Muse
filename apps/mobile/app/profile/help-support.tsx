import { useState } from "react";
import { View, Text, ScrollView, Pressable, Linking, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, radius, shadow, spacing, app } from "../../constants/theme";
import { notify } from "../../lib/platformAlert";

const FAQS: { question: string; answer: string }[] = [
  {
    question: "How does auto-tagging work?",
    answer: "When you upload a photo, AI analyzes the image to identify category, colour, pattern, and formality automatically. If it isn't confident enough, the item is flagged for you to review and correct instead of guessing.",
  },
  {
    question: "Why did I get this outfit recommendation?",
    answer: "Each outfit is scored on four things: how well the colours/pieces work together, how well the formality matches your occasion, how recently you've worn similar pieces, and your past feedback. Tap any outfit's \"Why this works\" section to see the exact breakdown.",
  },
  {
    question: "Does the weather affect my outfits?",
    answer: "Yes — recommendations use your device's real location and current conditions. Below 10°C, outerwear is prioritised; if it's raining, waterproof footwear is preferred.",
  },
  {
    question: "Can I fix a tag the AI got wrong?",
    answer: "Yes. Open the item from your Wardrobe tab and tap \"Edit tags\" to correct the category, colour, or name at any time — not just during upload.",
  },
  {
    question: "What happens when I tap \"Worn\", \"Saved\", or \"Dismissed\"?",
    answer: "Your feedback adjusts future recommendation scoring — worn outfits nudge similar pairings up, dismissed ones nudge them down. You have 5 seconds to undo any action.",
  },
  {
    question: "Is my wardrobe data private?",
    answer: "Yes — no social features, no other users can see your wardrobe. See Privacy & Security for data export and deletion options.",
  },
];

export default function HelpSupportScreen() {
  const insets = useSafeAreaInsets();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  async function handleContactSupport() {
    const url = `mailto:${app.supportEmail}?subject=ClosetMuse Support Request`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      Linking.openURL(url);
    } else {
      notify("Couldn't open Mail", `Reach us directly at ${app.supportEmail}`);
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxxl, paddingHorizontal: spacing.xl }}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={colors.ink900} />
        </Pressable>
        <Text style={styles.title}>Help & Support</Text>
        <View style={styles.backBtn} />
      </View>

      <Text style={styles.sectionLabel}>Frequently Asked Questions</Text>
      <View style={styles.card}>
        {FAQS.map((faq, index) => {
          const isExpanded = expandedIndex === index;
          return (
            <View key={faq.question} style={index !== FAQS.length - 1 ? styles.rowBorder : undefined}>
              <Pressable
                style={styles.faqRow}
                onPress={() => setExpandedIndex(isExpanded ? null : index)}
                accessibilityRole="button"
                accessibilityState={{ expanded: isExpanded }}
              >
                <Text style={styles.faqQuestion}>{faq.question}</Text>
                <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color={colors.ink500} />
              </Pressable>
              {isExpanded && <Text style={styles.faqAnswer}>{faq.answer}</Text>}
            </View>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>Contact</Text>
      <Pressable style={styles.contactCard} onPress={handleContactSupport} accessibilityRole="button" accessibilityLabel="Contact support">
        <View style={styles.contactIcon}>
          <Ionicons name="mail" size={20} color={colors.coral600} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>Email Support</Text>
          <Text style={styles.rowSubtitle}>{app.supportEmail}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.ink300} />
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.blush50 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.lg },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.displayBold, fontSize: 19, color: colors.ink900 },
  sectionLabel: { fontFamily: fonts.bodySemiBold, fontSize: 12, letterSpacing: 0.6, color: colors.ink500, marginBottom: spacing.sm, marginTop: spacing.lg },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, ...shadow.card },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.ink50 },
  faqRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg, gap: spacing.md },
  faqQuestion: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.ink900 },
  faqAnswer: { fontFamily: fonts.body, fontSize: 13, color: colors.ink500, lineHeight: 19, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  contactCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, ...shadow.card },
  contactIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.coral100, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: colors.ink900 },
  rowSubtitle: { fontFamily: fonts.body, fontSize: 12, color: colors.ink500, marginTop: 2 },
});
