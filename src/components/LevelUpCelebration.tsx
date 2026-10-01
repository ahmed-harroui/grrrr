import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { fonts } from "@/theme/theme";
import { onPetLevel } from "@/data/api/progress";
import { useAppState } from "@/context/AppState";
import { useTranslation } from "@/i18n/useTranslation";
import { PET_RANKS } from "@/utils/petProgression";

// Transparent decor sheets. Swap BIG_DECOR for assets/decor/big.png once it exists.
const SMALL_DECOR = require("../../assets/decor/small.png");
const BIG_DECOR = SMALL_DECOR;
const DECOR_ASPECT = 694 / 360;

const seenKey = (petId: string) => `@grrrr_seen_level:${petId}`;

type Celebration = { petId: string; level: number };

// Watches every XP refresh and celebrates when a pet reaches a level it never reached before.
// Stays on screen, above everything, until the user taps to continue.
export default function LevelUpCelebration() {
  const { ownedPets, pendingMatch } = useAppState();
  const { tx } = useTranslation();
  const [celebration, setCelebration] = useState<Celebration | null>(null);

  useEffect(
    () =>
      onPetLevel(async (petId, level, replay) => {
        if (replay) {
          setCelebration({ petId, level });
          return;
        }
        try {
          const stored = await AsyncStorage.getItem(seenKey(petId));
          await AsyncStorage.setItem(seenKey(petId), String(level));
          // First time we see this pet: remember its level without celebrating.
          if (stored !== null && level > Number(stored)) setCelebration({ petId, level });
        } catch {
          // Storage unavailable: skip the celebration rather than showing it every time.
        }
      }),
    []
  );

  // iOS can't show two modals at once: wait for "It's a Match" to close, then celebrate.
  if (!celebration || pendingMatch) return null;
  const petName = ownedPets.find((pet) => pet.dbId === celebration.petId)?.name ?? "";
  return <CelebrationCard key={`${celebration.petId}-${celebration.level}`} level={celebration.level} petName={petName} tx={tx} onClose={() => setCelebration(null)} />;
}

