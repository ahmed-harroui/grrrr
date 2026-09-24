import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { fonts, radii } from "@/theme/theme";
import { useThemedColors } from "@/hooks/useThemedColors";

interface Props {
  value: number; // 0..100
  onChange: (v: number) => void;
}

const PLAY_PAW = require("../../assets/bleue_clic.png");
const HOT_PAW = require("../../assets/pink_clic.png");

export default function ModeSlider({ value, onChange }: Props) {
  const colors = useThemedColors();
  const isPlay = value < 50;
  const styles = getStyles(colors);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.grey }]}>{isPlay ? "Looking for a play date" : "Open to a little hot love"}</Text>
      <View style={styles.selector}>
        <Pressable onPress={() => onChange(0)} style={[styles.choice, isPlay && styles.playActive]}>
          <Image source={PLAY_PAW} style={styles.pawImage} resizeMode="contain" />
          <Text style={[styles.choiceText, isPlay && styles.activeText]}>PLAY</Text>
        </Pressable>
        <View style={styles.divider} />
        <Pressable onPress={() => onChange(100)} style={[styles.choice, !isPlay && styles.hotActive]}>
          <Image source={HOT_PAW} style={styles.pawImage} resizeMode="contain" />
          <Text style={[styles.choiceText, !isPlay && styles.hotText]}>HOT</Text>
        </Pressable>
      </View>
    </View>
  );
}

function getStyles(colors: ReturnType<typeof useThemedColors>) {
  return StyleSheet.create({
    wrap: { paddingHorizontal: 20, paddingBottom: 14 },
    label: {
      textAlign: "center",
      fontFamily: fonts.displaySemi,
      fontSize: 13,
      marginBottom: 8,
    },
  selector: { height: 48, borderRadius: radii.pill, backgroundColor: "rgba(255,255,255,0.35)", borderWidth: 1, borderColor: "rgba(239,228,216,0.5)", flexDirection: "row", alignItems: "center", padding: 4 },
  choice: { flex: 1, height: 38, borderRadius: radii.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  playActive: { backgroundColor: "rgba(47,189,180,0.25)" },
  hotActive: { backgroundColor: "rgba(255,93,115,0.25)" },
  divider: { width: 1, height: 20, backgroundColor: "rgba(239,228,216,0.4)" },
  pawImage: { width: 20, height: 20, opacity: 0.8 },
  choiceText: { fontFamily: fonts.displaySemi, fontSize: 12, color: "rgba(43,39,36,0.75)", letterSpacing: 0.6 },
  activeText: { color: "rgba(30,112,108,0.95)" },
  hotText: { color: "rgba(190,55,78,0.95)" },
  });
}
