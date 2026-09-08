import React, { useRef } from "react";
import { Animated, LayoutChangeEvent, PanResponder, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, fonts, radii } from "@/theme/theme";

interface Props {
  value: number; // 0..100
  onChange: (v: number) => void;
}

const THUMB_SIZE = 42;
const TRACK_PADDING = 5;

export default function ModeSlider({ value, onChange }: Props) {
  const trackWidth = useRef(0);

  const handleLayout = (e: LayoutChangeEvent) => {
    trackWidth.current = e.nativeEvent.layout.width;
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, g) => {
        if (!trackWidth.current) return;
        const usable = trackWidth.current - TRACK_PADDING * 2 - THUMB_SIZE;
        const x = Math.min(usable, Math.max(0, g.moveX - TRACK_PADDING));
        onChange(Math.round((x / usable) * 100));
      },
    })
  ).current;

  const thumbLeft = trackWidth.current
    ? TRACK_PADDING + ((trackWidth.current - TRACK_PADDING * 2 - THUMB_SIZE) * value) / 100
    : TRACK_PADDING;

  const label =
    value < 33 ? "My pet needs a FRIEND" : value > 66 ? "My pet needs some HOT LOVE" : "My pet is open to FRIEND or LOVE";

  const thumbEmoji = value < 33 ? "🐾" : value > 66 ? "🔥" : "💞";

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.track} onLayout={handleLayout} {...panResponder.panHandlers}>
        <Text style={[styles.side, { color: colors.friend }]}>🐾 FRIEND</Text>
        <Text style={[styles.side, { color: colors.hot }]}>🔥 HOT</Text>
        <View style={[styles.thumbPos, { left: thumbLeft }]}>
          <LinearGradient
            colors={[colors.friend, value > 50 ? colors.hot : colors.coral]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.thumb}
          >
            <Text style={styles.thumbEmoji}>{thumbEmoji}</Text>
          </LinearGradient>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingBottom: 14 },
  label: {
    textAlign: "center",
    fontFamily: fonts.displaySemi,
    fontSize: 13,
    color: colors.grey,
    marginBottom: 8,
  },
  track: {
    height: 52,
    borderRadius: radii.pill,
    backgroundColor: "#F5F1EA",
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    justifyContent: "space-between",
  },
  side: { fontFamily: fonts.displaySemi, fontSize: 13 },
  thumbPos: { position: "absolute", top: TRACK_PADDING },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  thumbEmoji: { fontSize: 18 },
});
