import React from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { colors, fonts } from "@/theme/theme";
import { useAppState } from "@/context/AppState";
import Header from "@/components/Header";

export default function ChatListScreen() {
  const { chats } = useAppState();
  const navigation = useNavigation<any>();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Header />
      <Text style={styles.title}>Messages</Text>

      {chats.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Aucune conversation pour le moment.</Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(c) => String(c.pet.id)}
          contentContainerStyle={{ paddingHorizontal: 20 }}
          renderItem={({ item }) => {
            const last = item.messages[item.messages.length - 1];
            return (
              <Pressable style={styles.row} onPress={() => navigation.navigate("ChatThread", { petId: item.pet.id })}>
                <Image source={{ uri: item.pet.photo }} style={styles.avatar} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.pet.name}</Text>
                  <Text style={styles.preview} numberOfLines={1}>
                    {last.text}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  title: { fontFamily: fonts.display, fontSize: 21, color: colors.dark, marginHorizontal: 20, marginBottom: 14, marginTop: 2 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  emptyText: { textAlign: "center", fontFamily: fonts.body, color: colors.grey, fontSize: 13 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  name: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.dark },
  preview: { fontFamily: fonts.body, fontSize: 12, color: colors.grey, marginTop: 2 },
});
