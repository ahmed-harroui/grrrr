import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fonts, radii } from "@/theme/theme";
import { PETS } from "@/data/mockPets";
import { useAppState } from "@/context/AppState";
import ModeSlider from "@/components/ModeSlider";
import SwipeCard, { SwipeCardHandle } from "@/components/SwipeCard";
import MatchModal from "@/components/MatchModal";
import Header from "@/components/Header";

export default function DiscoverScreen() {
  const { mode, setMode, likePet, pendingMatch, clearPendingMatch } = useAppState();
  const [cursor, setCursor] = useState(0);
  const topCardRef = useRef<SwipeCardHandle>(null);

  const visible = PETS.slice(cursor, cursor + 3);

  const handleSwiped = (direction: "left" | "right" | "super") => {
    const pet = PETS[cursor];
    setCursor((c) => c + 1);
    if (pet && (direction === "right" || direction === "super")) {
      likePet(pet);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Header />
      <ModeSlider value={mode} onChange={setMode} />

      <View style={styles.stackWrap}>
        {visible.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              Plus de profils pour le moment 🐾{"\n"}Élargissez la distance dans les filtres.
            </Text>
          </View>
        ) : (
          visible
            .map((pet, i) => ({ pet, depth: i }))
            .reverse()
            .map(({ pet, depth }) => (
              <SwipeCard
                key={pet.id}
                ref={depth === 0 ? topCardRef : undefined}
                pet={pet}
                mode={mode}
                isTop={depth === 0}
                depth={depth}
                onSwiped={handleSwiped}
              />
            ))
        )}
      </View>

      <View style={styles.actions}>
        <Pressable style={[styles.actBtn, styles.skipBtn]} onPress={() => topCardRef.current?.triggerSwipe("left")}>
          <Text style={styles.skipIcon}>✕</Text>
        </Pressable>
        <Pressable style={[styles.actBtn, styles.superBtn]} onPress={() => topCardRef.current?.triggerSwipe("super")}>
          <Text style={styles.superIcon}>⭐</Text>
        </Pressable>
        <Pressable style={[styles.actBtn, styles.likeBtn]} onPress={() => topCardRef.current?.triggerSwipe("right")}>
          <Text style={styles.likeIcon}>❤️</Text>
        </Pressable>
      </View>

      <MatchModal
        visible={!!pendingMatch}
        pet={pendingMatch}
        onMessage={clearPendingMatch}
        onKeepSwiping={clearPendingMatch}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  stackWrap: { flex: 1, marginHorizontal: 18, marginBottom: 8, position: "relative" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 30 },
  emptyText: { textAlign: "center", fontFamily: fonts.body, color: colors.grey, fontSize: 13, lineHeight: 20 },
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 18, paddingVertical: 14 },
  actBtn: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    shadowColor: "#2B2724",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  skipBtn: { width: 54, height: 54, borderRadius: 27 },
  skipIcon: { fontSize: 22, color: colors.coral },
  superBtn: { width: 44, height: 44, borderRadius: 22 },
  superIcon: { fontSize: 18, color: colors.hot },
  likeBtn: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.coral },
  likeIcon: { fontSize: 22 },
});
