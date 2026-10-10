import React from "react";
import { Platform } from "react-native";
import { DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabs from "@/navigation/MainTabs";
import ChatThreadScreen from "@/screens/ChatThreadScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import NotificationsScreen from "@/screens/NotificationsScreen";
import AdoptScreen from "@/screens/AdoptScreen";
import { NotificationsProvider } from "@/context/NotificationsContext";
import { navigationRef } from "@/navigation/navigationRef";
import { framed } from "@/utils/wideScreen";
import { useThemedColors } from "@/hooks/useThemedColors";

const Stack = createNativeStackNavigator();

// Screens opened over the tabs, at the width they read best on a tablet or a laptop
const ChatThread = framed(ChatThreadScreen, 820);
const Settings = framed(SettingsScreen, 720);
const Notifications = framed(NotificationsScreen, 720);
const Adopt = framed(AdoptScreen, 620);

// grrrr:// links, used by the home-screen widgets (phones only: the web keeps a single URL).
const linking = {
  prefixes: ["grrrr://"],
  config: {
    screens: {
      MainTabs: { screens: { Discover: "discover", Matches: "matches", Chat: "chat", Explore: "explore", MyPet: "pet" } },
      Notifications: "notifications",
      Adopt: "adopt",
    },
  },
};

export default function RootNavigator() {
  // The navigator paints behind the rounded tab bar: in the app's colour, not the library's light grey
  const colors = useThemedColors();
  const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.cream } };
  return (
    // Around the navigator so the banner shows above every screen.
    <NotificationsProvider>
      <NavigationContainer ref={navigationRef} theme={theme} linking={Platform.OS === "web" ? undefined : linking}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="ChatThread" component={ChatThread} options={{ presentation: "card" }} />
          <Stack.Screen name="Settings" component={Settings} options={{ presentation: "card" }} />
          <Stack.Screen name="Notifications" component={Notifications} options={{ presentation: "card" }} />
          <Stack.Screen name="Adopt" component={Adopt} options={{ presentation: "card" }} />
        </Stack.Navigator>
      </NavigationContainer>
    </NotificationsProvider>
  );
}
