import React, { useEffect, useState } from "react";
import { getPetLikers, Liker } from "@/data/api/likes";
import { getWaitingForMyPet } from "@/data/api/adoption";
import { useWidgetSync } from "@/widgets/useWidgetSync";
import { Image, ImageStyle, StyleSheet, Text, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts } from "@/theme/theme";
import { useThemedColors } from "@/hooks/useThemedColors";
import DiscoverScreen from "@/screens/DiscoverScreen";
import MatchesScreen from "@/screens/MatchesScreen";
import ChatListScreen from "@/screens/ChatListScreen";
import ExploreScreen from "@/screens/ExploreScreen";
import MyPetScreen from "@/screens/MyPetScreen";
import { useAppState } from "@/context/AppState";
import { useTranslation } from "@/i18n/useTranslation";
import LevelUpCelebration from "@/components/LevelUpCelebration";
import MatchModal from "@/components/MatchModal";

const Tab = createBottomTabNavigator();

const ICONS: Record<string, number> = {
  Discover: require("../../assets/navbar/descover.png"),
  Matches: require("../../assets/navbar/matchs.png"),
  Explore: require("../../assets/navbar/explore.png"),
  MyPet: require("../../assets/navbar/my_pet.png"),
};

const LABELS: Record<string, [string, string]> = {
  Discover: ["Découvrir", "Discover"],
  Matches: ["Matchs", "Matches"],
  Chat: ["Chat", "Chat"],
  Explore: ["Explorer", "Explore"],
  MyPet: ["Mon pet", "My Pet"],
};

function getTabBarStyle(bottomInset: number, colors: ReturnType<typeof useThemedColors>) {
  return {
    backgroundColor: `${colors.white}F3`,
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
  };
}

export default function MainTabs() {
  const insets = useSafeAreaInsets();
  const colors = useThemedColors();
  const styles = getStaticStyles(colors);
  const { chats, matches, activePet, pendingMatch, clearPendingMatch } = useAppState();
  const { tx } = useTranslation();
  const unreadMessages = chats.reduce(
    (total, chat) => total + chat.messages.filter((message) => message.from === "them" && !message.read).length,
    0
  );
  const hasMessages = chats.some((chat) => chat.messages.length > 0);

  // Matches tab badge: the likes received that are still waiting for a like back, and the
  // families waiting for my pet's babies (matches are conversations, counted on the Chat tab).
  const [likers, setLikers] = useState<Liker[]>([]);
  const [waitingCount, setWaitingCount] = useState(0);
  useEffect(() => {
    let active = true;
    const load = () => {
      void getPetLikers(activePet.dbId).then((result) => active && setLikers(result));
      void getWaitingForMyPet(activePet.dbId).then((result) => active && setWaitingCount(result.length));
    };
    load();
    const timer = setInterval(load, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [activePet.dbId, matches.length]);
  const pendingLikers = likers.filter((liker) => !matches.some((pet) => pet.dbId === liker.id));
  const matchesCount = pendingLikers.length + waitingCount;

  // The home-screen widgets show the same numbers.
  useWidgetSync({ likes: pendingLikers.length, lastLikerName: pendingLikers[0]?.pet_name, unread: unreadMessages });

  return (
    <>
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.coralDark,
        tabBarInactiveTintColor: colors.grey,
        tabBarStyle: getTabBarStyle(insets.bottom, colors),
        tabBarItemStyle: { paddingHorizontal: 2 },
        tabBarLabel: ({ color }) => (
          <Text style={{ fontFamily: fonts.bodySemi, fontSize: 10.5, color }}>{tx(...LABELS[route.name])}</Text>
        ),
        tabBarIcon: ({ focused }) => (
          <View style={[styles.iconBox, focused && styles.iconBoxActive]}>
            {route.name === "Chat" ? (
              <View style={[styles.chatIcon, hasMessages && styles.chatIconWithMessages]}>
                <Text style={[styles.chatDots, hasMessages && styles.chatDotsWithMessages]}>•••</Text>
              </View>
            ) : (
              <Image source={ICONS[route.name]} style={styles.icon} resizeMode="contain" />
            )}
            {route.name === "Chat" && unreadMessages > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unreadMessages > 99 ? "99+" : unreadMessages}</Text></View>}
            {route.name === "Matches" && matchesCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{matchesCount > 99 ? "99+" : matchesCount}</Text></View>}
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
    {/* Shown on any tab: a like back can arrive while browsing elsewhere */}
    <MatchModal visible={!!pendingMatch} pet={pendingMatch} onMessage={clearPendingMatch} onKeepSwiping={clearPendingMatch} />
    <LevelUpCelebration />
    </>
  );
}

function getStaticStyles(colors: ReturnType<typeof useThemedColors>) {
  return StyleSheet.create({
    iconBox: { width: 58, height: 38, borderRadius: 22, alignItems: "center", justifyContent: "center", position: "relative" },
    iconBoxActive: { backgroundColor: "rgba(255,93,115,0.18)" },
    icon: { width: 34, height: 34 } as ImageStyle,
    chatIcon: { width: 34, height: 29, borderRadius: 17, backgroundColor: "#FFFDF9", borderWidth: 2, borderColor: "#9EA3A5", alignItems: "center", justifyContent: "center" },
    chatIconWithMessages: { backgroundColor: colors.coral, borderColor: colors.coralDark },
    chatDots: { color: "#8D9699", fontFamily: fonts.bodyBold, fontSize: 13, letterSpacing: 1 },
    chatDotsWithMessages: { color: colors.white },
    badge: { position: "absolute", right: 5, top: -5, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.coral, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
    badgeText: { color: colors.white, fontFamily: fonts.bodyBold, fontSize: 11 },
  });
}
