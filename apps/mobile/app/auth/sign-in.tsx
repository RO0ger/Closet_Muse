import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, spacing } from "../../constants/theme";
import FormField from "../../components/FormField";
import PrimaryButton from "../../components/PrimaryButton";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";

// Client-side attempt counter only — this gives immediate UX feedback but
// is NOT real lockout enforcement (a reinstalled app or a different device
// resets it instantly). Real OWASP-aligned lockout needs to be enforced
// server-side (e.g. a failed_login_attempts counter checked inside a custom
// auth hook, or Supabase's built-in rate limiting configured at the project
// level) — that's still open work, tracked in the backend README.
const MAX_ATTEMPTS = 5;

export default function SignIn() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  async function handleSignIn() {
    if (locked) return;

    if (!isSupabaseConfigured) {
      setError("Backend not configured — see .env.example in apps/mobile.");
      return;
    }

    setSubmitting(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setSubmitting(false);

    if (!authError) {
      router.replace("/(tabs)/home");
      return;
    }

    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    if (nextAttempts >= MAX_ATTEMPTS) {
      setLocked(true);
      setError("Too many failed attempts on this device. Try again later.");
    } else {
      setError(`${authError.message}. ${MAX_ATTEMPTS - nextAttempts} attempt(s) remaining on this device.`);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxxl, paddingHorizontal: spacing.xl }}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={colors.ink900} />
        </Pressable>

        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to your wardrobe</Text>

        {!isSupabaseConfigured && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning" size={16} color={colors.warning} />
            <Text style={styles.warningText}>Backend not configured yet — see apps/mobile/.env.example.</Text>
          </View>
        )}

        <View style={{ marginTop: spacing.xl }}>
          <FormField
            label="Email"
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            editable={!locked}
          />
          <FormField
            label="Password"
            placeholder="Your password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            error={error}
            editable={!locked}
          />
        </View>

        <View style={{ marginTop: spacing.md }}>
          <PrimaryButton label={locked ? "Account locked" : "Sign In"} onPress={handleSignIn} disabled={locked} loading={submitting} />
        </View>

        <Pressable onPress={() => router.replace("/auth/sign-up")} style={styles.switchLink} accessibilityRole="button">
          <Text style={styles.switchText}>
            New here? <Text style={styles.switchTextBold}>Create an account</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.blush50 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  title: { fontFamily: fonts.displayBold, fontSize: 26, color: colors.ink900 },
  subtitle: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink500, marginTop: 4 },
  warningBanner: { flexDirection: "row", gap: spacing.sm, backgroundColor: colors.warningBg, borderRadius: 12, padding: spacing.md, marginTop: spacing.lg, alignItems: "flex-start" },
  warningText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.warning, lineHeight: 17 },
  switchLink: { alignItems: "center", marginTop: spacing.xl },
  switchText: { fontFamily: fonts.body, fontSize: 13, color: colors.ink500 },
  switchTextBold: { fontFamily: fonts.bodyBold, color: colors.coral600 },
});
