import React from "react";
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { fonts, radii } from "@/theme/theme";
import { useThemedColors } from "@/hooks/useThemedColors";
import Header from "@/components/Header";
import MeetingMap from "@/components/MeetingMap";
import ThreadsFeed from "@/components/ThreadsFeed";
import SectionBoundary from "@/components/SectionBoundary";
import { useAppState } from "@/context/AppState";
import { useCareStatus } from "@/hooks/usePetProgression";
import { careUrlForPet, healthLabel } from "@/data/api/care";
import { useTranslation } from "@/i18n/useTranslation";

const CARE_BLUE = "#4C8DDE";
const STORE_IMAGE = require("../../assets/store/image.png");
const SOCIALS = [
  { label: "Instagram", icon: "◎", color: "#D95778", url: "https://instagram.com" },
  { label: "TikTok", icon: "♪", color: "#252525", url: "https://tiktok.com" },
  { label: "Snap", icon: "◈", color: "#D7B52A", url: "https://snapchat.com" },
];

export default function ExploreScreen() {
  const colors = useThemedColors();
  const styles = getStyles(colors);
  const { activePet } = useAppState();
  const { t, tx, language } = useTranslation();
  const care = useCareStatus(activePet.dbId);
  const navigation = useNavigation<any>();

    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <Header />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.mapSection}>
            <SectionBoundary name="map">
              <MeetingMap />
            </SectionBoundary>
          </View>
          <View style={styles.splitSection}>
            <View style={styles.leftColumn}>
              <SectionBoundary name="threads">
                <ThreadsFeed />
              </SectionBoundary>
            </View>
            <View style={styles.rightColumn}>
              <Text style={styles.columnTitle}>{tx("La boutique", "The shop")}</Text>
              <Pressable style={styles.storeCard} onPress={() => Linking.openURL("https://grrrr-store-89il.vercel.app/")}><Image source={STORE_IMAGE} style={styles.storeImage} resizeMode="cover" /><View style={styles.storeOverlay}><Text style={styles.storeEyebrow}>GRRRR SHOP</Text><Text style={styles.storeTitle}>{tx("Pour les balades qui comptent.", "For the walks that matter.")}</Text><Text style={styles.storeButton}>{tx("Visiter la boutique ↗", "Visit the shop ↗")}</Text></View></Pressable>
              <View style={styles.storeNote}><Text style={styles.storeNoteIcon}>✦</Text><Text style={styles.storeNoteText}>{tx("Une sélection pensée pour chaque tempérament.", "A selection designed for every temperament.")}</Text></View>
              <Pressable style={styles.careCard} onPress={() => Linking.openURL(careUrlForPet(activePet.dbId))}>
                <View style={styles.careHeader}><Text style={styles.careIcon}>🩺</Text><Text style={styles.careEyebrow}>GRRRR CARE</Text></View>
                {care && care.status !== "no_data" ? (
                  <>
                    <Text style={styles.careLabel}>{tx(`Santé de ${activePet.name}`, `${activePet.name}'s health`)}</Text>
                    <View style={styles.careScoreRow}><Text style={styles.careScore}>{care.score === null ? "—" : `${care.score}%`}</Text><Text style={styles.careLevel}>{healthLabel(care, language)}</Text></View>
                    <View style={styles.careTrack}><View style={[styles.careFill, { width: `${care.score ?? 0}%` }]} /></View>
                    {care.advice ? <Text style={styles.careAdvice} numberOfLines={3}>{care.advice[language]}</Text> : care.status !== "ok" ? <Text style={styles.careAdvice} numberOfLines={3}>{tx("Pas encore assez d'infos : complète son carnet dans Care.", "Not enough info yet: complete their record in Care.")}</Text> : null}
                    <Text style={styles.careLink}>{tx("Ouvrir Care ↗", "Open Care ↗")}</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.careTitle}>{tx(`Santé de ${activePet.name}`, `${activePet.name}'s health`)}</Text>
                    <Text style={styles.careAdvice}>{tx("Ajoute vaccins, visites et poids dans Care pour voir son score santé et gagner jusqu'à 1 080 XP.", "Add vaccines, visits and weight in Care to see their health score and earn up to 1,080 XP.")}</Text>
                    <Text style={styles.careLink}>{tx("Compléter dans Care ↗", "Complete in Care ↗")}</Text>
                  </>
                )}
              </Pressable>
              <Pressable style={styles.adoptionCard} onPress={() => navigation.navigate("Adopt")}>
                <View style={styles.careHeader}><Text style={styles.careIcon}>🍼</Text><Text style={styles.adoptionEyebrow}>GRRRR ADOPT</Text></View>
                <Text style={styles.careTitle}>{t.explore.adoptionTitle}</Text>
                <Text style={styles.careAdvice}>{t.explore.adoptionText}</Text>
                <Text style={styles.adoptionLink}>{t.explore.adoptionLink}</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
}
function getStyles(colors: ReturnType<typeof useThemedColors>) {
    return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.cream },
    content: { paddingBottom: 30 },
    mapSection: { paddingHorizontal: 16, paddingTop: 4 },
    careCard: { marginTop: 10, borderRadius: radii.md, padding: 12, backgroundColor: "rgba(76,141,222,0.1)", borderWidth: 1, borderColor: "rgba(76,141,222,0.35)" },
    careHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
    careIcon: { fontSize: 15 },
    careEyebrow: { fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1, color: CARE_BLUE },
    careLabel: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.dark, marginTop: 8 },
    careTitle: { fontFamily: fonts.displaySemi, fontSize: 16, color: colors.dark, marginTop: 6 },
    careScoreRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 2 },
    careScore: { fontFamily: fonts.displayExtra, fontSize: 28, color: CARE_BLUE },
    careLevel: { fontFamily: fonts.bodyBold, fontSize: 11, color: CARE_BLUE },
    careTrack: { height: 6, borderRadius: 3, backgroundColor: "rgba(76,141,222,0.18)", marginTop: 4, overflow: "hidden" },
    careFill: { height: "100%", borderRadius: 3, backgroundColor: CARE_BLUE },
    careAdvice: { fontFamily: fonts.body, fontSize: 10, lineHeight: 14, color: colors.grey, marginTop: 7 },
    careLink: { fontFamily: fonts.bodyBold, fontSize: 11, color: CARE_BLUE, marginTop: 8 },
    adoptionCard: { marginTop: 10, borderRadius: radii.md, padding: 12, backgroundColor: "rgba(255,179,92,0.16)", borderWidth: 1, borderColor: "rgba(255,179,92,0.6)" },
    adoptionEyebrow: { fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1, color: "#C97A1E" },
    adoptionLink: { fontFamily: fonts.bodyBold, fontSize: 11, color: "#C97A1E", marginTop: 8 },
    socialRow: { flexDirection: "row", gap: 8 },
    socialChip: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderWidth: 1, borderRadius: radii.pill, paddingVertical: 7, backgroundColor: "rgba(255,255,255,0.65)" },
    socialIcon: { fontFamily: fonts.bodyBold, fontSize: 15 },
    socialText: { fontFamily: fonts.bodySemi, fontSize: 10, color: colors.dark },
    splitSection: { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingTop: 20 },
    leftColumn: { flex: 1 },
    rightColumn: { flex: 1 },
    columnTitle: { fontFamily: fonts.displaySemi, fontSize: 16, color: colors.dark, marginBottom: 9 },
    storeCard: { height: 360, borderRadius: radii.lg, overflow: "hidden", backgroundColor: colors.cream2 },
    storeImage: { width: "100%", height: "100%" },
    storeOverlay: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 14, backgroundColor: "rgba(43,39,36,0.62)" },
    storeEyebrow: { fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1, color: colors.cream2 },
    storeTitle: { fontFamily: fonts.displaySemi, fontSize: 19, lineHeight: 22, color: colors.white, marginTop: 4 },
    storeButton: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.white, marginTop: 12 },
    storeNote: { flexDirection: "row", gap: 7, backgroundColor: colors.cream2, borderRadius: radii.md, padding: 10, marginTop: 10 },
    storeNoteIcon: { color: colors.hot, fontSize: 16 },
    storeNoteText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 10, lineHeight: 14, color: colors.dark },
  });
}
