import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { PET_RANKS } from "@/utils/petProgression";
import { useTranslation } from "@/i18n/useTranslation";

export default function PetRankBadge({ level = 1 }: { level?: number }) {
  const { tx } = useTranslation();
  const rank = PET_RANKS[Math.max(0, Math.min(PET_RANKS.length - 1, level - 1))];
  return <View style={styles.wrap}><Image source={rank.image} style={styles.image} resizeMode="contain" /><Text style={[styles.text, { color: rank.color }]}>{tx("Niv.", "Lvl")} {level}</Text></View>;
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "transparent", overflow: "visible", paddingHorizontal: 6, paddingVertical: 7 },
  image: { width: 52, height: 52, shadowColor: "#FF5D73", shadowOpacity: 0.5, shadowRadius: 6, shadowOffset: { width: 0, height: 0 }, elevation: 5 },
  text: { fontFamily: "Inter_700Bold", fontSize: 16, fontWeight: "bold", letterSpacing: 0.2, textShadowColor: "#FFFFFF", textShadowRadius: 4, textShadowOffset: { width: 1, height: 1 } },
});
