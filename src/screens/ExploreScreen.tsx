import React, { useEffect, useMemo, useState } from "react";
import { Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fonts, radii } from "@/theme/theme";
import { useThemedColors } from "@/hooks/useThemedColors";
import { PETS, Pet } from "@/data/mockPets";
import { computeMatch } from "@/utils/matching";
import { rankTrendingPets } from "@/utils/trending";
import { useAppState } from "@/context/AppState";
import { useAuth } from "@/context/AuthContext";
import { getDiscoverablePetProfiles, PetRecord } from "@/data/api/profile";
import Header from "@/components/Header";
import PetRankBadge from "@/components/PetRankBadge";
import { PET_RANKS } from "@/utils/petProgression";

const STORE_IMAGE = require("../../assets/store/image.png");
const SOCIALS = [
  { label: "Instagram", icon: "◎", color: "#D95778", url: "https://instagram.com" },
  { label: "TikTok", icon: "♪", color: "#252525", url: "https://tiktok.com" },
  { label: "Snap", icon: "◈", color: "#D7B52A", url: "https://snapchat.com" },
];

const EDITORIAL = [
  { type: "thread", title: "Le petit rituel qui rapproche", text: "3 idées simples pour une première balade réussie.", icon: "✦" },
  { type: "new", title: "Nouveau chez GRRRR", text: "Les badges de niveau arrivent dans les profils.", icon: "✧" },
  { type: "product", title: "La sélection du moment", text: "Des essentiels choisis pour les sorties complices.", icon: "♡" },
];

function stablePetId(id: string) {
  return Array.from(id).reduce((value, character) => ((value * 31) + character.charCodeAt(0)) >>> 0, 7);
}

function toExplorePet(record: PetRecord): Pet {
  const id = stablePetId(record.id ?? record.owner_id);
  return {
    id,
    name: record.pet_name,
    species: record.species as Pet["species"],
    breed: record.breed,
    gender: record.gender === "M" ? "M" : "F",
    age: record.age,
    energy: record.energy,
    dist: 2 + (id % 18),
    mode: record.mode,
    bio: record.bio,
    tags: record.tags,
    photo: record.photo_url,
    level: record.level,
  };
}

