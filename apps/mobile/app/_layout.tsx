import { useEffect, useCallback } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  useFonts as usePoppins,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { IBMPlexMono_500Medium } from "@expo-google-fonts/ibm-plex-mono";
import { AppStoreProvider } from "../lib/store"; // Adjust the path if necessary
import { colors } from "../constants/theme"; // Adjusted path to the correct relative location

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = usePoppins({
    Poppins_600SemiBold,
    Poppins_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    IBMPlexMono_500Medium,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    onLayoutRootView();
  }, [onLayoutRootView]);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.blush50 }} />;
  }

  return (
    <SafeAreaProvider>
      <AppStoreProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="auth" />
          <Stack.Screen name="(tabs)" />
          {/* Multi-step "add item" flow gets ONE modal entry here — every
              step inside app/add-item/_layout.tsx is a plain nested push.
              Registering each step as its own modal breaks on iOS
              (blueprint §4). */}
          <Stack.Screen name="add-item" options={{ presentation: "modal" }} />
          <Stack.Screen name="item/[id]" options={{ presentation: "card" }} />
          <Stack.Screen name="outfit/[id]" options={{ presentation: "card" }} />
          <Stack.Screen name="style-session/[id]" options={{ presentation: "card" }} />
        </Stack>
      </AppStoreProvider>
    </SafeAreaProvider>
  );
}
