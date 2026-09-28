import React, { useEffect, useMemo, useState } from "react";
import { Image, ImageSourcePropType, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { fonts, radii } from "@/theme/theme";
import { useThemedColors } from "@/hooks/useThemedColors";
import { PETS, Pet } from "@/data/mockPets";
import { computeMatch } from "@/utils/matching";
import { rankTrendingPets } from "@/utils/trending";
import { useAppState } from "@/context/AppState";
import { useAuth } from "@/context/AuthContext";
import { getDiscoverablePetProfiles, petRecordToPet } from "@/data/api/profile";
import PetRankBadge from "@/components/PetRankBadge";
import { PET_RANKS } from "@/utils/petProgression";
import { useTranslation } from "@/i18n/useTranslation";

type Colors = ReturnType<typeof useThemedColors>;

// Decor sheets used behind trending cards (aspect = width / height of the file).
const DECORS: { source: ImageSourcePropType; aspect: number }[] = [
  { source: require("../../assets/decor/big_small.jpg"), aspect: 1024 / 819 },
  { source: require("../../assets/decor/small_big.jpg"), aspect: 1024 / 531 },
];

const CARD_WIDTH = 128;
const CARD_HEIGHT = 206;

const between = (min: number, max: number) => min + Math.random() * (max - min);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// A random decor sheet, zoomed in on a random spot of its drawings.
function DecorBackground() {
  const frame = useMemo(() => {
    const decor = DECORS[Math.floor(Math.random() * DECORS.length)];
    // Scale so the sheet always covers the card, then zoom in further.
    const height = Math.max(CARD_HEIGHT, CARD_WIDTH / decor.aspect) * between(1.6, 2.8);
    const width = height * decor.aspect;
    const left = clamp(CARD_WIDTH / 2 - between(0.05, 0.95) * width, CARD_WIDTH - width, 0);
    const top = clamp(CARD_HEIGHT / 2 - between(0.05, 0.95) * height, CARD_HEIGHT - height, 0);
    return { source: decor.source, width, height, left, top };
  }, []);
  return <Image source={frame.source} style={{ position: "absolute", width: frame.width, height: frame.height, left: frame.left, top: frame.top }} resizeMode="stretch" />;
}

function TrendingCard({ pet, position, pct, onPress, styles, colors }: { pet: Pet; position: number; pct: number; onPress: () => void; styles: ReturnType<typeof getStyles>; colors: Colors }) {
  const level = pet.level ?? ((pet.id % PET_RANKS.length) + 1);
  const rank = PET_RANKS[clamp(level - 1, 0, PET_RANKS.length - 1)];
  const isHot = pet.mode >= 50;
  const { tx } = useTranslation();
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <DecorBackground />
      <View style={styles.cardTop}>
        <Text style={[styles.position, position === 1 && styles.positionFirst]}>{position === 1 ? "👑 #1" : `#${position}`}</Text>
        <Text style={styles.score}>{pct}%</Text>
      </View>
      <View style={[styles.ring, { borderColor: rank.color }]}>
        <Image source={{ uri: pet.photo }} style={styles.photo} />
        <Image source={rank.image} style={styles.rankEmblem} resizeMode="contain" />
      </View>
      <View style={styles.panel}>
        <Text style={styles.name} numberOfLines={1}>{pet.name}</Text>
        <Text style={[styles.level, { color: rank.color }]}>{tx("Niv.", "Lvl")} {level}</Text>
        <Text style={[styles.mode, { color: isHot ? colors.coralDark : colors.friend }]}>{isHot ? "✦ Hot" : "🐾 Friend"}</Text>
      </View>
    </Pressable>
  );
}

