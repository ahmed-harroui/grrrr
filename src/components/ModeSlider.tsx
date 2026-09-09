import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, radii } from "@/theme/theme";

interface Props {
  value: number; // 0..100
  onChange: (v: number) => void;
}

export default function ModeSlider({ value, onChange }: Props) {
  const isPlay = value < 50;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{isPlay ? "Looking for a play date" : "Open to a little hot love"}</Text>
      <View style={styles.selector}>
        <Pressable onPress={() => onChange(0)} style={[styles.choice, isPlay && styles.playActive]}>
          <Text style={[styles.icon, isPlay && styles.activeText]}>●</Text>
          <Text style={[styles.choiceText, isPlay && styles.activeText]}>PLAY</Text>
        </Pressable>
        <View style={styles.divider} />
        <Pressable onPress={() => onChange(100)} style={[styles.choice, !isPlay && styles.hotActive]}>
          <Text style={[styles.icon, !isPlay && styles.hotText]}>✦</Text>
          <Text style={[styles.choiceText, !isPlay && styles.hotText]}>HOT</Text>
        </Pressable>
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
  selector: { height: 48, borderRadius: radii.pill, backgroundColor: "rgba(255,255,255,0.58)", borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", padding: 4 },
  choice: { flex: 1, height: 38, borderRadius: radii.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  playActive: { backgroundColor: "rgba(47,189,180,0.12)" },
  hotActive: { backgroundColor: "rgba(255,93,115,0.12)" },
  divider: { width: 1, height: 20, backgroundColor: colors.line },
  icon: { fontFamily: fonts.bodyBold, fontSize: 12, color: "rgba(43,39,36,0.45)" },
  choiceText: { fontFamily: fonts.displaySemi, fontSize: 12, color: "rgba(43,39,36,0.58)", letterSpacing: 0.6 },
  activeText: { color: "rgba(30,112,108,0.82)" },
  hotText: { color: "rgba(190,55,78,0.82)" },
});
