import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fonts, radii } from "@/theme/theme";
import { PETS, Pet } from "@/data/mockPets";
import { useAuth } from "@/context/AuthContext";
import { getDiscoverablePetProfiles, petRecordToPet } from "@/data/api/profile";
import { getSwipeHistory } from "@/data/api/swipes";
import { getPetLikers, Liker } from "@/data/api/likes";
import { proximityRank } from "@/utils/discovery";
import { useAppState } from "@/context/AppState";
import { useThemedColors } from "@/hooks/useThemedColors";
import { useTranslation } from "@/i18n/useTranslation";
import ModeSlider from "@/components/ModeSlider";
import SwipeCard, { SwipeCardHandle } from "@/components/SwipeCard";
import Header from "@/components/Header";
import LikeButton from "@/components/LikeButton";
import { computeMatch } from "@/utils/matching";

export default function DiscoverScreen() {
  const colors = useThemedColors();
  const { t } = useTranslation();
  const { activePet, mode, setMode, likePet } = useAppState();
  const [cursor, setCursor] = useState(0);
  const [pendingMode, setPendingMode] = useState<number | null>(null);
  const topCardRef = useRef<SwipeCardHandle>(null);
  const { session } = useAuth();
  const [communityPets, setCommunityPets] = useState<Pet[]>([]);
  const [swipedIds, setSwipedIds] = useState<Set<string>>(new Set());
  // Pets that already liked mine: shown first, so liking back is one swipe away.
  const [likers, setLikers] = useState<Map<string, Liker>>(new Map());

  useEffect(() => setCursor(0), [activePet.id]);

  // Signed in: real pets from the database (other owners + test bots), minus the ones already swiped.
  useFocusEffect(
    useCallback(() => {
      if (!session?.user.id) return;
      let active = true;
      Promise.all([
        getDiscoverablePetProfiles(session.user.id),
        activePet.dbId ? getSwipeHistory(activePet.dbId) : Promise.resolve([]),
        getPetLikers(activePet.dbId),
      ])
        .then(([pets, swipes, likers]) => {
          if (!active) return;
          setLikers(new Map(likers.map((liker) => [liker.id, liker])));
          setCommunityPets(pets.data.map(petRecordToPet));
          setSwipedIds(new Set(swipes.map((swipe) => swipe.toPetId)));
          setCursor(0);
        })
        .catch((error) => console.warn("Discover could not load pets", error));
      return () => {
        active = false;
      };
    }, [activePet.dbId, session?.user.id])
  );

  // Everyone is shown, best fits first: pets that liked mine, real accounts before test bots
  // (newest first, as loaded), then same species, closest (city, country, world),
  // same mood (PLAY / HOT), most compatible. Only HOT mode hides same-gender pets of the same species.
  const recommendations = useMemo(() => {
    const fresh = communityPets.filter((pet) => !pet.dbId || !swipedIds.has(pet.dbId));
    // Demo profiles when signed out, or when the database has nobody left to show.
    const pool = session && fresh.length > 0 ? fresh : PETS;
    const sameSpecies = (pet: Pet) => (pet.species === activePet.species ? 0 : 1);
    const sameMood = (pet: Pet) => ((mode < 50) === (pet.mode < 50) ? 0 : 1);
    const likedMe = (pet: Pet) => (pet.dbId && likers.has(pet.dbId) ? 0 : 1);
    const realAccount = (pet: Pet) => (pet.isBot ? 1 : 0);
    return pool
      // A pet that already liked mine is always shown, so the like can be answered.
      .filter((pet) => pet.id !== activePet.id && (likedMe(pet) === 0 || !(mode >= 50 && pet.species === activePet.species && pet.gender === activePet.gender)))
      .sort((a, b) =>
        likedMe(a) - likedMe(b) ||
        realAccount(a) - realAccount(b) ||
        sameSpecies(a) - sameSpecies(b) ||
        proximityRank(a, activePet) - proximityRank(b, activePet) ||
        sameMood(a) - sameMood(b) ||
        computeMatch(b, mode, activePet).pct - computeMatch(a, mode, activePet).pct
      );
  }, [activePet, communityPets, likers, mode, session, swipedIds]);
  const visible = recommendations.slice(cursor, cursor + 3);

  const handleSwiped = (direction: "left" | "right" | "super") => {
    const pet = recommendations[cursor];
    setCursor((c) => c + 1);
    if (pet && (direction === "right" || direction === "super")) {
      likePet(pet, direction === "super");
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
                  likedMe={pet.dbId ? likers.get(pet.dbId) : undefined}
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
  actionsOverlay: { position: "absolute", bottom: -25, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 18, paddingTop: 12, paddingBottom: 20, backgroundColor: "transparent", zIndex: 20 },
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
