import React, { useCallback, useState } from "react";
import { Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { fonts, radii } from "@/theme/theme";
import { useThemedColors } from "@/hooks/useThemedColors";
import { useAppState } from "@/context/AppState";
import Header from "@/components/Header";
import TrendingProfiles from "@/components/TrendingProfiles";
import { useTranslation } from "@/i18n/useTranslation";
import { getPetLikers, Liker } from "@/data/api/likes";
import { AdoptionInterest, getWaitingForMyPet, removeWaitingFamily, WAITLIST_LIMIT } from "@/data/api/adoption";
import PetProfileSheet from "@/components/PetProfileSheet";
import type { Pet } from "@/data/mockPets";
import { timeAgo } from "@/utils/notificationText";

const HOT = "#FF5D73";
const FRIEND = "#2FBDB4";
const ADOPT = "#FFB35C";
const BUY = "#2FBDB4";

// The likes still waiting for an answer. Matches are not listed here: each one is a
// conversation in Messages.
export default function MatchesScreen() {
  const { matches, activePet } = useAppState();
  const navigation = useNavigation<any>();
  const colors = useThemedColors();
  const styles = getStyles(colors);
  const { tx } = useTranslation();
  const [likers, setLikers] = useState<Liker[]>([]);
  const [waiting, setWaiting] = useState<AdoptionInterest[]>([]);
  const [profilePet, setProfilePet] = useState<Pet | null>(null);

  // One-sided likes: blurred until my pet likes back in Discover. Below them, the swipes up.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getPetLikers(activePet.dbId).then((result) => active && setLikers(result));
      getWaitingForMyPet(activePet.dbId).then((result) => active && setWaiting(result));
      return () => {
        active = false;
      };
    }, [activePet.dbId])
  );
  // Removing a family makes room for another one (5 at most, migration 022).
  const confirmRemove = (interest: AdoptionInterest) => {
    const name = interest.pet.adopterOnly ? tx("cette personne", "this person") : interest.pet.name;
    const who = name.charAt(0).toUpperCase() + name.slice(1);
    Alert.alert(tx(`Retirer ${name} ?`, `Remove ${name}?`), tx(`${who} n'attendra plus les bébés de ${activePet.name}.`, `${who} will no longer wait for ${activePet.name}'s babies.`), [
      { text: tx("Annuler", "Cancel"), style: "cancel" },
      {
        text: tx("Retirer", "Remove"),
        style: "destructive",
        onPress: async () => {
          if (!activePet.dbId || !interest.pet.dbId) return;
          setWaiting((current) => current.filter((item) => item.pet.dbId !== interest.pet.dbId));
          const removed = await removeWaitingFamily(activePet.dbId, interest.pet.dbId);
          if (!removed) {
            getWaitingForMyPet(activePet.dbId).then(setWaiting);
            Alert.alert(tx("Pas retiré", "Not removed"), tx("La liste n'a pas pu être modifiée. Réessaie dans un instant.", "The list could not be changed. Try again in a moment."));
          }
        },
      },
    ]);
  };

  const matchedIds = new Set(matches.map((pet) => pet.dbId));
  const pendingLikers = likers.filter((liker) => !matchedIds.has(liker.id));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.cream }]} edges={["top"]}>
      <Header />

      <FlatList
        data={pendingLikers}
        keyExtractor={(liker) => liker.id}
        numColumns={1}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingBottom: 30 }}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <TrendingProfiles />
            <Text style={styles.title}>{tx(`Ils ont liké ${activePet.name}`, `They liked ${activePet.name}`)}</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{tx("Aucun like en attente. Swipez à droite sur Discover 🐾", "No likes waiting. Swipe right on Discover 🐾")}</Text>
          </View>
        }
        ListFooterComponent={
          <View>
            {/* Swiped my pet up in Discover: they wait for its babies, to adopt or to buy */}
            {waiting.length > 0 && (
              <View style={styles.waitingSection}>
                <View style={styles.waitingHeader}>
                  <Text style={styles.waitingTitle}>🍼 {tx(`Ils attendent les bébés de ${activePet.name}`, `Waiting for ${activePet.name}'s babies`)}</Text>
                  <Text style={[styles.waitingCount, waiting.length >= WAITLIST_LIMIT && styles.waitingCountFull]}>{waiting.length}/{WAITLIST_LIMIT}</Text>
                </View>
                <Text style={styles.waitingHint}>
                  {waiting.length >= WAITLIST_LIMIT
                    ? tx("Liste pleine : personne d'autre ne peut attendre. Retire une famille (✕) pour faire de la place.", "List full: nobody else can wait. Remove a family (✕) to make room.")
                    : tx("Leur demande part dès que tu proposes une relation 💞 dans un chat.", "Their request leaves as soon as you propose a relationship 💞 in a chat.")}
                </Text>
                {waiting.map((item) => (
                  <WaitingTile key={item.pet.id} interest={item} petName={activePet.name} onPress={() => setProfilePet(item.pet)} onRemove={() => confirmRemove(item)} styles={styles} />
                ))}
              </View>
            )}
            {matches.length > 0 ? (
              <Pressable style={styles.messagesLink} onPress={() => navigation.navigate("Chat")}>
                <Text style={styles.messagesLinkText}>
                  💬 {matches.length > 1 ? tx(`Tes ${matches.length} matchs sont dans Messages ›`, `Your ${matches.length} matches are in Messages ›`) : tx("Ton match est dans Messages ›", "Your match is in Messages ›")}
                </Text>
              </Pressable>
            ) : null}
          </View>
        }
        renderItem={({ item }) => <MysteryTile liker={item} petName={activePet.name} onPress={() => navigation.navigate("Discover")} styles={styles} />}
      />
      <PetProfileSheet pet={profilePet} onClose={() => setProfilePet(null)} />
    </SafeAreaView>
  );
}

