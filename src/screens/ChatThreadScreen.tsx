import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { fonts, radii } from "@/theme/theme";
import { useThemedColors } from "@/hooks/useThemedColors";
import { ChatMessage, useAppState } from "@/context/AppState";

export default function ChatThreadScreen() {
  const colors = useThemedColors();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { activePet, chats, sendMessage, markChatRead, meetingTraces, confirmMeetingTrace, deleteMeetingTrace } = useAppState();
  const [text, setText] = useState("");
  const styles = getStyles(colors);
  const listRef = useRef<FlatList>(null);

  const petId = route.params?.petId;
  const chat = chats.find((c) => c.pet.id === petId);
  const trace = meetingTraces[petId];

  const [isCondensed, setIsCondensed] = useState(true);

  useEffect(() => {
    if (petId !== undefined) markChatRead(petId);
  }, [markChatRead, petId]);

  if (!chat) return null;

  const onSend = () => {
    if (!text.trim()) return;
    sendMessage(petId, text.trim());
    setText("");
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const hiddenCount = chat.messages.length > 3 ? chat.messages.length - 3 : 0;
  const visibleMessages = isCondensed && chat.messages.length > 3 ? chat.messages.slice(-3) : chat.messages;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.head}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Image source={{ uri: chat.pet.photo }} style={styles.avatar} />
        <Text style={styles.name}>{chat.pet.name}</Text>
        <Pressable style={styles.locationButton} onPress={() => navigation.navigate("MainTabs", { screen: "Matches" })}>
          <Text style={styles.locationIcon}>⌖</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={80}
      >
        <FlatList
          ref={listRef}
          data={visibleMessages}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          ListHeaderComponent={
            <View style={{ gap: 10, marginBottom: 4 }}>
              {/* Carte héro Sortie Organisée */}
              <View style={styles.organizedHeroCard}>
                <Image
                  source={trace?.marker === "pink" ? require("../../assets/pink_clic.png") : require("../../assets/bleue_clic.png")}
                  style={styles.organizedHeroPaw}
                />
                <View style={styles.organizedHeroCopy}>
                  <View style={styles.organizedHeroRow}>
                    <Text style={styles.organizedHeroTitle}>
                      Sortie Organisée {trace?.marker === "pink" ? "❤️ (Hot)" : "🐾 (Friend)"}
                    </Text>
                    <View style={[styles.statusTag, trace?.status === "confirmed" ? styles.statusTagConfirmed : styles.statusTagPending]}>
                      <Text style={styles.statusTagText}>
                        {trace?.status === "confirmed" ? "Confirmée ✅" : "En attente ⏳"}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.organizedHeroSub}>
                    {trace?.status === "confirmed"
                      ? `Rendez-vous validé entre ${activePet.name} et ${chat.pet.name} !`
                      : `Proposition de rendez-vous avec ${chat.pet.name}`}
                  </Text>
                </View>
                <Pressable
                  style={styles.heroMapBtn}
                  onPress={() => navigation.navigate("MainTabs", { screen: "Matches" })}
                >
                  <Text style={styles.heroMapBtnText}>📍 Voir sur la carte</Text>
                </Pressable>
              </View>

              {/* Bar de condensation intelligente des messages */}
              {chat.messages.length > 3 && (
                <Pressable style={styles.condenseBar} onPress={() => setIsCondensed(!isCondensed)}>
                  <Text style={styles.condenseText}>
                    💬 {isCondensed ? `${hiddenCount} anciens messages condensés — Touchez pour déplier` : "Masquer les anciens messages"} {isCondensed ? "▼" : "▲"}
                  </Text>
                </Pressable>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <Bubble
              message={item}
              onOpenMap={() => navigation.navigate("MainTabs", { screen: "Matches" })}
              styles={styles}
            />
          )}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />

        <View style={styles.meetingRequest}>
          <View style={styles.meetingIcon}><Text style={styles.meetingIconText}>⌖</Text></View>
          <View style={styles.meetingCopy}>
            <Text style={styles.meetingTitle}>{trace?.status === "confirmed" ? "Sortie confirmée" : "Une sortie à organiser"}</Text>
            <Text style={styles.meetingText}>{trace?.status === "confirmed" ? "Le lieu est enregistré pour vous deux." : "Choisissez ensemble un endroit sur la carte."}</Text>
          </View>
          {trace?.status === "pending" ? (
            <View style={styles.meetingActions}>
              <Pressable style={styles.acceptButton} onPress={() => confirmMeetingTrace(petId)}>
                <Text style={styles.acceptText}>Accepter</Text>
              </Pressable>
              <Pressable style={styles.rejectButton} onPress={() => deleteMeetingTrace(petId)}>
                <Text style={styles.rejectText}>Refuser</Text>
              </Pressable>
            </View>
          ) : trace?.status === "confirmed" ? (
            <Pressable style={styles.deleteButton} onPress={() => deleteMeetingTrace(petId)}>
              <Text style={styles.deleteText}>Supprimer</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.proposeButton} onPress={() => navigation.navigate("MainTabs", { screen: "Matches" })}>
              <Text style={styles.proposeText}>Choisir</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Écrire un message..."
            placeholderTextColor={colors.grey}
            value={text}
            onChangeText={setText}
            onSubmitEditing={onSend}
            returnKeyType="send"
          />
          <Pressable style={styles.sendBtn} onPress={onSend}>
            <Text style={{ color: "#fff", fontSize: 15 }}>➤</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Bubble({ message, onOpenMap, styles }: { message: ChatMessage; onOpenMap: () => void; styles: ReturnType<typeof getStyles> }) {
  const mine = message.from === "me";
  const isOrganized = message.text.includes("Sortie organisée");

  if (isOrganized) {
    return (
      <View style={styles.organizedMsgCard}>
        <Text style={styles.organizedMsgTitle}>🐾 GRRRR — Sortie Organisée</Text>
        <Text style={styles.organizedMsgText}>{message.text}</Text>
        <Pressable style={styles.organizedMsgBtn} onPress={onOpenMap}>
          <Text style={styles.organizedMsgBtnText}>📍 Voir le lieu sur la carte</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.bubble, mine ? styles.bubbleMe : styles.bubbleThem]}>
      <Text style={[styles.bubbleText, mine && { color: "#fff" }]}>{message.text}</Text>
    </View>
  );
}

function getStyles(colors: ReturnType<typeof useThemedColors>) {
    return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.cream },
    head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
    back: { fontSize: 18, color: colors.dark, marginRight: 2 },
    avatar: { width: 38, height: 38, borderRadius: 19 },
    name: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.dark },
    locationButton: { marginLeft: "auto", width: 36, height: 36, borderRadius: 18, backgroundColor: colors.cream2, alignItems: "center", justifyContent: "center" },
    locationIcon: { color: colors.coralDark, fontSize: 20 },
    organizedHeroCard: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.coral,
    flexDirection: "column",
    gap: 8,
  },
    organizedHeroPaw: { width: 32, height: 32, position: "absolute", top: 10, right: 10 },
    organizedHeroCopy: { paddingRight: 40 },
    organizedHeroRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
    organizedHeroTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.dark },
    statusTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.pill },
    statusTagConfirmed: { backgroundColor: "#E6F4EA" },
    statusTagPending: { backgroundColor: colors.cream2 },
    statusTagText: { fontFamily: fonts.bodySemi, fontSize: 10, color: colors.coralDark },
    organizedHeroSub: { fontFamily: fonts.body, fontSize: 11, color: colors.grey, marginTop: 2 },
    heroMapBtn: {
    backgroundColor: colors.cream2,
    borderRadius: radii.pill,
    paddingVertical: 7,
    paddingHorizontal: 12,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.line,
  },
    heroMapBtnText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.coralDark },
    condenseBar: {
    backgroundColor: "rgba(0,0,0,0.04)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    alignItems: "center",
  },
    condenseText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.grey },
    organizedMsgCard: {
    backgroundColor: colors.cream2,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.coral,
    padding: 12,
    marginVertical: 4,
  },
    organizedMsgTitle: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.coralDark, marginBottom: 4 },
    organizedMsgText: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.dark, marginBottom: 8 },
    organizedMsgBtn: {
    backgroundColor: colors.coral,
    borderRadius: radii.pill,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignSelf: "flex-start",
  },
    organizedMsgBtnText: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.white },
    bubble: { maxWidth: "75%", paddingHorizontal: 13, paddingVertical: 9, borderRadius: 16 },
    bubbleThem: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
  },
    bubbleMe: { backgroundColor: colors.coral, alignSelf: "flex-end", borderBottomRightRadius: 4 },
    bubbleText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.dark },
    inputRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
    input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 13,
    backgroundColor: colors.white,
    color: colors.dark,
  },
    sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.coral,
    alignItems: "center",
    justifyContent: "center",
  },
    meetingRequest: { marginHorizontal: 16, marginBottom: 8, padding: 11, borderRadius: radii.md, backgroundColor: "rgba(255,93,115,0.12)", borderWidth: 1, borderColor: "rgba(255,93,115,0.3)", flexDirection: "row", alignItems: "center", gap: 9 },
    meetingIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
    meetingIconText: { color: colors.coralDark, fontSize: 19 },
    meetingCopy: { flex: 1 },
    meetingTitle: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.dark },
    meetingText: { fontFamily: fonts.body, fontSize: 10, lineHeight: 14, color: colors.grey, marginTop: 2 },
    meetingActions: { gap: 5 },
    acceptButton: { backgroundColor: colors.coral, borderRadius: radii.pill, paddingHorizontal: 9, paddingVertical: 6 },
    acceptText: { color: colors.white, fontFamily: fonts.bodyBold, fontSize: 10 },
    rejectButton: { alignItems: "center", paddingVertical: 3 },
    rejectText: { color: colors.coralDark, fontFamily: fonts.bodySemi, fontSize: 10 },
    proposeButton: { backgroundColor: colors.coral, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 7 },
    proposeText: { color: colors.white, fontFamily: fonts.bodyBold, fontSize: 10 },
    deleteButton: { paddingHorizontal: 5 },
    deleteText: { color: colors.coralDark, fontFamily: fonts.bodySemi, fontSize: 10 },
  });
}
