import React from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { fonts } from "@/theme/theme";
import { useThemedColors } from "@/hooks/useThemedColors";
import { useAppState } from "@/context/AppState";
import Header from "@/components/Header";

export default function ChatListScreen() {
  const { chats } = useAppState();
  const navigation = useNavigation<any>();
  const colors = useThemedColors();
  const styles = getStyles(colors);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.cream }]} edges={["top"]}>
      <Header />
      <Text style={[styles.title, { color: colors.dark }]}>Messages</Text>

      {chats.length > 0 && (
        <View>
          <Text style={[styles.storyHeading, { color: colors.grey }]}>Rencontres récentes</Text>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={chats}
            keyExtractor={(chat) => `story-${chat.pet.id}`}
            contentContainerStyle={styles.stories}
            renderItem={({ item }) => (
              <Pressable style={styles.story} onPress={() => navigation.navigate("ChatThread", { petId: item.pet.id })}>
                <View style={[styles.storyRing, { backgroundColor: colors.coral }]}><Image source={{ uri: item.pet.photo }} style={[styles.storyAvatar, { borderColor: colors.cream }]} /></View>
                <Text style={[styles.storyName, { color: colors.dark }]} numberOfLines={1}>{item.pet.name}</Text>
              </Pressable>
            )}
          />
        </View>
      )}

      {chats.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.grey }]}>Aucune conversation pour le moment.</Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(c) => String(c.pet.id)}
          contentContainerStyle={{ paddingHorizontal: 20 }}
          renderItem={({ item }) => {
            const last = item.messages[item.messages.length - 1];
            return (
              <Pressable style={[styles.row, { borderBottomColor: colors.line }]} onPress={() => navigation.navigate("ChatThread", { petId: item.pet.id })}>
                <Image source={{ uri: item.pet.photo }} style={styles.avatar} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { color: colors.dark }]}>{item.pet.name}</Text>
                  <Text style={[styles.preview, { color: colors.grey }]} numberOfLines={1}>
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

function getStyles(colors: ReturnType<typeof useThemedColors>) {
  return StyleSheet.create({
    container: { flex: 1 },
    title: { fontFamily: fonts.display, fontSize: 21, marginHorizontal: 20, marginBottom: 14, marginTop: 2 },
    storyHeading: { fontFamily: fonts.bodySemi, fontSize: 12, marginHorizontal: 20, marginBottom: 8 },
    stories: { paddingHorizontal: 20, gap: 14, paddingBottom: 18 },
    story: { width: 62, alignItems: "center" },
    storyRing: { width: 58, height: 58, borderRadius: 29, padding: 3 },
    storyAvatar: { width: "100%", height: "100%", borderRadius: 26, borderWidth: 2 },
    storyName: { fontFamily: fonts.bodyMedium, fontSize: 10, marginTop: 5 },
    empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
    emptyText: { textAlign: "center", fontFamily: fonts.body, fontSize: 13 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
    },
    avatar: { width: 52, height: 52, borderRadius: 26 },
    name: { fontFamily: fonts.bodyBold, fontSize: 14 },
    preview: { fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  });
}
