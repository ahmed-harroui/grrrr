import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, fonts } from "@/theme/theme";

interface Props {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: Props) {
  const pawScale = useRef(new Animated.Value(1)).current;
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pawScale, {
          toValue: 1.18,
          duration: 550,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pawScale, {
          toValue: 1,
          duration: 550,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    const timer = setTimeout(() => {
      Animated.timing(fade, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => onFinish());
    }, 1700);

    return () => {
      pulse.stop();
      clearTimeout(timer);
    };
  }, []);

  return (
    <Animated.View style={[styles.fill, { opacity: fade }]}>
      <LinearGradient
        colors={[colors.coral, colors.coralDark, "#D63A56"]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.fill}
      >
        <View style={styles.center}>
          <Animated.Text style={[styles.paw, { transform: [{ scale: pawScale }] }]}>🐾</Animated.Text>
          <Text style={styles.logo}>GRRRR</Text>
          <Text style={styles.tag}>Find their perfect match.</Text>
          <View style={styles.dots}>
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  paw: { fontSize: 58, marginBottom: 6 },
  logo: { fontFamily: fonts.displayExtra, fontSize: 40, color: "#fff", letterSpacing: 1, marginTop: 6 },
  tag: { fontFamily: fonts.bodyMedium, fontSize: 13, color: "#FCE9EC", marginTop: 10 },
  dots: { flexDirection: "row", gap: 6, marginTop: 34 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.55)" },
});
