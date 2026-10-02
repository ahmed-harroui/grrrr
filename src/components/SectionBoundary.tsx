import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { fonts, radii } from "@/theme/theme";

// A section that fails to draw shows a short note instead of closing the whole app
// (in a release build, an error while drawing ends the app).
export default class SectionBoundary extends React.Component<{ name: string; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn(`Section "${this.props.name}" failed`, error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={styles.box}>
        <Text style={styles.text}>🐾 Cette partie n'a pas pu s'afficher · This part could not be shown</Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  box: { padding: 14, borderRadius: radii.md, backgroundColor: "rgba(255,93,115,0.08)", borderWidth: 1, borderColor: "rgba(255,93,115,0.25)", marginVertical: 6 },
  text: { fontFamily: fonts.bodySemi, fontSize: 12, color: "#8A8078", textAlign: "center" },
});
