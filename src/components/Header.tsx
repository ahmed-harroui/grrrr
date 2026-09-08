import React from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "@/theme/theme";

export default function Header() {
  return (
    <View style={styles.row}>
      <Text style={styles.logo}>
        GR<Text style={{ color: colors.coral }}>RRR</Text> 🐾
      </Text>
      <Pressable
        style={styles.iconBtn}
        onPress={() => Alert.alert("Filtres", "Filtres avancés bientôt disponibles.")}
      >
        <Text style={{ fontSize: 16 }}>⚙️</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 6,
  },
  logo: { fontFamily: fonts.displayExtra, fontSize: 22, color: colors.dark },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
});
