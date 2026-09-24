import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { PET_RANKS } from "@/utils/petProgression";

export default function PetRankBadge({ level = 1 }: { level?: number }) {
  const rank = PET_RANKS[Math.max(0, Math.min(PET_RANKS.length - 1, level - 1))];
  return <View style={styles.wrap}><Image source={rank.image} style={styles.image} resizeMode="contain" /><View style={styles.textWrapper}><Text style={[styles.textStroke, { color: "#FFFFFF" }]}>Niv. {level}</Text><Text style={[styles.text, { color: rank.color }]}>Niv. {level}</Text></View></View>;
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "transparent", overflow: "visible", paddingHorizontal: 6, paddingVertical: 7 },
  image: { width: 52, height: 52, shadowColor: "#FF5D73", shadowOpacity: 0.5, shadowRadius: 6, shadowOffset: { width: 0, height: 0 }, elevation: 5 },
  textWrapper: { position: "relative" },
  textStroke: { position: "absolute", fontFamily: "Inter_700Bold", fontSize: 16, fontWeight: "bold", letterSpacing: 0.2, top: 0, left: 0 },
  text: { fontFamily: "Inter_700Bold", fontSize: 16, fontWeight: "bold", letterSpacing: 0.2, textShadowColor: "rgba(255,93,115,0.4)", textShadowRadius: 3, textShadowOffset: { width: 0, height: 0 } },
});
