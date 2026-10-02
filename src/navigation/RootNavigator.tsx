import React from "react";
import { Platform } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabs from "@/navigation/MainTabs";
import ChatThreadScreen from "@/screens/ChatThreadScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import NotificationsScreen from "@/screens/NotificationsScreen";
import AdoptScreen from "@/screens/AdoptScreen";
import { NotificationsProvider } from "@/context/NotificationsContext";
import { navigationRef } from "@/navigation/navigationRef";

const Stack = createNativeStackNavigator();

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
  return (
    // Around the navigator so the banner shows above every screen.
    <NotificationsProvider>
      <NavigationContainer ref={navigationRef} linking={Platform.OS === "web" ? undefined : linking}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="ChatThread" component={ChatThreadScreen} options={{ presentation: "card" }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ presentation: "card" }} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ presentation: "card" }} />
          <Stack.Screen name="Adopt" component={AdoptScreen} options={{ presentation: "card" }} />
        </Stack.Navigator>
      </NavigationContainer>
    </NotificationsProvider>
  );
}
