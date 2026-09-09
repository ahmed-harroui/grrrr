import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts } from "@/theme/theme";
import DiscoverScreen from "@/screens/DiscoverScreen";
import MatchesScreen from "@/screens/MatchesScreen";
import ChatListScreen from "@/screens/ChatListScreen";
import ExploreScreen from "@/screens/ExploreScreen";
import MyPetScreen from "@/screens/MyPetScreen";
import { useAppState } from "@/context/AppState";

const Tab = createBottomTabNavigator();

const ICONS: Record<string, number> = {
  Discover: require("../../assets/navbar/descover.png"),
  Matches: require("../../assets/navbar/matchs.png"),
  Explore: require("../../assets/navbar/explore.png"),
  MyPet: require("../../assets/navbar/my_pet.png"),
};

const LABELS: Record<string, string> = {
  Discover: "Discover",
  Matches: "Matches",
  Chat: "Chat",
  Explore: "Explore",
  MyPet: "My Pet",
};

export default function MainTabs() {
  const insets = useSafeAreaInsets();
  const { chats } = useAppState();
  const unreadMessages = chats.reduce(
    (total, chat) => total + chat.messages.filter((message) => message.from === "them" && !message.read).length,
    0
  );

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.coralDark,
        tabBarInactiveTintColor: colors.grey,
        tabBarStyle: styles.tabBar(insets.bottom),
        tabBarItemStyle: { paddingHorizontal: 2 },
        tabBarLabel: ({ color }) => (
          <Text style={{ fontFamily: fonts.bodySemi, fontSize: 10.5, color }}>{LABELS[route.name]}</Text>
        ),
        tabBarIcon: ({ focused }) => (
          <View style={[styles.iconBox, focused && styles.iconBoxActive]}>
            {route.name === "Chat" ? (
              <View style={styles.chatIcon}><Text style={styles.chatDots}>•••</Text></View>
            ) : (
              <Image source={ICONS[route.name]} style={styles.icon} resizeMode="contain" />
            )}
            {route.name === "Chat" && unreadMessages > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unreadMessages > 99 ? "99+" : unreadMessages}</Text></View>}
          </View>
        ),
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

const styles = StyleSheet.create({
  tabBar: (bottomInset: number) => ({
    backgroundColor: "rgba(255,255,255,0.96)",
    borderTopColor: colors.line,
    borderTopWidth: 1,
    borderRadius: 30,
    height: 72 + bottomInset,
    paddingTop: 8,
    paddingBottom: Math.max(bottomInset, 10),
    marginHorizontal: 10,
    marginBottom: Math.max(bottomInset, 8),
    shadowColor: colors.coralDark,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  }),
  iconBox: { width: 58, height: 38, borderRadius: 22, alignItems: "center", justifyContent: "center", position: "relative" },
  iconBoxActive: { backgroundColor: "rgba(255,93,115,0.18)" },
  icon: { width: 34, height: 34 },
  chatIcon: { width: 34, height: 29, borderRadius: 17, backgroundColor: "#FFFDF9", borderWidth: 2, borderColor: "#9EA3A5", alignItems: "center", justifyContent: "center" },
  chatDots: { color: "#8D9699", fontFamily: fonts.bodyBold, fontSize: 13, letterSpacing: 1 },
  badge: { position: "absolute", right: 5, top: -5, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.coral, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badgeText: { color: colors.white, fontFamily: fonts.bodyBold, fontSize: 11 },
});
