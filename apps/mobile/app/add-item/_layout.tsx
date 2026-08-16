import { Stack } from "expo-router";

// This entire flow is registered as ONE modal at the root (see app/_layout.tsx).
// Every step below is a plain push within this nested Stack — never its own
// separate modal. See engineering blueprint §4 for why that distinction
// matters (real iOS bug otherwise).
export default function AddItemLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