export default function ExploreScreen() {
  const { activePet, mode, setMode } = useAppState();
  const { session } = useAuth();
  const colors = useThemedColors();
  const styles = getStyles(colors);
  const [selectedTrend, setSelectedTrend] = useState<Pet | null>(null);
  const [speciesFilter, setSpeciesFilter] = useState<"all" | "dog" | "cat">("all");
  const [intentFilter, setIntentFilter] = useState<"all" | "play" | "hot">("all");
  const [communityPets, setCommunityPets] = useState<Pet[]>([]);

  useEffect(() => {
    getDiscoverablePetProfiles(session?.user.id).then(({ data }) => setCommunityPets(data.map(toExplorePet)));
  }, [session?.user.id]);

  const sorted = useMemo(
    () => rankTrendingPets(
      [...communityPets, ...PETS].filter((pet) =>
        (speciesFilter === "all" || pet.species === speciesFilter) &&
        (intentFilter === "all" || (intentFilter === "play" ? pet.mode < 50 : pet.mode >= 50 && pet.gender !== activePet.gender))
      ),
      activePet,
      mode
    ).map((trend) => trend.pet),
    [activePet, communityPets, intentFilter, mode, speciesFilter]
  );

    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <Header />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.trendingBar}>
            <View style={styles.trendingTitleRow}><Text style={styles.trendingTitle}>Profils près de vous</Text><Text style={styles.liveDot}>● LIVE</Text></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {([['all', 'Tous'], ['dog', '🐶 Chiens'], ['cat', '🐱 Chats']] as const).map(([key, label]) => <Pressable key={key} onPress={() => setSpeciesFilter(key)} style={[styles.filterChip, speciesFilter === key && styles.filterChipActive]}><Text style={[styles.filterText, speciesFilter === key && styles.filterTextActive]}>{label}</Text></Pressable>)}
            </ScrollView>
            <View style={styles.intentRow}>
              <Pressable onPress={() => { setIntentFilter("play"); setMode(0); }} style={[styles.intentChoice, intentFilter === "play" && styles.playChoiceActive]}>
                <Text style={[styles.intentText, intentFilter === "play" && styles.playChoiceTextActive]}>● PLAY</Text>
              </Pressable>
              <Pressable onPress={() => { setIntentFilter("hot"); setMode(100); }} style={[styles.intentChoice, intentFilter === "hot" && styles.hotChoiceActive]}>
                <Text style={[styles.intentText, intentFilter === "hot" && styles.hotChoiceTextActive]}>✦ HOT</Text>
              </Pressable>
              <Pressable onPress={() => setIntentFilter("all")} style={[styles.intentAllChoice, intentFilter === "all" && styles.intentAllChoiceActive]}>
                <Text style={[styles.intentAllText, intentFilter === "all" && styles.intentAllTextActive]}>Tous</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trendingList}>
              {sorted.slice(0, 6).map((pet, index) => {
                const pct = computeMatch(pet, mode, activePet).pct;
                const rank = PET_RANKS[(pet.id % PET_RANKS.length)];
                return <Pressable key={pet.id} style={styles.trendingPet} onPress={() => setSelectedTrend(pet)}><View style={[styles.trendingRing, { borderColor: rank.color }]}><Image source={{ uri: pet.photo }} style={styles.trendingImage} /></View><View style={styles.trendingRank}><PetRankBadge level={pet.level ?? ((pet.id % PET_RANKS.length) + 1)} /></View><Text style={styles.trendingName}>{pet.name}</Text><Text style={[styles.trendingMode, { color: pet.mode >= 50 ? colors.coralDark : colors.friend }]}>{pet.mode >= 50 ? "✦ Hot" : "🐾 Friend"}</Text><Text style={styles.trendingScore}>{pct}%</Text></Pressable>;
              })}
            </ScrollView>
          </View>

          <View style={styles.splitSection}>
            <View style={styles.leftColumn}>
              <Text style={styles.columnTitle}>À découvrir</Text>
              {EDITORIAL.map((item) => <Pressable key={item.title} style={styles.editorialCard}><View style={styles.editorialIcon}><Text style={styles.editorialIconText}>{item.icon}</Text></View><Text style={styles.editorialType}>{item.type === "thread" ? "THREAD" : item.type === "new" ? "NOUVEAUTÉ" : "SÉLECTION"}</Text><Text style={styles.editorialTitle}>{item.title}</Text><Text style={styles.editorialText}>{item.text}</Text><Text style={styles.readMore}>Voir plus ›</Text></Pressable>)}
            </View>
            <View style={styles.rightColumn}>
              <Text style={styles.columnTitle}>La boutique</Text>
              <Pressable style={styles.storeCard} onPress={() => Linking.openURL("https://grrrr-store-89il.vercel.app/")}><Image source={STORE_IMAGE} style={styles.storeImage} resizeMode="cover" /><View style={styles.storeOverlay}><Text style={styles.storeEyebrow}>GRRRR SHOP</Text><Text style={styles.storeTitle}>Pour les balades qui comptent.</Text><Text style={styles.storeButton}>Visiter la boutique ↗</Text></View></Pressable>
              <View style={styles.storeNote}><Text style={styles.storeNoteIcon}>✦</Text><Text style={styles.storeNoteText}>Une sélection pensée pour chaque tempérament.</Text></View>
            </View>
          </View>
        </ScrollView>
        <Modal visible={!!selectedTrend} transparent animationType="slide" onRequestClose={() => setSelectedTrend(null)}>
          <View style={styles.modalLayer}>
            <Pressable style={styles.modalBackdrop} onPress={() => setSelectedTrend(null)} />
            {selectedTrend && <View style={styles.profileSheet}>
              <View style={styles.sheetHandle} />
              <Image source={{ uri: selectedTrend.photo }} style={styles.profileImage} />
              <View style={styles.profileNameRow}>
                <Text style={styles.profileName}>{selectedTrend.name}</Text>
                <PetRankBadge level={selectedTrend.level ?? ((selectedTrend.id % PET_RANKS.length) + 1)} />
              </View>
              <View style={styles.profileStatusRow}><Text style={styles.profileMeta}>{selectedTrend.species === "cat" ? "Chat" : "Chien"} · {selectedTrend.breed} · {selectedTrend.age} ans · 📍 {selectedTrend.dist} km</Text><Text style={[styles.profileMode, { color: selectedTrend.mode >= 50 ? colors.coralDark : colors.friend }]}>{selectedTrend.mode >= 50 ? "✦ Hot" : "🐾 Friend"}</Text></View>
              <View style={styles.profileSocials}><Pressable onPress={() => Linking.openURL(`https://instagram.com/${selectedTrend.name.toLowerCase()}`)}><Text style={styles.socialLink}>◎ Instagram</Text></Pressable><Pressable onPress={() => Linking.openURL(`https://tiktok.com/@${selectedTrend.name.toLowerCase()}`)}><Text style={styles.socialLink}>♪ TikTok</Text></Pressable><Pressable onPress={() => Linking.openURL(`https://snapchat.com/add/${selectedTrend.name.toLowerCase()}`)}><Text style={styles.socialLink}>◈ Snap</Text></Pressable></View>
              <View style={styles.profileScore}><Text style={styles.profileScoreText}>{computeMatch(selectedTrend, mode, activePet).pct}% compatible avec {activePet.name}</Text></View>
              <Text style={styles.profileBio}>{selectedTrend.bio}</Text>
              <View style={styles.profileTags}>{selectedTrend.tags.map((tag) => <Text key={tag} style={styles.profileTag}>{tag}</Text>)}</View>
              <Pressable style={styles.closeProfile} onPress={() => setSelectedTrend(null)}><Text style={styles.closeProfileText}>Fermer</Text></Pressable>
            </View>}
          </View>
        </Modal>
      </SafeAreaView>
    );
}

