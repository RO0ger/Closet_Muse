import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated, Easing, Pressable, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, radius, spacing } from "../../constants/theme";
import { useAppStore } from "../../lib/store";
import { createWardrobeUploadController, UploadStage, WardrobeUploadController, WardrobeUploadError } from "../../lib/wardrobeUpload";
import { isSupabaseConfigured } from "../../lib/supabaseClient";
import { notify } from "../../lib/platformAlert";
import ItemImage from "../../components/ItemImage";

const STAGE_TEXT: Record<UploadStage, string> = {
  PREPARING: "Preparing photo...",
  UPLOADING: "Uploading photo...",
  ANALYSING: "Analysing your item...",
  FINISHING: "Finishing up...",
};

export default function AddItemProcessing() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ uri: string }>();
  const uri = Array.isArray(params.uri) ? params.uri[0] : params.uri ?? "";
  const { setDraftItem } = useAppStore();
  const spin = useRef(new Animated.Value(0)).current;
  const controller = useRef<WardrobeUploadController | null>(null);
  const inFlight = useRef(false);
  const ignored = useRef(false);
  const [stage, setStage] = useState<UploadStage>("PREPARING");
  const [error, setError] = useState<WardrobeUploadError | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true })).start();
  }, [spin]);

  const runUpload = useCallback(async () => {
    if (inFlight.current) return;
    if (!isSupabaseConfigured) {
      notify("Backend not configured", "Add your Supabase keys to apps/mobile/.env before adding items.");
      router.replace("/add-item");
      return;
    }
    if (!uri) {
      router.replace("/add-item");
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    if (!controller.current) controller.current = createWardrobeUploadController(uri, setStage);
    try {
      const { itemId, result } = await controller.current.run();
      if (ignored.current) return;
      const tags = "category" in result.tags ? result.tags : null;
      setDraftItem({
        uri,
        itemId,
        result: tags ? {
          name: tags.name || `${tags.primary_colour} ${tags.category}`,
          category: tags.category as any,
          primary_colour: tags.primary_colour,
          formality: tags.formality as 1 | 2 | 3 | 4 | 5,
          season: tags.season as any,
          confidence: tags.confidence,
        } : {
          name: "New Item", category: "TOP", primary_colour: "", formality: 3,
          season: ["SPRING", "SUMMER", "AUTUMN", "WINTER"], confidence: 0,
        },
      });
      router.replace("/add-item/review");
    } catch (caught) {
      if (ignored.current) return;
      const uploadError = caught instanceof WardrobeUploadError
        ? caught
        : new WardrobeUploadError("UNKNOWN", caught instanceof Error ? caught.message : "Please try again.");
      setError(uploadError);
    } finally {
      inFlight.current = false;
      if (!ignored.current) setBusy(false);
    }
  }, [setDraftItem, uri]);

  useEffect(() => {
    runUpload();
    return () => { ignored.current = true; };
  }, [runUpload]);

  async function cancel() {
    ignored.current = true;
    setBusy(true);
    try {
      await controller.current?.cancel();
      router.replace("/add-item");
    } catch (caught) {
      ignored.current = false;
      notify("Couldn't cancel upload", caught instanceof Error ? caught.message : "Please try again.");
      setBusy(false);
    }
  }

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}>
      <View style={styles.imageWrap}>
        <ItemImage uri={uri} style={styles.image} />
        <View style={styles.overlay}><Animated.View style={{ transform: [{ rotate }] }}><Ionicons name="sparkles" size={32} color={colors.white} /></Animated.View></View>
      </View>
      <Text style={styles.title}>{error ? "Upload needs attention" : STAGE_TEXT[stage]}</Text>
      {busy ? <ActivityIndicator color={colors.coral600} style={styles.spinner} /> : null}
      {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error.message}</Text><Text style={styles.errorCode}>Code: {error.code}</Text></View> : <Text style={styles.subtitle}>AI is identifying category, colour, pattern, and formality.</Text>}
      {error ? <Pressable style={styles.retry} onPress={runUpload} accessibilityRole="button"><Text style={styles.retryText}>Retry</Text></Pressable> : null}
      <Pressable style={styles.cancel} onPress={cancel} accessibilityRole="button"><Text style={styles.cancelText}>{error ? "Choose another photo" : "Cancel upload"}</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.blush50, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
  imageWrap: { width: 220, height: 220, borderRadius: radius.xl, overflow: "hidden", marginBottom: spacing.xl },
  image: { width: "100%", height: "100%" },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(26,26,26,0.45)", alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.displayBold, fontSize: 20, color: colors.ink900, marginBottom: spacing.xs },
  subtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.ink500, textAlign: "center" },
  spinner: { marginTop: spacing.md },
  errorBox: { width: "100%", backgroundColor: colors.dangerBg, padding: spacing.md, borderRadius: radius.md, marginTop: spacing.sm },
  errorText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.danger, textAlign: "center" },
  errorCode: { fontFamily: fonts.body, fontSize: 11, color: colors.danger, textAlign: "center", marginTop: spacing.xs },
  retry: { width: "100%", backgroundColor: colors.coral600, paddingVertical: spacing.md, borderRadius: radius.pill, marginTop: spacing.lg, alignItems: "center" },
  retryText: { fontFamily: fonts.bodyBold, color: colors.white, fontSize: 15 },
  cancel: { paddingVertical: spacing.md, marginTop: spacing.sm },
  cancelText: { fontFamily: fonts.bodySemiBold, color: colors.ink500, fontSize: 14 },
});
