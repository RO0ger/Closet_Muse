import { useRef, useState } from "react";
import { View, Text, Pressable, Linking, StyleSheet } from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, radius, shadow, spacing } from "../../constants/theme";
import { confirmAsync, notify } from "../../lib/platformAlert";

export default function AddItemChooseSource() {
  const insets = useSafeAreaInsets();
  const pickerInFlight = useRef(false);
  const [picking, setPicking] = useState(false);

  async function handleTakePhoto() {
    if (pickerInFlight.current) return;
    pickerInFlight.current = true;
    setPicking(true);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        if (perm.canAskAgain) {
          notify("Camera permission needed", "Allow camera access to take a photo of your clothing.");
        } else {
          const openSettings = await confirmAsync(
            "Camera access is turned off",
            "Enable camera access for ClosetMuse in Settings to take a photo.",
            "Open Settings",
          );
          if (openSettings) await Linking.openSettings();
        }
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 1, allowsEditing: false });
      if (!result.canceled && result.assets[0]) router.push({ pathname: "/add-item/processing", params: { uri: result.assets[0].uri } });
    } catch (error) {
      notify("Couldn't open camera", error instanceof Error ? error.message : "Please try again.");
    } finally {
      pickerInFlight.current = false;
      setPicking(false);
    }
  }

  async function handleChooseGallery() {
    if (pickerInFlight.current) return;
    pickerInFlight.current = true;
    setPicking(true);
    try {
      // iOS presents the system selected-asset picker without a broad Photos
      // permission request. Compression/cropping happen in preprocessing.
      const result = await ImagePicker.launchImageLibraryAsync({ quality: 1, allowsEditing: false });
      if (!result.canceled && result.assets[0]) router.push({ pathname: "/add-item/processing", params: { uri: result.assets[0].uri } });
    } catch (error) {
      notify("Couldn't open photo picker", error instanceof Error ? error.message : "Please try again.");
    } finally {
      pickerInFlight.current = false;
      setPicking(false);
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl }]}>
      <Pressable onPress={() => router.back()} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close">
        <Ionicons name="close" size={24} color={colors.ink900} />
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.title}>Add Item</Text>
        <Text style={styles.subtitle}>Upload a photo and AI will automatically identify the clothing item.</Text>
      </View>

      <Pressable style={[styles.primaryOption, picking && styles.disabled]} onPress={handleTakePhoto} disabled={picking} accessibilityRole="button" accessibilityLabel="Take a photo">
        <View style={styles.primaryIconWrap}>
          <Ionicons name="camera" size={30} color={colors.coral600} />
        </View>
        <Text style={styles.primaryTitle}>Take a Photo</Text>
        <Text style={styles.primarySubtitle}>Use your camera</Text>
      </Pressable>

      <Pressable style={[styles.option, picking && styles.disabled]} onPress={handleChooseGallery} disabled={picking} accessibilityRole="button" accessibilityLabel="Choose from gallery">
        <View style={styles.optionIconWrap}>
          <Ionicons name="image" size={20} color={colors.coral600} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.optionTitle}>Choose from Gallery</Text>
          <Text style={styles.optionSubtitle}>Select existing photos</Text>
        </View>
      </Pressable>

    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.blush50, paddingHorizontal: spacing.xl },
  closeBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  header: { marginBottom: spacing.xl },
  title: { fontFamily: fonts.displayBold, fontSize: 26, color: colors.ink900, marginBottom: spacing.xs },
  subtitle: { fontFamily: fonts.body, fontSize: 14, color: colors.ink500, lineHeight: 20 },
  primaryOption: {
    borderWidth: 2,
    borderColor: colors.coral500,
    borderStyle: "dashed",
    borderRadius: radius.xl,
    alignItems: "center",
    paddingVertical: spacing.xxl,
    marginBottom: spacing.lg,
    backgroundColor: colors.peach100,
  },
  primaryIconWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  primaryTitle: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.ink900 },
  primarySubtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.ink500, marginTop: 2 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  optionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.peach100,
    alignItems: "center",
    justifyContent: "center",
  },
  optionTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink900 },
  optionSubtitle: { fontFamily: fonts.body, fontSize: 12, color: colors.ink500, marginTop: 1 },
  disabled: { opacity: 0.55 },
});
