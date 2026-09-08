import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SplashAPI from "expo-splash-screen";
import { useFonts } from "expo-font";
import {
  Baloo2_600SemiBold,
  Baloo2_700Bold,
  Baloo2_800ExtraBold,
} from "@expo-google-fonts/baloo-2";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";

import { AppStateProvider } from "@/context/AppState";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import SplashScreen from "@/screens/SplashScreen";
import OnboardingScreen from "@/screens/OnboardingScreen";
import AuthScreen from "@/screens/AuthScreen";
import RootNavigator from "@/navigation/RootNavigator";

SplashAPI.preventAutoHideAsync().catch(() => {});

type Stage = "splash" | "auth" | "onboarding" | "app";

export default function App() {
  const [stage, setStage] = useState<Stage>("splash");

  const [fontsLoaded] = useFonts({
    Baloo2_600SemiBold,
    Baloo2_700Bold,
    Baloo2_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const onLayout = useCallback(async () => {
    if (fontsLoaded) await SplashAPI.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <View style={styles.fill} onLayout={onLayout}>
      <StatusBar style="dark" />
      <AuthProvider>
        <AppStateProvider>
          <AppContent stage={stage} setStage={setStage} />
        </AppStateProvider>
      </AuthProvider>
    </View>
  );
}

function AppContent({ stage, setStage }: { stage: Stage; setStage: (stage: Stage) => void }) {
  const { loading, session } = useAuth();

  useEffect(() => {
    if (!loading && !session && stage !== "splash" && stage !== "auth") setStage("auth");
  }, [loading, session, stage, setStage]);

  if (stage === "splash") return <SplashScreen onFinish={() => setStage(session ? "app" : "auth")} />;
  if (loading) return null;
  if (stage === "auth") return <AuthScreen onDemo={() => setStage("onboarding")} onAuthenticated={() => setStage("app")} />;
  if (stage === "onboarding") return <OnboardingScreen onDone={() => setStage("app")} />;
  return <RootNavigator />;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
