// Web stand-in for react-native-maps, which only runs on iOS/Android.
// metro.config.js points "react-native-maps" here for web builds.
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "@/i18n/useTranslation";

export type Region = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
export type MapPressEvent = { nativeEvent: { coordinate: { latitude: number; longitude: number } } };

export function Marker(_props: Record<string, unknown>) {
  return null;
}

export default function MapView({ style }: { style?: object; children?: React.ReactNode } & Record<string, unknown>) {
  const { tx } = useTranslation();
  return (
    <View style={[styles.placeholder, style]}>
      <Text style={styles.icon}>🗺️</Text>
      <Text style={styles.text}>{tx("La carte est disponible dans l'application mobile.", "The map is available in the mobile app.")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { alignItems: "center", justifyContent: "center", backgroundColor: "#FFEEE0", minHeight: 200, padding: 20 },
  icon: { fontSize: 36 },
  text: { marginTop: 8, color: "#8A8078", textAlign: "center" },
});
