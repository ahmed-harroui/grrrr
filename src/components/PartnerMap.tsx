import React from "react";
import { Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Marker, Region } from "react-native-maps";
import { fonts, radii } from "@/theme/theme";
import { useThemedColors } from "@/hooks/useThemedColors";
import { Partner } from "@/data/api/partners";
import { useTranslation } from "@/i18n/useTranslation";

type Colors = ReturnType<typeof useThemedColors>;

// The map always opens on our partners' city.
export const HOME_CITY_REGION: Region = { latitude: 44.8378, longitude: -0.5792, latitudeDelta: 0.08, longitudeDelta: 0.08 };

const CATEGORIES: Record<string, { label: string; labelEn: string; icon: string; color: (colors: Colors) => string }> = {
  clinic: { label: "Vétérinaire", labelEn: "Vet", icon: "🩺", color: (c) => c.friend },
  pharmacy: { label: "Pharmacie", labelEn: "Pharmacy", icon: "💊", color: (c) => c.coral },
  supplies: { label: "Animalerie", labelEn: "Pet store", icon: "🛍️", color: (c) => c.hot },
  grooming: { label: "Toilettage", labelEn: "Grooming", icon: "✂️", color: (c) => c.coralDark },
};
const FALLBACK_CATEGORY = { label: "Partenaire", labelEn: "Partner", icon: "🐾", color: (c: Colors) => c.coral };

export function partnerCategory(category: string) {
  return CATEGORIES[category] ?? FALLBACK_CATEGORY;
}

export function PartnerMarkers({ partners, onSelect }: { partners: Partner[]; onSelect: (partner: Partner) => void }) {
  const colors = useThemedColors();
  return (
    <>
      {partners.map((partner) => {
        const category = partnerCategory(partner.category);
        return (
          <Marker
            key={partner.id}
            coordinate={{ latitude: partner.latitude, longitude: partner.longitude }}
            tracksViewChanges={false}
            onPress={(event) => {
              // Keep the map's own onPress (placing a meeting trace) from firing too.
              event.stopPropagation?.();
              onSelect(partner);
            }}
          >
            <View style={[markerStyles.pin, { backgroundColor: category.color(colors), borderColor: "#FFFFFF" }, partner.is_featured && markerStyles.featured]}>
              <Text style={markerStyles.icon}>{category.icon}</Text>
            </View>
          </Marker>
        );
      })}
    </>
  );
}

export function PartnerCard({ partner, onClose }: { partner: Partner; onClose: () => void }) {
  const colors = useThemedColors();
  const styles = getCardStyles(colors);
  const { tx } = useTranslation();
  const category = partnerCategory(partner.category);
  const website = partner.website && !/^https?:\/\//.test(partner.website) ? `https://${partner.website}` : partner.website;
  const directions = Platform.select({
    ios: `http://maps.apple.com/?daddr=${partner.latitude},${partner.longitude}`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${partner.latitude},${partner.longitude}`,
  });

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.iconCircle, { backgroundColor: category.color(colors) }]}><Text style={styles.icon}>{category.icon}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{partner.name}</Text>
          <Text style={styles.meta}>
            {tx(category.label, category.labelEn)}{partner.rating ? ` · ★ ${partner.rating.toFixed(1)}` : ""}{partner.is_featured ? tx(" · Partenaire GRRRR", " · GRRRR partner") : ""}
          </Text>
        </View>
        <Pressable onPress={onClose} hitSlop={10} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable>
      </View>
      {partner.address ? <Text style={styles.address} numberOfLines={2}>📍 {partner.address}</Text> : null}
      <View style={styles.actions}>
        <Pressable style={[styles.action, styles.actionPrimary]} onPress={() => Linking.openURL(directions)}><Text style={[styles.actionText, styles.actionTextPrimary]}>{tx("Itinéraire", "Directions")}</Text></Pressable>
        {partner.phone ? <Pressable style={styles.action} onPress={() => Linking.openURL(`tel:${partner.phone}`)}><Text style={styles.actionText}>{tx("Appeler", "Call")}</Text></Pressable> : null}
        {website ? <Pressable style={styles.action} onPress={() => Linking.openURL(website)}><Text style={styles.actionText}>{tx("Site web", "Website")}</Text></Pressable> : null}
      </View>
    </View>
  );
}

const markerStyles = StyleSheet.create({
  pin: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  featured: { width: 42, height: 42, borderRadius: 21, borderWidth: 3 },
  icon: { fontSize: 16 },
});

function getCardStyles(colors: Colors) {
  return StyleSheet.create({
    card: { position: "absolute", left: 10, right: 10, bottom: 10, backgroundColor: colors.cream, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, padding: 12, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
    header: { flexDirection: "row", alignItems: "center", gap: 10 },
    iconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    icon: { fontSize: 17 },
    name: { fontFamily: fonts.displaySemi, fontSize: 15, color: colors.dark },
    meta: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.grey },
    close: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.cream2, alignItems: "center", justifyContent: "center" },
    closeText: { fontFamily: fonts.body, fontSize: 20, color: colors.dark, lineHeight: 22 },
    address: { fontFamily: fonts.body, fontSize: 11, color: colors.grey, marginTop: 8 },
    actions: { flexDirection: "row", gap: 6, marginTop: 10 },
    action: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: radii.pill, backgroundColor: colors.cream2 },
    actionPrimary: { backgroundColor: colors.coral },
    actionText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.coralDark },
    actionTextPrimary: { color: "#FFFFFF" },
  });
}

// Google Maps style (Android) matching the GRRRR cream / coral palette.
export const lightMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#FFF7EF" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8A8078" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#FFF7EF" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", stylers: [{ visibility: "on" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#DDF2E3" }] },
  { featureType: "poi.park", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#FFFFFF" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#FFE3CF" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#FFD0B8" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#BFE9E5" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#EFE4D8" }] },
];

export const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#1A1815" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#A89F96" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1A1815" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", stylers: [{ visibility: "on" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#1F2A22" }] },
  { featureType: "poi.park", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2D2620" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#3D3830" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#4A3A30" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#16302E" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#3D3830" }] },
];
