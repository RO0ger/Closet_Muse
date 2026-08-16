import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, spacing } from "@/constants/theme";
import FormField from "@/components/FormField";
import PrimaryButton from "@/components/PrimaryButton";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

function isWeakPassword(pw: string): string | undefined {
  if (pw.length < 8) return "Password must be at least 8 characters.";
  if (!/[0-9]/.test(pw)) return "Password must include at least one number.";
  if (!/[A-Z]/.test(pw)) return "Password must include at least one uppercase letter.";
  return undefined;
}

export default function SignUp() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleContinue() {
    if (!isSupabaseConfigured) {
      setErrors({ email: "Backend not configured — see .env.example in apps/mobile." });
      return;
    }

    const nextErrors: { email?: string; password?: string } = {};
    if (!email.includes("@")) nextErrors.email = "Enter a valid email address.";
    const pwError = isWeakPassword(password);
    if (pwError) nextErrors.password = pwError;

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    const { error } = await supabase.auth.signUp({ email: email.trim(), password });
    setSubmitting(false);

    if (error) {
      // Supabase returns a generic "User already registered" message for
      // duplicate emails (UC-01 alternate flow) when email confirmations
      // are disabled, per config.toml.
      setErrors({ email: error.message });
      return;
    }

    router.push("/auth/profile-setup");
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

        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>Step 1 of 2 — account details</Text>

        {!isSupabaseConfigured && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning" size={16} color={colors.warning} />
            <Text style={styles.warningText}>Backend not configured yet — sign-up will fail until .env is set (see apps/mobile/.env.example).</Text>
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
            error={errors.email}
          />
          <FormField
            label="Password"
            placeholder="At least 8 characters"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            error={errors.password}
          />
          <Text style={styles.hint}>Use 8+ characters, one uppercase letter, and one number.</Text>
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <PrimaryButton label="Continue" onPress={handleContinue} loading={submitting} />
        </View>

        <Pressable onPress={() => router.replace("/auth/sign-in")} style={styles.switchLink} accessibilityRole="button">
          <Text style={styles.switchText}>
            Already have an account? <Text style={styles.switchTextBold}>Sign in</Text>
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
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.ink500, marginTop: -spacing.sm },
  warningBanner: { flexDirection: "row", gap: spacing.sm, backgroundColor: colors.warningBg, borderRadius: 12, padding: spacing.md, marginTop: spacing.lg, alignItems: "flex-start" },
  warningText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.warning, lineHeight: 17 },
  switchLink: { alignItems: "center", marginTop: spacing.xl },
  switchText: { fontFamily: fonts.body, fontSize: 13, color: colors.ink500 },
  switchTextBold: { fontFamily: fonts.bodyBold, color: colors.coral600 },
});
