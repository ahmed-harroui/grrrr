import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { Animated, Dimensions, Image, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { fonts, radii } from "@/theme/theme";
import { useAppState } from "@/context/AppState";
import { useTranslation } from "@/i18n/useTranslation";
import { SPECIES } from "@/components/AddPetSheet";
import { AdoptionListing, AdoptionParent, answerAdoption, getAdoptionFeed } from "@/data/api/adoption";
import { refreshPetProgress } from "@/data/api/progress";

// GRRRR Adopt: the litters two matched pets agreed to entrust to adopters (migration 012),
// answered one by one like Discover. Its own look: white glass on a warm orange light.
const ORANGE = "#FFB35C";
const ORANGE_DARK = "#C97A1E";
const INK = "#3A2A18";
const INK_SOFT = "#8A6F54";
const GLASS = "rgba(255,255,255,0.58)";
const GLASS_BORDER = "rgba(255,255,255,0.9)";

const { width } = Dimensions.get("window");
const SWIPE_THRESHOLD = 110;

type Direction = "left" | "right";
interface CardHandle {
  triggerSwipe: (direction: Direction) => void;
}

export default function AdoptScreen() {
  const navigation = useNavigation<any>();
  const { activePet, refreshConversations } = useAppState();
  const { tx } = useTranslation();
  const [listings, setListings] = useState<AdoptionListing[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [sentTo, setSentTo] = useState<AdoptionListing | null>(null);
  const [failed, setFailed] = useState(false);
  const topCardRef = useRef<CardHandle>(null);
  const petId = activePet.dbId;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getAdoptionFeed(petId).then((result) => {
        if (!active) return;
        setListings(result);
        setLoaded(true);
      });
      return () => {
        active = false;
      };
    }, [petId])
  );

  const handleSwiped = async (listing: AdoptionListing, direction: Direction) => {
    setListings((current) => current.filter((item) => item.id !== listing.id));
    if (!petId) return;
    setFailed(false);
    const result = await answerAdoption(listing.id, petId, direction === "right");
    if (result.error) {
      // A litter removed in the meantime is simply gone; anything else is worth saying.
      if (direction === "right" && result.error !== "LITTER_CLOSED") setFailed(true);
      return;
    }
    if (direction === "right") {
      setSentTo(listing);
      // The request opened a conversation with each parent.
      void refreshConversations();
      // An adoption request earns XP (migration 013).
      void refreshPetProgress(petId, false);
    }
  };

  const visible = listings.slice(0, 2);

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#FFFFFF", "#FFF1DD", ORANGE]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
      <View style={[styles.glow, styles.glowTop]} />
      <View style={[styles.glow, styles.glowBottom]} />

      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.head}>
          <Pressable style={styles.glassRound} onPress={() => navigation.goBack()} hitSlop={8}>
            <Text style={styles.backIcon}>←</Text>
          </Pressable>
          <View style={styles.headCopy}>
            <Text style={styles.eyebrow}>GRRRR ADOPT</Text>
            <Text style={styles.title}>{tx("Des bébés à adopter", "Babies to adopt")}</Text>
          </View>
        </View>

        {sentTo && (
          <Pressable style={styles.notice} onPress={() => navigation.navigate("MainTabs", { screen: "Chat" })}>
            <Text style={styles.noticeTitle}>🍼 {tx("Demande envoyée", "Request sent")}</Text>
            <Text style={styles.noticeText}>{tx(`${sentTo.father.name} et ${sentTo.mother.name} ont reçu ta demande. Continue la discussion dans Messages ›`, `${sentTo.father.name} and ${sentTo.mother.name} received your request. Continue in Messages ›`)}</Text>
          </Pressable>
        )}
        {failed && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{tx("La demande n'a pas pu être envoyée. Réessaie dans un instant.", "The request could not be sent. Try again in a moment.")}</Text>
          </View>
        )}

        <View style={styles.stack}>
          {visible.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>🍼</Text>
              <Text style={styles.emptyTitle}>
                {!petId ? tx("Connecte-toi pour adopter", "Sign in to adopt") : !loaded ? tx("Chargement…", "Loading…") : tx("Aucune portée pour le moment", "No litters right now")}
              </Text>
              {loaded && (
                <Text style={styles.emptyText}>
                  {tx("Les annonces arrivent quand deux compagnons acceptent une relation 💞 depuis leur conversation.", "Listings appear when two companions accept a relationship 💞 from their conversation.")}
                </Text>
              )}
            </View>
          ) : (
            visible
              .map((listing, depth) => ({ listing, depth }))
              .reverse()
              .map(({ listing, depth }) => (
                <AdoptCard key={listing.id} ref={depth === 0 ? topCardRef : undefined} listing={listing} isTop={depth === 0} depth={depth} onSwiped={handleSwiped} />
              ))
          )}
        </View>

        {visible.length > 0 && (
          <View style={styles.actions}>
            <Pressable style={styles.skipButton} onPress={() => topCardRef.current?.triggerSwipe("left")}>
              <Text style={styles.skipIcon}>×</Text>
            </Pressable>
            <Pressable style={styles.adoptButton} onPress={() => topCardRef.current?.triggerSwipe("right")}>
              <Text style={styles.adoptButtonText}>🍼 {tx("Adopter", "Adopt")}</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const AdoptCard = forwardRef<CardHandle, { listing: AdoptionListing; isTop: boolean; depth: number; onSwiped: (listing: AdoptionListing, direction: Direction) => void }>(function AdoptCard(
  { listing, isTop, depth, onSwiped },
  ref
) {
  const { tx } = useTranslation();
  const pan = useRef(new Animated.ValueXY()).current;
  const { father, mother } = listing;
  const species = SPECIES.find((item) => item.key === listing.species?.toLowerCase());
  // The gesture handlers are created once: they reach the latest callback through this ref.
  const onSwipedRef = useRef(onSwiped);
  onSwipedRef.current = onSwiped;

  const flyOut = (direction: Direction) => {
    Animated.timing(pan, { toValue: { x: direction === "right" ? width * 1.4 : -width * 1.4, y: 0 }, duration: 260, useNativeDriver: false }).start(() => onSwipedRef.current(listing, direction));
  };
  useImperativeHandle(ref, () => ({ triggerSwipe: flyOut }));

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6,
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_, g) => {
        if (g.dx > SWIPE_THRESHOLD) flyOut("right");
        else if (g.dx < -SWIPE_THRESHOLD) flyOut("left");
        else Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
      },
    })
  ).current;

  const rotate = pan.x.interpolate({ inputRange: [-width / 2, 0, width / 2], outputRange: ["-14deg", "0deg", "14deg"] });
  const adoptOpacity = pan.x.interpolate({ inputRange: [20, 110], outputRange: [0, 1], extrapolate: "clamp" });
  const skipOpacity = pan.x.interpolate({ inputRange: [-110, -20], outputRange: [1, 0], extrapolate: "clamp" });
  const cardStyle = isTop
    ? { transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate }] }
    : { transform: [{ scale: 1 - depth * 0.04 }, { translateY: depth * 10 }] };

  return (
    <Animated.View style={[styles.card, cardStyle, { zIndex: 10 - depth }]} {...(isTop ? panResponder.panHandlers : {})}>
      {/* The two parents side by side, behind the glass panels */}
      <View style={styles.photos}>
        <Image source={{ uri: father.photo || undefined }} style={styles.photo} />
        <Image source={{ uri: mother.photo || undefined }} style={styles.photo} />
      </View>

      <GlassPanel style={styles.topPanel} father={father} mother={mother}>
        <View style={styles.avatars}>
          <Image source={{ uri: father.photo || undefined }} style={styles.avatar} />
          <Image source={{ uri: mother.photo || undefined }} style={[styles.avatar, styles.avatarSecond]} />
        </View>
        <View style={styles.topCopy}>
          <Text style={styles.parentsNames} numberOfLines={1}>{father.name} × {mother.name}</Text>
          <Text style={styles.parentsMeta} numberOfLines={1}>
            {species?.icon ?? "🐾"} {father.breed && mother.breed && father.breed !== mother.breed ? `${father.breed} × ${mother.breed}` : father.breed || mother.breed || tx("Leurs futurs bébés", "Their future babies")}
          </Text>
        </View>
        {listing.requests > 0 && <Text style={styles.requests}>{listing.requests} 🍼</Text>}
      </GlassPanel>

      {isTop && (
        <>
          <Animated.View style={[styles.stamp, styles.stampAdopt, { opacity: adoptOpacity }]}><Text style={[styles.stampText, { color: ORANGE_DARK, borderColor: ORANGE }]}>{tx("ADOPTER", "ADOPT")}</Text></Animated.View>
          <Animated.View style={[styles.stamp, styles.stampSkip, { opacity: skipOpacity }]}><Text style={[styles.stampText, { color: INK_SOFT, borderColor: INK_SOFT }]}>{tx("PASSER", "SKIP")}</Text></Animated.View>
        </>
      )}

      <GlassPanel style={styles.bottomPanel} father={father} mother={mother}>
        <ParentBio parent={father} sign="♂" role={tx("Le papa", "The dad")} />
        <View style={styles.divider} />
        <ParentBio parent={mother} sign="♀" role={tx("La maman", "The mum")} />
      </GlassPanel>
    </Animated.View>
  );
});

