import React, { useCallback, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { fonts, radii } from "@/theme/theme";
import { useThemedColors } from "@/hooks/useThemedColors";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "@/i18n/useTranslation";
import { timeAgo } from "@/utils/notificationText";
import {
  createThread,
  listThreads,
  rankThreads,
  setThreadUpvote,
  Thread,
  THREAD_ANIMALS,
  THREAD_CATEGORIES,
  THREAD_LIMITS,
  ThreadAnimal,
  ThreadCategory,
  ThreadError,
} from "@/data/api/threads";

const COLLAPSED = 5;

// Community threads in Explore: the most upvoted first, then the others in a random order.
// The arrow upvotes; anyone signed in can post.
export default function ThreadsFeed() {
  const colors = useThemedColors();
  const styles = getStyles(colors);
  const { tx, language } = useTranslation();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [signInHint, setSignInHint] = useState(false);

  // Ranked once per visit: an upvote changes the count, not the order under the finger.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      listThreads(userId).then((result) => {
        if (!active) return;
        setThreads(rankThreads(result));
        setLoaded(true);
      });
      return () => {
        active = false;
      };
    }, [userId])
  );

  const toggleUpvote = (thread: Thread) => {
    if (!userId) {
      setSignInHint(true);
      return;
    }
    const upvoted = !thread.upvoted;
    const apply = (value: boolean) => setThreads((current) => current.map((item) => (item.id === thread.id ? { ...item, upvoted: value, upvotes: Math.max(0, item.upvotes + (value ? 1 : -1)) } : item)));
    apply(upvoted);
    setThreadUpvote(thread.id, userId, upvoted).then(({ error }) => error && apply(!upvoted));
  };

  const startComposing = () => {
    if (!userId) {
      setSignInHint(true);
      return;
    }
    setComposing(true);
  };

  const opened = threads.find((thread) => thread.id === openId) ?? null;
  const shown = expanded ? threads : threads.slice(0, COLLAPSED);

  return (
    <View>
      <View style={styles.titleRow}>
        <Text style={styles.columnTitle}>Threads</Text>
        <Pressable style={styles.postButton} onPress={startComposing} hitSlop={6}>
          <Text style={styles.postButtonText}>＋ {tx("Poster", "Post")}</Text>
        </Pressable>
      </View>
      {signInHint && <Text style={styles.hint}>{tx("Connecte-toi pour voter ou poster un thread.", "Sign in to upvote or post a thread.")}</Text>}

      {loaded && threads.length === 0 && (
        <View style={styles.card}>
          <Text style={styles.excerpt}>{tx("Pas encore de thread. Lance le premier !", "No threads yet. Post the first one!")}</Text>
        </View>
      )}

      {shown.map((thread) => (
        <Pressable key={thread.id} style={styles.card} onPress={() => setOpenId(thread.id)}>
          <ThreadLabel thread={thread} styles={styles} />
          <Text style={styles.cardTitle} numberOfLines={3}>{thread.title}</Text>
          <Text style={styles.excerpt} numberOfLines={3}>{thread.body}</Text>
          <View style={styles.cardFooter}>
            <UpvoteButton thread={thread} onPress={() => toggleUpvote(thread)} styles={styles} />
            <Text style={styles.readMore}>{tx("Lire ›", "Read ›")}</Text>
          </View>
        </Pressable>
      ))}

      {threads.length > COLLAPSED && (
        <Pressable style={styles.moreButton} onPress={() => setExpanded(!expanded)}>
          <Text style={styles.moreButtonText}>{expanded ? tx("Voir moins", "Show less") : tx(`Voir les ${threads.length} threads`, `See all ${threads.length} threads`)}</Text>
        </Pressable>
      )}

      <Modal visible={!!opened} transparent animationType="slide" onRequestClose={() => setOpenId(null)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpenId(null)} />
          {opened && (
            <View style={styles.sheet}>
              <View style={styles.handle} />
              <ScrollView showsVerticalScrollIndicator={false}>
                <ThreadLabel thread={opened} styles={styles} />
                <Text style={styles.sheetTitle}>{opened.title}</Text>
                <Text style={styles.byline}>{[opened.authorName, timeAgo(opened.createdAt, language)].filter(Boolean).join(" · ")}</Text>
                <Text style={styles.sheetBody}>{opened.body}</Text>
              </ScrollView>
              <View style={styles.sheetFooter}>
                <UpvoteButton thread={opened} onPress={() => toggleUpvote(opened)} styles={styles} large />
                <Pressable style={styles.closeButton} onPress={() => setOpenId(null)}><Text style={styles.closeButtonText}>{tx("Fermer", "Close")}</Text></Pressable>
              </View>
            </View>
          )}
        </View>
      </Modal>

      {userId && (
        <ComposeThread
          visible={composing}
          userId={userId}
          onClose={() => setComposing(false)}
          // A new thread has no upvote yet: it is shown first so its author sees it.
          onPosted={(thread) => {
            setThreads((current) => [thread, ...current]);
            setComposing(false);
          }}
        />
      )}
    </View>
  );
}

