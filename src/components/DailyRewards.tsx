import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { fonts, radii } from "@/theme/theme";
import { useAuth } from "@/context/AuthContext";
import { useAppState } from "@/context/AppState";
import { useTranslation } from "@/i18n/useTranslation";
import { claimDailyReward, DailyReward, DailyStreak, getDailyStreak, weekFor } from "@/data/api/rewards";

// The daily gifts: a chain button in the header (next to the notifications) opens the week's
// chain, in Adopt's look (white glass on a warm orange). One gift a day; a missed day starts
// again at day 1; the gifts grow until day 7, a month of GRRR Care's AI assistant.
const ORANGE = "#FFB35C";
const ORANGE_DARK = "#C97A1E";
const INK = "#3A2A18";
const INK_SOFT = "#8A6F54";
const GLASS = "rgba(255,255,255,0.62)";
const GLASS_BORDER = "rgba(255,255,255,0.92)";
const CARE_AI_LOGO = require("../../assets/rewards/care-ai-month.png");

type Tx = (fr: string, en: string) => string;

function rewardLabel(reward: DailyReward, tx: Tx) {
  if (reward.kind === "treats") return tx(`${reward.amount} croquette${reward.amount > 1 ? "s" : ""}`, `${reward.amount} treat${reward.amount > 1 ? "s" : ""}`);
  if (reward.kind === "voucher") return tx("Cadeau boutique", "Shop gift");
  return tx("1 mois IA Care", "1 month Care AI");
}

function RewardIcon({ reward, size }: { reward: DailyReward; size: number }) {
  if (reward.kind === "care_ai") return <Image source={CARE_AI_LOGO} style={{ width: size * 1.5, height: size * 1.5 }} resizeMode="contain" />;
  return <Text style={{ fontSize: size }}>{reward.kind === "voucher" ? "🎁" : "🦴"}</Text>;
}

