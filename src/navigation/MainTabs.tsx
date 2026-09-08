import React from "react";
import { Text } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { colors, fonts } from "@/theme/theme";
import DiscoverScreen from "@/screens/DiscoverScreen";
import MatchesScreen from "@/screens/MatchesScreen";
import ChatListScreen from "@/screens/ChatListScreen";
import ExploreScreen from "@/screens/ExploreScreen";
import MyPetScreen from "@/screens/MyPetScreen";

const Tab = createBottomTabNavigator();

const ICONS: Record<string, string> = {
  Discover: "🐾",
  Matches: "❤️",
  Chat: "💬",
  Explore: "🔥",
  MyPet: "👤",
};

const LABELS: Record<string, string> = {
  Discover: "Discover",
  Matches: "Matches",
  Chat: "Chat",
  Explore: "Explore",
  MyPet: "My Pet",
};

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.coralDark,
        tabBarInactiveTintColor: colors.grey,
        tabBarStyle: { borderTopColor: colors.line, height: 62, paddingTop: 6, paddingBottom: 8 },
        tabBarLabel: ({ color }) => (
          <Text style={{ fontFamily: fonts.bodySemi, fontSize: 10.5, color }}>{LABELS[route.name]}</Text>
        ),
        tabBarIcon: ({ color }) => <Text style={{ fontSize: 19, color }}>{ICONS[route.name]}</Text>,
      })}
    >
      <Tab.Screen name="Discover" component={DiscoverScreen} />
      <Tab.Screen name="Matches" component={MatchesScreen} />
      <Tab.Screen name="Chat" component={ChatListScreen} />
      <Tab.Screen name="Explore" component={ExploreScreen} />
      <Tab.Screen name="MyPet" component={MyPetScreen} />
    </Tab.Navigator>
  );
}
