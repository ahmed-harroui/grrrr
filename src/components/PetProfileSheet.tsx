import React, { useEffect, useMemo, useRef, useState } from "react";
import { Image, Modal, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fonts, radii } from "@/theme/theme";
import { useThemedColors } from "@/hooks/useThemedColors";
import { useTranslation } from "@/i18n/useTranslation";
import { useAppState } from "@/context/AppState";
import { ENERGY_LABEL, Pet } from "@/data/mockPets";
import { computeMatch } from "@/utils/matching";
import { SPECIES, speciesLabel } from "@/components/AddPetSheet";
import PetRankBadge from "@/components/PetRankBadge";

interface Props {
  /** The profile to show; null hides the sheet */
  pet: Pet | null;
  onClose: () => void;
  /** Optional main action under the profile (e.g. open the chat) */
  action?: { label: string; onPress: () => void };
}

const WHITE = "#FFFFFF";

/** Full pet profile: every photo and everything shared when the pet was created. */
export default function PetProfileSheet({ pet, onClose, action }: Props) {
  return (
    <Modal visible={!!pet} animationType="slide" transparent onRequestClose={onClose}>
      {pet && <ProfileContent pet={pet} onClose={onClose} action={action} />}
    </Modal>
  );
}

function ProfileContent({ pet, onClose, action }: { pet: Pet; onClose: () => void; action?: Props["action"] }) {
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { tx, language } = useTranslation();
  const { activePet, mode } = useAppState();
  const [pageWidth, setPageWidth] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const carouselRef = useRef<ScrollView>(null);

  const photos = useMemo(() => Array.from(new Set([pet.photo, ...(pet.photos ?? [])].filter(Boolean))), [pet]);
  const species = SPECIES.find((item) => item.key === pet.species);
  const isHot = pet.mode >= 50;
  const isMine = pet.id === activePet.id;
  const pct = computeMatch(pet, mode, activePet).pct;
  const place = [pet.city, pet.country].filter(Boolean).join(", ");
  const health = pet.health;

  useEffect(() => setPhotoIndex(0), [pet.id]);

  const goToPhoto = (index: number) => {
    setPhotoIndex(index);
    carouselRef.current?.scrollTo({ x: index * pageWidth, animated: true });
  };

  const onCarouselScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!pageWidth) return;
    setPhotoIndex(Math.round(event.nativeEvent.contentOffset.x / pageWidth));
  };

  const facts: { label: string; value: string }[] = [
    { label: tx("Espèce", "Species"), value: species ? `${species.icon} ${speciesLabel(species, language)}` : pet.species },
    { label: tx("Race", "Breed"), value: pet.breed },
    { label: tx("Âge", "Age"), value: `${pet.age} ${pet.age > 1 ? tx("ans", "yrs") : tx("an", "yr")}` },
    { label: tx("Genre", "Gender"), value: pet.gender === "F" ? tx("♀ Femelle", "♀ Female") : tx("♂ Mâle", "♂ Male") },
    { label: tx("Énergie", "Energy"), value: ENERGY_LABEL[pet.energy] },
    { label: tx("Recherche", "Looking for"), value: pet.mode < 25 ? "🐾 Friend" : pet.mode > 75 ? "❤️ Hot" : "✨ Both" },
  ].filter((fact) => fact.value);

  // Health details the owner chose to fill in (the microchip number stays private).
  const healthFacts: { label: string; value: string }[] = health
    ? [
        health.weight != null ? { label: tx("Poids", "Weight"), value: `${health.weight} kg` } : null,
        health.birthday ? { label: tx("Naissance", "Birthday"), value: health.birthday } : null,
        health.sterilized != null ? { label: tx("Stérilisé(e)", "Neutered"), value: health.sterilized ? tx("Oui", "Yes") : tx("Non", "No") } : null,
        health.color ? { label: tx("Robe", "Coat"), value: health.color } : null,
        health.allergies ? { label: tx("Allergies", "Allergies"), value: health.allergies } : null,
      ].filter((fact): fact is { label: string; value: string } => fact !== null)
    : [];

  return (
    <View style={styles.layer}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <SafeAreaView style={styles.sheet} edges={["bottom"]}>
        <View style={styles.handle} />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Photos */}
          <View style={styles.carousel} onLayout={(event) => setPageWidth(event.nativeEvent.layout.width)}>
            {pageWidth > 0 && (
              <ScrollView ref={carouselRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onCarouselScroll} onScroll={onCarouselScroll} scrollEventThrottle={32}>
                {photos.map((uri, index) => <Image key={uri + index} source={{ uri }} style={[styles.photo, { width: pageWidth }]} />)}
              </ScrollView>
            )}
            {photos.length > 1 && (
              <>
                <View style={styles.dots}>{photos.map((uri, index) => <View key={uri + index} style={[styles.dot, index === photoIndex && styles.dotActive]} />)}</View>
                {photoIndex > 0 && <Pressable style={[styles.photoNav, styles.photoNavLeft]} onPress={() => goToPhoto(photoIndex - 1)}><Text style={styles.photoNavText}>‹</Text></Pressable>}
                {photoIndex < photos.length - 1 && <Pressable style={[styles.photoNav, styles.photoNavRight]} onPress={() => goToPhoto(photoIndex + 1)}><Text style={styles.photoNavText}>›</Text></Pressable>}
                <View style={styles.counter}><Text style={styles.counterText}>{photoIndex + 1}/{photos.length}</Text></View>
              </>
            )}
            <Pressable style={styles.close} onPress={onClose} hitSlop={8}><Text style={styles.closeText}>✕</Text></Pressable>
          </View>
          {photos.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>
              {photos.map((uri, index) => (
                <Pressable key={uri + index} onPress={() => goToPhoto(index)} style={[styles.thumb, index === photoIndex && styles.thumbActive]}>
                  <Image source={{ uri }} style={styles.thumbImage} />
                </Pressable>
              ))}
            </ScrollView>
          )}

          {/* Identity */}
          <View style={styles.nameRow}>
            <View style={styles.flex}>
              <Text style={styles.name}>{pet.name}<Text style={styles.age}>, {pet.age}</Text></Text>
              <Text style={styles.meta}>{place ? `📍 ${place} · ` : "📍 "}{pet.dist} km</Text>
            </View>
            <PetRankBadge level={pet.level ?? ((pet.id % 3) + 1)} />
          </View>

          <View style={styles.pills}>
            <Text style={[styles.pill, { color: WHITE, backgroundColor: isHot ? colors.coral : colors.friend }]}>{isHot ? "✦ Hot" : "🐾 Friend"}</Text>
            {!isMine && <Text style={[styles.pill, styles.compatPill]}>❤️ {pct}% {tx("compatible avec", "compatible with")} {activePet.name}</Text>}
          </View>

          {pet.bio ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{tx("À propos", "About")}</Text>
              <Text style={styles.bio}>{pet.bio}</Text>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{tx("Infos", "Details")}</Text>
            <View style={styles.grid}>
              {facts.map((fact) => (
                <View key={fact.label} style={styles.fact}>
                  <Text style={styles.factLabel}>{fact.label.toUpperCase()}</Text>
                  <Text style={styles.factValue} numberOfLines={2}>{fact.value}</Text>
                </View>
              ))}
            </View>
          </View>

          {pet.tags.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{tx("Ses petites habitudes", "Little habits")}</Text>
              <View style={styles.tags}>{pet.tags.map((tag) => <Text key={tag} style={styles.tag}>{tag}</Text>)}</View>
            </View>
          )}

          {healthFacts.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{tx("Santé", "Health")}</Text>
              <View style={styles.grid}>
                {healthFacts.map((fact) => (
                  <View key={fact.label} style={styles.fact}>
                    <Text style={styles.factLabel}>{fact.label.toUpperCase()}</Text>
                    <Text style={styles.factValue} numberOfLines={3}>{fact.value}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {action && <Pressable style={styles.primary} onPress={action.onPress}><Text style={styles.primaryText}>{action.label}</Text></Pressable>}
          <Pressable style={action ? styles.secondary : styles.primary} onPress={onClose}><Text style={action ? styles.secondaryText : styles.primaryText}>{tx("Fermer", "Close")}</Text></Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

function getStyles(colors: ReturnType<typeof useThemedColors>) {
  return StyleSheet.create({
    flex: { flex: 1 },
    layer: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(43,39,36,0.45)" },
    sheet: { maxHeight: "94%", backgroundColor: colors.cream, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 10 },
    handle: { width: 42, height: 5, borderRadius: 3, backgroundColor: colors.line, alignSelf: "center", marginBottom: 12 },
    content: { paddingHorizontal: 18, paddingBottom: 16 },
    carousel: { width: "100%", height: 380, borderRadius: radii.lg, overflow: "hidden", backgroundColor: colors.cream2 },
    photo: { height: 380 },
    dots: { position: "absolute", top: 10, left: 12, right: 12, flexDirection: "row", gap: 4 },
    dot: { flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.45)" },
    dotActive: { backgroundColor: WHITE },
    photoNav: { position: "absolute", top: "50%", marginTop: -20, width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.35)" },
    photoNavLeft: { left: 10 },
    photoNavRight: { right: 10 },
    photoNavText: { fontSize: 26, lineHeight: 28, color: WHITE, fontWeight: "bold" },
    counter: { position: "absolute", bottom: 12, right: 12, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.pill },
    counterText: { fontFamily: fonts.bodySemi, fontSize: 11, color: WHITE },
    close: { position: "absolute", top: 20, right: 12, width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.45)" },
    closeText: { color: WHITE, fontSize: 15, fontFamily: fonts.bodyBold },
    thumbs: { gap: 8, paddingTop: 10 },
    thumb: { width: 54, height: 54, borderRadius: radii.sm, overflow: "hidden", borderWidth: 2, borderColor: "transparent", opacity: 0.6 },
    thumbActive: { borderColor: colors.coral, opacity: 1 },
    thumbImage: { width: "100%", height: "100%" },
    nameRow: { flexDirection: "row", alignItems: "center", marginTop: 14 },
    name: { fontFamily: fonts.displayExtra, fontSize: 28, color: colors.dark },
    age: { fontFamily: fonts.body, fontSize: 20, color: colors.grey },
    meta: { fontFamily: fonts.body, fontSize: 12, color: colors.grey, marginTop: 2 },
    pills: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
    pill: { fontFamily: fonts.bodyBold, fontSize: 11, paddingHorizontal: 11, paddingVertical: 6, borderRadius: radii.pill, overflow: "hidden" },
    compatPill: { color: colors.coralDark, backgroundColor: colors.cream2 },
    section: { backgroundColor: colors.white, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, padding: 14, marginTop: 14 },
    sectionTitle: { fontFamily: fonts.displaySemi, fontSize: 16, color: colors.dark, marginBottom: 10 },
    bio: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.dark },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    fact: { width: "48.5%", backgroundColor: colors.cream, borderRadius: radii.sm, paddingHorizontal: 11, paddingVertical: 9 },
    factLabel: { fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 0.6, color: colors.grey },
    factValue: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.dark, marginTop: 3 },
    tags: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
    tag: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.coralDark, backgroundColor: colors.cream2, borderRadius: radii.pill, paddingHorizontal: 11, paddingVertical: 7, overflow: "hidden" },
    footer: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 14, gap: 4, borderTopWidth: 1, borderTopColor: colors.line },
    primary: { backgroundColor: colors.coral, borderRadius: radii.pill, alignItems: "center", paddingVertical: 14 },
    primaryText: { fontFamily: fonts.bodyBold, fontSize: 13, color: WHITE },
    secondary: { alignItems: "center", paddingVertical: 10 },
    secondaryText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.grey },
  });
}
