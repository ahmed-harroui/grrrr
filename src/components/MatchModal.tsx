import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Dimensions, Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { fonts } from "@/theme/theme";
import { useThemedColors } from "@/hooks/useThemedColors";
import { ME, Pet } from "@/data/mockPets";

interface Props {
  visible: boolean;
  pet: Pet | null;
  onMessage: () => void;
  onKeepSwiping: () => void;
}

const { width } = Dimensions.get("window");
const SPARKLE_COLORS = ["#FFD7E1", "#FFC0D1", "#FFE8A3", "#BFF5E5"];

export default function MatchModal({ visible, pet, onKeepSwiping }: Props) {
  const colors = useThemedColors();
  const styles = getStyles(colors);
  const leftX = useRef(new Animated.Value(-70)).current;
  const rightX = useRef(new Animated.Value(70)).current;
  const contentScale = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      leftX.setValue(-70);
      rightX.setValue(70);
      contentScale.setValue(0.92);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(leftX, { toValue: 0, useNativeDriver: true, friction: 7 }),
        Animated.spring(rightX, { toValue: 0, useNativeDriver: true, friction: 7 }),
        Animated.spring(contentScale, { toValue: 1, useNativeDriver: true, friction: 7 }),
        Animated.timing(opacity, { toValue: 1, duration: 360, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, contentScale, leftX, opacity, rightX]);

  const sparkles = useMemo(
    () =>
      Array.from({ length: 20 }).map((_, i) => ({
        id: i,
        left: Math.random() * width,
        color: SPARKLE_COLORS[i % SPARKLE_COLORS.length],
        delay: Math.random() * 500,
        duration: 1500 + Math.random() * 1200,
      })),
    [visible]
  );

  if (!pet) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.overlay} onPress={onKeepSwiping}>
        {sparkles.map((piece) => (
          <SparklePiece key={piece.id} {...piece} />
        ))}
        <Animated.View style={[styles.content, { opacity, transform: [{ scale: contentScale }] }]}>
          <View style={styles.photos}>
            <Animated.View style={[styles.photoCircle, styles.meCircle, { transform: [{ translateX: leftX }] }]}>
              <Image source={{ uri: ME.photo }} style={styles.photoImg} />
            </Animated.View>
            <Animated.View style={[styles.photoCircle, styles.themCircle, { transform: [{ translateX: rightX }] }]}>
              <Image source={{ uri: pet.photo }} style={styles.photoImg} />
            </Animated.View>
          </View>
          <Text style={styles.title}>It’s a Match!</Text>
          <Text style={styles.matchType}>{(pet as any).matchType === "Hot" ? "💕 HOT MATCH" : "🐾 FRIEND MATCH"}</Text>
          <Text style={styles.subtitle}>{ME.name} et {pet.name} se sont likés mutuellement.</Text>
          <Text style={styles.matchDetail}>{(pet as any).matchType === "Hot" ? "Une belle rencontre amoureuse vous attend !" : "Une amitié fantastique commence !"}</Text>
          <Text style={styles.tapHint}>Touchez l’écran pour fermer</Text>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

function SparklePiece({ left, color, delay, duration }: { left: number; color: string; delay: number; duration: number }) {
  const y = useRef(new Animated.Value(-24)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(fade, { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 0, duration: 280, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(y, { toValue: 760, duration, useNativeDriver: true }),
      ]),
    ]).start();
  }, [delay, duration, fade, y]);

  return <Animated.View style={{ position: "absolute", left, top: 0, width: 7, height: 7, borderRadius: 2, backgroundColor: color, opacity: fade, transform: [{ translateY: y }] }} />;
}

function getStyles(colors: ReturnType<typeof useThemedColors>) {
    return StyleSheet.create({
    overlay: {
    flex: 1,
    backgroundColor: "rgba(255,93,115,0.94)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 26,
  },
    content: { alignItems: "center" },
    photos: { flexDirection: "row", alignItems: "center", marginBottom: 22 },
    photoCircle: {
    width: 122,
    height: 122,
    borderRadius: 61,
    borderWidth: 5,
    borderColor: "#fff",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
    meCircle: { marginRight: -16 },
    themCircle: { marginLeft: -16 },
    photoImg: { width: "100%", height: "100%" },
    title: { fontFamily: fonts.displayExtra, fontSize: 40, lineHeight: 42, color: "#fff", textAlign: "center" },
    matchType: { fontFamily: fonts.displaySemi, fontSize: 18, color: "#fff", textAlign: "center", marginTop: 6, letterSpacing: 1.2 },
    subtitle: { fontFamily: fonts.bodyMedium, fontSize: 14, color: "#FFE6ED", marginTop: 12, textAlign: "center" },
    matchDetail: { fontFamily: fonts.body, fontSize: 12, color: "#FFE6ED", marginTop: 6, textAlign: "center" },
    tapHint: { fontFamily: fonts.bodyBold, fontSize: 12, color: "#fff", opacity: 0.92, marginTop: 24 },
  });
}
