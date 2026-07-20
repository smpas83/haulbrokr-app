import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { View, StyleSheet } from "react-native";

export default function TabLayout() {
  const colors = useColors();
  const { isOnline, profile } = useApp();
  const isProvider = profile?.role === "provider";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          height: 58,
          paddingBottom: 6,
        },
        tabBarLabelStyle: { fontFamily: "Inter_500Medium", fontSize: 10 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <View style={{ position: "relative" }}>
              <Feather name="home" size={22} color={color} />
              {isProvider && (
                <View style={[styles.onlineDot, { backgroundColor: isOnline ? "#16a34a" : "#6b7280" }]} />
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{ title: "Loads", tabBarIcon: ({ color }) => <Feather name="briefcase" size={22} color={color} /> }}
      />
      {!isProvider && (
        <Tabs.Screen
          name="projects"
          options={{ title: "Projects", tabBarIcon: ({ color }) => <Feather name="folder" size={22} color={color} /> }}
        />
      )}
      <Tabs.Screen
        name="map"
        options={{ title: "Map", tabBarIcon: ({ color }) => <Feather name="map" size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="bins"
        options={{ title: "Bins", tabBarIcon: ({ color }) => <Feather name="package" size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: "Account", tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} /> }}
      />
      <Tabs.Screen name="guide" options={{ href: null }} />
      {isProvider && <Tabs.Screen name="projects" options={{ href: null }} />}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  onlineDot: {
    position: "absolute", top: -2, right: -4,
    width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: "#0A0A0C",
  },
});