type Styles = ReturnType<typeof getStyles>;

function ThreadLabel({ thread, styles }: { thread: Thread; styles: Styles }) {
  const { tx } = useTranslation();
  return (
    <View style={styles.labelRow}>
      <Text style={styles.category}>{tx(...THREAD_CATEGORIES[thread.category]).toUpperCase()}</Text>
      {thread.official && <Text style={styles.official}>GRRRR ✓</Text>}
    </View>
  );
}

function UpvoteButton({ thread, onPress, styles, large }: { thread: Thread; onPress: () => void; styles: Styles; large?: boolean }) {
  return (
    <Pressable style={[styles.upvote, large && styles.upvoteLarge, thread.upvoted && styles.upvoteActive]} onPress={onPress} hitSlop={8}>
      <Text style={[styles.upvoteArrow, large && styles.upvoteArrowLarge, thread.upvoted && styles.upvoteTextActive]}>▲</Text>
      <Text style={[styles.upvoteCount, large && styles.upvoteCountLarge, thread.upvoted && styles.upvoteTextActive]}>{thread.upvotes}</Text>
    </Pressable>
  );
}

function ComposeThread({ visible, userId, onClose, onPosted }: { visible: boolean; userId: string; onClose: () => void; onPosted: (thread: Thread) => void }) {
  const colors = useThemedColors();
  const styles = getStyles(colors);
  const { tx } = useTranslation();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<ThreadCategory>("fact");
  const [animal, setAnimal] = useState<ThreadAnimal>("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ThreadError | null>(null);
  const ready = title.trim().length >= THREAD_LIMITS.titleMin && body.trim().length >= THREAD_LIMITS.bodyMin;

  const publish = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    const result = await createThread(userId, { title, body, category, animal });
    setBusy(false);
    if (!result.thread) {
      setError(result.error ?? "UNKNOWN");
      return;
    }
    setTitle("");
    setBody("");
    onPosted(result.thread);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.sheetTitle}>{tx("Nouveau thread", "New thread")}</Text>
            <Text style={styles.byline}>{tx("Une anecdote, une histoire ou un conseil à partager.", "A fact, a story or a tip to share.")}</Text>

            <TextInput style={styles.input} value={title} onChangeText={setTitle} maxLength={THREAD_LIMITS.title} placeholder={tx("Titre", "Title")} placeholderTextColor={colors.grey} />
            <TextInput style={[styles.input, styles.inputBody]} value={body} onChangeText={setBody} maxLength={THREAD_LIMITS.body} multiline textAlignVertical="top" placeholder={tx("Raconte…", "Tell us…")} placeholderTextColor={colors.grey} />
            <Text style={styles.counter}>{body.length} / {THREAD_LIMITS.body}</Text>

            <View style={styles.chips}>
              {(Object.keys(THREAD_CATEGORIES) as ThreadCategory[]).map((key) => (
                <Pressable key={key} style={[styles.chip, category === key && styles.chipActive]} onPress={() => setCategory(key)}>
                  <Text style={[styles.chipText, category === key && styles.chipTextActive]}>{tx(...THREAD_CATEGORIES[key])}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.chips}>
              {(Object.keys(THREAD_ANIMALS) as ThreadAnimal[]).map((key) => (
                <Pressable key={key} style={[styles.chip, animal === key && styles.chipActive]} onPress={() => setAnimal(key)}>
                  <Text style={[styles.chipText, animal === key && styles.chipTextActive]}>{tx(...THREAD_ANIMALS[key])}</Text>
                </Pressable>
              ))}
            </View>

            {error && (
              <Text style={styles.error}>
                {error === "DAILY_LIMIT" ? tx("Limite atteinte : 10 threads par jour.", "Limit reached: 10 threads per day.") : tx("Le thread n'a pas pu être publié. Réessaie dans un instant.", "The thread could not be posted. Try again in a moment.")}
              </Text>
            )}
          </ScrollView>
          <View style={styles.sheetFooter}>
            <Pressable style={[styles.publishButton, (!ready || busy) && styles.publishButtonOff]} onPress={publish} disabled={!ready || busy}>
              <Text style={styles.publishButtonText}>{busy ? tx("Publication…", "Posting…") : tx("Publier", "Post")}</Text>
            </Pressable>
            <Pressable style={styles.closeButton} onPress={onClose}><Text style={styles.closeButtonText}>{tx("Annuler", "Cancel")}</Text></Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function getStyles(colors: ReturnType<typeof useThemedColors>) {
  return StyleSheet.create({
    titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 9 },
    columnTitle: { fontFamily: fonts.displaySemi, fontSize: 16, color: colors.dark },
    postButton: { backgroundColor: colors.coral, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 5 },
    postButtonText: { fontFamily: fonts.bodyBold, fontSize: 10, color: "#FFFFFF" },
    hint: { fontFamily: fonts.bodyMedium, fontSize: 10, lineHeight: 14, color: colors.coralDark, marginBottom: 8 },
    card: { backgroundColor: colors.white, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, padding: 12, marginBottom: 10 },
    labelRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
    category: { fontFamily: fonts.bodyBold, fontSize: 8, letterSpacing: 0.8, color: colors.friend },
    official: { fontFamily: fonts.bodyBold, fontSize: 8, letterSpacing: 0.5, color: colors.coralDark, backgroundColor: colors.cream2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.pill, overflow: "hidden" },
    cardTitle: { fontFamily: fonts.displaySemi, fontSize: 15, lineHeight: 18, color: colors.dark, marginTop: 4 },
    excerpt: { fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.grey, marginTop: 4 },
    cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 9 },
    readMore: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.coralDark },
    upvote: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.cream2 },
    upvoteLarge: { paddingHorizontal: 16, paddingVertical: 10 },
    upvoteActive: { backgroundColor: colors.coral, borderColor: colors.coral },
    upvoteArrow: { fontSize: 10, color: colors.coralDark },
    upvoteArrowLarge: { fontSize: 14 },
    upvoteCount: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.dark },
    upvoteCountLarge: { fontSize: 14 },
    upvoteTextActive: { color: "#FFFFFF" },
    moreButton: { alignItems: "center", paddingVertical: 9, borderRadius: radii.pill, backgroundColor: colors.cream2, borderWidth: 1, borderColor: colors.line, marginBottom: 10 },
    moreButtonText: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.coralDark },
    overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(43,39,36,0.48)" },
    sheet: { maxHeight: "86%", backgroundColor: colors.cream, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 22 },
    handle: { alignSelf: "center", width: 42, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: 14 },
    sheetTitle: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26, color: colors.dark, marginTop: 6 },
    byline: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.grey, marginTop: 4 },
    sheetBody: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22, color: colors.dark, marginTop: 14, marginBottom: 8 },
    sheetFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 14 },
    closeButton: { paddingHorizontal: 14, paddingVertical: 10 },
    closeButtonText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.grey },
    input: { borderWidth: 1, borderColor: colors.line, borderRadius: radii.sm, paddingHorizontal: 14, paddingVertical: 11, fontFamily: fonts.body, fontSize: 14, backgroundColor: colors.white, color: colors.dark, marginTop: 14 },
    inputBody: { minHeight: 130 },
    counter: { alignSelf: "flex-end", fontFamily: fonts.body, fontSize: 10, color: colors.grey, marginTop: 4 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 10 },
    chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
    chipActive: { backgroundColor: colors.coral, borderColor: colors.coral },
    chipText: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.dark },
    chipTextActive: { color: "#FFFFFF" },
    error: { fontFamily: fonts.bodySemi, fontSize: 12, lineHeight: 17, color: colors.coralDark, marginTop: 12 },
    publishButton: { flex: 1, alignItems: "center", borderRadius: radii.pill, paddingVertical: 13, backgroundColor: colors.coral },
    publishButtonOff: { opacity: 0.45 },
    publishButtonText: { fontFamily: fonts.bodyBold, fontSize: 13, color: "#FFFFFF" },
  });
}
