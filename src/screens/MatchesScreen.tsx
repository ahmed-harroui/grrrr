import React, { useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { fonts, radii } from "@/theme/theme";
import { useThemedColors } from "@/hooks/useThemedColors";
import { MeetingMarker, useAppState } from "@/context/AppState";
import Header from "@/components/Header";
import { Pet } from "@/data/mockPets";
import PetRankBadge from "@/components/PetRankBadge";
import TrendingProfiles from "@/components/TrendingProfiles";
import LikedYouTeaser from "@/components/LikedYouTeaser";
import { MeetingConfirmModal, MeetingRequest } from "@/components/MeetingMap";
import { useTranslation } from "@/i18n/useTranslation";

export default function MatchesScreen() {
  const { matches, meetingMarkers } = useAppState();
  const navigation = useNavigation<any>();
  const colors = useThemedColors();
  const styles = getStyles(colors);
  const { tx } = useTranslation();
  const [confirmRequest, setConfirmRequest] = useState<MeetingRequest | null>(null);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.cream }]} edges={["top"]}>
      <Header />

      <FlatList
        data={matches}
        keyExtractor={(p) => String(p.id)}
        numColumns={1}
        contentContainerStyle={{ gap: 12, paddingHorizontal: 20, paddingBottom: 30 }}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <TrendingProfiles />
            <LikedYouTeaser />
            <Text style={styles.title}>{tx("Vos matchs", "Your matches")}</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{tx("Pas encore de match. Swipez à droite sur Discover 🐾", "No matches yet. Swipe right on Discover 🐾")}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <MatchTile
            pet={item}
            marker={meetingMarkers[item.id]}
            onMarkerChange={(marker) => setConfirmRequest({ pet: item, marker })}
            onPress={() => navigation.navigate("ChatThread", { petId: item.id })}
            styles={styles}
          />
        )}
      />

      <MeetingConfirmModal request={confirmRequest} onClose={() => setConfirmRequest(null)} />
    </SafeAreaView>
  );
}
function MatchTile({ pet, marker, onMarkerChange, onPress, styles }: { pet: Pet; marker?: MeetingMarker; onMarkerChange: (marker: MeetingMarker) => void; onPress: () => void; styles: ReturnType<typeof getStyles> }) {
  const { tx } = useTranslation();
  return (
    <View style={styles.card}>
      <Pressable style={styles.tile} onPress={onPress}>
        <Image source={{ uri: pet.photo }} style={styles.tileImg} />
        <View style={styles.tileShade} />
        <View style={styles.tileNameRow}><View><Text style={styles.tileName}>{pet.name}, {pet.age}</Text><PetRankBadge level={pet.level ?? ((pet.id % 3) + 1)} /></View><Text style={styles.matchScore}>✦ Match</Text></View>
      </Pressable>
      <View style={styles.meetingArea}>
        <Text style={styles.detailLine}>{pet.breed} · {pet.gender === "F" ? tx("Femelle", "Female") : tx("Mâle", "Male")} · 📍 {pet.dist} km</Text>
        <Text style={styles.cardBio} numberOfLines={2}>{pet.bio}</Text>
        <View style={styles.cardTags}>{pet.tags.slice(0, 3).map((tag) => <Text key={tag} style={styles.cardTag}>{tag}</Text>)}</View>
        <View style={styles.routeLine}><Text style={styles.routeDot}>●</Text><View style={styles.line} /><Text style={styles.routeDot}>●</Text></View>
        <Text style={styles.meetingLabel}>{tx("Point de rencontre", "Meeting point")}</Text>
        <Text style={styles.meetingPlace}>{marker ? tx("📍 Trace enregistrée", "📍 Spot saved") : tx("📍 À définir ensemble", "📍 To decide together")}</Text>
        <View style={styles.markerRow}>
          <Text style={styles.markerHint}>{tx("Choisir une patte", "Pick a paw")}</Text>
          <Pressable onPress={() => onMarkerChange("blue")} style={[styles.markerButton, marker === "blue" && styles.markerSelected]}><Image source={require("../../assets/bleue_clic.png")} style={styles.markerImage} /></Pressable>
          <Pressable onPress={() => onMarkerChange("pink")} style={[styles.markerButton, marker === "pink" && styles.markerSelected]}><Image source={require("../../assets/pink_clic.png")} style={styles.markerImage} /></Pressable>
        </View>
      </View>
    </View>
  );
}

function getStyles(colors: ReturnType<typeof useThemedColors>) {
  return StyleSheet.create({
    container: { flex: 1 },
    headerWrap: { marginBottom: 4 },
    title: { fontFamily: fonts.display, fontSize: 21, color: colors.dark, marginBottom: 10, marginTop: 10 },
    empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, paddingVertical: 40 },
    emptyText: { textAlign: "center", fontFamily: fonts.body, color: colors.grey, fontSize: 13 },
    tile: { height: 205, borderRadius: radii.md, overflow: "hidden" },
    tileImg: { width: "100%", height: "100%" },
    tileShade: { position: "absolute", left: 0, right: 0, bottom: 0, height: "50%", backgroundColor: "rgba(0,0,0,0.35)" },
    tileNameRow: { position: "absolute", bottom: 12, left: 14, right: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    tileName: { color: "#fff", fontFamily: fonts.display, fontSize: 22 },
    matchScore: { color: "#fff", fontFamily: fonts.bodyBold, fontSize: 11, backgroundColor: "rgba(255,93,115,0.85)", paddingHorizontal: 9, paddingVertical: 5, borderRadius: radii.pill },
    card: { backgroundColor: colors.white, borderRadius: radii.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.line, marginBottom: 12 },
    meetingArea: { padding: 15 },
    detailLine: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.dark },
    cardBio: { fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.grey, marginTop: 7 },
    cardTags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 9 },
    cardTag: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.coralDark, backgroundColor: colors.cream2, paddingHorizontal: 8, paddingVertical: 5, borderRadius: radii.pill },
    routeLine: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
    routeDot: { color: colors.coral, fontSize: 9 },
    line: { flex: 1, borderTopWidth: 1, borderStyle: "dashed", borderColor: colors.line, marginHorizontal: 5 },
    meetingLabel: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.dark },
    meetingPlace: { fontFamily: fonts.body, fontSize: 10, color: colors.grey, marginTop: 3 },
    markerRow: { flexDirection: "row", alignItems: "center", marginTop: 7, gap: 4 },
    markerHint: { flex: 1, fontFamily: fonts.body, fontSize: 9, color: colors.grey },
    markerButton: { width: 28, height: 28, alignItems: "center", justifyContent: "center", borderRadius: 14 },
    markerSelected: { backgroundColor: colors.cream2 },
    markerImage: { width: 27, height: 27 },
  });
}