function CelebrationCard({ level, petName, tx, onClose }: { level: number; petName: string; tx: (fr: string, en: string) => string; onClose: () => void }) {
  const rank = PET_RANKS[Math.max(0, Math.min(PET_RANKS.length - 1, level - 1))];
  const { width, height } = useWindowDimensions();
  const backdrop = useRef(new Animated.Value(0)).current;
  const card = useRef(new Animated.Value(0)).current;
  const emblem = useRef(new Animated.Value(0)).current;
  const copy = useRef(new Animated.Value(0)).current;
  const loop = useRef(new Animated.Value(0)).current;
  const closing = useRef(false);

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    Animated.parallel([
      Animated.timing(backdrop, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(card, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(onClose);
  };

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(card, { toValue: 1, friction: 6, tension: 70, useNativeDriver: true }),
      ]),
      Animated.spring(emblem, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
      Animated.timing(copy, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();
    const drift = Animated.loop(Animated.timing(loop, { toValue: 1, duration: 9000, easing: Easing.linear, useNativeDriver: true }));
    drift.start();
    return () => drift.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bigWidth = width * 2.6;
  const smallWidth = width * 1.4;
  const spin = loop.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const bigShift = loop.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -80, 0] });
  const smallShift = loop.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 50, 0] });
  const pulse = loop.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [1, 1.06, 1, 1.06, 1] });

  // Full screen: the whole screen becomes the celebration, it zooms in slightly as it appears.
  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={close}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close}>
        <Animated.View pointerEvents="none" style={[styles.screen, { opacity: card, transform: [{ scale: card.interpolate({ inputRange: [0, 1], outputRange: [1.12, 1] }) }] }]}>
          <LinearGradient colors={["#FFFFFF", rank.color, rank.color]} locations={[0, 0.55, 1]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
          <Animated.View style={[styles.backdrop, { opacity: backdrop.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0] }) }]} />

          {/* "big" decor: large white drawings drifting slowly */}
          <Animated.Image source={BIG_DECOR} resizeMode="stretch" style={[styles.decor, { width: bigWidth, height: bigWidth / DECOR_ASPECT, left: -bigWidth * 0.3, top: -20, opacity: 0.28, tintColor: "#FFFFFF", transform: [{ translateX: bigShift }] }]} />
          {/* "small" decor: smaller pink drawings at the bottom, drifting the other way */}
          <Animated.Image source={SMALL_DECOR} resizeMode="stretch" style={[styles.decor, { width: smallWidth, height: smallWidth / DECOR_ASPECT, left: -smallWidth * 0.15, bottom: -10, opacity: 0.55, transform: [{ translateX: smallShift }] }]} />

          <View style={[styles.content, { paddingTop: height * 0.1 }]}>
            <Animated.Text style={[styles.eyebrow, { opacity: copy }]}>{tx("NIVEAU SUPÉRIEUR !", "LEVEL UP!")}</Animated.Text>

            <View style={styles.emblemZone}>
              <Animated.View style={[styles.rays, { transform: [{ rotate: spin }] }]}>
                {Array.from({ length: 12 }, (_, i) => <View key={i} style={[styles.ray, { transform: [{ rotate: `${i * 15}deg` }] }]} />)}
              </Animated.View>
              <Animated.View style={[styles.halo, { transform: [{ scale: pulse }] }]} />
              <Animated.Image source={rank.image} resizeMode="contain" style={[styles.emblem, { transform: [{ scale: Animated.multiply(emblem.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }), pulse) }] }]} />
            </View>

            <Animated.View style={{ opacity: copy, transform: [{ translateY: copy.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }], alignItems: "center" }}>
              <Text style={styles.rankName}>{tx(rank.name, rank.nameEn)}</Text>
              <Text style={styles.levelText}>{tx("Niveau", "Level")} {level}</Text>
              {petName ? <Text style={styles.petText}>{tx(`${petName} passe au niveau ${level} 🐾`, `${petName} reached level ${level} 🐾`)}</Text> : null}
            </Animated.View>
          </View>

          <Animated.Text style={[styles.hint, { bottom: Math.max(36, height * 0.06), opacity: Animated.multiply(copy, loop.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [1, 0.45, 1, 0.45, 1] })) }]}>{tx("Touchez pour continuer", "Tap to continue")}</Animated.Text>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { ...StyleSheet.absoluteFill, overflow: "hidden", alignItems: "center" },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "#FFFFFF" },
  content: { flex: 1, width: "100%", alignItems: "center" },
  decor: { position: "absolute" },
  eyebrow: { fontFamily: fonts.displayExtra, fontSize: 34, color: "#2B2724", letterSpacing: 1, textAlign: "center" },
  emblemZone: { width: 320, height: 320, alignItems: "center", justifyContent: "center", marginTop: 18 },
  rays: { position: "absolute", width: 340, height: 340, alignItems: "center", justifyContent: "center" },
  ray: { position: "absolute", width: 11, height: 340, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.35)" },
  halo: { position: "absolute", width: 220, height: 220, borderRadius: 110, backgroundColor: "rgba(255,255,255,0.55)" },
  emblem: { width: 210, height: 210 },
  rankName: { fontFamily: fonts.displayExtra, fontSize: 46, color: "#FFFFFF", textShadowColor: "rgba(0,0,0,0.25)", textShadowRadius: 8, textShadowOffset: { width: 0, height: 2 }, marginTop: 10 },
  levelText: { fontFamily: fonts.bodyBold, fontSize: 20, color: "#FFFFFF", marginTop: -2 },
  petText: { fontFamily: fonts.bodySemi, fontSize: 16, color: "#FFFFFF", marginTop: 14, paddingHorizontal: 28, textAlign: "center" },
  hint: { position: "absolute", fontFamily: fonts.bodyBold, fontSize: 14, color: "#FFFFFF", letterSpacing: 0.5 },
});
