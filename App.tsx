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

import { AppStateProvider, useAppState } from "@/context/AppState";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { LocalizationProvider } from "@/context/LocalizationContext";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { PetSelectorProvider } from "@/context/PetSelectorContext";
import SplashScreen from "@/screens/SplashScreen";
import OnboardingScreen from "@/screens/OnboardingScreen";
import AuthScreen from "@/screens/AuthScreen";
import PetProfileSetupScreen from "@/screens/PetProfileSetupScreen";
import RootNavigator from "@/navigation/RootNavigator";

SplashAPI.preventAutoHideAsync().catch(() => {});

type Stage = "splash" | "auth" | "onboarding" | "profileSetup" | "app";

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
      <AuthProvider>
        <LocalizationProvider>
          <ThemeProvider>
            <ThemedApp stage={stage} setStage={setStage} />
          </ThemeProvider>
        </LocalizationProvider>
      </AuthProvider>
    </View>
  );
}

function ThemedApp({ stage, setStage }: { stage: Stage; setStage: (stage: Stage) => void }) {
  const { isDark } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <AppStateProvider>
        <AppContent stage={stage} setStage={setStage} />
      </AppStateProvider>
    </>
  );
}

function AppContent({ stage, setStage }: { stage: Stage; setStage: (stage: Stage) => void }) {
  const { loading, session } = useAuth();
  const { refreshOwnedPets } = useAppState();
  const [guestMode, setGuestMode] = useState(false);

  // Signed-in accounts go straight to the app once they have a pet; new accounts create one first.
  const enterSignedIn = useCallback(async () => {
    const pets = await refreshOwnedPets();
    setStage(pets.length ? "app" : "profileSetup");
  }, [refreshOwnedPets, setStage]);

  useEffect(() => {
    if (loading) return;
    if (!session && !guestMode && stage !== "splash" && stage !== "auth") setStage("auth");
    if (session && stage === "auth") void enterSignedIn();
  }, [enterSignedIn, guestMode, loading, session, stage, setStage]);

  if (stage === "splash") return <SplashScreen onFinish={() => setStage("auth")} />;
  if (loading) return null;
  if (stage === "auth") return <AuthScreen onDemo={() => { setGuestMode(true); setStage("onboarding"); }} onAuthenticated={() => {}} />;
  if (stage === "onboarding") return <OnboardingScreen onDone={() => setStage("app")} />;
  if (stage === "profileSetup") return <PetProfileSetupScreen onDone={() => void enterSignedIn()} />;
  return (
    <PetSelectorProvider>
      <RootNavigator />
    </PetSelectorProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
