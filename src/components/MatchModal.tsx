import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Dimensions, Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, radii } from "@/theme/theme";
import { ME, Pet } from "@/data/mockPets";

interface Props {
  visible: boolean;
  pet: Pet | null;
  onMessage: () => void;
  onKeepSwiping: () => void;
}

const { width } = Dimensions.get("window");
const CONFETTI_COLORS = [colors.coral, colors.hot, colors.friend, "#FFD166"];

export default function MatchModal({ visible, pet, onMessage, onKeepSwiping }: Props) {
  const leftX = useRef(new Animated.Value(-80)).current;
  const rightX = useRef(new Animated.Value(80)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      leftX.setValue(-80);
      rightX.setValue(80);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(leftX, { toValue: 0, useNativeDriver: true, friction: 6 }),
        Animated.spring(rightX, { toValue: 0, useNativeDriver: true, friction: 6 }),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const confetti = useMemo(
    () =>
      Array.from({ length: 22 }).map((_, i) => ({
        id: i,
        left: Math.random() * width,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        delay: Math.random() * 400,
        duration: 1200 + Math.random() * 1200,
      })),
    [visible]
  );

  if (!pet) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        {confetti.map((c) => (
          <ConfettiPiece key={c.id} {...c} />
        ))}

        <View style={styles.photos}>
          <Animated.View style={[styles.photoCircle, { transform: [{ translateX: leftX }], opacity }]}>
            <Image source={{ uri: ME.photo }} style={styles.photoImg} />
          </Animated.View>
          <Animated.View
            style={[styles.photoCircle, styles.photoRight, { transform: [{ translateX: rightX }], opacity }]}
          >
            <Image source={{ uri: pet.photo }} style={styles.photoImg} />
          </Animated.View>
        </View>

        <Text style={styles.title}>IT'S A MATCH! 🐾❤️</Text>
        <Text style={styles.subtitle}>
          {ME.name} et {pet.name} se sont likés mutuellement.
        </Text>

        <Pressable style={[styles.btn, styles.btnPrimary]} onPress={onMessage}>
          <Text style={styles.btnPrimaryText}>Envoyer un message</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.btnGhost]} onPress={onKeepSwiping}>
          <Text style={styles.btnGhostText}>Continuer à swiper</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function ConfettiPiece({ left, color, delay, duration }: { left: number; color: string; delay: number; duration: number }) {
  const y = useRef(new Animated.Value(-20)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(y, { toValue: 700, duration, delay, useNativeDriver: true }).start();
    Animated.loop(Animated.timing(rotate, { toValue: 1, duration: 900, useNativeDriver: true })).start();
  }, []);

  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <Animated.View
      style={{
        position: "absolute",
        left,
        top: 0,
        width: 8,
        height: 8,
        borderRadius: 2,
        backgroundColor: color,
        transform: [{ translateY: y }, { rotate: spin }],
      }}
    />
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(43,39,36,0.9)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  photos: { flexDirection: "row", height: 110, marginBottom: 26 },
  photoCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 4,
    borderColor: "#fff",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  photoRight: { marginLeft: -20 },
  photoImg: { width: "100%", height: "100%" },
  title: { fontFamily: fonts.displayExtra, fontSize: 30, color: "#fff", marginBottom: 6, textAlign: "center" },
  subtitle: { fontFamily: fonts.body, fontSize: 13, color: "#F0E4DA", marginBottom: 24, textAlign: "center" },
  btn: { width: "100%", maxWidth: 260, paddingVertical: 14, borderRadius: radii.lg, alignItems: "center", marginTop: 8 },
  btnPrimary: { backgroundColor: "#fff" },
  btnPrimaryText: { fontFamily: fonts.displaySemi, fontSize: 14, color: colors.coralDark },
  btnGhost: { borderWidth: 1, borderColor: "rgba(255,255,255,0.5)" },
  btnGhostText: { fontFamily: fonts.displaySemi, fontSize: 14, color: "#fff" },
});
