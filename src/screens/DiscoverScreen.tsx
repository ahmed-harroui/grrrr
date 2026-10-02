import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
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
import SwipeCard, { SwipeCardHandle, SwipeDirection } from "@/components/SwipeCard";
import Header from "@/components/Header";
import LikeButton from "@/components/LikeButton";
import { computeMatch } from "@/utils/matching";
import { addAdoptionInterest, AdoptionIntent, getAdoptionInterests } from "@/data/api/adoption";

const ADOPT = "#FFB35C";
const DISCOVER_ICON = require("../../assets/navbar/descover.png");

export default function DiscoverScreen() {
  const colors = useThemedColors();
  const { t, tx } = useTranslation();
  const { activePet, mode, setMode, likePet } = useAppState();
  const [cursor, setCursor] = useState(0);
  const [pendingMode, setPendingMode] = useState<number | null>(null);
  const topCardRef = useRef<SwipeCardHandle>(null);
  const { session } = useAuth();
  const [communityPets, setCommunityPets] = useState<Pet[]>([]);
  const [swipedIds, setSwipedIds] = useState<Set<string>>(new Set());
  // Pets that already liked mine: shown first, so liking back is one swipe away.
  const [likers, setLikers] = useState<Map<string, Liker>>(new Map());
  // An account that came to adopt has no pet to show: its swipes only say "waiting to adopt".
  const adopterMode = Boolean(activePet.adopterOnly);
  const [adoptNotice, setAdoptNotice] = useState<string | null>(null);
  const [adoptChoice, setAdoptChoice] = useState<Pet | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }, []);

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
        getAdoptionInterests(activePet.dbId),
      ])
        .then(([pets, swipes, likers, interests]) => {
          if (!active) return;
          setLikers(new Map(likers.map((liker) => [liker.id, liker])));
          setCommunityPets(pets.data.map(petRecordToPet));
          // Pets swiped up are waiting in Messages: not shown again.
          setSwipedIds(new Set([...swipes.map((swipe) => swipe.toPetId), ...interests.map((interest) => interest.pet.dbId ?? "")]));
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

  const handleSwiped = (direction: SwipeDirection) => {
    const pet = recommendations[cursor];
    setCursor((c) => c + 1);
    if (!pet) return;
    // Up (or any like in adopter mode): no like is sent; a sheet asks whether to adopt or buy.
    if (direction === "adopt" || (adopterMode && direction === "right")) {
      setAdoptChoice(pet);
      return;
    }
    if (direction === "right") likePet(pet);
  };

  // The family waits for this pet's babies; the request leaves with its first litter.
  const chooseIntent = async (intent: AdoptionIntent) => {
    const pet = adoptChoice;
    setAdoptChoice(null);
    if (!pet) return;
    const { error } = await addAdoptionInterest(pet.dbId, activePet.dbId, intent);
    setAdoptNotice(error === "WAITLIST_FULL"
      ? tx(`😿 ${pet.name} a déjà 5 familles qui attendent ses bébés. Réessaie plus tard.`, `😿 ${pet.name} already has 5 families waiting for their babies. Try again later.`)
      : intent === "BUY"
        ? tx(`🔔 Tu seras prévenu dès que ${pet.name} aura des bébés à vendre. Il t'attend dans Messages.`, `🔔 You will be told as soon as ${pet.name} has babies for sale. Find them in Messages.`)
        : tx(`🔔 Tu seras prévenu dès que ${pet.name} aura des bébés à adopter. Il t'attend dans Messages.`, `🔔 You will be told as soon as ${pet.name} has babies to adopt. Find them in Messages.`));
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setAdoptNotice(null), 4000);
  };

  // Changed my mind: the card comes back.
  const cancelIntent = () => {
    setAdoptChoice(null);
    setCursor((c) => Math.max(0, c - 1));
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
            {adopterMode ? (
              <View style={styles.modeSliderOverlay}>
                <Text style={styles.adopterBanner}>{tx("🍼 Mode adoption · glisse vers le haut les compagnons dont tu veux un bébé", "🍼 Adoption mode · swipe up the companions you would like a baby from")}</Text>
              </View>
            ) : (
              <View style={styles.modeSliderOverlay}>
                <ModeSlider value={mode} onChange={(nextMode) => nextMode !== mode && setPendingMode(nextMode)} />
              </View>
            )}
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
              <Pressable style={[styles.actBtn, styles.adoptBtn]} onPress={() => topCardRef.current?.triggerSwipe("adopt")}>
                <Image source={DISCOVER_ICON} style={styles.adoptIcon} resizeMode="contain" />
              </Pressable>
              {!adopterMode && <LikeButton mode={mode} onLike={() => topCardRef.current?.triggerSwipe("right")} />}
            </View>
          </>
        )}
      </View>

      {adoptNotice && (
        <Pressable style={styles.adoptNotice} onPress={() => setAdoptNotice(null)}>
          <Text style={styles.adoptNoticeText}>{adoptNotice}</Text>
        </Pressable>
      )}

      <Modal visible={!!adoptChoice} transparent animationType="slide" onRequestClose={cancelIntent}>
        <View style={styles.sheetOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={cancelIntent} />
          {adoptChoice && (
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />
              <Image source={{ uri: adoptChoice.photo || undefined }} style={styles.sheetAvatar} />
              <Text style={styles.sheetTitle}>{tx(`Les bébés de ${adoptChoice.name}`, `${adoptChoice.name}'s babies`)}</Text>
              <Text style={styles.sheetText}>{tx(`Rien n'est envoyé maintenant. Dès que ${adoptChoice.name} aura une portée, ta demande part chez les deux parents.`, `Nothing is sent now. As soon as ${adoptChoice.name} has a litter, your request goes to both parents.`)}</Text>
              <Pressable style={styles.sheetPrimary} onPress={() => chooseIntent("ADOPT")}>
                <Text style={styles.sheetPrimaryText}>🍼 {tx("Adopter un bébé", "Adopt a baby")}</Text>
              </Pressable>
              <Pressable style={styles.sheetSecondary} onPress={() => chooseIntent("BUY")}>
                <Text style={styles.sheetSecondaryText}>💶 {tx("Acheter un bébé", "Buy a baby")}</Text>
              </Pressable>
              <Pressable style={styles.sheetCancel} onPress={cancelIntent}>
                <Text style={styles.sheetCancelText}>{tx("Annuler", "Cancel")}</Text>
              </Pressable>
            </View>
          )}
        </View>
      </Modal>

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
  adoptBtn: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: ADOPT },
  adoptIcon: { width: 28, height: 28 },
  adopterBanner: { alignSelf: "center", fontFamily: fonts.bodyBold, fontSize: 11, color: "#FFFFFF", backgroundColor: "rgba(201,122,30,0.9)", paddingHorizontal: 12, paddingVertical: 7, borderRadius: radii.pill, overflow: "hidden", textAlign: "center" },
  adoptNotice: { position: "absolute", left: 16, right: 16, top: 70, zIndex: 40, padding: 12, borderRadius: radii.md, backgroundColor: "rgba(255,255,255,0.96)", borderWidth: 1.5, borderColor: ADOPT, shadowColor: "#C97A1E", shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  sheetOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(43,39,36,0.42)" },
  sheet: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.97)", borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, borderWidth: 1.5, borderBottomWidth: 0, borderColor: ADOPT, paddingHorizontal: 22, paddingTop: 10, paddingBottom: 28 },
  sheetHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: "rgba(201,122,30,0.35)", marginBottom: 16 },
  sheetAvatar: { width: 76, height: 76, borderRadius: 38, borderWidth: 3, borderColor: ADOPT, backgroundColor: "#FFF1DD" },
  sheetTitle: { fontFamily: fonts.display, fontSize: 21, color: "#3A2A18", marginTop: 10, textAlign: "center" },
  sheetText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: "#8A6F54", textAlign: "center", marginTop: 6, marginBottom: 18 },
  sheetPrimary: { alignSelf: "stretch", alignItems: "center", borderRadius: radii.pill, paddingVertical: 14, backgroundColor: ADOPT },
  sheetPrimaryText: { fontFamily: fonts.bodyBold, fontSize: 15, color: "#FFFFFF" },
  sheetSecondary: { alignSelf: "stretch", alignItems: "center", borderRadius: radii.pill, paddingVertical: 13, marginTop: 10, backgroundColor: "#FFFFFF", borderWidth: 1.5, borderColor: ADOPT },
  sheetSecondaryText: { fontFamily: fonts.bodyBold, fontSize: 15, color: "#C97A1E" },
  sheetCancel: { paddingVertical: 12, marginTop: 4 },
  sheetCancelText: { fontFamily: fonts.bodySemi, fontSize: 13, color: "#8A6F54" },
  adoptNoticeText: { fontFamily: fonts.bodySemi, fontSize: 12, lineHeight: 17, color: "#3A2A18" },
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
