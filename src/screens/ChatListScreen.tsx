import React, { useCallback, useState } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { fonts } from "@/theme/theme";
import { useThemedColors } from "@/hooks/useThemedColors";
import { Chat, useAppState } from "@/context/AppState";
import Header from "@/components/Header";
import PetProfileSheet from "@/components/PetProfileSheet";
import type { Pet } from "@/data/mockPets";
import { useTranslation } from "@/i18n/useTranslation";
import { AdoptionIntent, AdoptionInterest, getAdoptionInterests, removeAdoptionInterest } from "@/data/api/adoption";

const ADOPT = "#FFB35C";

type Story = { kind: "chat"; pet: Pet } | { kind: "waiting"; pet: Pet; intent: AdoptionIntent };
type Row = { kind: "chat"; chat: Chat } | { kind: "waiting"; pet: Pet; intent: AdoptionIntent };

export default function ChatListScreen() {
  const { chats, activePet } = useAppState();
  const navigation = useNavigation<any>();
  const colors = useThemedColors();
  const styles = getStyles(colors);
  const { tx } = useTranslation();
  const [profilePet, setProfilePet] = useState<Pet | null>(null);
  const [waitingPet, setWaitingPet] = useState<Pet | null>(null);
  // Pets swiped up in Discover: the family waits for their babies (migration 015).
  const [interests, setInterests] = useState<AdoptionInterest[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getAdoptionInterests(activePet.dbId).then((result) => active && setInterests(result));
      return () => {
        active = false;
      };
    }, [activePet.dbId])
  );

  const stopWaiting = (pet: Pet) => {
    setWaitingPet(null);
    setInterests((current) => current.filter((interest) => interest.pet.dbId !== pet.dbId));
    if (pet.dbId && activePet.dbId) void removeAdoptionInterest(pet.dbId, activePet.dbId);
  };

  // Kept with the matches until the pet has babies: then the request opens a real conversation
  // with it, which replaces the waiting row.
  const waiting = interests.filter((interest) => !chats.some((chat) => chat.pet.dbId && chat.pet.dbId === interest.pet.dbId));
  // Most recent first: a new match, a new message or a new wait goes to the top.
  const dated = [
    ...waiting.map((interest) => ({ at: interest.since, row: { kind: "waiting" as const, pet: interest.pet, intent: interest.intent } })),
    ...chats.map((chat) => ({ at: chat.lastAt ?? "", row: { kind: "chat" as const, chat } })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  // The waits live in the bubbles above (orange); the list below is only for conversations.
  const stories: Story[] = dated.map(({ row }) => (row.kind === "chat" ? { kind: "chat", pet: row.chat.pet } : row));
  const rows: Row[] = dated.map((item) => item.row).filter((row) => row.kind === "chat");

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.cream }]} edges={["top"]}>
      <Header />
      <Text style={[styles.title, { color: colors.dark }]}>Messages</Text>

      {stories.length > 0 && (
        <View>
          <Text style={[styles.storyHeading, { color: colors.grey }]}>{tx("Rencontres récentes", "Recent matches")}</Text>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={stories}
            keyExtractor={(story) => `${story.kind}-${story.pet.id}`}
            contentContainerStyle={styles.stories}
            renderItem={({ item }) => (
              <Pressable style={styles.story} onPress={() => (item.kind === "waiting" ? setWaitingPet(item.pet) : setProfilePet(item.pet))}>
                <View style={[styles.storyRing, { backgroundColor: item.kind === "waiting" ? ADOPT : colors.coral }]}>
                  <Image source={{ uri: item.pet.photo || undefined }} style={[styles.storyAvatar, { borderColor: colors.cream, backgroundColor: colors.line }]} />
                  {item.kind === "waiting" && <Text style={styles.waitingBadge}>{item.intent === "BUY" ? "💶" : "🍼"}</Text>}
                </View>
                <Text style={[styles.storyName, { color: item.kind === "waiting" ? "#C97A1E" : colors.dark }]} numberOfLines={1}>{item.pet.name}</Text>
              </Pressable>
            )}
          />
        </View>
      )}

      {rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.grey }]}>
            {waiting.length > 0
              ? tx("Tes attentes de bébés sont en haut 🍼 : la conversation s'ouvre ici dès qu'une portée est proposée.", "Your baby waits are above 🍼: the conversation opens here as soon as a litter is offered.")
              : tx("Aucune conversation pour le moment.", "No conversations yet.")}
          </Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => (row.kind === "chat" ? `chat-${row.chat.pet.id}` : `waiting-${row.pet.id}`)}
          contentContainerStyle={{ paddingHorizontal: 20 }}
          renderItem={({ item }) => {
            if (item.kind !== "chat") return null;
            const { chat } = item;
            const last = chat.messages[chat.messages.length - 1];
            return (
              <Pressable style={[styles.row, { borderBottomColor: colors.line }]} onPress={() => navigation.navigate("ChatThread", { petId: chat.pet.id })}>
                <Pressable onPress={() => setProfilePet(chat.pet)} hitSlop={6}>
                  <Image source={{ uri: chat.pet.photo || undefined }} style={[styles.avatar, { backgroundColor: colors.line }]} />
                </Pressable>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { color: colors.dark }]}>{chat.pet.name}</Text>
                  <Text style={[styles.preview, { color: colors.grey }]} numberOfLines={1}>
                    {last?.text ?? ""}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      <PetProfileSheet
        pet={profilePet}
        onClose={() => setProfilePet(null)}
        action={profilePet ? { label: tx(`💬 Écrire à ${profilePet.name}`, `💬 Message ${profilePet.name}`), onPress: () => { const petId = profilePet.id; setProfilePet(null); navigation.navigate("ChatThread", { petId }); } } : undefined}
      />
      {/* A pet the family waits for: its profile, and a way to stop waiting */}
      <PetProfileSheet
        pet={waitingPet}
        onClose={() => setWaitingPet(null)}
        action={waitingPet ? { label: tx("🍼 Ne plus attendre ses bébés", "🍼 Stop waiting for their babies"), onPress: () => stopWaiting(waitingPet) } : undefined}
      />
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
    waitingBadge: { position: "absolute", right: -4, bottom: -2, fontSize: 15 },
    storyName: { fontFamily: fonts.bodyMedium, fontSize: 10, marginTop: 5 },
    empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
    emptyText: { textAlign: "center", fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
    },
    avatar: { width: 52, height: 52, borderRadius: 26 },
    waitingRing: { width: 58, height: 58, borderRadius: 29, padding: 3, backgroundColor: ADOPT },
    waitingAvatar: { width: "100%", height: "100%" },
    lock: { fontSize: 14, opacity: 0.7 },
    name: { fontFamily: fonts.bodyBold, fontSize: 14 },
    preview: { fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  });
}