// A family that swiped my pet up: who, and whether they want to adopt or buy. An account with
// no pet of its own (adopter mode) has nothing to show: no name, just what it is waiting for.
function WaitingTile({ interest, petName, onPress, onRemove, styles }: { interest: AdoptionInterest; petName: string; onPress: () => void; onRemove: () => void; styles: ReturnType<typeof getStyles> }) {
  const { tx, language } = useTranslation();
  const { pet, intent } = interest;
  const buy = intent === "BUY";
  const noPet = Boolean(pet.adopterOnly);
  // The ✕ sits beside the tappable part, not inside it: nested in the card, its taps could go
  // to the card (the profile) instead.
  return (
    <View style={styles.waitingCard}>
      <Pressable style={styles.waitingMain} onPress={noPet ? undefined : onPress}>
        <View style={styles.waitingRing}>
          {noPet || !pet.photo ? (
            <View style={[styles.waitingAvatar, styles.waitingFamily]}>
              <Text style={styles.waitingFamilyIcon}>{buy ? "💶" : "🍼"}</Text>
            </View>
          ) : (
            <Image source={{ uri: pet.photo }} style={styles.waitingAvatar} />
          )}
        </View>
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.waitingName} numberOfLines={1}>
              {noPet ? (buy ? tx("Veut acheter", "Wants to buy") : tx("Veut adopter", "Wants to adopt")) : pet.name}
            </Text>
            <Text style={[styles.intentPill, { backgroundColor: buy ? BUY : ADOPT }]}>{buy ? tx("💶 Acheter", "💶 Buy") : tx("🍼 Adopter", "🍼 Adopt")}</Text>
          </View>
          <Text style={styles.meetingPlace} numberOfLines={1}>
            {noPet
              ? [tx(`Attend les bébés de ${petName}`, `Waiting for ${petName}'s babies`), timeAgo(interest.since, language)].join(" · ")
              : [pet.breed, timeAgo(interest.since, language)].filter(Boolean).join(" · ")}
          </Text>
        </View>
      </Pressable>
      <Pressable onPress={onRemove} hitSlop={12} style={({ pressed }) => [styles.waitingRemove, pressed && styles.waitingRemovePressed]} accessibilityLabel={tx("Retirer de la liste", "Remove from the list")}>
        <Text style={styles.waitingRemoveText}>✕</Text>
      </Pressable>
    </View>
  );
}