export default function TrendingProfiles() {
  const { activePet, mode, setMode } = useAppState();
  const { session } = useAuth();
  const colors = useThemedColors();
  const styles = getStyles(colors);
  const { tx } = useTranslation();
  const [selectedTrend, setSelectedTrend] = useState<Pet | null>(null);
  const [speciesFilter, setSpeciesFilter] = useState<"all" | "dog" | "cat">("all");
  const [intentFilter, setIntentFilter] = useState<"all" | "play" | "hot">("all");
  const [communityPets, setCommunityPets] = useState<Pet[]>([]);

  useEffect(() => {
    getDiscoverablePetProfiles(session?.user.id).then(({ data }) => setCommunityPets(data.map(petRecordToPet)));
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
    <View style={styles.trendingBar}>
      <View style={styles.trendingTitleRow}><Text style={styles.trendingTitle}>{tx("Profils tendances", "Trending profiles")}</Text><Text style={styles.liveDot}>● LIVE</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {([['all', tx('Tous', 'All')], ['dog', tx('🐶 Chiens', '🐶 Dogs')], ['cat', tx('🐱 Chats', '🐱 Cats')]] as const).map(([key, label]) => <Pressable key={key} onPress={() => setSpeciesFilter(key)} style={[styles.filterChip, speciesFilter === key && styles.filterChipActive]}><Text style={[styles.filterText, speciesFilter === key && styles.filterTextActive]}>{label}</Text></Pressable>)}
      </ScrollView>
      <View style={styles.intentRow}>
        <Pressable onPress={() => { setIntentFilter("play"); setMode(0); }} style={[styles.intentChoice, intentFilter === "play" && styles.playChoiceActive]}>
          <Text style={[styles.intentText, intentFilter === "play" && styles.playChoiceTextActive]}>● PLAY</Text>
        </Pressable>
        <Pressable onPress={() => { setIntentFilter("hot"); setMode(100); }} style={[styles.intentChoice, intentFilter === "hot" && styles.hotChoiceActive]}>
          <Text style={[styles.intentText, intentFilter === "hot" && styles.hotChoiceTextActive]}>✦ HOT</Text>
        </Pressable>
        <Pressable onPress={() => setIntentFilter("all")} style={[styles.intentAllChoice, intentFilter === "all" && styles.intentAllChoiceActive]}>
          <Text style={[styles.intentAllText, intentFilter === "all" && styles.intentAllTextActive]}>{tx("Tous", "All")}</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trendingList}>
        {sorted.slice(0, 6).map((pet, index) => (
          <TrendingCard key={pet.id} pet={pet} position={index + 1} pct={computeMatch(pet, mode, activePet).pct} onPress={() => setSelectedTrend(pet)} styles={styles} colors={colors} />
        ))}
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
            <View style={styles.profileStatusRow}><Text style={styles.profileMeta}>{selectedTrend.species === "cat" ? tx("Chat", "Cat") : tx("Chien", "Dog")} · {selectedTrend.breed} · {selectedTrend.age} {tx("ans", "yrs")} · 📍 {selectedTrend.dist} km</Text><Text style={[styles.profileMode, { color: selectedTrend.mode >= 50 ? colors.coralDark : colors.friend }]}>{selectedTrend.mode >= 50 ? "✦ Hot" : "🐾 Friend"}</Text></View>
            <View style={styles.profileSocials}><Pressable onPress={() => Linking.openURL(`https://instagram.com/${selectedTrend.name.toLowerCase()}`)}><Text style={styles.socialLink}>◎ Instagram</Text></Pressable><Pressable onPress={() => Linking.openURL(`https://tiktok.com/@${selectedTrend.name.toLowerCase()}`)}><Text style={styles.socialLink}>♪ TikTok</Text></Pressable><Pressable onPress={() => Linking.openURL(`https://snapchat.com/add/${selectedTrend.name.toLowerCase()}`)}><Text style={styles.socialLink}>◈ Snap</Text></Pressable></View>
            <View style={styles.profileScore}><Text style={styles.profileScoreText}>{computeMatch(selectedTrend, mode, activePet).pct}% {tx("compatible avec", "compatible with")} {activePet.name}</Text></View>
            <Text style={styles.profileBio}>{selectedTrend.bio}</Text>
            <View style={styles.profileTags}>{selectedTrend.tags.map((tag) => <Text key={tag} style={styles.profileTag}>{tag}</Text>)}</View>
            <Pressable style={styles.closeProfile} onPress={() => setSelectedTrend(null)}><Text style={styles.closeProfileText}>{tx("Fermer", "Close")}</Text></Pressable>
          </View>}
        </View>
      </Modal>
    </View>
  );
}

function getStyles(colors: Colors) {
  return StyleSheet.create({
    trendingBar: { paddingTop: 4, paddingBottom: 10 },
    trendingTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    trendingTitle: { fontFamily: fonts.displaySemi, fontSize: 16, color: colors.dark },
    liveDot: { fontFamily: fonts.bodyBold, fontSize: 9, color: colors.coralDark },
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
    trendingList: { gap: 12, paddingVertical: 12, marginTop: 4 },
    card: { width: CARD_WIDTH, height: CARD_HEIGHT, borderRadius: radii.md, overflow: "hidden", alignItems: "center", backgroundColor: "#FFD6E0", borderWidth: 2, borderColor: "rgba(255,255,255,0.9)", shadowColor: "#FF5D73", shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
    cardTop: { width: "100%", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 8, paddingTop: 8 },
    position: { fontFamily: fonts.bodyBold, fontSize: 10, color: "#2B2724", backgroundColor: "rgba(255,255,255,0.88)", paddingHorizontal: 7, paddingVertical: 3, borderRadius: radii.pill, overflow: "hidden" },
    positionFirst: { backgroundColor: "#FFE8A3" },
    score: { fontFamily: fonts.bodyBold, fontSize: 10, color: "#FFFFFF", backgroundColor: "rgba(230,72,99,0.92)", paddingHorizontal: 7, paddingVertical: 3, borderRadius: radii.pill, overflow: "hidden" },
    ring: { width: 84, height: 84, borderRadius: 42, borderWidth: 3, padding: 3, backgroundColor: "#FFFFFF", marginTop: 8 },
    photo: { width: "100%", height: "100%", borderRadius: 38 },
    rankEmblem: { position: "absolute", right: -10, bottom: -8, width: 34, height: 34 },
    panel: { position: "absolute", left: 6, right: 6, bottom: 6, alignItems: "center", backgroundColor: "rgba(255,255,255,0.9)", borderRadius: radii.sm, paddingVertical: 6, paddingHorizontal: 4 },
    name: { fontFamily: fonts.display, fontSize: 15, lineHeight: 18, color: "#2B2724" },
    level: { fontFamily: fonts.bodyBold, fontSize: 10 },
    mode: { fontFamily: fonts.bodyBold, fontSize: 10, marginTop: 1 },
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