// Frosted glass: the parents' photos again, blurred, under a white veil.
function GlassPanel({ style, father, mother, children }: { style: object; father: AdoptionParent; mother: AdoptionParent; children: React.ReactNode }) {
  return (
    <View style={[styles.glassPanel, style]}>
      <View style={styles.glassBackdrop}>
        <Image source={{ uri: father.photo || undefined }} style={styles.photo} blurRadius={28} />
        <Image source={{ uri: mother.photo || undefined }} style={styles.photo} blurRadius={28} />
      </View>
      <View style={styles.glassVeil} />
      {children}
    </View>
  );
}

function ParentBio({ parent, sign, role }: { parent: AdoptionParent; sign: string; role: string }) {
  const { tx } = useTranslation();
  return (
    <View style={styles.bioRow}>
      <View style={styles.sign}><Text style={styles.signText}>{sign}</Text></View>
      <View style={styles.bioCopy}>
        <Text style={styles.bioTitle} numberOfLines={1}>
          {role} · {parent.name}
          {parent.owner ? <Text style={styles.bioOwner}> · {tx(`chez ${parent.owner}`, `with ${parent.owner}`)}</Text> : null}
        </Text>
        <Text style={styles.bioText} numberOfLines={2}>{parent.bio || [parent.breed, parent.city].filter(Boolean).join(" · ") || tx("Pas encore de bio.", "No bio yet.")}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  safe: { flex: 1 },
  glow: { position: "absolute", borderRadius: 999, backgroundColor: ORANGE },
  glowTop: { width: 260, height: 260, top: -90, right: -80, opacity: 0.28 },
  glowBottom: { width: 320, height: 320, bottom: -120, left: -110, opacity: 0.35 },
  head: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10 },
  glassRound: { width: 40, height: 40, borderRadius: 20, backgroundColor: GLASS, borderWidth: 1, borderColor: GLASS_BORDER, alignItems: "center", justifyContent: "center" },
  backIcon: { fontSize: 18, color: INK },
  headCopy: { flex: 1 },
  eyebrow: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 1.2, color: ORANGE_DARK },
  title: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26, color: INK },
  notice: { marginHorizontal: 16, marginBottom: 10, padding: 12, borderRadius: radii.md, backgroundColor: "rgba(255,255,255,0.78)", borderWidth: 1, borderColor: GLASS_BORDER },
  noticeTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: INK },
  noticeText: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: INK_SOFT, marginTop: 2 },
  stack: { flex: 1, marginHorizontal: 16, position: "relative" },
  emptyCard: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, borderRadius: 28, backgroundColor: GLASS, borderWidth: 1.5, borderColor: GLASS_BORDER },
  emptyIcon: { fontSize: 44 },
  emptyTitle: { fontFamily: fonts.displaySemi, fontSize: 19, color: INK, textAlign: "center", marginTop: 10 },
  emptyText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: INK_SOFT, textAlign: "center", marginTop: 6 },
  card: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#FFF1DD",
    borderWidth: 1.5,
    borderColor: GLASS_BORDER,
    shadowColor: ORANGE_DARK,
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  photos: { ...StyleSheet.absoluteFill, flexDirection: "row" },
  photo: { flex: 1, height: "100%" },
  glassPanel: { position: "absolute", left: 10, right: 10, borderRadius: 22, overflow: "hidden", borderWidth: 1, borderColor: GLASS_BORDER },
  glassBackdrop: { ...StyleSheet.absoluteFill, flexDirection: "row" },
  glassVeil: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(255,255,255,0.66)" },
  topPanel: { top: 10, flexDirection: "row", alignItems: "center", gap: 10, padding: 10 },
  avatars: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 54, height: 54, borderRadius: 27, borderWidth: 3, borderColor: "#FFFFFF", backgroundColor: "#FFE3BF" },
  avatarSecond: { marginLeft: -16, borderColor: ORANGE },
  topCopy: { flex: 1, minWidth: 0 },
  parentsNames: { fontFamily: fonts.display, fontSize: 19, lineHeight: 23, color: INK },
  parentsMeta: { fontFamily: fonts.bodySemi, fontSize: 11, color: INK_SOFT, marginTop: 1 },
  requests: { fontFamily: fonts.bodyBold, fontSize: 11, color: ORANGE_DARK, backgroundColor: "rgba(255,255,255,0.8)", paddingHorizontal: 9, paddingVertical: 5, borderRadius: radii.pill, overflow: "hidden" },
  stamp: { position: "absolute", top: 96, zIndex: 3 },
  stampAdopt: { left: 20 },
  stampSkip: { right: 20 },
  stampText: { fontFamily: fonts.displayExtra, fontSize: 30, borderWidth: 4, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 4, letterSpacing: 1, backgroundColor: "rgba(255,255,255,0.85)", overflow: "hidden" },
  bottomPanel: { bottom: 10, padding: 12 },
  divider: { height: 1, backgroundColor: "rgba(201,122,30,0.22)", marginVertical: 9 },
  bioRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  sign: { width: 30, height: 30, borderRadius: 15, backgroundColor: ORANGE, alignItems: "center", justifyContent: "center" },
  signText: { fontFamily: fonts.bodyBold, fontSize: 15, color: "#FFFFFF" },
  bioCopy: { flex: 1, minWidth: 0 },
  bioTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: INK },
  bioOwner: { fontFamily: fonts.bodyMedium, color: INK_SOFT },
  bioText: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: INK, marginTop: 2 },
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  skipButton: { width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(255,255,255,0.82)", borderWidth: 1, borderColor: GLASS_BORDER, alignItems: "center", justifyContent: "center" },
  skipIcon: { fontFamily: fonts.body, fontSize: 30, lineHeight: 32, color: INK },
  adoptButton: { flex: 1, maxWidth: 240, height: 56, borderRadius: 28, backgroundColor: ORANGE, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.85)", alignItems: "center", justifyContent: "center", shadowColor: ORANGE_DARK, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  adoptButtonText: { fontFamily: fonts.bodyBold, fontSize: 16, color: "#FFFFFF" },
});
