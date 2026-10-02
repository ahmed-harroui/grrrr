import React, { useEffect, useState } from "react";
import { Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { fonts, radii } from "@/theme/theme";
import { useThemedColors } from "@/hooks/useThemedColors";
import { MeetingMarker, useAppState } from "@/context/AppState";
import { Pet } from "@/data/mockPets";
import { HOME_CITY_REGION } from "@/components/PartnerMap";
import { useTranslation } from "@/i18n/useTranslation";
import { formatMeetingTime, MeetingError, MeetingProposal, proposeMeeting } from "@/data/api/meetings";
import { NATIVE_MAPS_AVAILABLE } from "@/lib/maps";

const PINK_PAW = require("../../assets/pink_clic.png");
const BLUE_PAW = require("../../assets/bleue_clic.png");
const QUICK_TIMES = [9 * 60, 12 * 60, 15 * 60, 18 * 60, 20 * 60];
const FIRST_MINUTE = 7 * 60;
const LAST_MINUTE = 23 * 60 + 45;
const DAYS = 7;

const clampMinutes = (value: number) => Math.min(LAST_MINUTE, Math.max(FIRST_MINUTE, value));
const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

function dateAt(dayOffset: number, minutes: number) {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date;
}

// Proposes an outing to a match: the spot (tap the map), Hot or Friend, the day and the hour.
// The other owner receives it in the chat and is the one who accepts or declines.
export default function MeetingComposer({
  pet,
  initialCoord,
  initialMarker,
  onClose,
  onSent,
}: {
  /** The match to meet; null hides the sheet */
  pet: Pet | null;
  initialCoord?: { latitude: number; longitude: number };
  initialMarker?: MeetingMarker;
  onClose: () => void;
  onSent?: (proposal: MeetingProposal | null) => void;
}) {
  const colors = useThemedColors();
  const styles = getStyles(colors);
  const { tx, language } = useTranslation();
  const { activePet, refreshConversations, setMeetingTrace } = useAppState();
  const [marker, setMarker] = useState<MeetingMarker>(initialMarker ?? "blue");
  const [coord, setCoord] = useState(initialCoord ?? { latitude: HOME_CITY_REGION.latitude, longitude: HOME_CITY_REGION.longitude });
  const [dayOffset, setDayOffset] = useState(0);
  const [minutes, setMinutes] = useState(18 * 60);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MeetingError | null>(null);

  // A new sheet starts from what it was opened with.
  useEffect(() => {
    if (!pet) return;
    setMarker(initialMarker ?? "blue");
    setCoord(initialCoord ?? { latitude: HOME_CITY_REGION.latitude, longitude: HOME_CITY_REGION.longitude });
    setError(null);
    // Today if there is still time, otherwise tomorrow.
    setDayOffset(dateAt(0, 18 * 60).getTime() > Date.now() + 30 * 60_000 ? 0 : 1);
    setMinutes(18 * 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pet?.id]);

  const scheduled = dateAt(dayOffset, minutes);
  const tooSoon = scheduled.getTime() <= Date.now() + 10 * 60_000;

  const send = async () => {
    if (!pet || busy || tooSoon) return;
    // Demo pets (signed out) only exist on this phone.
    if (!pet.dbId || !activePet.dbId) {
      setMeetingTrace(pet.id, { latitude: coord.latitude, longitude: coord.longitude, marker });
      onSent?.(null);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await proposeMeeting({ petId: activePet.dbId, otherPetId: pet.dbId, latitude: coord.latitude, longitude: coord.longitude, marker, scheduledAt: scheduled, label: formatMeetingTime(scheduled, "fr", true) });
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    // The database wrote the 📍 message: the chat and the map follow.
    void refreshConversations();
    onSent?.(result.proposal);
  };

  const dayLabel = (offset: number) => {
    if (offset === 0) return tx("Aujourd'hui", "Today");
    if (offset === 1) return tx("Demain", "Tomorrow");
    return dateAt(offset, 0).toLocaleDateString(language === "en" ? "en-GB" : "fr-FR", { weekday: "short", day: "numeric" });
  };

  return (
    <Modal visible={!!pet} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        {pet && (
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.title}>📍 {tx(`Sortie avec ${pet.name}`, `Outing with ${pet.name}`)}</Text>
              <Text style={styles.subtitle}>{tx(`${pet.name} reçoit ta proposition et choisit d'accepter ou non.`, `${pet.name} receives your proposal and chooses to accept or not.`)}</Text>

              <View style={styles.markers}>
                {(["blue", "pink"] as MeetingMarker[]).map((value) => (
                  <Pressable key={value} style={[styles.markerChoice, marker === value && styles.markerChoiceActive]} onPress={() => setMarker(value)}>
                    <Image source={value === "pink" ? PINK_PAW : BLUE_PAW} style={styles.markerImage} />
                    <Text style={[styles.markerText, marker === value && styles.markerTextActive]}>{value === "pink" ? tx("Rendez-vous Hot ❤️", "Hot date ❤️") : tx("Sortie Friend 🐾", "Friend outing 🐾")}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>{NATIVE_MAPS_AVAILABLE ? tx("LE LIEU · touche la carte", "THE SPOT · tap the map") : tx("LE LIEU", "THE SPOT")}</Text>
              {NATIVE_MAPS_AVAILABLE ? (
                <View style={styles.mapWrap}>
                  <MapView
                    style={styles.map}
                    initialRegion={{ latitude: coord.latitude, longitude: coord.longitude, latitudeDelta: 0.03, longitudeDelta: 0.03 }}
                    onPress={(event: any) => {
                      const point = event?.nativeEvent?.coordinate;
                      if (point && typeof point.latitude === "number" && typeof point.longitude === "number") setCoord({ latitude: point.latitude, longitude: point.longitude });
                    }}
                  >
                    <Marker coordinate={coord}>
                      <Image source={marker === "pink" ? PINK_PAW : BLUE_PAW} style={styles.pin} />
                    </Marker>
                  </MapView>
                </View>
              ) : (
                // No map on this phone (web, or Android without a Maps key): the spot picked on
                // the Explore map, or the city centre; the place is agreed in the chat.
                <View style={[styles.mapWrap, styles.noMap]}>
                  <Image source={marker === "pink" ? PINK_PAW : BLUE_PAW} style={styles.pin} />
                  <Text style={styles.hint}>
                    {initialCoord ? tx("Le lieu touché sur la carte d'Explorer.", "The spot tapped on the Explore map.") : tx("Centre-ville par défaut : précisez le lieu dans le chat.", "City centre by default: agree on the place in the chat.")}
                  </Text>
                </View>
              )}

              <Text style={styles.label}>{tx("LE JOUR", "THE DAY")}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {Array.from({ length: DAYS }, (_, offset) => (
                  <Pressable key={offset} style={[styles.chip, dayOffset === offset && styles.chipActive]} onPress={() => setDayOffset(offset)}>
                    <Text style={[styles.chipText, dayOffset === offset && styles.chipTextActive]}>{dayLabel(offset)}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Text style={styles.label}>{tx("L'HEURE", "THE TIME")}</Text>
              <View style={styles.stepper}>
                <Pressable style={styles.stepButton} onPress={() => setMinutes((m) => clampMinutes(m - 60))}><Text style={styles.stepText}>−1 h</Text></Pressable>
                <Pressable style={styles.stepButton} onPress={() => setMinutes((m) => clampMinutes(m - 15))}><Text style={styles.stepText}>−15</Text></Pressable>
                <Text style={styles.time}>{hhmm(minutes)}</Text>
                <Pressable style={styles.stepButton} onPress={() => setMinutes((m) => clampMinutes(m + 15))}><Text style={styles.stepText}>+15</Text></Pressable>
                <Pressable style={styles.stepButton} onPress={() => setMinutes((m) => clampMinutes(m + 60))}><Text style={styles.stepText}>+1 h</Text></Pressable>
              </View>
              <View style={styles.chipsWrap}>
                {QUICK_TIMES.map((value) => (
                  <Pressable key={value} style={[styles.chip, minutes === value && styles.chipActive]} onPress={() => setMinutes(value)}>
                    <Text style={[styles.chipText, minutes === value && styles.chipTextActive]}>{hhmm(value)}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.summary}>{formatMeetingTime(scheduled, language, true)}</Text>
              {tooSoon && <Text style={styles.error}>{tx("Cette heure est déjà passée (ou trop proche) : choisis plus tard.", "This time has passed (or is too close): pick a later one.")}</Text>}
              {error && (
                <Text style={styles.error}>
                  {error === "NOT_MATCHED" ? tx("Il faut avoir matché pour proposer une sortie.", "You need a match to propose an outing.") : error === "TIME_PASSED" ? tx("Cette heure est déjà passée : choisis plus tard.", "This time has passed: pick a later one.") : tx("La proposition n'a pas pu être envoyée. Réessaie dans un instant.", "The proposal could not be sent. Try again in a moment.")}
                </Text>
              )}
            </ScrollView>

            <Pressable style={[styles.primary, (busy || tooSoon) && styles.primaryOff]} onPress={send} disabled={busy || tooSoon}>
              <Text style={styles.primaryText}>{busy ? tx("Envoi…", "Sending…") : tx(`Envoyer à ${pet.name}`, `Send to ${pet.name}`)}</Text>
            </Pressable>
            <Pressable style={styles.cancel} onPress={onClose}><Text style={styles.cancelText}>{tx("Annuler", "Cancel")}</Text></Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

function getStyles(colors: ReturnType<typeof useThemedColors>) {
  return StyleSheet.create({
    overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(43,39,36,0.48)" },
    sheet: { maxHeight: "92%", backgroundColor: colors.cream, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 22 },
    handle: { alignSelf: "center", width: 42, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: 14 },
    title: { fontFamily: fonts.display, fontSize: 21, color: colors.dark },
    subtitle: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.grey, marginTop: 3 },
    markers: { flexDirection: "row", gap: 8, marginTop: 14 },
    markerChoice: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, padding: 9, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
    markerChoiceActive: { borderColor: colors.coral, backgroundColor: colors.cream2 },
    markerImage: { width: 26, height: 26 },
    markerText: { flexShrink: 1, fontFamily: fonts.bodySemi, fontSize: 11, color: colors.dark },
    markerTextActive: { color: colors.coralDark },
    label: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 0.8, color: colors.grey, marginTop: 16, marginBottom: 7 },
    mapWrap: { height: 170, borderRadius: radii.md, overflow: "hidden", borderWidth: 1, borderColor: colors.line },
    map: { flex: 1 },
    pin: { width: 34, height: 34 },
    noMap: { height: 92, alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 14, backgroundColor: colors.cream2 },
    hint: { fontFamily: fonts.body, fontSize: 10, color: colors.grey, marginTop: 4 },
    chips: { gap: 7 },
    chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 9 },
    chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
    chipActive: { backgroundColor: colors.coral, borderColor: colors.coral },
    chipText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.dark },
    chipTextActive: { color: "#FFFFFF" },
    stepper: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
    stepButton: { paddingHorizontal: 11, paddingVertical: 9, borderRadius: radii.pill, backgroundColor: colors.cream2, borderWidth: 1, borderColor: colors.line },
    stepText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.coralDark },
    time: { fontFamily: fonts.displayExtra, fontSize: 30, color: colors.dark, minWidth: 92, textAlign: "center" },
    summary: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.dark, textAlign: "center", marginTop: 16 },
    error: { fontFamily: fonts.bodySemi, fontSize: 12, lineHeight: 17, color: colors.coralDark, textAlign: "center", marginTop: 8 },
    primary: { alignItems: "center", borderRadius: radii.pill, paddingVertical: 14, backgroundColor: colors.coral, marginTop: 14 },
    primaryOff: { opacity: 0.45 },
    primaryText: { fontFamily: fonts.bodyBold, fontSize: 14, color: "#FFFFFF" },
    cancel: { alignItems: "center", paddingVertical: 11 },
    cancelText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.grey },
  });
}
