import React, { useRef, useState } from "react";
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
import { colors, fonts, radii } from "@/theme/theme";
import { useAppState } from "@/context/AppState";
import { ChatMessage } from "@/context/AppState";

export default function ChatThreadScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { chats, sendMessage } = useAppState();
  const [text, setText] = useState("");
  const listRef = useRef<FlatList>(null);

  const petId = route.params?.petId;
  const chat = chats.find((c) => c.pet.id === petId);

  if (!chat) return null;

  const onSend = () => {
    if (!text.trim()) return;
    sendMessage(petId, text.trim());
    setText("");
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.head}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Image source={{ uri: chat.pet.photo }} style={styles.avatar} />
        <Text style={styles.name}>{chat.pet.name}</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={80}
      >
        <FlatList
          ref={listRef}
          data={chat.messages}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          renderItem={({ item }) => <Bubble message={item} />}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />

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

function Bubble({ message }: { message: ChatMessage }) {
  const mine = message.from === "me";
  return (
    <View style={[styles.bubble, mine ? styles.bubbleMe : styles.bubbleThem]}>
      <Text style={[styles.bubbleText, mine && { color: "#fff" }]}>{message.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  bubble: { maxWidth: "75%", paddingHorizontal: 13, paddingVertical: 9, borderRadius: 16 },
  bubbleThem: {
    backgroundColor: "#fff",
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
    backgroundColor: "#fff",
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.coral,
    alignItems: "center",
    justifyContent: "center",
  },
});
