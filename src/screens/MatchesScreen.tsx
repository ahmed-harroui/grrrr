import React, { useRef, useState } from "react";
import { FlatList, Image, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { MapPressEvent, Marker, Region } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { fonts, radii } from "@/theme/theme";
import { useThemedColors } from "@/hooks/useThemedColors";
import { MeetingMarker, MeetingTrace, useAppState } from "@/context/AppState";
import Header from "@/components/Header";
import { Pet } from "@/data/mockPets";
import PetRankBadge from "@/components/PetRankBadge";

export default function MatchesScreen() {
  const { activePet, matches, meetingMarkers, meetingTraces, setMeetingMarker, setMeetingTrace } = useAppState();
  const navigation = useNavigation<any>();
  const colors = useThemedColors();
  const mapRef = useRef<MapView>(null);
  const [selectedPetId, setSelectedPetId] = useState<number | null>(matches[0]?.id ?? null);
  const [selectedMarker, setSelectedMarker] = useState<MeetingMarker>("pink");
  const [mapExpanded, setMapExpanded] = useState(false);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<"expand" | "click">("click");
  const [pendingClickEvent, setPendingClickEvent] = useState<{ type: "native" | "web"; event: any } | null>(null);
  const [meetingTime, setMeetingTime] = useState("18:00");
  const styles = getStyles(colors);

  const [confirmModal, setConfirmModal] = useState<{
    pet: Pet;
    marker: MeetingMarker;
    coord?: { latitude: number; longitude: number };
  } | null>(null);
  const selectedPet = matches.find((pet) => pet.id === selectedPetId);
  const initialRegion: Region = { latitude: 48.8566, longitude: 2.3522, latitudeDelta: 0.12, longitudeDelta: 0.12 };
  const meetingTimes = ["12:00", "15:00", "18:00", "20:00"];

  const handleOpenMapClick = () => {
    if (!locationPermissionGranted) {
      setPendingAction("expand");
      setShowLocationModal(true);
    } else {
      setMapExpanded(true);
    }
  };

  const handleMapPress = (type: "native" | "web", event: any) => {
    if (!locationPermissionGranted) {
      setPendingAction("click");
      setPendingClickEvent({ type, event });
      setShowLocationModal(true);
    } else {
      executeMapPress(type, event);
    }
  };

  const executeMapPress = (type: "native" | "web", event: any) => {
    if (!selectedPet) return;
    let latitude = initialRegion.latitude;
    let longitude = initialRegion.longitude;
    if (type === "native") {
      const coord = event?.nativeEvent?.coordinate;
      if (coord && typeof coord.latitude === "number" && !isNaN(coord.latitude)) {
        latitude = coord.latitude;
      }
      if (coord && typeof coord.longitude === "number" && !isNaN(coord.longitude)) {
        longitude = coord.longitude;
      }
    } else {
      const locationX = event?.nativeEvent?.locationX ?? 180;
      const locationY = event?.nativeEvent?.locationY ?? 180;
      latitude = initialRegion.latitude + (180 - locationY) * 0.00035;
      longitude = initialRegion.longitude + (locationX - 180) * 0.00035;
    }
    setConfirmModal({ pet: selectedPet, marker: selectedMarker, coord: { latitude, longitude } });
  };

  const grantLocationPermission = () => {
    setLocationPermissionGranted(true);
    setShowLocationModal(false);
    if (pendingAction === "expand") {
      setMapExpanded(true);
    } else if (pendingAction === "click" && pendingClickEvent) {
      executeMapPress(pendingClickEvent.type, pendingClickEvent.event);
      setPendingClickEvent(null);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.cream }]} edges={["top"]}>
      <Header />

      <FlatList
        data={matches}
        keyExtractor={(p) => String(p.id)}
        numColumns={1}
        contentContainerStyle={{ gap: 12, paddingHorizontal: 20, paddingBottom: 30 }}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <Text style={styles.title}>Vos matchs</Text>
            <View style={styles.mapCard}>
              <View style={styles.mapHeader}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.mapTitle}>Notre carte des rencontres</Text>
                  <Text style={styles.mapHint}>{selectedPet ? `Touchez pour placer ${selectedPet.name}` : "Faites un match"}</Text>
                </View>
                <View style={styles.markerChoices}>
                  <Pressable onPress={handleOpenMapClick} style={styles.expandButton}><Text style={styles.expandText}>Ouvrir</Text></Pressable>
                  {(["pink", "blue"] as MeetingMarker[]).map((marker) => (
                    <Pressable key={marker} onPress={() => setSelectedMarker(marker)} style={[styles.markerChoice, selectedMarker === marker && styles.markerChoiceActive]}>
                      <Image source={marker === "pink" ? require("../../assets/pink_clic.png") : require("../../assets/bleue_clic.png")} style={styles.markerChoiceImage} />
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={styles.mapWrap}>
                {Platform.OS === "web" ? (
                  <Pressable
                    style={styles.webMap}
                    onPress={(e) => handleMapPress("web", e)}
                  >
                    <Text style={styles.webMapEmoji}>⌖</Text>
                    <Text style={styles.webMapTitle}>Carte interactive</Text>
                    <Text style={styles.webMapText}>Touche cette zone pour placer la patte du match sélectionné.</Text>
                    {matches.map((pet, index) => {
                      const trace = meetingTraces[pet.id];
                      return trace ? <View key={pet.id} style={[styles.webMarker, { left: `${25 + (index * 23) % 55}%`, top: `${30 + (index * 31) % 42}%` }]}><Image source={trace.marker === "pink" ? require("../../assets/pink_clic.png") : require("../../assets/bleue_clic.png")} style={styles.mapMarker} /></View> : null;
                    })}
                  </Pressable>
                ) : (
                  <>
                    <MapView
                      ref={mapRef}
                      style={styles.map}
                      initialRegion={initialRegion}
                      mapType="standard"
                      onPress={(e) => handleMapPress("native", e)}
                      scrollEnabled
                      zoomEnabled
                      rotateEnabled
                      pitchEnabled
                      showsCompass
                      showsScale
                      showsBuildings
                      showsPointsOfInterests
                      zoomControlEnabled
                      toolbarEnabled
                    >
                      {matches.map((pet) => {
                        const trace = meetingTraces[pet.id];
                        if (!trace || typeof trace.latitude !== "number" || typeof trace.longitude !== "number" || isNaN(trace.latitude) || isNaN(trace.longitude)) return null;
                        return (
                          <Marker
                            key={pet.id}
                            coordinate={{ latitude: trace.latitude, longitude: trace.longitude }}
                            title={`${pet.name} & ${activePet.name}`}
                            description="Trace de rencontre"
                          >
                            <Image source={trace.marker === "pink" ? require("../../assets/pink_clic.png") : require("../../assets/bleue_clic.png")} style={styles.mapMarker} />
                          </Marker>
                        );
                      })}
                    </MapView>
                    <Pressable style={styles.recenterButton} onPress={() => mapRef.current?.animateToRegion(initialRegion, 450)}>
                      <Text style={styles.recenterIcon}>◎</Text>
                    </Pressable>
                  </>
                )}
                <View style={styles.mapControlsHint} pointerEvents="none">
                  <Text style={styles.mapControlsText}>Glissez pour explorer</Text>
                </View>
              </View>
              <FlatList horizontal data={matches} keyExtractor={(pet) => String(pet.id)} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.petSelector} renderItem={({ item }) => <Pressable onPress={() => setSelectedPetId(item.id)} style={[styles.petChip, selectedPetId === item.id && styles.petChipActive]}><Image source={{ uri: item.photo }} style={styles.petChipImage} /><Text style={styles.petChipText}>{item.name}</Text></Pressable>} />
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Pas encore de match. Swipez à droite sur Discover 🐾</Text>
          </View>
        }
        renderItem={({ item }) => (
          <MatchTile
            pet={item}
            marker={meetingMarkers[item.id]}
            onMarkerChange={(marker) => setConfirmModal({ pet: item, marker })}
            onPress={() => navigation.navigate("ChatThread", { petId: item.id })}
            styles={styles}
          />
        )}
      />

      {/* Modal de Confirmation de Rendez-vous GRRRR */}
      <Modal visible={!!confirmModal} transparent animationType="fade" onRequestClose={() => setConfirmModal(null)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmLogo}>
              GR<Text style={{ color: colors.coral }}>RRR</Text> 🐾
            </Text>
            
            <Image
              source={confirmModal?.marker === "pink" ? require("../../assets/pink_clic.png") : require("../../assets/bleue_clic.png")}
              style={styles.confirmPawImage}
            />

            <Text style={styles.confirmTitle}>
              {confirmModal?.marker === "pink" ? "Sortie Coup de Cœur ❤️" : "Sortie Amicale 🐾"}
            </Text>

            <Text style={styles.confirmSub}>
              {confirmModal?.marker === "pink"
                ? `Voulez-vous planifier un rendez-vous HOT / Amoureux avec ${confirmModal?.pet.name} ?`
                : `Voulez-vous planifier une sortie Amicale avec ${confirmModal?.pet.name} ?`}
            </Text>

            <Text style={styles.timeLabel}>Choisissez l'heure de rencontre</Text>
            <View style={styles.timeChoices}>
              {meetingTimes.map((time) => (
                <Pressable
                  key={time}
                  onPress={() => setMeetingTime(time)}
                  style={[styles.timeChoice, meetingTime === time && styles.timeChoiceActive]}
                >
                  <Text style={[styles.timeChoiceText, meetingTime === time && styles.timeChoiceTextActive]}>{time}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.confirmNoticeBox}>
              <Text style={styles.confirmNoticeText}>
                📍 La proposition expire dans 24 h ou à l'heure du rendez-vous. Votre match pourra accepter ou refuser.
              </Text>
            </View>

            <View style={styles.confirmActions}>
              <Pressable
                style={styles.confirmPrimaryBtn}
                onPress={() => {
                  if (confirmModal) {
                    const targetPet = confirmModal.pet;
                    const targetMarker = confirmModal.marker;
                    if (confirmModal.coord) {
                      setMeetingTrace(targetPet.id, {
                        latitude: confirmModal.coord.latitude,
                        longitude: confirmModal.coord.longitude,
                        marker: targetMarker,
                      });
                    }
                    setMeetingMarker(targetPet.id, targetMarker);
                    setConfirmModal(null);
                    if (mapExpanded) setMapExpanded(false);
                    navigation.navigate("ChatThread", { petId: targetPet.id });
                  }
                }}
              >
                <Text style={styles.confirmPrimaryText}>Confirmer avec GRRRR 🐾</Text>
              </Pressable>

              <Pressable style={styles.confirmSecondaryBtn} onPress={() => setConfirmModal(null)}>
                <Text style={styles.confirmSecondaryText}>Annuler</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={mapExpanded} animationType="slide" onRequestClose={() => setMapExpanded(false)}>
        <SafeAreaView style={styles.fullMapScreen} edges={["top", "bottom"]}>
          <View style={styles.fullMapHeader}><View><Text style={styles.fullMapTitle}>Carte des rencontres</Text><Text style={styles.mapHint}>Explore la carte et place tes traces</Text></View><Pressable onPress={() => setMapExpanded(false)} style={styles.closeMap}><Text style={styles.closeMapText}>×</Text></Pressable></View>
          <View style={styles.fullMapWrap}>{Platform.OS === "web" ? <Pressable style={styles.webMap} onPress={(e) => handleMapPress("web", e)}><Text style={styles.webMapEmoji}>⌖</Text><Text style={styles.webMapTitle}>Carte interactive</Text><Text style={styles.webMapText}>Touche cette zone pour placer la patte.</Text>{matches.map((pet, index) => { const trace = meetingTraces[pet.id]; return trace ? <View key={pet.id} style={[styles.webMarker, { left: `${25 + (index * 23) % 55}%`, top: `${30 + (index * 31) % 42}%` }]}><Image source={trace.marker === "pink" ? require("../../assets/pink_clic.png") : require("../../assets/bleue_clic.png")} style={styles.mapMarker} /></View> : null; })}</Pressable> : <MapView ref={mapRef} style={styles.fullMap} initialRegion={initialRegion} mapType="standard" scrollEnabled zoomEnabled rotateEnabled pitchEnabled showsCompass showsScale showsBuildings showsPointsOfInterests zoomControlEnabled toolbarEnabled onPress={(e) => handleMapPress("native", e)}>{matches.map((pet) => { const trace = meetingTraces[pet.id]; return (trace && typeof trace.latitude === "number" && typeof trace.longitude === "number" && !isNaN(trace.latitude) && !isNaN(trace.longitude)) ? <Marker key={pet.id} coordinate={{ latitude: trace.latitude, longitude: trace.longitude }} title={`${pet.name} & ${activePet.name}`}><Image source={trace.marker === "pink" ? require("../../assets/pink_clic.png") : require("../../assets/bleue_clic.png")} style={styles.mapMarker} /></Marker> : null; })}</MapView>}</View>
          <Text style={styles.fullMapHint}>{selectedPet ? `Pet sélectionné : ${selectedPet.name}. Touche la carte pour placer la trace.` : "Sélectionne un match pour placer une trace."}</Text>
        </SafeAreaView>
      </Modal>

      {/* Modal de Demande d'Autorisation de Géolocalisation */}
      <Modal visible={showLocationModal} transparent animationType="fade" onRequestClose={() => setShowLocationModal(false)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmLogo}>
              GR<Text style={{ color: colors.coral }}>RRR</Text> 📍
            </Text>

            <View style={styles.locationIconCircle}>
              <Text style={{ fontSize: 28 }}>⌖</Text>
            </View>

            <Text style={styles.confirmTitle}>Autoriser la localisation</Text>

            <Text style={styles.confirmSub}>
              GRRRR a besoin de votre position GPS pour afficher les lieux de rencontre à proximité et placer vos empreintes de patte sur la carte.
            </Text>

            <View style={styles.confirmNoticeBox}>
              <Text style={styles.confirmNoticeText}>
                🔒 Vos données de position sont sécurisées et utilisées uniquement pour vos sorties entre animaux.
              </Text>
            </View>

            <View style={styles.confirmActions}>
              <Pressable style={styles.confirmPrimaryBtn} onPress={grantLocationPermission}>
                <Text style={styles.confirmPrimaryText}>Autoriser la localisation 📍</Text>
              </Pressable>

              <Pressable style={styles.confirmSecondaryBtn} onPress={() => setShowLocationModal(false)}>
                <Text style={styles.confirmSecondaryText}>Refuser</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function MatchTile({ pet, marker, onMarkerChange, onPress, styles }: { pet: Pet; marker?: MeetingMarker; onMarkerChange: (marker: MeetingMarker) => void; onPress: () => void; styles: ReturnType<typeof getStyles> }) {
  return (
    <View style={styles.card}>
      <Pressable style={styles.tile} onPress={onPress}>
        <Image source={{ uri: pet.photo }} style={styles.tileImg} />
        <View style={styles.tileShade} />
        <View style={styles.tileNameRow}><View><Text style={styles.tileName}>{pet.name}, {pet.age}</Text><PetRankBadge level={pet.level ?? ((pet.id % 3) + 1)} /></View><Text style={styles.matchScore}>✦ Match</Text></View>
      </Pressable>
      <View style={styles.meetingArea}>
        <Text style={styles.detailLine}>{pet.breed} · {pet.gender === "F" ? "Femelle" : "Mâle"} · 📍 {pet.dist} km</Text>
        <Text style={styles.cardBio} numberOfLines={2}>{pet.bio}</Text>
        <View style={styles.cardTags}>{pet.tags.slice(0, 3).map((tag) => <Text key={tag} style={styles.cardTag}>{tag}</Text>)}</View>
        <View style={styles.routeLine}><Text style={styles.routeDot}>●</Text><View style={styles.line} /><Text style={styles.routeDot}>●</Text></View>
        <Text style={styles.meetingLabel}>Point de rencontre</Text>
        <Text style={styles.meetingPlace}>{marker ? "📍 Trace enregistrée" : "📍 À définir ensemble"}</Text>
        <View style={styles.markerRow}>
          <Text style={styles.markerHint}>Choisir une patte</Text>
          <Pressable onPress={() => onMarkerChange("blue")} style={[styles.markerButton, marker === "blue" && styles.markerSelected]}><Image source={require("../../assets/bleue_clic.png")} style={styles.markerImage} /></Pressable>
          <Pressable onPress={() => onMarkerChange("pink")} style={[styles.markerButton, marker === "pink" && styles.markerSelected]}><Image source={require("../../assets/pink_clic.png")} style={styles.markerImage} /></Pressable>
        </View>
      </View>
    </View>
  );
}

function getStyles(colors: ReturnType<typeof useThemedColors>) {
  return StyleSheet.create({
    container: { flex: 1 },
    headerWrap: { marginBottom: 4 },
    title: { fontFamily: fonts.display, fontSize: 21, color: colors.dark, marginBottom: 10, marginTop: 2 },
    empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, paddingVertical: 40 },
    emptyText: { textAlign: "center", fontFamily: fonts.body, color: colors.grey, fontSize: 13 },
    tile: { height: 205, borderRadius: radii.md, overflow: "hidden" },
    tileImg: { width: "100%", height: "100%" },
    tileShade: { position: "absolute", left: 0, right: 0, bottom: 0, height: "50%", backgroundColor: "rgba(0,0,0,0.35)" },
    tileNameRow: { position: "absolute", bottom: 12, left: 14, right: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    tileName: { color: "#fff", fontFamily: fonts.display, fontSize: 22 },
    matchScore: { color: "#fff", fontFamily: fonts.bodyBold, fontSize: 11, backgroundColor: "rgba(255,93,115,0.85)", paddingHorizontal: 9, paddingVertical: 5, borderRadius: radii.pill },
    card: { backgroundColor: colors.white, borderRadius: radii.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.line, marginBottom: 12 },
    meetingArea: { padding: 15 },
    detailLine: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.dark },
    cardBio: { fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.grey, marginTop: 7 },
    cardTags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 9 },
    cardTag: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.coralDark, backgroundColor: colors.cream2, paddingHorizontal: 8, paddingVertical: 5, borderRadius: radii.pill },
    routeLine: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
    routeDot: { color: colors.coral, fontSize: 9 },
    line: { flex: 1, borderTopWidth: 1, borderStyle: "dashed", borderColor: colors.line, marginHorizontal: 5 },
    meetingLabel: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.dark },
    meetingPlace: { fontFamily: fonts.body, fontSize: 10, color: colors.grey, marginTop: 3 },
    markerRow: { flexDirection: "row", alignItems: "center", marginTop: 7, gap: 4 },
    markerHint: { flex: 1, fontFamily: fonts.body, fontSize: 9, color: colors.grey },
    markerButton: { width: 28, height: 28, alignItems: "center", justifyContent: "center", borderRadius: 14 },
    markerSelected: { backgroundColor: colors.cream2 },
    markerImage: { width: 27, height: 27 },
    mapCard: { marginBottom: 14, backgroundColor: colors.white, borderRadius: radii.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.line },
    mapHeader: { padding: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    mapTitle: { fontFamily: fonts.displaySemi, fontSize: 15, color: colors.dark },
    mapHint: { fontFamily: fonts.body, fontSize: 10, color: colors.grey, marginTop: 2 },
    markerChoices: { flexDirection: "row", gap: 4 },
    expandButton: { backgroundColor: colors.cream2, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 6, marginRight: 3 },
    expandText: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.coralDark },
    markerChoice: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 16 },
    markerChoiceActive: { backgroundColor: colors.cream2 },
    markerChoiceImage: { width: 26, height: 26 },
    mapWrap: { height: 170, width: "100%", position: "relative" },
    map: { flex: 1, width: "100%" },
    webMap: { flex: 1, backgroundColor: "#E9F1EC", alignItems: "center", justifyContent: "center", padding: 12, position: "relative", overflow: "hidden" },
    webMapEmoji: { fontSize: 26, color: colors.friend },
    webMapTitle: { fontFamily: fonts.displaySemi, fontSize: 14, color: colors.dark, marginTop: 2 },
    webMapText: { fontFamily: fonts.body, fontSize: 10, lineHeight: 14, color: colors.grey, textAlign: "center", maxWidth: 280, marginTop: 2 },
    webMarker: { position: "absolute" },
    mapMarker: { width: 32, height: 32 },
    recenterButton: { position: "absolute", right: 10, bottom: 28, width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.94)", alignItems: "center", justifyContent: "center", shadowColor: colors.dark, shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
    recenterIcon: { fontFamily: fonts.bodyBold, fontSize: 20, color: colors.friend, lineHeight: 22 },
    mapControlsHint: { position: "absolute", left: 10, bottom: 8, backgroundColor: "rgba(255,255,255,0.84)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: radii.pill },
    confirmOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 20 },
    confirmCard: { width: "100%", maxWidth: 340, backgroundColor: colors.cream, borderRadius: radii.lg, borderWidth: 2, borderColor: colors.coral, padding: 22, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 10, elevation: 6 },
    locationIconCircle: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.cream2, alignItems: "center", justifyContent: "center", marginBottom: 10, borderWidth: 1, borderColor: colors.coral },
    confirmLogo: { fontFamily: fonts.displayExtra, fontSize: 24, color: colors.dark, marginBottom: 12 },
    confirmPawImage: { width: 56, height: 56, marginBottom: 10 },
    confirmTitle: { fontFamily: fonts.displaySemi, fontSize: 18, color: colors.dark, textAlign: "center" },
    confirmSub: { fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.grey, textAlign: "center", marginTop: 6, marginBottom: 14 },
    timeLabel: { alignSelf: "flex-start", fontFamily: fonts.bodySemi, fontSize: 12, color: colors.dark, marginBottom: 7 },
    timeChoices: { flexDirection: "row", flexWrap: "wrap", gap: 7, width: "100%", marginBottom: 14 },
    timeChoice: { flexGrow: 1, minWidth: "40%", alignItems: "center", paddingVertical: 8, paddingHorizontal: 10, borderRadius: radii.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
    timeChoiceActive: { backgroundColor: colors.coral, borderColor: colors.coral },
    timeChoiceText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.dark },
    timeChoiceTextActive: { color: colors.white },
    confirmNoticeBox: { backgroundColor: colors.cream2, padding: 10, borderRadius: radii.md, borderWidth: 1, borderColor: "rgba(255,93,115,0.2)", marginBottom: 18 },
    confirmNoticeText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.coralDark, textAlign: "center", lineHeight: 15 },
    confirmActions: { width: "100%", gap: 8 },
    confirmPrimaryBtn: { backgroundColor: colors.coral, borderRadius: radii.pill, paddingVertical: 12, alignItems: "center" },
    confirmPrimaryText: { fontFamily: fonts.bodyBold, color: colors.white, fontSize: 13 },
    confirmSecondaryBtn: { backgroundColor: "transparent", paddingVertical: 8, alignItems: "center" },
    confirmSecondaryText: { fontFamily: fonts.bodySemi, color: colors.grey, fontSize: 12 },
    mapControlsText: { fontFamily: fonts.bodyMedium, fontSize: 9, color: colors.grey },
    fullMapScreen: { flex: 1, backgroundColor: colors.cream },
    fullMapHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14 },
    fullMapTitle: { fontFamily: fonts.displayExtra, fontSize: 23, color: colors.dark },
    closeMap: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
    closeMapText: { fontFamily: fonts.body, fontSize: 28, color: colors.dark, lineHeight: 30 },
    fullMapWrap: { flex: 1, marginHorizontal: 12, borderRadius: radii.lg, overflow: "hidden" },
    fullMap: { flex: 1 },
    fullMapHint: { fontFamily: fonts.bodyMedium, color: colors.grey, fontSize: 12, padding: 14, textAlign: "center" },
    petSelector: { padding: 10, gap: 8 },
    petChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 5, paddingHorizontal: 8, borderRadius: radii.pill, backgroundColor: colors.cream },
    petChipActive: { backgroundColor: colors.cream2, borderWidth: 1, borderColor: colors.coral },
    petChipImage: { width: 24, height: 24, borderRadius: 12 },
    petChipText: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.dark },
  });
}