// A pet that liked mine: photo and identity stay blurred until the like back.
function MysteryTile({ liker, petName, onPress, styles }: { liker: Liker; petName: string; onPress: () => void; styles: ReturnType<typeof getStyles> }) {
  const { tx } = useTranslation();
  const hot = liker.intent === "HOT";
  const tint = hot ? HOT : FRIEND;
  return (
    <Pressable style={[styles.card, { borderColor: tint }]} onPress={onPress}>
      <View style={styles.mysteryAvatar}>
        {liker.adopter_only ? (
          <Text style={styles.waitingFamilyIcon}>🍼</Text>
        ) : (
          <Image source={{ uri: liker.photo_url || undefined }} style={styles.mysteryPhoto} blurRadius={7} />
        )}
      </View>
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{liker.adopter_only ? tx("Veut adopter", "Wants to adopt") : liker.pet_name ?? tx("Un pet", "A pet")}</Text>
          <Text style={[styles.intentPill, { backgroundColor: tint }]}>{hot ? "✦ Hot" : "🐾 Friend"}</Text>
          {liker.super_like && <Text style={styles.superLike}>⭐</Text>}
        </View>
        {!liker.adopter_only && !!liker.breed && <Text style={styles.detailLine} numberOfLines={1}>{liker.breed}</Text>}
        <Text style={styles.meetingPlace} numberOfLines={1}>
          {liker.adopter_only
            ? tx(`Pas encore de pet · attend des bébés à adopter`, `No pet yet · waiting for babies to adopt`)
            : tx(`A liké ${petName} · like en retour dans Discover 👀`, `Liked ${petName} · like back in Discover 👀`)}
        </Text>
      </View>
      <View style={styles.chatButton}><Text style={styles.chatButtonText}>💌</Text></View>
    </Pressable>
  );
}

function getStyles(colors: ReturnType<typeof useThemedColors>) {
  return StyleSheet.create({
    container: { flex: 1 },
    headerWrap: { marginBottom: 4 },
    title: { fontFamily: fonts.display, fontSize: 21, color: colors.dark, marginBottom: 10, marginTop: 10 },
    empty: { alignItems: "center", justifyContent: "center", paddingHorizontal: 40, paddingVertical: 40 },
    emptyText: { textAlign: "center", fontFamily: fonts.body, color: colors.grey, fontSize: 13 },
    card: { flexDirection: "row", alignItems: "center", gap: 8, padding: 9, backgroundColor: colors.white, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line },
    info: { flex: 1, minWidth: 0, marginLeft: 3 },
    nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    name: { flexShrink: 1, fontFamily: fonts.display, fontSize: 16, color: colors.dark },
    detailLine: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.dark, marginTop: 1 },
    meetingPlace: { fontFamily: fonts.body, fontSize: 10, color: colors.grey, marginTop: 2 },
    chatButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.cream2, alignItems: "center", justifyContent: "center" },
    chatButtonText: { fontSize: 15 },
    mysteryAvatar: { width: 52, height: 52, borderRadius: 26, overflow: "hidden", backgroundColor: colors.line, alignItems: "center", justifyContent: "center" },
    mysteryPhoto: { ...StyleSheet.absoluteFill },
    intentPill: { fontFamily: fonts.bodyBold, fontSize: 9, color: "#FFFFFF", paddingHorizontal: 7, paddingVertical: 2, borderRadius: radii.pill, overflow: "hidden" },
    superLike: { fontSize: 12 },
    waitingSection: { marginTop: 18, padding: 12, gap: 8, borderRadius: radii.lg, backgroundColor: "rgba(255,179,92,0.12)", borderWidth: 1, borderColor: "rgba(255,179,92,0.45)" },
    waitingTitle: { fontFamily: fonts.display, fontSize: 17, color: colors.dark },
    waitingHint: { fontFamily: fonts.body, fontSize: 11, lineHeight: 15, color: colors.grey, marginTop: -4, marginBottom: 2 },
    waitingCard: { flexDirection: "row", alignItems: "center", gap: 9, padding: 8, borderRadius: radii.md, backgroundColor: colors.white, borderWidth: 1, borderColor: "rgba(255,179,92,0.35)" },
    waitingRing: { width: 46, height: 46, borderRadius: 23, padding: 2, backgroundColor: ADOPT },
    waitingAvatar: { width: "100%", height: "100%", borderRadius: 21, backgroundColor: colors.cream2 },
    waitingFamily: { alignItems: "center", justifyContent: "center" },
    waitingFamilyIcon: { fontSize: 20 },
    waitingName: { flexShrink: 1, fontFamily: fonts.display, fontSize: 15, color: colors.dark },
    waitingHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    waitingCount: { fontFamily: fonts.bodyBold, fontSize: 11, color: "#C97A1E", backgroundColor: colors.white, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.pill, overflow: "hidden" },
    waitingCountFull: { color: colors.white, backgroundColor: "#C97A1E" },
    waitingMain: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 9 },
    waitingRemove: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.cream2, alignItems: "center", justifyContent: "center" },
    waitingRemovePressed: { backgroundColor: colors.line },
    waitingRemoveText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.grey },
    messagesLink: { alignSelf: "center", marginTop: 8, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radii.pill, backgroundColor: colors.cream2, borderWidth: 1, borderColor: colors.line },
    messagesLinkText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.coralDark },
  });
}
