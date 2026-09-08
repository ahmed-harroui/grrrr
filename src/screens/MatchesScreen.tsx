import React from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { colors, fonts, radii } from "@/theme/theme";
import { useAppState } from "@/context/AppState";
import Header from "@/components/Header";
import { Pet } from "@/data/mockPets";

export default function MatchesScreen() {
  const { matches } = useAppState();
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
          renderItem={({ item }) => <MatchTile pet={item} onPress={() => navigation.navigate("ChatThread", { petId: item.id })} />}
        />
      )}
    </SafeAreaView>
  );
}

function MatchTile({ pet, onPress }: { pet: Pet; onPress: () => void }) {
  return (
    <Pressable style={styles.tile} onPress={onPress}>
      <Image source={{ uri: pet.photo }} style={styles.tileImg} />
      <View style={styles.tileShade} />
      <Text style={styles.tileName}>{pet.name}</Text>
    </Pressable>
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
});
