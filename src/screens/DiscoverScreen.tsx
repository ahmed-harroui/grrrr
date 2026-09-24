import React, { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fonts, radii } from "@/theme/theme";
import { PETS } from "@/data/mockPets";
import { useAppState } from "@/context/AppState";
import { useThemedColors } from "@/hooks/useThemedColors";
import { useTranslation } from "@/i18n/useTranslation";
import ModeSlider from "@/components/ModeSlider";
import SwipeCard, { SwipeCardHandle } from "@/components/SwipeCard";
import MatchModal from "@/components/MatchModal";
import Header from "@/components/Header";
import LikeButton from "@/components/LikeButton";
import { computeMatch } from "@/utils/matching";

export default function DiscoverScreen() {
  const colors = useThemedColors();
  const { t } = useTranslation();
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.cream }]} edges={["top"]}>
      <Header />

      <View style={styles.stackWrap}>
        {visible.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.grey }]}>
              {t.discover.noMore} 🐾{"\n"}{t.discover.expandDistance}
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.modeSliderOverlay}>
              <ModeSlider value={mode} onChange={(nextMode) => nextMode !== mode && setPendingMode(nextMode)} />
            </View>
            {visible
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
              ))}
            <View style={styles.actionsOverlay}>
              <Pressable style={[styles.actBtn, styles.skipBtn]} onPress={() => topCardRef.current?.triggerSwipe("left")}>
                <Text style={styles.skipIcon}>×</Text>
              </Pressable>
              <Pressable style={[styles.actBtn, styles.superBtn]} onPress={() => topCardRef.current?.triggerSwipe("super")}>
                <Text style={styles.superIcon}>⭐</Text>
              </Pressable>
              <LikeButton mode={mode} onLike={() => topCardRef.current?.triggerSwipe("right")} />
            </View>
          </>
        )}
      </View>

      <MatchModal
        visible={!!pendingMatch}
        pet={pendingMatch}
        onMessage={clearPendingMatch}
        onKeepSwiping={clearPendingMatch}
      />

      <Modal visible={pendingMode !== null} transparent animationType="fade" onRequestClose={() => setPendingMode(null)}>
        <View style={[styles.confirmOverlay, { backgroundColor: "rgba(43,39,36,0.48)" }]}>
          <View style={[styles.confirmCard, { backgroundColor: colors.cream, borderColor: colors.line }]}>
            <Text style={[styles.confirmTitle, { color: colors.dark }]}>{pendingMode === 0 ? t.discover.switchPlay : t.discover.switchHot}</Text>
            <Text style={[styles.confirmText, { color: colors.grey }]}>{activePet.name} {t.discover.willBeDisplayed} {pendingMode === 0 ? "Friend / PLAY" : "Hot"}. {t.discover.profilesWillReorder}</Text>
            <Pressable style={[styles.confirmButton, pendingMode === 0 ? { backgroundColor: colors.friend } : { backgroundColor: colors.coral }]} onPress={() => { if (pendingMode !== null) setMode(pendingMode); setPendingMode(null); }}>
              <Text style={styles.confirmButtonText}>{t.common.confirm}</Text>
            </Pressable>
            <Pressable style={styles.cancelButton} onPress={() => setPendingMode(null)}><Text style={[styles.cancelButtonText, { color: colors.grey }]}>{t.common.cancel}</Text></Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  stackWrap: { flex: 1, marginHorizontal: 8, marginBottom: 0, position: "relative" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 30 },
  emptyText: { textAlign: "center", fontFamily: fonts.body, fontSize: 13, lineHeight: 20 },
  modeSliderOverlay: { position: "absolute", top: 12, left: 0, right: 0, zIndex: 25, paddingHorizontal: 8 },
  actionsOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 18, paddingTop: 12, paddingBottom: 16, backgroundColor: "transparent", zIndex: 20 },
  actBtn: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.95)",
    shadowColor: "#2B2724",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  skipBtn: { width: 54, height: 54, borderRadius: 27 },
  skipIcon: { fontFamily: fonts.body, fontSize: 32, lineHeight: 34, color: "#2B2724" },
  superBtn: { width: 44, height: 44, borderRadius: 22 },
  superIcon: { fontSize: 18, color: "#FF9E4F" },
  likeBtn: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#FF5D73" },
  likeIcon: { fontSize: 22 },
  confirmOverlay: { flex: 1, alignItems: "center", justifyContent: "center", padding: 22 },
  confirmCard: { width: "100%", maxWidth: 350, borderRadius: radii.md, borderWidth: 1, padding: 20 },
  confirmTitle: { fontFamily: fonts.displaySemi, fontSize: 20, textAlign: "center" },
  confirmText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 8, marginBottom: 18 },
  confirmButton: { alignItems: "center", borderRadius: radii.pill, paddingVertical: 13 },
  confirmButtonText: { fontFamily: fonts.bodyBold, fontSize: 13, color: "#FFFFFF" },
  cancelButton: { alignItems: "center", paddingVertical: 12 },
  cancelButtonText: { fontFamily: fonts.bodySemi, fontSize: 12 },
});
