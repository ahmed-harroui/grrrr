import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { Animated, Dimensions, Image, Modal, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
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
  const [showProfile, setShowProfile] = React.useState(false);
  const [photoIndex, setPhotoIndex] = React.useState(0);
  const { pct } = computeMatch(pet, mode, activePet);
  const lastTapRef = useRef<number>(0);
  const photos = pet.photos || [pet.photo];

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

  const handlePhotoTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      setShowProfile(true);
    }
    lastTapRef.current = now;
  };

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
      <Pressable style={styles.photoTapOverlay} onPress={handlePhotoTap} pointerEvents={isTop ? "auto" : "none"} />
      <LinearGradient colors={["transparent", "rgba(0,0,0,0.15)", "rgba(0,0,0,0.55)"]} locations={[0, 0.4, 1]} style={styles.photoShade} pointerEvents="none" />

      {isTop && (
        <>
          <Animated.View style={[styles.swipeTint, styles.likeTint, { opacity: likePhotoOpacity }]} pointerEvents="none" />
          <Animated.View style={[styles.swipeTint, styles.nopeTint, { opacity: nopePhotoOpacity }]} pointerEvents="none" />
        </>
      )}

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

      <LinearGradient colors={["transparent", "transparent", mode < 50 ? "rgba(47,189,180,0.92)" : "rgba(255,93,115,0.92)"]} locations={[0, 0.4, 1]} style={styles.gradientOverlay} pointerEvents="none" />

      <View style={styles.bodyOverlay}>
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
        </View>
      </View>

      <Modal visible={showProfile} transparent animationType="slide" onRequestClose={() => setShowProfile(false)}>
        <View style={styles.profileModal}>
          <View style={[styles.profileCard, { backgroundColor: colors.cream }]}>
            <Pressable style={styles.closeButton} onPress={() => setShowProfile(false)}>
              <Text style={styles.closeIcon}>✕</Text>
            </Pressable>

            {/* Photo Carousel */}
            <View style={styles.photoCarousel}>
              <Image source={{ uri: photos[photoIndex] }} style={styles.profilePhoto} />
              {photos.length > 1 && (
                <>
                  <Pressable style={[styles.photoNav, styles.photoNavLeft]} onPress={() => setPhotoIndex((i) => (i - 1 + photos.length) % photos.length)}>
                    <Text style={styles.photoNavText}>‹</Text>
                  </Pressable>
                  <Pressable style={[styles.photoNav, styles.photoNavRight]} onPress={() => setPhotoIndex((i) => (i + 1) % photos.length)}>
                    <Text style={styles.photoNavText}>›</Text>
                  </Pressable>
                  <View style={styles.photoIndicator}>
                    <Text style={styles.photoCount}>{photoIndex + 1}/{photos.length}</Text>
                  </View>
                </>
              )}
            </View>

            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: colors.dark }]}>{pet.name}, {pet.age} {t.common.years}</Text>
              <Text style={[styles.profileMeta, { color: colors.grey }]}>{pet.breed} • {pet.gender === "F" ? t.common.female : t.common.male}</Text>
              <Text style={[styles.profileDist, { color: colors.grey }]}>📍 {pet.dist} km away</Text>
              <Text style={[styles.profileCompat, { color: colors.friend }]}>❤️ {pct}% compatible</Text>

              <Text style={[styles.profileBio, { color: colors.dark }]}>{pet.bio}</Text>

              {pet.tags && pet.tags.length > 0 && (
                <View style={styles.profileTags}>
                  {pet.tags.map((tag) => (
                    <View key={tag} style={[styles.profileTag, { backgroundColor: colors.friend + "20" }]}>
                      <Text style={[styles.profileTagText, { color: colors.friend }]}>{tag}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>
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
  photoTapOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 2 },
  photoShade: { position: "absolute", left: 0, right: 0, bottom: 0, width: "100%", height: "65%" },
  swipeTint: StyleSheet.absoluteFill,
  likeTint: { backgroundColor: "#2FBDB4" },
  nopeTint: { backgroundColor: "#FF5D73" },
  rankBadge: { position: "absolute", top: -8, right: 12, zIndex: 4 },
  stamp: {
    position: "absolute",
    top: 26,
    zIndex: 3,
  },
  stampLike: { left: 20 },
  stampNope: { right: 20 },
  stampText: {
    fontFamily: fonts.displayExtra,
    fontSize: 36,
    borderWidth: 5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 6,
    letterSpacing: 1,
  },
  nameRow: { position: "absolute", left: 16, bottom: 165, zIndex: 3 },
  name: { fontFamily: fonts.display, fontSize: 26, color: "#fff" },
  nameAge: { fontFamily: fonts.body, fontSize: 16, color: "#fff" },
  meta: { fontFamily: fonts.body, fontSize: 14, color: "#F1E9E2", marginTop: 3 },
  gradientOverlay: { position: "absolute", left: 0, right: 0, bottom: 0, height: "65%", zIndex: 1 },
  bodyOverlay: { position: "absolute", left: 0, right: 0, bottom: 72, paddingHorizontal: 16, paddingVertical: 12, zIndex: 2 },
  bodyContent: { justifyContent: "flex-start" },
  bio: { fontFamily: fonts.body, fontSize: 13, color: "#FFFFFF", lineHeight: 19 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 7 },
  tag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radii.pill },
  tagText: { fontFamily: fonts.bodySemi, fontSize: 10, color: "#FFFFFF" },
  whyToggle: { fontFamily: fonts.bodySemi, fontSize: 11, color: "#FFFFFF", marginTop: 6 },
  profileModal: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  profileCard: { borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, padding: 20, maxHeight: "85%", overflow: "scroll" },
  closeButton: { position: "absolute", top: 12, right: 12, zIndex: 10, width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  closeIcon: { fontSize: 24, color: "#2B2724" },
  photoCarousel: { position: "relative", width: "100%", height: 320, marginBottom: 20, borderRadius: radii.md, overflow: "hidden" },
  profilePhoto: { width: "100%", height: "100%", borderRadius: radii.md },
  photoNav: { position: "absolute", top: "50%", width: 44, height: 44, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 22 },
  photoNavLeft: { left: 12 },
  photoNavRight: { right: 12 },
  photoNavText: { fontSize: 28, color: "#FFFFFF", fontWeight: "bold" },
  photoIndicator: { position: "absolute", bottom: 12, right: 12, backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  photoCount: { fontFamily: fonts.bodySemi, fontSize: 12, color: "#FFFFFF" },
  profileInfo: { paddingHorizontal: 0 },
  profileName: { fontFamily: fonts.display, fontSize: 26, marginBottom: 4 },
  profileMeta: { fontFamily: fonts.body, fontSize: 14, marginBottom: 4 },
  profileDist: { fontFamily: fonts.body, fontSize: 13, marginBottom: 8 },
  profileCompat: { fontFamily: fonts.displaySemi, fontSize: 14, marginBottom: 12, fontWeight: "600" },
  profileBio: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, marginBottom: 12 },
  profileTags: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  profileTag: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.pill },
  profileTagText: { fontFamily: fonts.bodySemi, fontSize: 12 },
});
