import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { Animated, Dimensions, Image, PanResponder, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, fonts, radii } from "@/theme/theme";
import { ENERGY_LABEL, Pet } from "@/data/mockPets";
import { computeMatch } from "@/utils/matching";

const { width } = Dimensions.get("window");
const SWIPE_THRESHOLD = 110;

export interface SwipeCardHandle {
  triggerSwipe: (direction: "left" | "right" | "super") => void;
}

interface Props {
  pet: Pet;
  mode: number;
  isTop: boolean;
  depth: number;
  onSwiped: (direction: "left" | "right" | "super") => void;
}

const SwipeCard = forwardRef<SwipeCardHandle, Props>(function SwipeCard(
  { pet, mode, isTop, depth, onSwiped },
  ref
) {
  const pan = useRef(new Animated.ValueXY()).current;
  const [whyOpen, setWhyOpen] = React.useState(false);
  const { pct, reasons } = computeMatch(pet, mode);

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
      <View style={styles.photoWrap}>
        <Image source={{ uri: pet.photo }} style={styles.photo} />
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.08)", "rgba(0,0,0,0.28)"]} locations={[0, 0.55, 1]} style={styles.photoShade} pointerEvents="none" />
        {isTop && (
          <>
            <Animated.View style={[styles.swipeTint, styles.likeTint, { opacity: likePhotoOpacity }]} pointerEvents="none" />
            <Animated.View style={[styles.swipeTint, styles.nopeTint, { opacity: nopePhotoOpacity }]} pointerEvents="none" />
          </>
        )}

        <View style={styles.scoreBadge}>
          <Text style={styles.scoreBadgeText}>❤️ {pct}%</Text>
        </View>

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
            {pet.name} <Text style={styles.nameAge}>{pet.age} ans</Text>
          </Text>
          <Text style={styles.meta}>
            {pet.breed} · {pet.gender === "F" ? "Femelle" : "Mâle"} · 📍 {pet.dist} km
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.bio} numberOfLines={2}>
          {pet.bio}
        </Text>
        <View style={styles.tags}>
          {[...pet.tags, ENERGY_LABEL[pet.energy]].map((t) => (
            <View key={t} style={styles.tag}>
              <Text style={styles.tagText}>{t}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.whyToggle} onPress={() => setWhyOpen((v) => !v)}>
          Pourquoi {pct}% compatible ? {whyOpen ? "▴" : "▾"}
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
    </Animated.View>
  );
});

export default SwipeCard;

const CARD_HEIGHT_RATIO = 0.68;

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
    borderRadius: radii.lg,
    overflow: "hidden",
    shadowColor: "#2B2724",
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  photoWrap: { height: `${CARD_HEIGHT_RATIO * 100}%`, position: "relative" },
  photo: { width: "100%", height: "100%" },
  photoShade: { position: "absolute", left: 0, right: 0, bottom: 0, height: "45%" },
  swipeTint: StyleSheet.absoluteFill,
  likeTint: { backgroundColor: colors.friend },
  nopeTint: { backgroundColor: colors.coral },
  scoreBadge: {
    position: "absolute",
    top: 14,
    right: 14,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  scoreBadgeText: { fontFamily: fonts.displaySemi, fontSize: 13, color: colors.coralDark },
  stamp: {
    position: "absolute",
    top: 26,
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
  nameRow: { position: "absolute", left: 16, bottom: 12 },
  name: { fontFamily: fonts.display, fontSize: 26, color: "#fff" },
  nameAge: { fontFamily: fonts.body, fontSize: 16, color: "#fff" },
  meta: { fontFamily: fonts.body, fontSize: 14, color: "#F1E9E2", marginTop: 3 },
  body: { flex: 1, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 14 },
  bio: { fontFamily: fonts.body, fontSize: 14, color: colors.grey, lineHeight: 20 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 11 },
  tag: { backgroundColor: colors.cream2, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.pill },
  tagText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.coralDark },
  whyToggle: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.friend, marginTop: 10 },
  whyPanel: { backgroundColor: "#F7FAF9", borderRadius: 12, padding: 10, marginTop: 6 },
  whyText: { fontFamily: fonts.body, fontSize: 12, color: colors.dark, lineHeight: 18 },
});