export default function DailyRewards() {
  const { session } = useAuth();
  const { activePet, refreshTreats } = useAppState();
  const { tx, language } = useTranslation();
  const [streak, setStreak] = useState<DailyStreak | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [won, setWon] = useState<(DailyReward & { day: number }) | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    if (!session?.user.id) return;
    void getDailyStreak().then(setStreak);
  }, [session?.user.id]);
  useFocusEffect(load);

  // The button breathes while today's gift waits.
  const pulse = useRef(new Animated.Value(1)).current;
  const claimable = Boolean(streak && !streak.claimedToday);
  useEffect(() => {
    if (!claimable) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.12, duration: 650, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [claimable, pulse]);

  if (!session?.user.id) return null;

  const claim = async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    const result = await claimDailyReward(activePet.dbId);
    setBusy(false);
    if (result.reward) {
      setWon(result.reward);
      if (result.reward.kind === "treats") refreshTreats();
    } else if (result.error !== "ALREADY_CLAIMED") {
      setFailed(true);
    }
    load();
  };

  const day = streak?.day ?? 1;
  const week = weekFor(streak?.aiMonthUsed);
  const done = streak?.done ?? 0;
  const careUntil = streak?.careAiUntil && new Date(streak.careAiUntil).getTime() > Date.now() ? new Date(streak.careAiUntil) : null;

  return (
    <>
      <Animated.View style={{ transform: [{ scale: claimable ? pulse : 1 }] }}>
        <Pressable style={[styles.button, claimable && styles.buttonReady]} onPress={() => { setWon(null); setOpen(true); }} hitSlop={4}>
          <Text style={styles.buttonIcon}>🔗</Text>
          {streak && <Text style={styles.buttonDay}>{streak.claimedToday ? day : done}</Text>}
          {claimable && <View style={styles.buttonDot} />}
        </Pressable>
      </Animated.View>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <LinearGradient colors={["#FFFFFF", "#FFF1DD", ORANGE]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
            <View style={[styles.glow, styles.glowTop]} />
            <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
              <View style={styles.handle} />
              <Text style={styles.eyebrow}>GRRRR · {tx("CADEAUX DU JOUR", "DAILY GIFTS")}</Text>
              <Text style={styles.title}>{tx("Ta chaîne de la semaine", "Your week's chain")}</Text>
              <Text style={styles.subtitle}>{tx("Un cadeau par jour, de plus en plus gros. Rate un jour et la chaîne reprend au jour 1.", "One gift a day, bigger and bigger. Miss a day and the chain starts again at day 1.")}</Text>

              {/* The chain: 7 links, done / today / to come */}
              <View style={styles.chain}>
                {week.map((reward, index) => {
                  const n = index + 1;
                  const isDone = n <= done;
                  const isToday = !streak?.claimedToday && n === day;
                  const big = n === 7;
                  return (
                    <View key={n} style={[styles.linkWrap, big && styles.linkWrapBig]}>
                      {index > 0 && index !== 4 && <View style={[styles.connector, n <= done + (isToday ? 1 : 0) && styles.connectorDone]} />}
                      <View style={[styles.link, big && styles.linkBig, isDone && styles.linkDone, isToday && styles.linkToday]}>
                        <RewardIcon reward={reward} size={big ? 26 : 20} />
                        {isDone && <Text style={styles.check}>✓</Text>}
                      </View>
                      <Text style={[styles.linkDay, isToday && styles.linkDayToday]}>{tx(`Jour ${n}`, `Day ${n}`)}</Text>
                      <Text style={styles.linkLabel} numberOfLines={2}>{rewardLabel(reward, tx)}</Text>
                    </View>
                  );
                })}
              </View>

              {won ? (
                <View style={styles.wonCard}>
                  <View style={styles.wonIcon}><RewardIcon reward={won} size={34} /></View>
                  <Text style={styles.wonTitle}>{tx(`Jour ${won.day} récupéré ! 🎉`, `Day ${won.day} collected! 🎉`)}</Text>
                  <Text style={styles.wonText}>
                    {won.kind === "treats"
                      ? tx(`+${won.amount} croquette${won.amount > 1 ? "s" : ""} pour ${won.petName ?? activePet.name}.`, `+${won.amount} treat${won.amount > 1 ? "s" : ""} for ${won.petName ?? activePet.name}.`)
                      : won.kind === "voucher"
                        ? tx("Ton bon cadeau pour la boutique GRRRR (garde-le précieusement) :", "Your GRRRR Shop gift voucher (keep it safe):")
                        : tx(`L'assistant IA de GRRR Care est illimité jusqu'au ${won.until ? new Date(won.until).toLocaleDateString("fr-FR", { day: "numeric", month: "long" }) : "mois prochain"}.`, `GRRR Care's AI assistant is unlimited until ${won.until ? new Date(won.until).toLocaleDateString("en-GB", { day: "numeric", month: "long" }) : "next month"}.`)}
                  </Text>
                  {won.kind === "voucher" && won.code && <Text selectable style={styles.code}>{won.code}</Text>}
                  <Text style={styles.wonNext}>{tx("Reviens demain pour le suivant 🔗", "Come back tomorrow for the next one 🔗")}</Text>
                </View>
              ) : streak?.claimedToday ? (
                <View style={styles.wonCard}>
                  <Text style={styles.wonTitle}>{tx("Cadeau du jour récupéré ✓", "Today's gift collected ✓")}</Text>
                  <Text style={styles.wonText}>{day >= 7 ? tx("Semaine complète ! Demain, une nouvelle chaîne commence.", "Week complete! A new chain starts tomorrow.") : tx(`Demain : ${rewardLabel(week[day], tx)}. Ne casse pas la chaîne !`, `Tomorrow: ${rewardLabel(week[day], tx)}. Don't break the chain!`)}</Text>
                </View>
              ) : (
                <Pressable style={[styles.claim, busy && styles.claimBusy]} onPress={claim} disabled={busy || !streak}>
                  <Text style={styles.claimText}>{busy ? tx("Ouverture…", "Opening…") : tx(`Récupérer le cadeau du jour ${day}`, `Collect day ${day}'s gift`)}</Text>
                </Pressable>
              )}
              {failed && <Text style={styles.error}>{tx("Le cadeau n'a pas pu être récupéré. Réessaie dans un instant.", "The gift could not be collected. Try again in a moment.")}</Text>}

              {careUntil && (
                <View style={styles.careBadge}>
                  <Image source={CARE_AI_LOGO} style={styles.careLogo} resizeMode="contain" />
                  <Text style={styles.careText}>{tx(`IA GRRR Care illimitée jusqu'au ${careUntil.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`, `Unlimited GRRR Care AI until ${careUntil.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}`)}</Text>
                </View>
              )}
              <Text style={styles.footnote}>{tx(`Meilleure série : ${streak?.best ?? 0} jour${(streak?.best ?? 0) > 1 ? "s" : ""} · aussi dans GRRR Care`, `Best streak: ${streak?.best ?? 0} day${(streak?.best ?? 0) > 1 ? "s" : ""} · also in GRRR Care`)}</Text>
              <Pressable style={styles.close} onPress={() => setOpen(false)}><Text style={styles.closeText}>{tx("Fermer", "Close")}</Text></Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.9)", borderWidth: 1.5, borderColor: "rgba(255,179,92,0.6)", alignItems: "center", justifyContent: "center" },
  buttonReady: { backgroundColor: ORANGE, borderColor: "#FFFFFF", shadowColor: ORANGE_DARK, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  buttonIcon: { fontSize: 15 },
  buttonDay: { position: "absolute", bottom: -4, right: -4, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: ORANGE_DARK, color: "#FFFFFF", fontFamily: fonts.bodyBold, fontSize: 10, textAlign: "center", lineHeight: 17, overflow: "hidden" },
  buttonDot: { position: "absolute", top: -2, right: -2, width: 11, height: 11, borderRadius: 6, backgroundColor: "#FF5D73", borderWidth: 2, borderColor: "#FFFFFF" },
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(43,39,36,0.45)" },
  sheet: { maxHeight: "90%", borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: "hidden" },
  sheetContent: { paddingHorizontal: 20, paddingBottom: 26, paddingTop: 10 },
  glow: { position: "absolute", borderRadius: 999, backgroundColor: ORANGE },
  glowTop: { width: 240, height: 240, top: -80, right: -70, opacity: 0.3 },
  handle: { alignSelf: "center", width: 42, height: 4, borderRadius: 2, backgroundColor: "rgba(201,122,30,0.35)", marginBottom: 14 },
  eyebrow: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1.2, color: ORANGE_DARK },
  title: { fontFamily: fonts.display, fontSize: 24, color: INK, marginTop: 2 },
  subtitle: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: INK_SOFT, marginTop: 4 },
  chain: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", rowGap: 14, marginTop: 18, padding: 12, borderRadius: 24, backgroundColor: GLASS, borderWidth: 1.5, borderColor: GLASS_BORDER },
  linkWrap: { width: "25%", alignItems: "center" },
  linkWrapBig: { width: "50%" },
  connector: { position: "absolute", top: 26, right: "62%", width: "76%", height: 4, borderRadius: 2, backgroundColor: "rgba(201,122,30,0.18)" },
  connectorDone: { backgroundColor: ORANGE },
  link: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.75)", borderWidth: 2, borderColor: "rgba(255,179,92,0.45)" },
  linkBig: { width: 74, height: 74, borderRadius: 37, borderColor: ORANGE, borderWidth: 3 },
  linkDone: { backgroundColor: ORANGE, borderColor: "#FFFFFF" },
  linkToday: { borderColor: ORANGE_DARK, borderWidth: 3, backgroundColor: "#FFFFFF", shadowColor: ORANGE_DARK, shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, elevation: 6 },
  check: { position: "absolute", bottom: -3, right: -3, width: 19, height: 19, borderRadius: 10, backgroundColor: "#FFFFFF", color: ORANGE_DARK, fontFamily: fonts.bodyBold, fontSize: 12, textAlign: "center", lineHeight: 19, overflow: "hidden" },
  linkDay: { fontFamily: fonts.bodyBold, fontSize: 11, color: INK, marginTop: 5 },
  linkDayToday: { color: ORANGE_DARK },
  linkLabel: { fontFamily: fonts.body, fontSize: 10, color: INK_SOFT, textAlign: "center", paddingHorizontal: 2 },
  claim: { marginTop: 18, alignItems: "center", paddingVertical: 15, borderRadius: radii.pill, backgroundColor: ORANGE, borderWidth: 1.5, borderColor: "#FFFFFF", shadowColor: ORANGE_DARK, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  claimBusy: { opacity: 0.6 },
  claimText: { fontFamily: fonts.bodyBold, fontSize: 15, color: "#FFFFFF" },
  error: { fontFamily: fonts.bodySemi, fontSize: 12, color: "#E64863", textAlign: "center", marginTop: 8 },
  wonCard: { marginTop: 18, alignItems: "center", padding: 16, borderRadius: 22, backgroundColor: GLASS, borderWidth: 1.5, borderColor: GLASS_BORDER },
  wonIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: ORANGE, marginBottom: 8 },
  wonTitle: { fontFamily: fonts.display, fontSize: 19, color: INK, textAlign: "center" },
  wonText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: INK_SOFT, textAlign: "center", marginTop: 4 },
  code: { fontFamily: fonts.displayExtra, fontSize: 22, letterSpacing: 2, color: ORANGE_DARK, marginTop: 8, paddingHorizontal: 14, paddingVertical: 6, borderRadius: radii.md, backgroundColor: "#FFFFFF", overflow: "hidden" },
  wonNext: { fontFamily: fonts.bodySemi, fontSize: 12, color: ORANGE_DARK, marginTop: 10 },
  careBadge: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14, padding: 10, borderRadius: radii.md, backgroundColor: "rgba(255,255,255,0.8)", borderWidth: 1, borderColor: GLASS_BORDER },
  careLogo: { width: 40, height: 40 },
  careText: { flex: 1, fontFamily: fonts.bodySemi, fontSize: 12, color: INK },
  footnote: { fontFamily: fonts.body, fontSize: 11, color: INK_SOFT, textAlign: "center", marginTop: 14 },
  close: { alignItems: "center", paddingVertical: 12 },
  closeText: { fontFamily: fonts.bodySemi, fontSize: 13, color: INK_SOFT },
});
