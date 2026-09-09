import React, { useRef, useState } from "react";
import { Animated, Image, Pressable, StyleSheet, View } from "react-native";
import { colors } from "@/theme/theme";

interface Props {
  onLike: () => void;
  mode: number;
}

const BROKEN_LOGO = require("../../assets/like_after_hold.png");
const PLAY_PAW = require("../../assets/bleue_clic.png");
const HOT_PAW = require("../../assets/pink_clic.png");
const INITIAL_LOGO = require("../../assets/initiale_log.png");

export default function LikeButton({ onLike, mode }: Props) {
  const [isBreaking, setIsBreaking] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    if (isBreaking) return;
    setIsBreaking(true);
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.12, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
    ]).start();
    setTimeout(() => {
      setIsBreaking(false);
      onLike();
    }, 1000);
  };

  const pawLogo = mode >= 50 ? HOT_PAW : PLAY_PAW;

  return (
    <Pressable style={styles.button} onPress={handlePress} disabled={isBreaking}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Image source={INITIAL_LOGO} style={styles.logo} resizeMode="contain" />
        {isBreaking && (
          <View style={styles.breakingOverlay}>
            <Image source={pawLogo} style={styles.paw} resizeMode="contain" />
            <Image source={BROKEN_LOGO} style={styles.brokenLogo} resizeMode="contain" />
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 76, height: 76, alignItems: "center", justifyContent: "center" },
  logo: { width: 72, height: 72 },
  breakingOverlay: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  paw: { position: "absolute", width: 70, height: 70, opacity: 0.68, zIndex: 1 },
  brokenLogo: { width: 72, height: 72, zIndex: 2 },
});
