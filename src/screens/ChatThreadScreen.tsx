import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
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
import { useTranslation } from "@/i18n/useTranslation";
import PetProfileSheet from "@/components/PetProfileSheet";
import { useNotifications } from "@/context/NotificationsContext";
import { AdoptionError, closeLitter, getLitter, Litter, proposeLitter, respondToLitter } from "@/data/api/adoption";
import { refreshPetProgress } from "@/data/api/progress";
import { answerMeeting, cancelMeeting, formatMeetingTime, getLatestMeeting, isLiveMeeting, MeetingError, MeetingProposal } from "@/data/api/meetings";
import MeetingComposer from "@/components/MeetingComposer";

const ADOPT = "#FFB35C";

export default function ChatThreadScreen() {
  const colors = useThemedColors();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { activePet, chats, sendMessage, markChatRead, refreshConversations, meetingTraces } = useAppState();
  const [text, setText] = useState("");
  const styles = getStyles(colors);
  const { tx, language } = useTranslation();
  const listRef = useRef<FlatList>(null);

  const petId = route.params?.petId;
  const chat = chats.find((c) => c.pet.id === petId);

  const [isCondensed, setIsCondensed] = useState(true);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    if (petId !== undefined) markChatRead(petId);
  }, [markChatRead, petId]);

  // Opening the conversation also reads its message notifications (and the new ones that arrive).
  const { markReadFrom } = useNotifications();
  const chatPetDbId = chat?.pet.dbId;
  const messageCount = chat?.messages.length ?? 0;
  useEffect(() => {
    markReadFrom(chatPetDbId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatPetDbId, messageCount]);

  // The relation between the two pets: babies to entrust to adopters (migration 012).
  // Its steps are chat messages, so it is read again whenever one arrives.
  const [litter, setLitter] = useState<Litter | null>(null);
  const [relationOpen, setRelationOpen] = useState(false);
  const [relationBusy, setRelationBusy] = useState(false);
  const [relationError, setRelationError] = useState<AdoptionError | null>(null);
  const myDbId = activePet.dbId;
  useEffect(() => {
    let active = true;
    getLitter(myDbId, chatPetDbId).then((result) => active && setLitter(result));
    return () => {
      active = false;
    };
  }, [chatPetDbId, messageCount, myDbId]);

  // The outing shared by both owners (migration 017). Its steps are 📍 chat messages too.
  const [meeting, setMeeting] = useState<MeetingProposal | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [meetingBusy, setMeetingBusy] = useState(false);
  const [meetingError, setMeetingError] = useState<MeetingError | null>(null);
  useEffect(() => {
    let active = true;
    getLatestMeeting(myDbId, chatPetDbId).then((result) => active && setMeeting(result));
    return () => {
      active = false;
    };
  }, [chatPetDbId, messageCount, myDbId]);

  if (!chat) return null;

  const meetingLive = isLiveMeeting(meeting);
  const meetingMine = meeting?.proposerPetId === myDbId;
  // Only the owner who received the proposal answers it.
  const mustAnswer = meetingLive && meeting.status === "pending" && !meetingMine;
  const runMeeting = async (action: () => Promise<{ proposal: MeetingProposal | null; error: MeetingError | null }>) => {
    if (meetingBusy) return;
    setMeetingBusy(true);
    setMeetingError(null);
    const result = await action();
    setMeetingBusy(false);
    if (result.error) {
      setMeetingError(result.error);
      return;
    }
    if (result.proposal) setMeeting(result.proposal);
    void refreshConversations();
  };
  const openMap = () => navigation.navigate("MainTabs", { screen: "Explore" });
  // Demo chats (signed out) keep the outing on this phone only.
  const localTrace = !chatPetDbId ? meetingTraces[petId] : undefined;
  const meetingStatusText = meetingLive
    ? meeting.status === "accepted"
      ? tx(`Confirmée · ${formatMeetingTime(meeting.scheduledAt, language)}`, `Confirmed · ${formatMeetingTime(meeting.scheduledAt, language)}`)
      : meetingMine
        ? tx(`${formatMeetingTime(meeting.scheduledAt, language)} · en attente de ${chat.pet.name}`, `${formatMeetingTime(meeting.scheduledAt, language)} · waiting for ${chat.pet.name}`)
        : tx(`${chat.pet.name} propose le ${formatMeetingTime(meeting.scheduledAt, language)}`, `${chat.pet.name} suggests ${formatMeetingTime(meeting.scheduledAt, language)}`)
    : null;

  const relationLive = litter?.status === "pending" || litter?.status === "accepted";
  const relationMine = litter?.proposerPetId === myDbId;
  const runRelation = async (action: () => Promise<{ litter: Litter | null; error: AdoptionError | null }>, closeAfter = true) => {
    if (relationBusy) return;
    setRelationBusy(true);
    setRelationError(null);
    const result = await action();
    setRelationBusy(false);
    if (result.error) {
      setRelationError(result.error);
      setRelationOpen(true);
      return;
    }
    setLitter(result.litter);
    if (closeAfter) setRelationOpen(false);
    // The database wrote the relation message in this conversation.
    void refreshConversations();
    // A listed litter earns XP (migration 013).
    if (myDbId) void refreshPetProgress(myDbId, false);
  };
  const openRelation = () => {
    setRelationError(null);
    setRelationOpen(true);
  };
  const openAdopt = () => {
    setRelationOpen(false);
    navigation.navigate("Adopt");
  };
  const relationErrorText = relationError === "DIFFERENT_SPECIES"
    ? tx(`${activePet.name} et ${chat.pet.name} ne sont pas de la même espèce.`, `${activePet.name} and ${chat.pet.name} are not the same species.`)
    : relationError === "SAME_GENDER"
      ? tx("Il faut un mâle et une femelle : vérifie le sexe indiqué sur les deux profils.", "It takes a male and a female: check the gender on both profiles.")
      : relationError === "NOT_MATCHED"
        ? tx("La relation se propose entre deux compagnons qui ont matché.", "A relationship is proposed between two companions who matched.")
        : relationError
          ? tx("Impossible pour le moment. Réessaie dans un instant.", "Not possible right now. Try again in a moment.")
          : null;

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
        <Pressable style={styles.profileLink} onPress={() => setShowProfile(true)}>
          <Image source={{ uri: chat.pet.photo }} style={styles.avatar} />
          <View>
            <Text style={styles.name}>{chat.pet.name}</Text>
            <Text style={styles.profileHint}>{tx("Voir le profil", "View profile")}</Text>
          </View>
        </Pressable>
        <View style={styles.headActions}>
          <Pressable style={[styles.locationButton, relationLive && styles.relationButtonActive]} onPress={openRelation}>
            <Text style={styles.relationIcon}>💞</Text>
          </Pressable>
          <Pressable style={[styles.locationButton, meetingLive && styles.meetingButtonActive]} onPress={() => setComposerOpen(true)}>
            <Text style={styles.relationIcon}>📍</Text>
          </Pressable>
        </View>
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
              {/* The outing, at the top of the conversation: the one who received it answers here */}
              {meetingLive ? (
                <View style={[styles.organizedHeroCard, mustAnswer && styles.organizedHeroCardToAnswer]}>
                  <Image source={meeting.marker === "pink" ? require("../../assets/pink_clic.png") : require("../../assets/bleue_clic.png")} style={styles.organizedHeroPaw} />
                  <View style={styles.organizedHeroCopy}>
                    <View style={styles.organizedHeroRow}>
                      <Text style={styles.organizedHeroTitle}>{meeting.marker === "pink" ? tx("Rendez-vous Hot ❤️", "Hot date ❤️") : tx("Sortie Friend 🐾", "Friend outing 🐾")}</Text>
                      <View style={[styles.statusTag, meeting.status === "accepted" ? styles.statusTagConfirmed : styles.statusTagPending]}>
                        <Text style={styles.statusTagText}>{meeting.status === "accepted" ? tx("Confirmée ✅", "Confirmed ✅") : mustAnswer ? tx("À toi de répondre", "Your answer") : tx("En attente ⏳", "Pending ⏳")}</Text>
                      </View>
                    </View>
                    <Text style={styles.organizedHeroDate}>{formatMeetingTime(meeting.scheduledAt, language, true)}</Text>
                    <Text style={styles.organizedHeroSub}>
                      {meeting.status === "accepted"
                        ? tx(`Rendez-vous validé entre ${activePet.name} et ${chat.pet.name} !`, `Meetup confirmed between ${activePet.name} and ${chat.pet.name}!`)
                        : mustAnswer
                          ? tx(`${chat.pet.name} te propose cette sortie. Tu acceptes ?`, `${chat.pet.name} suggests this outing. Do you accept?`)
                          : tx(`Proposition envoyée : ${chat.pet.name} doit accepter ou refuser.`, `Proposal sent: ${chat.pet.name} has to accept or decline.`)}
                    </Text>
                  </View>
                  <View style={styles.heroActions}>
                    {mustAnswer ? (
                      <>
                        <Pressable style={styles.heroAccept} disabled={meetingBusy} onPress={() => runMeeting(() => answerMeeting(meeting.id, true))}>
                          <Text style={styles.heroAcceptText}>{tx("Accepter", "Accept")}</Text>
                        </Pressable>
                        <Pressable style={styles.heroMapBtn} disabled={meetingBusy} onPress={() => runMeeting(() => answerMeeting(meeting.id, false))}>
                          <Text style={styles.heroMapBtnText}>{tx("Refuser", "Decline")}</Text>
                        </Pressable>
                      </>
                    ) : (
                      <Pressable style={styles.heroMapBtn} disabled={meetingBusy} onPress={() => runMeeting(() => cancelMeeting(meeting.id))}>
                        <Text style={styles.heroMapBtnText}>{meetingMine && meeting.status === "pending" ? tx("Annuler", "Cancel") : tx("Annuler la sortie", "Cancel the outing")}</Text>
                      </Pressable>
                    )}
                    <Pressable style={styles.heroMapBtn} onPress={openMap}>
                      <Text style={styles.heroMapBtnText}>📍 {tx("Voir sur la carte", "See on the map")}</Text>
                    </Pressable>
                  </View>
                  {meetingError && <Text style={styles.meetingErrorText}>{meetingError === "NOT_RECIPIENT" ? tx("C'est à l'autre propriétaire de répondre.", "It's up to the other owner to answer.") : tx("Impossible pour le moment. Réessaie dans un instant.", "Not possible right now. Try again in a moment.")}</Text>}
                </View>
              ) : null}

              {/* Bar de condensation intelligente des messages */}
              {chat.messages.length > 3 && (
                <Pressable style={styles.condenseBar} onPress={() => setIsCondensed(!isCondensed)}>
                  <Text style={styles.condenseText}>
                    💬 {isCondensed ? tx(`${hiddenCount} anciens messages condensés — Touchez pour déplier`, `${hiddenCount} older messages hidden — Tap to expand`) : tx("Masquer les anciens messages", "Hide older messages")} {isCondensed ? "▼" : "▲"}
                  </Text>
                </Pressable>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <Bubble
              message={item}
              onOpenMap={() => navigation.navigate("MainTabs", { screen: "Explore" })}
              onOpenRelation={openRelation}
              styles={styles}
            />
          )}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />

        {relationLive && litter && (
          <Pressable style={styles.relationBar} onPress={openRelation}>
            <View style={styles.meetingIcon}><Text style={styles.relationIcon}>💞</Text></View>
            <View style={styles.meetingCopy}>
              <Text style={styles.meetingTitle}>{litter.status === "accepted" ? tx("Relation acceptée", "Relationship accepted") : relationMine ? tx("Relation proposée", "Relationship proposed") : tx(`${chat.pet.name} propose une relation`, `${chat.pet.name} proposes a relationship`)}</Text>
              <Text style={styles.meetingText}>{litter.status === "accepted" ? tx("Leurs futurs bébés sont proposés dans Adopt.", "Their future babies are listed in Adopt.") : relationMine ? tx(`En attente de la réponse de ${chat.pet.name}.`, `Waiting for ${chat.pet.name}'s answer.`) : tx("Des bébés à confier à l'adoption.", "Babies to entrust to adopters.")}</Text>
            </View>
            {litter.status === "pending" && !relationMine ? (
              <View style={styles.meetingActions}>
                <Pressable style={styles.relationAccept} onPress={() => runRelation(() => respondToLitter(litter.id, true))}>
                  <Text style={styles.acceptText}>{tx("Accepter", "Accept")}</Text>
                </Pressable>
                <Pressable style={styles.rejectButton} onPress={() => runRelation(() => respondToLitter(litter.id, false))}>
                  <Text style={styles.relationReject}>{tx("Refuser", "Decline")}</Text>
                </Pressable>
              </View>
            ) : litter.status === "accepted" ? (
              <Pressable style={styles.relationAccept} onPress={openAdopt}>
                <Text style={styles.acceptText}>{tx("Voir Adopt", "See Adopt")}</Text>
              </Pressable>
            ) : (
              <Text style={styles.relationWaiting}>⏳</Text>
            )}
          </Pressable>
        )}

        <View style={styles.meetingRequest}>
          <View style={styles.meetingIcon}><Text style={styles.meetingIconText}>⌖</Text></View>
          <View style={styles.meetingCopy}>
            <Text style={styles.meetingTitle}>
              {meetingLive ? (meeting.status === "accepted" ? tx("Sortie confirmée", "Outing confirmed") : mustAnswer ? tx("Sortie à accepter", "Outing to answer") : tx("Sortie proposée", "Outing proposed")) : localTrace ? tx("Sortie enregistrée", "Outing saved") : tx("Une sortie à organiser", "An outing to plan")}
            </Text>
            <Text style={styles.meetingText} numberOfLines={2}>{meetingStatusText ?? tx("Choisis le lieu, le jour et l'heure : l'autre accepte ou refuse.", "Pick the spot, the day and the time: the other one accepts or declines.")}</Text>
          </View>
          {mustAnswer ? (
            <View style={styles.meetingActions}>
              <Pressable style={styles.acceptButton} disabled={meetingBusy} onPress={() => runMeeting(() => answerMeeting(meeting.id, true))}>
                <Text style={styles.acceptText}>{tx("Accepter", "Accept")}</Text>
              </Pressable>
              <Pressable style={styles.rejectButton} disabled={meetingBusy} onPress={() => runMeeting(() => answerMeeting(meeting.id, false))}>
                <Text style={styles.rejectText}>{tx("Refuser", "Decline")}</Text>
              </Pressable>
            </View>
          ) : meetingLive ? (
            <Pressable style={styles.proposeButton} onPress={openMap}>
              <Text style={styles.proposeText}>{tx("Carte", "Map")}</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.proposeButton} onPress={() => setComposerOpen(true)}>
              <Text style={styles.proposeText}>{tx("Proposer", "Propose")}</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder={tx("Écrire un message...", "Write a message...")}
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

      <PetProfileSheet pet={showProfile ? chat.pet : null} onClose={() => setShowProfile(false)} />
      <MeetingComposer
        pet={composerOpen ? chat.pet : null}
        initialMarker={meetingLive ? meeting.marker : undefined}
        onClose={() => setComposerOpen(false)}
        onSent={(proposal) => {
          setComposerOpen(false);
          if (proposal) setMeeting(proposal);
        }}
      />

      <Modal visible={relationOpen} transparent animationType="fade" onRequestClose={() => setRelationOpen(false)}>
        <View style={styles.relationOverlay}>
          <View style={styles.relationCard}>
            <View style={styles.relationAvatars}>
              <Image source={{ uri: activePet.photo }} style={styles.relationAvatar} />
              <Image source={{ uri: chat.pet.photo }} style={[styles.relationAvatar, styles.relationAvatarSecond]} />
            </View>
            <Text style={styles.relationTitle}>💞 {activePet.name} × {chat.pet.name}</Text>
            {!myDbId || !chatPetDbId ? (
              <Text style={styles.relationText}>{tx("La relation est disponible entre deux comptes GRRRR connectés.", "Relationships are available between two signed-in GRRRR accounts.")}</Text>
            ) : litter?.status === "accepted" ? (
              <>
                <Text style={styles.relationText}>{tx("Relation acceptée. Leurs futurs bébés sont proposés dans Adopt : les familles intéressées vous écrivent à tous les deux dans Messages.", "Relationship accepted. Their future babies are listed in Adopt: interested families message both of you in Messages.")}</Text>
                <Pressable style={styles.relationPrimary} onPress={openAdopt}><Text style={styles.relationPrimaryText}>{tx("Voir Adopt", "See Adopt")}</Text></Pressable>
                <Pressable style={styles.relationSecondary} disabled={relationBusy} onPress={() => runRelation(() => closeLitter(litter.id))}><Text style={styles.relationSecondaryText}>{tx("Retirer l'annonce", "Remove the listing")}</Text></Pressable>
              </>
            ) : litter?.status === "pending" && relationMine ? (
              <>
                <Text style={styles.relationText}>{tx(`Proposition envoyée. Dès que ${chat.pet.name} accepte, leurs futurs bébés sont proposés dans Adopt.`, `Proposal sent. As soon as ${chat.pet.name} accepts, their future babies are listed in Adopt.`)}</Text>
                <Pressable style={styles.relationSecondary} disabled={relationBusy} onPress={() => runRelation(() => closeLitter(litter.id))}><Text style={styles.relationSecondaryText}>{tx("Annuler la proposition", "Cancel the proposal")}</Text></Pressable>
              </>
            ) : litter?.status === "pending" ? (
              <>
                <Text style={styles.relationText}>{tx(`${chat.pet.name} propose que ${activePet.name} et ${chat.pet.name} aient des bébés, à confier à des familles qui veulent adopter. En acceptant, leur annonce apparaît dans Adopt.`, `${chat.pet.name} suggests that ${activePet.name} and ${chat.pet.name} have babies, to entrust to families who want to adopt. If you accept, their listing appears in Adopt.`)}</Text>
                <Pressable style={styles.relationPrimary} disabled={relationBusy} onPress={() => runRelation(() => respondToLitter(litter.id, true))}><Text style={styles.relationPrimaryText}>{tx("Accepter la relation", "Accept the relationship")}</Text></Pressable>
                <Pressable style={styles.relationSecondary} disabled={relationBusy} onPress={() => runRelation(() => respondToLitter(litter.id, false))}><Text style={styles.relationSecondaryText}>{tx("Refuser", "Decline")}</Text></Pressable>
              </>
            ) : (
              <>
                <Text style={styles.relationText}>{tx(`Propose à ${chat.pet.name} d'avoir des bébés avec ${activePet.name}, à confier à des familles qui veulent adopter. Si ${chat.pet.name} accepte, leur annonce apparaît dans Adopt.`, `Suggest that ${chat.pet.name} has babies with ${activePet.name}, to entrust to families who want to adopt. If ${chat.pet.name} accepts, their listing appears in Adopt.`)}</Text>
                <Pressable style={styles.relationPrimary} disabled={relationBusy} onPress={() => runRelation(() => proposeLitter(myDbId, chatPetDbId), false)}><Text style={styles.relationPrimaryText}>{tx("Proposer la relation", "Propose the relationship")}</Text></Pressable>
              </>
            )}
            {!!relationErrorText && <Text style={styles.relationErrorText}>{relationErrorText}</Text>}
            <Pressable style={styles.relationSecondary} onPress={() => setRelationOpen(false)}><Text style={styles.relationCloseText}>{tx("Fermer", "Close")}</Text></Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Bubble({ message, onOpenMap, onOpenRelation, styles }: { message: ChatMessage; onOpenMap: () => void; onOpenRelation: () => void; styles: ReturnType<typeof getStyles> }) {
  const mine = message.from === "me";
  const { tx } = useTranslation();
  // Outing steps (📍 written by the database) and older local ones.
  const isOrganized = message.text.startsWith("📍") || message.text.includes("Sortie organisée");

  // Written by the database: a step of the relation (💞) or an adoption request (🍼).
  if (message.text.startsWith("💞")) {
    return (
      <Pressable style={styles.relationMsgCard} onPress={onOpenRelation}>
        <Text style={styles.relationMsgTitle}>GRRRR — {tx("Relation", "Relationship")}</Text>
        <Text style={styles.organizedMsgText}>{message.text}</Text>
      </Pressable>
    );
  }
  if (message.text.startsWith("🍼")) {
    return (
      <View style={styles.relationMsgCard}>
        <Text style={styles.relationMsgTitle}>GRRRR ADOPT — {message.text.startsWith("🍼 Achat") ? tx("Demande d'achat", "Purchase request") : tx("Demande d'adoption", "Adoption request")}</Text>
        <Text style={[styles.organizedMsgText, { marginBottom: 0 }]}>{message.text}</Text>
      </View>
    );
  }

  if (isOrganized) {
    return (
      <View style={styles.organizedMsgCard}>
        <Text style={styles.organizedMsgTitle}>🐾 GRRRR — {tx("Sortie Organisée", "Planned outing")}</Text>
        <Text style={styles.organizedMsgText}>{message.text}</Text>
        <Pressable style={styles.organizedMsgBtn} onPress={onOpenMap}>
          <Text style={styles.organizedMsgBtnText}>📍 {tx("Voir le lieu sur la carte", "See the spot on the map")}</Text>
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
    profileLink: { flexDirection: "row", alignItems: "center", gap: 10 },
    profileHint: { fontFamily: fonts.body, fontSize: 10, color: colors.grey },
    headActions: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 8 },
    locationButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.cream2, alignItems: "center", justifyContent: "center" },
    locationIcon: { color: colors.coralDark, fontSize: 20 },
    relationButtonActive: { backgroundColor: "rgba(255,179,92,0.3)", borderWidth: 1, borderColor: ADOPT },
    relationIcon: { fontSize: 16 },
    relationBar: { marginHorizontal: 16, marginBottom: 8, padding: 11, borderRadius: radii.md, backgroundColor: "rgba(255,179,92,0.16)", borderWidth: 1, borderColor: "rgba(255,179,92,0.55)", flexDirection: "row", alignItems: "center", gap: 9 },
    relationAccept: { backgroundColor: ADOPT, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 7 },
    relationReject: { color: colors.grey, fontFamily: fonts.bodySemi, fontSize: 10 },
    relationWaiting: { fontSize: 16 },
    relationMsgCard: { backgroundColor: "rgba(255,179,92,0.16)", borderRadius: radii.md, borderWidth: 1, borderColor: ADOPT, padding: 12, marginVertical: 4 },
    relationMsgTitle: { fontFamily: fonts.bodyBold, fontSize: 11, color: "#C97A1E", marginBottom: 4 },
    relationOverlay: { flex: 1, alignItems: "center", justifyContent: "center", padding: 22, backgroundColor: "rgba(43,39,36,0.48)" },
    relationCard: { width: "100%", maxWidth: 350, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.cream, padding: 20, alignItems: "center" },
    relationAvatars: { flexDirection: "row", alignItems: "center" },
    relationAvatar: { width: 62, height: 62, borderRadius: 31, borderWidth: 3, borderColor: ADOPT, backgroundColor: colors.line },
    relationAvatarSecond: { marginLeft: -16 },
    relationTitle: { fontFamily: fonts.displaySemi, fontSize: 20, color: colors.dark, textAlign: "center", marginTop: 10 },
    relationText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.grey, textAlign: "center", marginTop: 8, marginBottom: 16 },
    relationPrimary: { alignSelf: "stretch", alignItems: "center", borderRadius: radii.pill, paddingVertical: 13, backgroundColor: ADOPT },
    relationPrimaryText: { fontFamily: fonts.bodyBold, fontSize: 13, color: "#FFFFFF" },
    relationSecondary: { alignItems: "center", paddingVertical: 11 },
    relationSecondaryText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.coralDark },
    relationCloseText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.grey },
    relationErrorText: { fontFamily: fonts.bodySemi, fontSize: 12, lineHeight: 17, color: colors.coralDark, textAlign: "center", marginTop: 4 },
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
    organizedHeroCardToAnswer: { borderWidth: 2, backgroundColor: colors.cream2 },
    organizedHeroDate: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.dark, marginTop: 4 },
    heroActions: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
    heroAccept: { backgroundColor: colors.coral, borderRadius: radii.pill, paddingVertical: 7, paddingHorizontal: 14 },
    heroAcceptText: { fontFamily: fonts.bodyBold, fontSize: 11, color: "#FFFFFF" },
    meetingErrorText: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.coralDark },
    meetingButtonActive: { backgroundColor: "rgba(255,93,115,0.18)", borderWidth: 1, borderColor: colors.coral },
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