function getStyles(colors: ReturnType<typeof useThemedColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.cream },
    content: { paddingBottom: 30 },
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
    trendingBar: { backgroundColor: colors.cream, borderBottomWidth: 1, borderBottomColor: colors.line, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 10, zIndex: 5 },
    trendingTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    trendingTitle: { fontFamily: fonts.displaySemi, fontSize: 16, color: colors.dark },
    liveDot: { fontFamily: fonts.bodyBold, fontSize: 9, color: colors.coralDark },
    trendingList: { gap: 14, paddingHorizontal: 12, paddingVertical: 12, marginTop: 10, backgroundColor: "rgba(255,93,115,0.16)", borderRadius: radii.md },
    filterRow: { gap: 7, paddingTop: 7 },
    filterChip: { borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "rgba(255,255,255,0.65)" },
    filterChipActive: { backgroundColor: colors.cream2, borderColor: colors.coral },
    filterText: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.grey },
    filterTextActive: { color: colors.coralDark, fontFamily: fonts.bodyBold },
    intentRow: { flexDirection: "row", gap: 7, marginTop: 9 },
    intentChoice: { flex: 1, minHeight: 34, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
    playChoiceActive: { backgroundColor: "rgba(47,189,180,0.14)", borderColor: colors.friend },
    hotChoiceActive: { backgroundColor: "rgba(255,93,115,0.14)", borderColor: colors.coral },
    intentText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.grey },
    playChoiceTextActive: { color: colors.friend },
    hotChoiceTextActive: { color: colors.coralDark },
    intentAllChoice: { paddingHorizontal: 12, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
    intentAllChoiceActive: { backgroundColor: colors.cream2, borderColor: colors.coral },
    intentAllText: { fontFamily: fonts.bodySemi, fontSize: 10, color: colors.grey },
    intentAllTextActive: { color: colors.coralDark },
    trendingPet: { width: 92, alignItems: "center" },
    trendingRing: { width: 82, height: 82, borderRadius: 41, borderWidth: 3, padding: 3, backgroundColor: colors.white },
    trendingImage: { width: "100%", height: "100%", borderRadius: 37 },
    trendingRank: { marginTop: 2, minHeight: 32, justifyContent: "center" },
    trendingName: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.dark, marginTop: 1 },
    trendingMode: { fontFamily: fonts.bodyBold, fontSize: 10, marginTop: 1 },
    trendingScore: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.coralDark },
    socialRow: { flexDirection: "row", gap: 8 },
    socialChip: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderWidth: 1, borderRadius: radii.pill, paddingVertical: 7, backgroundColor: "rgba(255,255,255,0.65)" },
    socialIcon: { fontFamily: fonts.bodyBold, fontSize: 15 },
    socialText: { fontFamily: fonts.bodySemi, fontSize: 10, color: colors.dark },
    splitSection: { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingTop: 20 },
    leftColumn: { flex: 1 },
    rightColumn: { flex: 1 },
    columnTitle: { fontFamily: fonts.displaySemi, fontSize: 16, color: colors.dark, marginBottom: 9 },
    editorialCard: { backgroundColor: colors.white, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, padding: 12, marginBottom: 10, minHeight: 157 },
    editorialIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.cream2, alignItems: "center", justifyContent: "center", marginBottom: 8 },
    editorialIconText: { fontFamily: fonts.display, fontSize: 17, color: colors.coralDark },
    editorialType: { fontFamily: fonts.bodyBold, fontSize: 8, letterSpacing: 0.8, color: colors.friend },
    editorialTitle: { fontFamily: fonts.displaySemi, fontSize: 15, lineHeight: 18, color: colors.dark, marginTop: 3 },
    editorialText: { fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.grey, marginTop: 4 },
    readMore: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.coralDark, marginTop: 8 },
    storeCard: { height: 360, borderRadius: radii.lg, overflow: "hidden", backgroundColor: colors.cream2 },
    storeImage: { width: "100%", height: "100%" },
    storeOverlay: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 14, backgroundColor: "rgba(43,39,36,0.62)" },
    storeEyebrow: { fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1, color: colors.cream2 },
    storeTitle: { fontFamily: fonts.displaySemi, fontSize: 19, lineHeight: 22, color: colors.white, marginTop: 4 },
    storeButton: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.white, marginTop: 12 },
    storeNote: { flexDirection: "row", gap: 7, backgroundColor: colors.cream2, borderRadius: radii.md, padding: 10, marginTop: 10 },
    storeNoteIcon: { color: colors.hot, fontSize: 16 },
    storeNoteText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 10, lineHeight: 14, color: colors.dark },
    modalLayer: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(43,39,36,0.25)" },
    modalBackdrop: { ...StyleSheet.absoluteFill },
    profileSheet: { backgroundColor: colors.cream, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 20, paddingBottom: 26 },
    sheetHandle: { width: 42, height: 5, borderRadius: 3, backgroundColor: colors.line, alignSelf: "center", marginBottom: 14 },
    profileImage: { width: "100%", height: 190, borderRadius: radii.lg },
    profileNameRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
    profileName: { fontFamily: fonts.displayExtra, fontSize: 27, color: colors.dark },
    profileMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.grey, marginTop: 3 },
    profileStatusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    profileMode: { fontFamily: fonts.bodyBold, fontSize: 12 },
    profileSocials: { flexDirection: "row", gap: 12, marginTop: 12 },
    socialLink: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.coralDark },
    profileScore: { alignSelf: "flex-start", backgroundColor: colors.cream2, borderRadius: radii.pill, paddingHorizontal: 11, paddingVertical: 7, marginTop: 12 },
    profileScoreText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.coralDark },
    profileBio: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: colors.dark, marginTop: 13 },
    profileTags: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 12 },
    profileTag: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.coralDark, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 7 },
    closeProfile: { backgroundColor: colors.coral, borderRadius: radii.pill, alignItems: "center", paddingVertical: 14, marginTop: 18 },
    closeProfileText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.white },
  });
}
