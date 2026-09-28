import React, { useCallback, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { fonts, radii } from "@/theme/theme";
import { useThemedColors } from "@/hooks/useThemedColors";
import { useAppState } from "@/context/AppState";
import { useTranslation } from "@/i18n/useTranslation";
import { getPetLikers, Liker } from "@/data/api/likes";

// One-sided likes: shown blurred and anonymous — it's not a match until my pet likes back in Discover.
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

  return (
    <Pressable style={styles.card} onPress={() => navigation.navigate("Discover")}>
      <View style={styles.avatars}>
        {likers.slice(0, 4).map((liker, index) => (
          <View key={liker.id} style={[styles.avatarWrap, { marginLeft: index === 0 ? 0 : -14, zIndex: 4 - index }]}>
            <Image source={{ uri: liker.photo_url }} style={styles.avatar} blurRadius={18} />
            <View style={styles.avatarVeil} />
          </View>
        ))}
        {count > 4 && <View style={[styles.avatarWrap, styles.more]}><Text style={styles.moreText}>+{count - 4}</Text></View>}
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>
          💌 {count > 1 ? tx(`${count} pets ont liké ${activePet.name}`, `${count} pets liked ${activePet.name}`) : tx(`Un pet a liké ${activePet.name}`, `Someone liked ${activePet.name}`)}
        </Text>
        <Text style={styles.hint}>{tx("Pas encore un match : like-les en retour dans Discover 👀", "Not a match yet: like them back in Discover 👀")}</Text>
      </View>
      <Text style={styles.arrow}>›</Text>
    </Pressable>
  );
}

function getStyles(colors: ReturnType<typeof useThemedColors>) {
  return StyleSheet.create({
    card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, marginTop: 12, borderRadius: radii.md, backgroundColor: colors.cream2, borderWidth: 1, borderColor: colors.line },
    avatars: { flexDirection: "row", alignItems: "center" },
    avatarWrap: { width: 42, height: 42, borderRadius: 21, overflow: "hidden", borderWidth: 2, borderColor: colors.cream, backgroundColor: colors.line },
    avatar: { width: "100%", height: "100%" },
    avatarVeil: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(255,93,115,0.18)" },
    more: { marginLeft: -14, alignItems: "center", justifyContent: "center", backgroundColor: colors.coral },
    moreText: { fontFamily: fonts.bodyBold, fontSize: 11, color: "#FFFFFF" },
    copy: { flex: 1 },
    title: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.dark },
    hint: { fontFamily: fonts.body, fontSize: 11, color: colors.grey, marginTop: 2 },
    arrow: { fontFamily: fonts.bodyBold, fontSize: 22, color: colors.coralDark },
  });
}
