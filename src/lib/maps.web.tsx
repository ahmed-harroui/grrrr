// Web version of react-native-maps (only iOS/Android have the real one): the same MapView and
// Marker API drawn with Leaflet and OpenStreetMap tiles, so the Explore meetup map and the outing
// composer work on the website too. metro.config.js points "react-native-maps" here for web,
// and "@/lib/maps" resolves to this file on web (NATIVE_MAPS_AVAILABLE below).
// Leaflet comes from unpkg the first time a map shows. A marker's children (the partner pin, the
// pink or blue paw) are rendered inside the Leaflet marker, so they look as on the phones.
import React, { createContext, forwardRef, useContext, useEffect, useImperativeHandle, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "@/i18n/useTranslation";

// react-dom is there on the web (react-native-web renders through it); it ships no types here.
const { createPortal } = require("react-dom") as { createPortal: (node: React.ReactNode, container: Element) => React.ReactPortal };

/** The map works on the web: Leaflet. */
export const NATIVE_MAPS_AVAILABLE = true;

export type Region = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
export type LatLng = { latitude: number; longitude: number };
export type MapPressEvent = { nativeEvent: { coordinate: LatLng } };

const LEAFLET = "https://unpkg.com/leaflet@1.9.4/dist";
let leafletPromise: Promise<any> | null = null;

function loadLeaflet(): Promise<any> {
  const w = window as any;
  if (w.L) return Promise.resolve(w.L);
  if (!leafletPromise) {
    leafletPromise = new Promise((resolve, reject) => {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = `${LEAFLET}/leaflet.css`;
      document.head.appendChild(css);
      const script = document.createElement("script");
      script.src = `${LEAFLET}/leaflet.js`;
      script.onload = () => resolve(w.L);
      script.onerror = () => {
        leafletPromise = null;
        reject(new Error("Leaflet could not be loaded"));
      };
      document.head.appendChild(script);
    });
  }
  return leafletPromise;
}

/** react-native-maps describes the view by its span in degrees; Leaflet by a zoom level. */
const zoomFor = (region: Region) => Math.max(3, Math.min(18, Math.round(Math.log2(360 / Math.max(region.longitudeDelta, 0.0005)))));

const MapContext = createContext<{ L: any; map: any } | null>(null);

type MapViewProps = {
  style?: any;
  initialRegion?: Region;
  region?: Region;
  onPress?: (event: MapPressEvent) => void;
  children?: React.ReactNode;
  /** The native-only props (map style, gestures...) are accepted and ignored. */
  [prop: string]: any;
};

export type MapViewHandle = { animateToRegion: (region: Region, duration?: number) => void };

const MapView = forwardRef<MapViewHandle, MapViewProps>(function MapView({ style, initialRegion, region, onPress, children }, ref) {
  const { tx } = useTranslation();
  const container = useRef<any>(null);
  const [ready, setReady] = useState<{ L: any; map: any } | null>(null);
  const [failed, setFailed] = useState(false);
  // The latest onPress, without re-creating the map when the parent re-renders.
  const pressRef = useRef(onPress);
  pressRef.current = onPress;
  const start = region ?? initialRegion ?? { latitude: 44.8378, longitude: -0.5792, latitudeDelta: 0.08, longitudeDelta: 0.08 };

  useEffect(() => {
    let map: any = null;
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !container.current) return;
        map = L.map(container.current, { zoomControl: true, attributionControl: true }).setView([start.latitude, start.longitude], zoomFor(start));
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
        map.on("click", (event: any) => pressRef.current?.({ nativeEvent: { coordinate: { latitude: event.latlng.lat, longitude: event.latlng.lng } } }));
        // The container may get its size after the first layout (modals, cards).
        setTimeout(() => map?.invalidateSize(), 200);
        setReady({ L, map });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      map?.remove();
    };
    // The map is made once; the region props are only its starting view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    animateToRegion: (target: Region) => ready?.map.flyTo([target.latitude, target.longitude], zoomFor(target), { duration: 0.45 }),
  }), [ready]);

  if (failed) {
    return (
      <View style={[styles.placeholder, style]}>
        <Text style={styles.icon}>🗺️</Text>
        <Text style={styles.text}>{tx("La carte n'a pas pu se charger. Vérifie ta connexion.", "The map could not load. Check your connection.")}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.map, style]}>
      <View ref={container} style={StyleSheet.absoluteFill} />
      {ready && <MapContext.Provider value={ready}>{children}</MapContext.Provider>}
    </View>
  );
});

export default MapView;

type MarkerProps = {
  coordinate: LatLng;
  title?: string;
  description?: string;
  onPress?: (event: { stopPropagation: () => void; nativeEvent: { coordinate: LatLng } }) => void;
  children?: React.ReactNode;
  [prop: string]: any;
};

export function Marker({ coordinate, title, description, onPress, children }: MarkerProps) {
  const context = useContext(MapContext);
  const [element, setElement] = useState<HTMLElement | null>(null);
  const markerRef = useRef<any>(null);
  const pressRef = useRef(onPress);
  pressRef.current = onPress;

  useEffect(() => {
    if (!context) return;
    const { L, map } = context;
    const icon = L.divIcon({ className: "grrrr-marker", html: "", iconSize: [36, 36], iconAnchor: [18, 18] });
    const marker = L.marker([coordinate.latitude, coordinate.longitude], { icon, title: title ?? "" }).addTo(map);
    if (title || description) marker.bindTooltip([title, description].filter(Boolean).join(" · "), { direction: "top", offset: [0, -16] });
    marker.on("click", (event: any) => {
      L.DomEvent.stopPropagation(event);
      pressRef.current?.({ stopPropagation: () => {}, nativeEvent: { coordinate } });
    });
    markerRef.current = marker;
    setElement(marker.getElement() ?? null);
    return () => {
      marker.remove();
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context]);

  // Moves with its coordinate (the spot picked in the outing composer).
  useEffect(() => {
    markerRef.current?.setLatLng([coordinate.latitude, coordinate.longitude]);
  }, [coordinate.latitude, coordinate.longitude]);

  if (!element) return null;
  return createPortal(
    <View style={styles.markerBox}>{children ?? <View style={styles.defaultPin} />}</View>,
    element
  );
}

const styles = StyleSheet.create({
  map: { overflow: "hidden", minHeight: 200, backgroundColor: "#E9F1EC" },
  placeholder: { alignItems: "center", justifyContent: "center", backgroundColor: "#FFEEE0", minHeight: 200, padding: 20 },
  icon: { fontSize: 36 },
  text: { marginTop: 8, color: "#8A8078", textAlign: "center" },
  markerBox: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  defaultPin: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#FF5D73", borderWidth: 3, borderColor: "#FFFFFF" },
});
