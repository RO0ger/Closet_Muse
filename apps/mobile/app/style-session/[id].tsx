import { useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, radius, spacing } from "../../constants/theme";
import { useAppStore } from "../../lib/store";
import { parseOutfitId } from "../../lib/recommendationEngine";
import  ChatBubble  from "../../components/ChatBubble";

export default function StyleSessionDetail() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { sessions, items } = useAppStore();
  const session = sessions.find((s) => s.session_id === id);
  const [expandedPackingMessageIds, setExpandedPackingMessageIds] = useState<Record<string, boolean>>({});

  if (!session) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.notFound}>Conversation not found.</Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.backLink}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={colors.ink900} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>{session.title}</Text>
        <View style={styles.iconBtn} />
      </View>
      <FlatList
        data={session.messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: spacing.lg }}
        renderItem={({ item }) => {
          const outfitIds = item.outfit_id ? parseOutfitId(item.outfit_id) : undefined;
          return (
            <ChatBubble
              message={item}
              outfitItemIds={outfitIds}
              items={items}
              packingExpanded={expandedPackingMessageIds[item.id]}
              onPackingExpansionChange={(messageId, expanded) =>
                setExpandedPackingMessageIds((current) => ({ ...current, [messageId]: expanded }))
              }
            />
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.blush50 },
  center: { alignItems: "center", justifyContent: "center" },
  notFound: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink500, marginBottom: spacing.sm },
  backLink: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.coral600 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.ink100 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, textAlign: "center", fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.ink900 },
});
