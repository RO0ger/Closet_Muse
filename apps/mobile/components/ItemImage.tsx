import { useState } from "react";
import { Image, View, StyleSheet, ImageStyle, StyleProp } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius } from "../constants/theme";

interface ItemImageProps {
  uri: string;
  style?: StyleProp<ImageStyle>;
  iconSize?: number;
}

/**
 * Wraps RN's <Image> with a graceful fallback — a signed Storage URL can
 * expire or a network blip can fail the fetch, so a broken URL degrades to
 * a neutral placeholder icon instead of a blank box or a crash.
 */
export default function ItemImage({ uri, style, iconSize = 28 }: ItemImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <View style={[styles.fallback, style as any]}>
        <Ionicons name="shirt-outline" size={iconSize} color={colors.ink300} />
      </View>
    );
  }

  return <Image source={{ uri }} style={style} onError={() => setFailed(true)} />;
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: colors.ink100,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
