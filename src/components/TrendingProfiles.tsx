import React, { useCallback, useMemo, useState } from "react";
import { Image, ImageSourcePropType, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { fonts, radii } from "@/theme/theme";
import { useThemedColors } from "@/hooks/useThemedColors";
import { PETS, Pet } from "@/data/mockPets";
import { rankTrendingPets } from "@/utils/trending";
import { useAppState } from "@/context/AppState";
import { useAuth } from "@/context/AuthContext";
import { getTopXpPetProfiles, petRecordToPet } from "@/data/api/profile";
import PetProfileSheet from "@/components/PetProfileSheet";
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

const formatXp = (xp: number) => (xp >= 10000 ? `${Math.round(xp / 1000)}k` : xp >= 1000 ? `${(xp / 1000).toFixed(1).replace(".0", "")}k` : String(xp));

function TrendingCard({ pet, position, isMine, onPress, styles, colors }: { pet: Pet; position: number; isMine: boolean; onPress: () => void; styles: ReturnType<typeof getStyles>; colors: Colors }) {
  const level = pet.level ?? ((pet.id % PET_RANKS.length) + 1);
  const rank = PET_RANKS[clamp(level - 1, 0, PET_RANKS.length - 1)];
  const isHot = pet.mode >= 50;
  const { tx } = useTranslation();
  return (
    <Pressable style={[styles.card, isMine && { borderColor: colors.coral }]} onPress={onPress}>
      <DecorBackground />
      <View style={styles.cardTop}>
        <Text style={[styles.position, position === 1 && styles.positionFirst]}>{position === 1 ? "👑 #1" : `#${position}`}</Text>
        <Text style={styles.score}>{formatXp(pet.xp ?? 0)} XP</Text>
      </View>
      <View style={[styles.ring, { borderColor: rank.color }]}>
        <Image source={{ uri: pet.photo }} style={styles.photo} />
        <Image source={rank.image} style={styles.rankEmblem} resizeMode="contain" />
        {isMine && <Text style={styles.mineBadge}>{tx("⭐ Toi", "⭐ You")}</Text>}
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
  const { activePet, setMode } = useAppState();
  const { session } = useAuth();
  const colors = useThemedColors();
  const styles = getStyles(colors);
  const { tx } = useTranslation();
  const [selectedTrend, setSelectedTrend] = useState<Pet | null>(null);
  const [speciesFilter, setSpeciesFilter] = useState<"all" | "dog" | "cat">("all");
  const [intentFilter, setIntentFilter] = useState<"all" | "play" | "hot">("all");
  const [communityPets, setCommunityPets] = useState<Pet[]>([]);

  // The highest-XP pets in the database, refreshed each time the screen comes back into view.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getTopXpPetProfiles(100).then(({ data }) => active && setCommunityPets(data.map(petRecordToPet)));
      return () => {
        active = false;
      };
    }, [session?.user.id])
  );

  const sorted = useMemo(
    () => rankTrendingPets(
      // Demo pets only when the database has nothing to rank (signed out / offline).
      (communityPets.length ? communityPets : PETS).filter((pet) =>
        (speciesFilter === "all" || pet.species === speciesFilter) &&
        (intentFilter === "all" || (intentFilter === "play" ? pet.mode < 50 : pet.mode >= 50 && (pet.id === activePet.id || pet.gender !== activePet.gender)))
      )
    ),
    [activePet, communityPets, intentFilter, speciesFilter]
  );

  return (
    <View style={styles.trendingBar}>
      <View style={styles.trendingTitleRow}><Text style={styles.trendingTitle}>{tx("Profils tendances", "Trending profiles")}</Text><Text style={styles.liveDot}>● LIVE</Text></View>
      <Text style={styles.trendingHint}>{tx("Les compagnons avec le plus d'XP", "The companions with the most XP")}</Text>
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
          <TrendingCard key={pet.id} pet={pet} position={index + 1} isMine={pet.id === activePet.id} onPress={() => setSelectedTrend(pet)} styles={styles} colors={colors} />
        ))}
      </ScrollView>

      <PetProfileSheet pet={selectedTrend} onClose={() => setSelectedTrend(null)} />
    </View>
  );
}

function getStyles(colors: Colors) {
  return StyleSheet.create({
    trendingBar: { paddingTop: 4, paddingBottom: 10 },
    trendingTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    trendingTitle: { fontFamily: fonts.displaySemi, fontSize: 16, color: colors.dark },
    trendingHint: { fontFamily: fonts.body, fontSize: 11, color: colors.grey, marginTop: 1 },
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
    mineBadge: { position: "absolute", left: -12, bottom: -6, fontFamily: fonts.bodyBold, fontSize: 9, color: "#FFFFFF", backgroundColor: colors.coral, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.pill, overflow: "hidden" },
    rankEmblem: { position: "absolute", right: -10, bottom: -8, width: 34, height: 34 },
    panel: { position: "absolute", left: 6, right: 6, bottom: 6, alignItems: "center", backgroundColor: "rgba(255,255,255,0.9)", borderRadius: radii.sm, paddingVertical: 6, paddingHorizontal: 4 },
    name: { fontFamily: fonts.display, fontSize: 15, lineHeight: 18, color: "#2B2724" },
    level: { fontFamily: fonts.bodyBold, fontSize: 10 },
    mode: { fontFamily: fonts.bodyBold, fontSize: 10, marginTop: 1 },
  });
}
