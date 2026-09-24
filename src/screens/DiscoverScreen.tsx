import React, { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fonts, radii } from "@/theme/theme";
import { PETS } from "@/data/mockPets";
import { useAppState } from "@/context/AppState";
import ModeSlider from "@/components/ModeSlider";
import SwipeCard, { SwipeCardHandle } from "@/components/SwipeCard";
import MatchModal from "@/components/MatchModal";
import Header from "@/components/Header";
import LikeButton from "@/components/LikeButton";
import { computeMatch } from "@/utils/matching";

export default function DiscoverScreen() {
  const { activePet, mode, setMode, likePet, pendingMatch, clearPendingMatch } = useAppState();
  const [cursor, setCursor] = useState(0);
  const [pendingMode, setPendingMode] = useState<number | null>(null);
  const topCardRef = useRef<SwipeCardHandle>(null);

  useEffect(() => setCursor(0), [activePet.id]);

  const recommendations = useMemo(() => {
    return PETS
      .filter((pet) =>
        pet.species === activePet.species &&
        pet.id !== activePet.id &&
        (mode < 50 ? pet.mode < 50 : pet.mode >= 50 && pet.gender !== activePet.gender)
      )
      .sort((a, b) => computeMatch(b, mode, activePet).pct - computeMatch(a, mode, activePet).pct);
  }, [activePet, mode]);
  const visible = recommendations.slice(cursor, cursor + 3);

  const handleSwiped = (direction: "left" | "right" | "super") => {
    const pet = recommendations[cursor];
    setCursor((c) => c + 1);
    if (pet && (direction === "right" || direction === "super")) {
      likePet(pet);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Header />
      <ModeSlider value={mode} onChange={(nextMode) => nextMode !== mode && setPendingMode(nextMode)} />

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
                activePet={activePet}
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
          <Text style={styles.skipIcon}>×</Text>
        </Pressable>
        <Pressable style={[styles.actBtn, styles.superBtn]} onPress={() => topCardRef.current?.triggerSwipe("super")}>
          <Text style={styles.superIcon}>⭐</Text>
        </Pressable>
        <LikeButton mode={mode} onLike={() => topCardRef.current?.triggerSwipe("right")} />
      </View>

      <MatchModal
        visible={!!pendingMatch}
        pet={pendingMatch}
        onMessage={clearPendingMatch}
        onKeepSwiping={clearPendingMatch}
      />

      <Modal visible={pendingMode !== null} transparent animationType="fade" onRequestClose={() => setPendingMode(null)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>{pendingMode === 0 ? "Passer en mode PLAY ?" : "Passer en mode HOT ?"}</Text>
            <Text style={styles.confirmText}>{activePet.name} sera affiché comme {pendingMode === 0 ? "Friend / PLAY" : "Hot"}. Les profils Discover seront immédiatement reclassés selon cette préférence.</Text>
            <Pressable style={[styles.confirmButton, pendingMode === 0 ? styles.playButton : styles.hotButton]} onPress={() => { if (pendingMode !== null) setMode(pendingMode); setPendingMode(null); }}>
              <Text style={styles.confirmButtonText}>Confirmer</Text>
            </Pressable>
            <Pressable style={styles.cancelButton} onPress={() => setPendingMode(null)}><Text style={styles.cancelButtonText}>Annuler</Text></Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  stackWrap: { flex: 1, marginHorizontal: 14, marginBottom: 4, position: "relative" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 30 },
  emptyText: { textAlign: "center", fontFamily: fonts.body, color: colors.grey, fontSize: 13, lineHeight: 20 },
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 18, paddingTop: 10, paddingBottom: 18 },
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
  skipIcon: { fontFamily: fonts.body, fontSize: 32, lineHeight: 34, color: colors.dark },
  superBtn: { width: 44, height: 44, borderRadius: 22 },
  superIcon: { fontSize: 18, color: colors.hot },
  likeBtn: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.coral },
  likeIcon: { fontSize: 22 },
  confirmOverlay: { flex: 1, alignItems: "center", justifyContent: "center", padding: 22, backgroundColor: "rgba(43,39,36,0.48)" },
  confirmCard: { width: "100%", maxWidth: 350, backgroundColor: colors.cream, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, padding: 20 },
  confirmTitle: { fontFamily: fonts.displaySemi, fontSize: 20, textAlign: "center", color: colors.dark },
  confirmText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, textAlign: "center", color: colors.grey, marginTop: 8, marginBottom: 18 },
  confirmButton: { alignItems: "center", borderRadius: radii.pill, paddingVertical: 13 },
  playButton: { backgroundColor: colors.friend },
  hotButton: { backgroundColor: colors.coral },
  confirmButtonText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.white },
  cancelButton: { alignItems: "center", paddingVertical: 12 },
  cancelButtonText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.grey },
});
