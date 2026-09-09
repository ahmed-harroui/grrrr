import React from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { colors, fonts, radii } from "@/theme/theme";
import { MeetingMarker, useAppState } from "@/context/AppState";
import Header from "@/components/Header";
import { Pet } from "@/data/mockPets";

export default function MatchesScreen() {
  const { matches, meetingMarkers, setMeetingMarker } = useAppState();
  const navigation = useNavigation<any>();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Header />
      <Text style={styles.title}>Vos matchs</Text>

      {matches.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Pas encore de match. Swipez à droite sur Discover 🐾</Text>
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(p) => String(p.id)}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{ gap: 12, paddingHorizontal: 20, paddingBottom: 20 }}
          renderItem={({ item }) => <MatchTile pet={item} marker={meetingMarkers[item.id]} onMarkerChange={(marker) => setMeetingMarker(item.id, marker)} onPress={() => navigation.navigate("ChatThread", { petId: item.id })} />}
        />
      )}
    </SafeAreaView>
  );
}

function MatchTile({ pet, marker, onMarkerChange, onPress }: { pet: Pet; marker?: MeetingMarker; onMarkerChange: (marker: MeetingMarker) => void; onPress: () => void }) {
  return (
    <View style={styles.card}>
      <Pressable style={styles.tile} onPress={onPress}>
        <Image source={{ uri: pet.photo }} style={styles.tileImg} />
        <View style={styles.tileShade} />
        <Text style={styles.tileName}>{pet.name}</Text>
      </Pressable>
      <View style={styles.meetingArea}>
        <View style={styles.routeLine}><Text style={styles.routeDot}>●</Text><View style={styles.line} /><Text style={styles.routeDot}>●</Text></View>
        <Text style={styles.meetingLabel}>Point de rencontre</Text>
        <Text style={styles.meetingPlace}>📍 À définir ensemble</Text>
        <View style={styles.markerRow}>
          <Text style={styles.markerHint}>Choisir une patte</Text>
          <Pressable onPress={() => onMarkerChange("blue")} style={[styles.markerButton, marker === "blue" && styles.markerSelected]}><Image source={require("../../assets/bleue_clic.png")} style={styles.markerImage} /></Pressable>
          <Pressable onPress={() => onMarkerChange("pink")} style={[styles.markerButton, marker === "pink" && styles.markerSelected]}><Image source={require("../../assets/pink_clic.png")} style={styles.markerImage} /></Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  title: { fontFamily: fonts.display, fontSize: 21, color: colors.dark, marginHorizontal: 20, marginBottom: 14, marginTop: 2 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  emptyText: { textAlign: "center", fontFamily: fonts.body, color: colors.grey, fontSize: 13 },
  tile: { flex: 1, height: 150, borderRadius: radii.md, overflow: "hidden" },
  tileImg: { width: "100%", height: "100%" },
  tileShade: { position: "absolute", left: 0, right: 0, bottom: 0, height: "50%", backgroundColor: "rgba(0,0,0,0.35)" },
  tileName: { position: "absolute", bottom: 8, left: 10, color: "#fff", fontFamily: fonts.display, fontSize: 14 },
  card: { flex: 1, backgroundColor: colors.white, borderRadius: radii.md, overflow: "hidden", borderWidth: 1, borderColor: colors.line },
  meetingArea: { padding: 10 },
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
