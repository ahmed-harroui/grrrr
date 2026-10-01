import React, { useCallback, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { fonts, radii } from "@/theme/theme";
import { useThemedColors } from "@/hooks/useThemedColors";
import { MeetingMarker, useAppState } from "@/context/AppState";
import Header from "@/components/Header";
import { Pet } from "@/data/mockPets";
import PetRankBadge from "@/components/PetRankBadge";
import TrendingProfiles from "@/components/TrendingProfiles";
import PetProfileSheet from "@/components/PetProfileSheet";
import { MeetingConfirmModal, MeetingRequest } from "@/components/MeetingMap";
import { useTranslation } from "@/i18n/useTranslation";
import { getPetLikers, Liker } from "@/data/api/likes";

const HOT = "#FF5D73";
const FRIEND = "#2FBDB4";

export default function MatchesScreen() {
  const { matches, meetingMarkers, activePet } = useAppState();
  const navigation = useNavigation<any>();
  const colors = useThemedColors();
  const styles = getStyles(colors);
  const { tx } = useTranslation();
  const [confirmRequest, setConfirmRequest] = useState<MeetingRequest | null>(null);
  const [profilePet, setProfilePet] = useState<Pet | null>(null);
  const [likers, setLikers] = useState<Liker[]>([]);

  // One-sided likes: listed like matches but blurred until my pet likes back in Discover.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getPetLikers(activePet.dbId).then((result) => active && setLikers(result));
      return () => {
        active = false;
      };
    }, [activePet.dbId])
  );
  const matchedIds = new Set(matches.map((pet) => pet.dbId));
  const pendingLikers = likers.filter((liker) => !matchedIds.has(liker.id));

  const openChat = (pet: Pet) => {
    setProfilePet(null);
    navigation.navigate("ChatThread", { petId: pet.id });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.cream }]} edges={["top"]}>
      <Header />

      <FlatList
        data={matches}
        keyExtractor={(p) => String(p.id)}
        numColumns={1}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingBottom: 30 }}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <TrendingProfiles />
            <Text style={styles.title}>{tx("Vos matchs", "Your matches")}</Text>
            {pendingLikers.length > 0 && (
              <View style={styles.pendingList}>
                {pendingLikers.map((liker) => (
                  <MysteryTile key={liker.id} liker={liker} petName={activePet.name} onPress={() => navigation.navigate("Discover")} styles={styles} />
                ))}
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          pendingLikers.length > 0 ? null : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{tx("Pas encore de match. Swipez à droite sur Discover 🐾", "No matches yet. Swipe right on Discover 🐾")}</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <MatchTile
            pet={item}
            marker={meetingMarkers[item.id]}
            onMarkerChange={(marker) => setConfirmRequest({ pet: item, marker })}
            onPress={() => setProfilePet(item)}
            onChat={() => openChat(item)}
            styles={styles}
          />
        )}
      />

      <MeetingConfirmModal request={confirmRequest} onClose={() => setConfirmRequest(null)} />
      <PetProfileSheet
        pet={profilePet}
        onClose={() => setProfilePet(null)}
        action={profilePet ? { label: tx(`💬 Écrire à ${profilePet.name}`, `💬 Message ${profilePet.name}`), onPress: () => openChat(profilePet) } : undefined}
      />
    </SafeAreaView>
  );
}
function MatchTile({ pet, marker, onMarkerChange, onPress, onChat, styles }: { pet: Pet; marker?: MeetingMarker; onMarkerChange: (marker: MeetingMarker) => void; onPress: () => void; onChat: () => void; styles: ReturnType<typeof getStyles> }) {
  const { tx } = useTranslation();
  // Compact row: the full profile (photos, bio, tags) opens on tap.
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Image source={{ uri: pet.photo }} style={styles.avatar} />
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{pet.name}, {pet.age}</Text>
          <PetRankBadge level={pet.level ?? ((pet.id % 3) + 1)} />
        </View>
        <Text style={styles.detailLine} numberOfLines={1}>{pet.breed} · {pet.gender === "F" ? tx("Femelle", "Female") : tx("Mâle", "Male")} · 📍 {pet.dist} km</Text>
        <Text style={styles.meetingPlace} numberOfLines={1}>{marker ? tx("📍 Trace enregistrée", "📍 Spot saved") : tx("📍 Point de rencontre à définir", "📍 Meeting point to decide")}</Text>
      </View>
      <Pressable onPress={() => onMarkerChange("blue")} hitSlop={4} style={[styles.markerButton, marker === "blue" && styles.markerSelected]}><Image source={require("../../assets/bleue_clic.png")} style={styles.markerImage} /></Pressable>
      <Pressable onPress={() => onMarkerChange("pink")} hitSlop={4} style={[styles.markerButton, marker === "pink" && styles.markerSelected]}><Image source={require("../../assets/pink_clic.png")} style={styles.markerImage} /></Pressable>
      <Pressable onPress={onChat} hitSlop={8} style={styles.chatButton}><Text style={styles.chatButtonText}>💬</Text></Pressable>
    </Pressable>
  );
}

