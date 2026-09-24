import React, { useRef, useState } from "react";
import { Animated, Image, Pressable, StyleSheet, View } from "react-native";

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
      <Animated.View style={[styles.logoContainer, { transform: [{ scale }] }]}>
        {!isBreaking ? (
          <Image source={INITIAL_LOGO} style={styles.logo} resizeMode="contain" />
        ) : (
          <View style={styles.breakingOverlay}>
            <Image source={BROKEN_LOGO} style={styles.brokenLogo} resizeMode="contain" />
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 84, height: 84, alignItems: "center", justifyContent: "center" },
  logoContainer: { width: 84, height: 84, alignItems: "center", justifyContent: "center" },
  logo: { width: 76, height: 76 },
  breakingOverlay: { width: 84, height: 84, alignItems: "center", justifyContent: "center" },
  brokenLogo: { width: 92, height: 92, zIndex: 2 },
});
