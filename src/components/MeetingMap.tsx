import React, { useCallback, useRef, useState } from "react";
import { FlatList, Image, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useAuth } from "@/context/AuthContext";
import { FriendOnMap, getFriendsOnMap, getMapBubbles, getMapVisibility, getMyPosition, MapBubble, MapVisibility, setMapVisibility, shareMyPosition } from "@/data/api/presence";
import { fonts, radii } from "@/theme/theme";
import { useThemedColors } from "@/hooks/useThemedColors";
import { MeetingMarker, useAppState } from "@/context/AppState";
import { Pet } from "@/data/mockPets";
import { darkMapStyle, HOME_CITY_REGION, lightMapStyle, PartnerCard, PartnerMarkers } from "@/components/PartnerMap";
import { usePartners } from "@/hooks/usePartners";
import { Partner } from "@/data/api/partners";
import { useTheme } from "@/context/ThemeContext";
import { useTranslation } from "@/i18n/useTranslation";
import MeetingComposer from "@/components/MeetingComposer";
import { NATIVE_MAPS_AVAILABLE } from "@/lib/maps";

type Colors = ReturnType<typeof useThemedColors>;

export type MeetingRequest = {
  pet: Pet;
  marker: MeetingMarker;
  coord?: { latitude: number; longitude: number };
};

const PINK_PAW = require("../../assets/pink_clic.png");
const BLUE_PAW = require("../../assets/bleue_clic.png");

// A spot tapped on the map: the outing sheet opens there, then the chat (where the match answers).
export function MeetingConfirmModal({ request, onClose, onConfirmed }: { request: MeetingRequest | null; onClose: () => void; onConfirmed?: () => void }) {
  const navigation = useNavigation<any>();
  return (
    <MeetingComposer
      pet={request?.pet ?? null}
      initialCoord={request?.coord}
      initialMarker={request?.marker}
      onClose={onClose}
      onSent={() => {
        const petId = request?.pet.id;
        onClose();
        onConfirmed?.();
        if (petId !== undefined) navigation.navigate("ChatThread", { petId });
      }}
    />
  );
}

