import { View, Text, StyleSheet, Image } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius, spacing, app } from "../../constants/theme";
import PrimaryButton from "../../components/PrimaryButton";

export default function AuthWelcome() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl }]}>
      <View style={styles.hero}>
        <View style={styles.logoMark}>
          <Ionicons name="sparkles" size={30} color={colors.white} />
        </View>
        <Text style={styles.title}>{app.name}</Text>
        <Text style={styles.tagline}>{app.tagline}</Text>
      </View>

      <View style={styles.previewRow}>
        <Image
          source={{ uri: "https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?w=600" }}
          style={styles.previewImg}
        />
        <Image
          source={{ uri: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=600" }}
          style={[styles.previewImg, styles.previewImgOffset]}
        />
      </View>

      <View style={styles.actions}>
        <PrimaryButton label="Sign Up" onPress={() => router.push("/auth/sign-up")} />
        <View style={{ height: spacing.md }} />
        <PrimaryButton label="Sign In" onPress={() => router.push("/auth/sign-in")} variant="outline" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.blush50, paddingHorizontal: spacing.xl, justifyContent: "space-between" },
  hero: { alignItems: "center" },
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: radius.xl,
    backgroundColor: colors.coral600,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  title: { fontFamily: fonts.displayBold, fontSize: 32, color: colors.ink900 },
  tagline: { fontFamily: fonts.body, fontSize: 15, color: colors.ink500, marginTop: spacing.xs },
  previewRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginVertical: spacing.xxl },
  previewImg: { width: 140, height: 180, borderRadius: radius.lg, backgroundColor: colors.ink100 },
  previewImgOffset: { marginLeft: -spacing.xl, marginTop: spacing.xl, borderWidth: 4, borderColor: colors.blush50 },
  actions: { paddingBottom: spacing.md },
});
