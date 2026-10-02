import React from "react";
import { Image, StyleSheet, View } from "react-native";
import { PET_RANKS } from "@/utils/petProgression";

// The rank emblem alone: it says the level without a label.
export default function PetRankBadge({ level = 1 }: { level?: number }) {
  const rank = PET_RANKS[Math.max(0, Math.min(PET_RANKS.length - 1, level - 1))];
  return <View style={styles.wrap}><Image source={rank.image} style={styles.image} resizeMode="contain" /></View>;
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: "transparent", overflow: "visible", paddingHorizontal: 6, paddingVertical: 7 },
  image: { width: 52, height: 52, shadowColor: "#FF5D73", shadowOpacity: 0.5, shadowRadius: 6, shadowOffset: { width: 0, height: 0 }, elevation: 5 },
});
