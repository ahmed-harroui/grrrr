import React from "react";
import { Image, StyleSheet } from "react-native";

const TREAT_LOGO = require("../../assets/initiale_log.png");

export default function TreatModel() {
  return <Image source={TREAT_LOGO} style={styles.logo} resizeMode="contain" />;
}

const styles = StyleSheet.create({
  logo: { width: 30, height: 30 },
});
