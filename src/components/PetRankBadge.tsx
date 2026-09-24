import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { PET_RANKS } from "@/utils/petProgression";

export default function PetRankBadge({ level = 1 }: { level?: number }) {
  const rank = PET_RANKS[Math.max(0, Math.min(PET_RANKS.length - 1, level - 1))];
  return <View style={styles.wrap}><Image source={rank.image} style={styles.image} resizeMode="contain" /><Text style={[styles.text, { color: rank.color }]}>Niv. {level}</Text></View>;
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "transparent", overflow: "visible", paddingHorizontal: 2, paddingVertical: 3 },
  image: { width: 30, height: 30, shadowColor: "#FF5D73", shadowOpacity: 0.35, shadowRadius: 3, shadowOffset: { width: 0, height: 0 }, elevation: 3 },
  text: { fontFamily: "Inter_700Bold", fontSize: 10, textShadowColor: "rgba(255,93,115,0.25)", textShadowRadius: 2, textShadowOffset: { width: 0, height: 0 } },
});
