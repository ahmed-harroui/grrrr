import React, { useCallback, useState } from "react";
import { FlatList, Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { fonts } from "@/theme/theme";
import { useTranslation } from "@/i18n/useTranslation";
import { SPECIES } from "@/components/AddPetSheet";
import { getRehomingListings, RehomingListing } from "@/data/api/adoption";

// GRRRR Adopt, "To give": pets whose owners can no longer keep them, posted on the website
// (migration 025). The listing, the request and posting one open there, with the same account.
const SITE = "https://grrrr-main.vercel.app";
const ORANGE = "#FFB35C";
const ORANGE_DARK = "#C97A1E";
const INK = "#3A2A18";
const INK_SOFT = "#8A6F54";
const GLASS = "rgba(255,255,255,0.72)";
const GLASS_BORDER = "rgba(255,255,255,0.95)";

export default function GiveList() {
  const { tx } = useTranslation();
  const [listings, setListings] = useState<RehomingListing[]>([]);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getRehomingListings().then((result) => {
        if (!active) return;
        setListings(result);
        setLoaded(true);
      });
      return () => {
        active = false;
      };
    }, [])
  );

  const open = (path: string) => Linking.openURL(`${SITE}${path}`).catch(() => {});

  return (
    <FlatList
      data={listings}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <Pressable style={styles.giveCard} onPress={() => open("/adopt/give/new")}>
          <Text style={styles.giveTitle}>🏡 {tx("Tu ne peux plus garder ton animal ?", "Can’t keep your pet?")}</Text>
          <Text style={styles.giveText}>{tx("Publie-le avec une photo et son histoire : tu choisis sa nouvelle famille.", "Post them with a photo and their story: you choose their new family.")}</Text>
          <Text style={styles.giveLink}>{tx("Donner un animal ›", "Give a pet ›")}</Text>
        </Pressable>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🏡</Text>
          <Text style={styles.emptyText}>{loaded ? tx("Aucun animal à donner pour le moment.", "No pet to give right now.") : tx("Chargement…", "Loading…")}</Text>
        </View>
      }
      renderItem={({ item }) => {
        const species = SPECIES.find((entry) => entry.key === item.species?.toLowerCase());
        const gender = item.gender === "M" ? tx("Mâle", "Male") : item.gender === "F" ? tx("Femelle", "Female") : "";
        return (
          <Pressable style={styles.card} onPress={() => open(`/adopt/give/${item.id}`)}>
            {item.photo ? <Image source={{ uri: item.photo }} style={styles.photo} /> : <View style={[styles.photo, styles.noPhoto]}><Text style={styles.noPhotoIcon}>{species?.icon ?? "🐾"}</Text></View>}
            <View style={styles.body}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>{item.petName}</Text>
                {item.reserved && <Text style={styles.reserved}>{tx("Réservé", "Reserved")}</Text>}
              </View>
              <Text style={styles.meta} numberOfLines={1}>{[`${species?.icon ?? "🐾"} ${item.breed}`.trim(), gender, item.age].filter(Boolean).join(" · ")}</Text>
              <Text style={styles.meta} numberOfLines={1}>📍 {item.city}</Text>
              <Text style={styles.story} numberOfLines={2}>{item.story}</Text>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 18, paddingBottom: 30, gap: 12 },
  giveCard: { padding: 16, borderRadius: 22, backgroundColor: INK, marginBottom: 2 },
  giveTitle: { fontFamily: fonts.displaySemi, fontSize: 17, color: "#FFFFFF" },
  giveText: { fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: "rgba(255,255,255,0.78)", marginTop: 4 },
  giveLink: { fontFamily: fonts.bodyBold, fontSize: 13, color: ORANGE, marginTop: 10 },
  empty: { alignItems: "center", padding: 34, borderRadius: 24, backgroundColor: GLASS, borderWidth: 1.5, borderColor: GLASS_BORDER },
  emptyIcon: { fontSize: 40 },
  emptyText: { fontFamily: fonts.body, fontSize: 13, color: INK_SOFT, textAlign: "center", marginTop: 8 },
  card: { flexDirection: "row", gap: 12, padding: 10, borderRadius: 22, backgroundColor: GLASS, borderWidth: 1.5, borderColor: GLASS_BORDER },
  photo: { width: 96, height: 96, borderRadius: 16, backgroundColor: "#FFE2BD" },
  noPhoto: { alignItems: "center", justifyContent: "center" },
  noPhotoIcon: { fontSize: 38 },
  body: { flex: 1, minWidth: 0, justifyContent: "center" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { flexShrink: 1, fontFamily: fonts.displaySemi, fontSize: 18, color: INK },
  reserved: { fontFamily: fonts.bodyBold, fontSize: 9, color: "#FFFFFF", backgroundColor: ORANGE_DARK, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, overflow: "hidden" },
  meta: { fontFamily: fonts.bodySemi, fontSize: 11, color: INK_SOFT, marginTop: 2 },
  story: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: INK, marginTop: 4 },
});
