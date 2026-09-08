import React, { useMemo } from "react";
import { FlatList, Image, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fonts, radii } from "@/theme/theme";
import { PETS } from "@/data/mockPets";
import { computeMatch } from "@/utils/matching";
import { useAppState } from "@/context/AppState";
import Header from "@/components/Header";

export default function ExploreScreen() {
  const { mode } = useAppState();

  const sorted = useMemo(
    () => [...PETS].sort((a, b) => computeMatch(b, mode).pct - computeMatch(a, mode).pct),
    [mode]
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Header />
      <Text style={styles.title}>Tendances près de vous</Text>
      <FlatList
        data={sorted}
        keyExtractor={(p) => String(p.id)}
        numColumns={2}
        columnWrapperStyle={{ gap: 10 }}
        contentContainerStyle={{ gap: 10, paddingHorizontal: 20, paddingBottom: 20 }}
        renderItem={({ item }) => {
          const { pct } = computeMatch(item, mode);
          return (
            <View style={styles.tile}>
              <Image source={{ uri: item.photo }} style={styles.tileImg} />
              <View style={styles.tileShade} />
              <Text style={styles.tileLabel}>
                {item.name} · {pct}%
              </Text>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  title: { fontFamily: fonts.display, fontSize: 21, color: colors.dark, marginHorizontal: 20, marginBottom: 14, marginTop: 2 },
  tile: { flex: 1, height: 120, borderRadius: radii.md, overflow: "hidden" },
  tileImg: { width: "100%", height: "100%" },
  tileShade: { position: "absolute", left: 0, right: 0, bottom: 0, height: "45%", backgroundColor: "rgba(0,0,0,0.4)" },
  tileLabel: {
    position: "absolute",
    bottom: 6,
    left: 8,
    color: "#fff",
    fontFamily: fonts.display,
    fontSize: 11.5,
  },
});
