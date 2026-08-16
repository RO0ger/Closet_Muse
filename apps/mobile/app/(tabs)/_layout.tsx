import { View, StyleSheet } from "react-native";
import { Tabs, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius } from "../..//constants/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.coral600,
        tabBarInactiveTintColor: colors.ink300,
        tabBarLabelStyle: { fontFamily: fonts.bodySemiBold, fontSize: 11 },
        tabBarStyle: {
          borderTopColor: colors.ink100,
          height: 84,
          paddingTop: 8,
          paddingBottom: 24,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="wardrobe"
        options={{
          title: "Wardrobe",
          tabBarIcon: ({ color, size }) => <Ionicons name="shirt" color={color} size={size} />,
        }}
      />
      {/* Center "Add" slot — intercepted before navigation so it opens the
          add-item modal flow instead of becoming an actual tab screen. */}
      <Tabs.Screen
        name="add"
        options={{
          title: "",
          tabBarIcon: () => (
            <View style={styles.addButton}>
              <Ionicons name="add" color={colors.white} size={26} />
            </View>
          ),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.push("/add-item");
          },
        }}
      />
      <Tabs.Screen
        name="style-me"
        options={{
          title: "Style Me",
          tabBarIcon: ({ color, size }) => <Ionicons name="sparkles" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  addButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.coral600,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -18,
  },
});
