import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { Animated, Dimensions, Image, PanResponder, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { fonts, radii } from "@/theme/theme";
import { ENERGY_LABEL, Pet } from "@/data/mockPets";
import { computeMatch } from "@/utils/matching";
import { useThemedColors } from "@/hooks/useThemedColors";
import { useTranslation } from "@/i18n/useTranslation";
import PetRankBadge from "@/components/PetRankBadge";

const { width } = Dimensions.get("window");
const SWIPE_THRESHOLD = 110;

export interface SwipeCardHandle {
  triggerSwipe: (direction: "left" | "right" | "super") => void;
}

interface Props {
  pet: Pet;
  activePet: Pet;
  mode: number;
  isTop: boolean;
  depth: number;
  onSwiped: (direction: "left" | "right" | "super") => void;
}

const SwipeCard = forwardRef<SwipeCardHandle, Props>(function SwipeCard(
  { pet, activePet, mode, isTop, depth, onSwiped },
  ref
) {
  const colors = useThemedColors();
  const { t } = useTranslation();
  const pan = useRef(new Animated.ValueXY()).current;
  const [whyOpen, setWhyOpen] = React.useState(false);
  const { pct, reasons } = computeMatch(pet, mode, activePet);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6,
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_, g) => {
        if (g.dx > SWIPE_THRESHOLD) {
          flyOut("right");
        } else if (g.dx < -SWIPE_THRESHOLD) {
          flyOut("left");
        } else {
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
        }
      },
    })
  ).current;

  const flyOut = (direction: "left" | "right" | "super") => {
    const toX = direction === "right" ? width * 1.4 : direction === "left" ? -width * 1.4 : 0;
    const toY = direction === "super" ? -900 : 0;
    Animated.timing(pan, {
      toValue: { x: toX, y: toY },
      duration: 260,
      useNativeDriver: false,
    }).start(() => onSwiped(direction));
  };

  useImperativeHandle(ref, () => ({ triggerSwipe: flyOut }));

  const rotate = pan.x.interpolate({
    inputRange: [-width / 2, 0, width / 2],
    outputRange: ["-16deg", "0deg", "16deg"],
  });
  const likeOpacity = pan.x.interpolate({ inputRange: [20, 110], outputRange: [0, 1], extrapolate: "clamp" });
  const nopeOpacity = pan.x.interpolate({ inputRange: [-110, -20], outputRange: [1, 0], extrapolate: "clamp" });
  const likePhotoOpacity = pan.x.interpolate({ inputRange: [20, 110], outputRange: [0, 0.13], extrapolate: "clamp" });
  const nopePhotoOpacity = pan.x.interpolate({ inputRange: [-110, -20], outputRange: [0.13, 0], extrapolate: "clamp" });

  const cardStyle = isTop
    ? {
        transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate }],
      }
    : {
        transform: [{ scale: 1 - depth * 0.04 }, { translateY: depth * 10 }],
      };

  return (
    <Animated.View
      style={[styles.card, cardStyle, { zIndex: 10 - depth }]}
      {...(isTop ? panResponder.panHandlers : {})}
    >
      <Image source={{ uri: pet.photo }} style={styles.photo} />
      <LinearGradient colors={["transparent", "rgba(0,0,0,0.15)", "rgba(0,0,0,0.55)"]} locations={[0, 0.4, 1]} style={styles.photoShade} pointerEvents="none" />

      {isTop && (
        <>
          <Animated.View style={[styles.swipeTint, styles.likeTint, { opacity: likePhotoOpacity }]} pointerEvents="none" />
          <Animated.View style={[styles.swipeTint, styles.nopeTint, { opacity: nopePhotoOpacity }]} pointerEvents="none" />
        </>
      )}

      <View style={styles.scoreBadge}>
        <Text style={styles.scoreBadgeText}>❤️ {pct}%</Text>
      </View>
      <View style={styles.rankBadge}><PetRankBadge level={pet.level ?? ((pet.id % 3) + 1)} /></View>

      {isTop && (
        <>
          <Animated.View style={[styles.stamp, styles.stampLike, { opacity: likeOpacity }]}>
            <Text style={[styles.stampText, { color: colors.friend, borderColor: colors.friend }]}>LIKE</Text>
          </Animated.View>
          <Animated.View style={[styles.stamp, styles.stampNope, { opacity: nopeOpacity }]}>
            <Text style={[styles.stampText, { color: colors.coral, borderColor: colors.coral }]}>NOPE</Text>
          </Animated.View>
        </>
      )}

      <View style={styles.nameRow}>
        <Text style={styles.name}>
          {pet.name} <Text style={styles.nameAge}>{pet.age} {t.common.years}</Text>
        </Text>
        <Text style={styles.meta}>
          {pet.breed} · {pet.gender === "F" ? t.common.female : t.common.male} · 📍 {pet.dist} km
        </Text>
      </View>

      <LinearGradient colors={["transparent", pet.gender === "F" ? "rgba(255,93,115,0.88)" : "rgba(47,189,180,0.88)"]} locations={[0, 1]} style={styles.bodyOverlay} pointerEvents="none">
        <View style={styles.bodyContent}>
          <Text style={styles.bio} numberOfLines={2}>
            {pet.bio}
          </Text>
          <View style={styles.tags}>
            {[...pet.tags, ENERGY_LABEL[pet.energy]].map((t) => (
              <View key={t} style={[styles.tag, { backgroundColor: `rgba(255,255,255,0.25)` }]}>
                <Text style={styles.tagText}>{t}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.whyToggle} onPress={() => setWhyOpen((v) => !v)}>
            {t.discover.why} {pct}% ? {whyOpen ? "▴" : "▾"}
          </Text>
          {whyOpen && (
            <View style={styles.whyPanel}>
              {reasons.map((r) => (
                <Text key={r} style={styles.whyText}>
                  {r}
                </Text>
              ))}
            </View>
          )}
        </View>
      </LinearGradient>
    </Animated.View>
  );
});

