import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabs from "@/navigation/MainTabs";
import ChatThreadScreen from "@/screens/ChatThreadScreen";
import SettingsScreen from "@/screens/SettingsScreen";

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen name="ChatThread" component={ChatThreadScreen} options={{ presentation: "card" }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ presentation: "card" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