// A pet that liked mine: same row as a match, but photo and identity stay blurred until the like back.
function MysteryTile({ liker, petName, onPress, styles }: { liker: Liker; petName: string; onPress: () => void; styles: ReturnType<typeof getStyles> }) {
  const { tx } = useTranslation();
  const hot = liker.intent === "HOT";
  const tint = hot ? HOT : FRIEND;
  return (
    <Pressable style={[styles.card, { borderColor: tint }]} onPress={onPress}>
      <View style={styles.mysteryAvatar}>
        <Image source={{ uri: liker.photo_url || undefined }} style={styles.mysteryPhoto} blurRadius={7} />
      </View>
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{liker.pet_name ?? tx("Un pet", "A pet")}</Text>
          <Text style={[styles.intentPill, { backgroundColor: tint }]}>{hot ? "✦ Hot" : "🐾 Friend"}</Text>
          {liker.super_like && <Text style={styles.superLike}>⭐</Text>}
        </View>
        {!!liker.breed && <Text style={styles.detailLine} numberOfLines={1}>{liker.breed}</Text>}
        <Text style={styles.meetingPlace} numberOfLines={1}>{tx(`A liké ${petName} · like en retour dans Discover 👀`, `Liked ${petName} · like back in Discover 👀`)}</Text>
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
    empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, paddingVertical: 40 },
    emptyText: { textAlign: "center", fontFamily: fonts.body, color: colors.grey, fontSize: 13 },
    card: { flexDirection: "row", alignItems: "center", gap: 8, padding: 9, backgroundColor: colors.white, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line },
    avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.line },
    info: { flex: 1, minWidth: 0, marginLeft: 3 },
    nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    name: { flexShrink: 1, fontFamily: fonts.display, fontSize: 16, color: colors.dark },
    detailLine: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.dark, marginTop: 1 },
    meetingPlace: { fontFamily: fonts.body, fontSize: 10, color: colors.grey, marginTop: 2 },
    chatButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.cream2, alignItems: "center", justifyContent: "center" },
    chatButtonText: { fontSize: 15 },
    markerButton: { width: 26, height: 26, alignItems: "center", justifyContent: "center", borderRadius: 13 },
    markerSelected: { backgroundColor: colors.cream2 },
    markerImage: { width: 22, height: 22 },
    pendingList: { gap: 8, marginBottom: 4 },
    mysteryAvatar: { width: 52, height: 52, borderRadius: 26, overflow: "hidden", backgroundColor: colors.line, alignItems: "center", justifyContent: "center" },
    mysteryPhoto: { ...StyleSheet.absoluteFill },
    intentPill: { fontFamily: fonts.bodyBold, fontSize: 9, color: "#FFFFFF", paddingHorizontal: 7, paddingVertical: 2, borderRadius: radii.pill, overflow: "hidden" },
    superLike: { fontSize: 12 },
  });
}