// "Carte des rencontres": partner places plus the meeting traces placed with matches.
export default function MeetingMap() {
  const { activePet, matches, meetingTraces } = useAppState();
  const { session } = useAuth();
  const navigation = useNavigation<any>();
  const colors = useThemedColors();
  const styles = getStyles(colors);
  const { tx } = useTranslation();
  const { isDark } = useTheme();
  const { partners } = usePartners();
  const mapRef = useRef<MapView>(null);
  const [selectedPetId, setSelectedPetId] = useState<number | null>(matches[0]?.id ?? null);
  const [selectedMarker, setSelectedMarker] = useState<MeetingMarker>("pink");
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<"expand" | "click">("click");
  const [pendingClickEvent, setPendingClickEvent] = useState<{ type: "native" | "web"; event: any } | null>(null);
  const [confirmRequest, setConfirmRequest] = useState<MeetingRequest | null>(null);
  // Who is around (migration 028): my matches one by one, everyone else as a count per district.
  // It is mutual: I only see others once I am on the map myself.
  const [visibility, setVisibility] = useState<MapVisibility>("off");
  const [friends, setFriends] = useState<FriendOnMap[]>([]);
  const [bubbles, setBubbles] = useState<MapBubble[]>([]);
  const [presenceNote, setPresenceNote] = useState<string | null>(null);
  const userId = session?.user.id;
  const myPetId = activePet.dbId;

  const loadPresence = useCallback(
    async (current: MapVisibility, ask: boolean) => {
      if (current === "off" || !myPetId) {
        setFriends([]);
        setBubbles([]);
        return true;
      }
      const position = await getMyPosition(ask);
      if (!position) return false;
      await shareMyPosition(myPetId, position);
      const [nextFriends, nextBubbles] = await Promise.all([getFriendsOnMap(myPetId), getMapBubbles(myPetId, position)]);
      setFriends(nextFriends);
      setBubbles(nextBubbles);
      return true;
    },
    [myPetId]
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getMapVisibility(userId).then((saved) => {
        if (!active) return;
        setVisibility(saved);
        void loadPresence(saved, false);
      });
      return () => {
        active = false;
      };
    }, [userId, loadPresence])
  );

  const chooseVisibility = async (next: MapVisibility) => {
    setPresenceNote(null);
    if (next !== "off" && !(await loadPresence(next, true))) {
      setPresenceNote(tx("Autorise la position dans les réglages du téléphone pour apparaître sur la carte.", "Allow location in your phone's settings to appear on the map."));
      return;
    }
    setVisibility(next);
    await setMapVisibility(next);
    if (next === "off") void loadPresence("off", false);
  };

  const selectedPet = matches.find((pet) => pet.id === selectedPetId) ?? matches[0];
  const initialRegion: Region = HOME_CITY_REGION;
  const mapTheme = { customMapStyle: isDark ? darkMapStyle : lightMapStyle, userInterfaceStyle: isDark ? "dark" as const : "light" as const };

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
    setConfirmRequest({ pet: selectedPet, marker: selectedMarker, coord: { latitude, longitude } });
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

  const traceMarkers = matches.map((pet) => {
    const trace = meetingTraces[pet.id];
    if (!trace || typeof trace.latitude !== "number" || typeof trace.longitude !== "number" || isNaN(trace.latitude) || isNaN(trace.longitude)) return null;
    return (
      <Marker key={pet.id} coordinate={{ latitude: trace.latitude, longitude: trace.longitude }} title={`${pet.name} & ${activePet.name}`} description={tx("Trace de rencontre", "Meeting spot")}>
        <Image source={trace.marker === "pink" ? PINK_PAW : BLUE_PAW} style={styles.mapMarker} />
      </Marker>
    );
  });

  const webMap = (hint: string) => (
    <Pressable style={styles.webMap} onPress={(e) => handleMapPress("web", e)}>
      <Text style={styles.webMapEmoji}>⌖</Text>
      <Text style={styles.webMapTitle}>{tx("Carte interactive", "Interactive map")}</Text>
      <Text style={styles.webMapText}>{hint}</Text>
      {matches.map((pet, index) => {
        const trace = meetingTraces[pet.id];
        return trace ? <View key={pet.id} style={[styles.webMarker, { left: `${25 + (index * 23) % 55}%`, top: `${30 + (index * 31) % 42}%` }]}><Image source={trace.marker === "pink" ? PINK_PAW : BLUE_PAW} style={styles.mapMarker} /></View> : null;
      })}
    </Pressable>
  );

  const nativeMap = (style: object) => (
    <MapView
      ref={mapRef}
      style={style}
      initialRegion={initialRegion}
      mapType="standard"
      {...mapTheme}
      onPress={(e) => handleMapPress("native", e)}
      scrollEnabled
      zoomEnabled
      rotateEnabled
      pitchEnabled
      showsCompass
      showsScale
      showsBuildings
      showsPointsOfInterests={false}
      zoomControlEnabled
      toolbarEnabled
    >
      <PartnerMarkers partners={partners} onSelect={setSelectedPartner} />
      {traceMarkers}
      {/* Everyone else nearby: a count per district, which opens Discover */}
      {bubbles.map((bubble) => (
        <Marker
          key={`bubble-${bubble.latitude}-${bubble.longitude}`}
          coordinate={{ latitude: bubble.latitude, longitude: bubble.longitude }}
          tracksViewChanges={false}
          onPress={(event) => {
            event.stopPropagation?.();
            setMapExpanded(false);
            navigation.navigate("MainTabs", { screen: "Discover" });
          }}
        >
          <View style={styles.bubble}><Text style={styles.bubbleText}>🐾 {bubble.pets}</Text></View>
        </Marker>
      ))}
      {/* My matches who are on the map: their avatar, which opens the chat */}
      {friends.map((friend) => (
        <Marker
          key={`friend-${friend.petId}`}
          coordinate={{ latitude: friend.latitude, longitude: friend.longitude }}
          title={friend.name}
          tracksViewChanges={false}
          onPress={(event) => {
            event.stopPropagation?.();
            const match = matches.find((pet) => pet.dbId === friend.petId);
            if (!match) return;
            setMapExpanded(false);
            navigation.navigate("ChatThread", { petId: match.id });
          }}
        >
          <View style={styles.friendPin}>
            {friend.photo ? <Image source={{ uri: friend.photo }} style={styles.friendPhoto} /> : <Text style={styles.friendInitial}>{friend.name.slice(0, 1)}</Text>}
          </View>
        </Marker>
      ))}
    </MapView>
  );

  return (
    <>
      <View style={styles.mapCard}>
        <View style={styles.mapHeader}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.mapTitle}>{tx("Notre carte des rencontres", "Our meetup map")}</Text>
            <Text style={styles.mapHint}>{selectedPet ? tx(`Touchez pour placer ${selectedPet.name}`, `Tap to place ${selectedPet.name}`) : tx("Nos partenaires près de chez vous", "Our partners near you")}</Text>
          </View>
          <View style={styles.markerChoices}>
            <Pressable onPress={handleOpenMapClick} style={styles.expandButton}><Text style={styles.expandText}>{tx("Ouvrir", "Open")}</Text></Pressable>
            {(["pink", "blue"] as MeetingMarker[]).map((marker) => (
              <Pressable key={marker} onPress={() => setSelectedMarker(marker)} style={[styles.markerChoice, selectedMarker === marker && styles.markerChoiceActive]}>
                <Image source={marker === "pink" ? PINK_PAW : BLUE_PAW} style={styles.markerChoiceImage} />
              </Pressable>
            ))}
          </View>
        </View>
        <View style={styles.mapWrap}>
          {!NATIVE_MAPS_AVAILABLE ? webMap(tx("Touche cette zone pour placer la patte du match sélectionné.", "Tap this area to place the selected match's paw.")) : (
            <>
              {nativeMap(styles.map)}
              {!selectedPartner && (
                <Pressable style={styles.recenterButton} onPress={() => mapRef.current?.animateToRegion(initialRegion, 450)}>
                  <Text style={styles.recenterIcon}>◎</Text>
                </Pressable>
              )}
            </>
          )}
          <View style={styles.mapControlsHint} pointerEvents="none">
            <Text style={styles.mapControlsText}>{tx("Glissez pour explorer", "Drag to explore")}</Text>
          </View>
          {selectedPartner && !mapExpanded && <PartnerCard partner={selectedPartner} onClose={() => setSelectedPartner(null)} />}
        </View>
        {/* Who sees me on the map: off by default, and I only see others once I am on it */}
        {Boolean(userId && myPetId) && (
          <View style={styles.presence}>
            <Text style={styles.presenceLabel}>{tx("Qui me voit sur la carte ?", "Who sees me on the map?")}</Text>
            <View style={styles.presenceChoices}>
              {([["off", tx("Personne", "Nobody")], ["friends", tx("Mes amis", "My friends")], ["area", tx("Ma zone", "My area")]] as [MapVisibility, string][]).map(([value, label]) => (
                <Pressable key={value} onPress={() => chooseVisibility(value)} style={[styles.presenceChoice, visibility === value && styles.presenceChoiceActive]}>
                  <Text style={[styles.presenceChoiceText, visibility === value && styles.presenceChoiceTextActive]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.presenceHint}>
              {presenceNote ??
                (visibility === "off"
                  ? tx("Active-la pour voir tes amis et combien de compagnons sont autour.", "Switch it on to see your friends and how many pets are around.")
                  : visibility === "friends"
                    ? tx(`Tes matchs te voient à environ 500 m près. ${friends.length} ami(s) sur la carte.`, `Your matches see you to about 500 m. ${friends.length} friend(s) on the map.`)
                    : tx(`Tes matchs te voient ; les autres ne voient qu'un nombre par quartier. ${friends.length} ami(s) sur la carte.`, `Your matches see you; others only see a count per district. ${friends.length} friend(s) on the map.`))}
            </Text>
          </View>
        )}
        {matches.length > 0 && (
          <FlatList horizontal data={matches} keyExtractor={(pet) => String(pet.id)} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.petSelector} renderItem={({ item }) => <Pressable onPress={() => setSelectedPetId(item.id)} style={[styles.petChip, selectedPet?.id === item.id && styles.petChipActive]}><Image source={{ uri: item.photo }} style={styles.petChipImage} /><Text style={styles.petChipText}>{item.name}</Text></Pressable>} />
        )}
      </View>

      <MeetingConfirmModal request={confirmRequest} onClose={() => setConfirmRequest(null)} onConfirmed={() => setMapExpanded(false)} />

      <Modal visible={mapExpanded} animationType="slide" onRequestClose={() => setMapExpanded(false)}>
        <SafeAreaView style={styles.fullMapScreen} edges={["top", "bottom"]}>
          <View style={styles.fullMapHeader}>
            <View><Text style={styles.fullMapTitle}>{tx("Carte des rencontres", "Meetup map")}</Text><Text style={styles.mapHint}>{tx("Explore la carte et place tes traces", "Explore the map and place your paws")}</Text></View>
            <Pressable onPress={() => setMapExpanded(false)} style={styles.closeMap}><Text style={styles.closeMapText}>×</Text></Pressable>
          </View>
          <View style={styles.fullMapWrap}>
            {!NATIVE_MAPS_AVAILABLE ? webMap(tx("Touche cette zone pour placer la patte.", "Tap this area to place the paw.")) : nativeMap(styles.fullMap)}
            {selectedPartner && <PartnerCard partner={selectedPartner} onClose={() => setSelectedPartner(null)} />}
          </View>
          <Text style={styles.fullMapHint}>{selectedPet ? tx(`Pet sélectionné : ${selectedPet.name}. Touche la carte pour placer la trace.`, `Selected pet: ${selectedPet.name}. Tap the map to place the paw.`) : tx("Sélectionne un match pour placer une trace.", "Select a match to place a paw.")}</Text>
        </SafeAreaView>
      </Modal>

      <Modal visible={showLocationModal} transparent animationType="fade" onRequestClose={() => setShowLocationModal(false)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmLogo}>
              GR<Text style={{ color: colors.coral }}>RRR</Text> 📍
            </Text>
            <View style={styles.locationIconCircle}>
              <Text style={{ fontSize: 28 }}>⌖</Text>
            </View>
            <Text style={styles.confirmTitle}>{tx("Autoriser la localisation", "Allow location")}</Text>
            <Text style={styles.confirmSub}>{tx("GRRRR a besoin de votre position GPS pour afficher les lieux de rencontre à proximité et placer vos empreintes de patte sur la carte.", "GRRRR needs your GPS location to show nearby meetup spots and place your paw prints on the map.")}</Text>
            <View style={styles.confirmNoticeBox}>
              <Text style={styles.confirmNoticeText}>🔒 {tx("Vos données de position sont sécurisées et utilisées uniquement pour vos sorties entre animaux.", "Your location data is secure and only used for your pet outings.")}</Text>
            </View>
            <View style={styles.confirmActions}>
              <Pressable style={styles.confirmPrimaryBtn} onPress={grantLocationPermission}>
                <Text style={styles.confirmPrimaryText}>{tx("Autoriser la localisation 📍", "Allow location 📍")}</Text>
              </Pressable>
              <Pressable style={styles.confirmSecondaryBtn} onPress={() => setShowLocationModal(false)}>
                <Text style={styles.confirmSecondaryText}>{tx("Refuser", "Decline")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function getStyles(colors: Colors) {
  return StyleSheet.create({
    mapCard: { backgroundColor: colors.white, borderRadius: radii.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.line },
    mapHeader: { padding: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    mapTitle: { fontFamily: fonts.displaySemi, fontSize: 15, color: colors.dark },
    mapHint: { fontFamily: fonts.body, fontSize: 10, color: colors.grey, marginTop: 2 },
    markerChoices: { flexDirection: "row", gap: 4 },
    expandButton: { backgroundColor: colors.cream2, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 6, marginRight: 3 },
    expandText: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.coralDark },
    markerChoice: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 16 },
    markerChoiceActive: { backgroundColor: colors.cream2 },
    markerChoiceImage: { width: 26, height: 26 },
    mapWrap: { height: 230, width: "100%", position: "relative" },
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
    mapControlsText: { fontFamily: fonts.bodyMedium, fontSize: 9, color: colors.grey },
    bubble: { minWidth: 44, height: 30, paddingHorizontal: 9, borderRadius: 15, backgroundColor: "rgba(255,179,92,0.95)", borderWidth: 2, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
    bubbleText: { fontFamily: fonts.bodyBold, fontSize: 12, color: "#3A2A18" },
    friendPin: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, borderColor: colors.coral, backgroundColor: colors.cream2, alignItems: "center", justifyContent: "center", overflow: "hidden" },
    friendPhoto: { width: "100%", height: "100%" },
    friendInitial: { fontFamily: fonts.displaySemi, fontSize: 16, color: colors.dark },
    presence: { paddingHorizontal: 10, paddingTop: 10, gap: 6 },
    presenceLabel: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.dark },
    presenceChoices: { flexDirection: "row", gap: 6 },
    presenceChoice: { flex: 1, alignItems: "center", paddingVertical: 7, borderRadius: radii.pill, backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.line },
    presenceChoiceActive: { backgroundColor: colors.coral, borderColor: colors.coral },
    presenceChoiceText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.dark },
    presenceChoiceTextActive: { color: "#FFFFFF" },
    presenceHint: { fontFamily: fonts.body, fontSize: 10, lineHeight: 14, color: colors.grey },
    petSelector: { padding: 10, gap: 8 },
    petChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 5, paddingHorizontal: 8, borderRadius: radii.pill, backgroundColor: colors.cream },
    petChipActive: { backgroundColor: colors.cream2, borderWidth: 1, borderColor: colors.coral },
    petChipImage: { width: 24, height: 24, borderRadius: 12 },
    petChipText: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.dark },
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
    fullMapScreen: { flex: 1, backgroundColor: colors.cream },
    fullMapHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14 },
    fullMapTitle: { fontFamily: fonts.displayExtra, fontSize: 23, color: colors.dark },
    closeMap: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
    closeMapText: { fontFamily: fonts.body, fontSize: 28, color: colors.dark, lineHeight: 30 },
    fullMapWrap: { flex: 1, marginHorizontal: 12, borderRadius: radii.lg, overflow: "hidden" },
    fullMap: { flex: 1 },
    fullMapHint: { fontFamily: fonts.bodyMedium, color: colors.grey, fontSize: 12, padding: 14, textAlign: "center" },
  });
}