export default SwipeCard;

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
    borderRadius: radii.lg,
    overflow: "hidden",
    shadowColor: "#2B2724",
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  photo: { width: "100%", height: "100%", position: "absolute" },
  photoShade: { position: "absolute", left: 0, right: 0, bottom: 0, width: "100%", height: "65%" },
  swipeTint: StyleSheet.absoluteFill,
  likeTint: { backgroundColor: "#2FBDB4" },
  nopeTint: { backgroundColor: "#FF5D73" },
  scoreBadge: {
    position: "absolute",
    top: 14,
    right: 14,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    zIndex: 3,
  },
  scoreBadgeText: { fontFamily: fonts.displaySemi, fontSize: 13, color: "#E64863" },
  rankBadge: { position: "absolute", top: 56, right: 14, zIndex: 3 },
  stamp: {
    position: "absolute",
    top: 26,
    zIndex: 3,
  },
  stampLike: { left: 20 },
  stampNope: { right: 20 },
  stampText: {
    fontFamily: fonts.displayExtra,
    fontSize: 26,
    borderWidth: 4,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 2,
    letterSpacing: 1,
  },
  nameRow: { position: "absolute", left: 16, bottom: 140, zIndex: 2 },
  name: { fontFamily: fonts.display, fontSize: 26, color: "#fff" },
  nameAge: { fontFamily: fonts.body, fontSize: 16, color: "#fff" },
  meta: { fontFamily: fonts.body, fontSize: 14, color: "#F1E9E2", marginTop: 3 },
  bodyOverlay: { position: "absolute", left: 0, right: 0, bottom: 0, height: "60%", paddingHorizontal: 18, paddingBottom: 16, zIndex: 2 },
  bodyContent: { flex: 1, justifyContent: "flex-end" },
  bio: { fontFamily: fonts.body, fontSize: 13, color: "#FFFFFF", lineHeight: 19 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 8 },
  tag: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: radii.pill },
  tagText: { fontFamily: fonts.bodySemi, fontSize: 10, color: "#FFFFFF" },
  whyToggle: { fontFamily: fonts.bodySemi, fontSize: 11, color: "#FFFFFF", marginTop: 6 },
  whyPanel: { backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 8, padding: 7, marginTop: 4, maxHeight: 100 },
  whyText: { fontFamily: fonts.body, fontSize: 10, color: "#FFFFFF", lineHeight: 15 },
});
