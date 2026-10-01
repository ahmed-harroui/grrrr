import React, { useCallback, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { fonts, radii } from "@/theme/theme";
import { useThemedColors } from "@/hooks/useThemedColors";
import { useAppState } from "@/context/AppState";
import { useTranslation } from "@/i18n/useTranslation";
import { getPetLikers, Liker } from "@/data/api/likes";

const HOT = "#FF5D73";
const FRIEND = "#2FBDB4";

// One-sided likes: shown blurred and anonymous, with the mood they were sent in (Hot / Friend).
// It's not a match until my pet meets them in Discover and likes back.
export default function LikedYouTeaser() {
  const { activePet } = useAppState();
  const navigation = useNavigation<any>();
  const colors = useThemedColors();
  const styles = getStyles(colors);
  const { tx } = useTranslation();
  const [likers, setLikers] = useState<Liker[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getPetLikers(activePet.dbId).then((result) => active && setLikers(result));
      return () => {
        active = false;
      };
    }, [activePet.dbId])
  );

  if (likers.length === 0) return null;
  const count = likers.length;
  const hotCount = likers.filter((liker) => liker.intent === "HOT").length;
  const openDiscover = () => navigation.navigate("Discover");

  return (
    <View style={styles.card}>
      <Pressable style={styles.header} onPress={openDiscover}>
        <View style={styles.copy}>
          <Text style={styles.title}>
            💌 {count > 1 ? tx(`${count} pets ont liké ${activePet.name}`, `${count} pets liked ${activePet.name}`) : tx(`Un pet a liké ${activePet.name}`, `Someone liked ${activePet.name}`)}
          </Text>
          <Text style={styles.hint}>
            {hotCount > 0 && hotCount < count
              ? tx(`${hotCount} en Hot, ${count - hotCount} en Friend · `, `${hotCount} Hot, ${count - hotCount} Friend · `)
              : ""}
            {tx("Pas encore un match : croise-les dans Discover et like en retour 👀", "Not a match yet: find them in Discover and like back 👀")}
          </Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </Pressable>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.list}>
        {likers.map((liker) => {
          const hot = liker.intent === "HOT";
          return (
            <Pressable key={liker.id} onPress={openDiscover} style={[styles.likerCard, { borderColor: hot ? HOT : FRIEND }]}>
              <Image source={{ uri: liker.photo_url || undefined }} style={styles.likerPhoto} blurRadius={22} />
              <View style={[styles.veil, { backgroundColor: hot ? "rgba(255,93,115,0.22)" : "rgba(47,189,180,0.22)" }]} />
              <Text style={styles.mystery}>?</Text>
              {liker.super_like && <Text style={styles.superLike}>⭐</Text>}
              <Text style={[styles.intent, { backgroundColor: hot ? HOT : FRIEND }]}>{hot ? "✦ Hot" : "🐾 Friend"}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function getStyles(colors: ReturnType<typeof useThemedColors>) {
  return StyleSheet.create({
    card: { padding: 12, marginTop: 12, borderRadius: radii.md, backgroundColor: colors.cream2, borderWidth: 1, borderColor: colors.line },
    header: { flexDirection: "row", alignItems: "center", gap: 10 },
    copy: { flex: 1 },
    title: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.dark },
    hint: { fontFamily: fonts.body, fontSize: 11, color: colors.grey, marginTop: 2 },
    arrow: { fontFamily: fonts.bodyBold, fontSize: 22, color: colors.coralDark },
    list: { gap: 9, paddingTop: 11 },
    likerCard: { width: 78, height: 100, borderRadius: radii.sm, overflow: "hidden", borderWidth: 2, backgroundColor: colors.line, alignItems: "center", justifyContent: "center" },
    likerPhoto: { ...StyleSheet.absoluteFill },
    veil: { ...StyleSheet.absoluteFill },
    mystery: { fontFamily: fonts.displayExtra, fontSize: 30, color: "#FFFFFF", textShadowColor: "rgba(0,0,0,0.35)", textShadowRadius: 6 },
    superLike: { position: "absolute", top: 5, right: 6, fontSize: 13 },
    intent: { position: "absolute", left: 5, right: 5, bottom: 5, textAlign: "center", fontFamily: fonts.bodyBold, fontSize: 10, color: "#FFFFFF", borderRadius: radii.pill, paddingVertical: 3, overflow: "hidden" },
  });
}
