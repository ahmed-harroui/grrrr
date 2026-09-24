import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { fonts } from "@/theme/theme";
import { useThemedColors } from "@/hooks/useThemedColors";

export default function Header() {
  const navigation = useNavigation<any>();
  const colors = useThemedColors();

  return (
    <View style={styles.row}>
      <Text style={[styles.logo, { color: colors.dark }]}>
        GR<Text style={{ color: colors.coral }}>RRR</Text> 🐾
      </Text>
      <Pressable
        style={[styles.iconBtn, { borderColor: colors.line }]}
        onPress={() => navigation.navigate("Settings")}
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
  logo: { fontFamily: fonts.displayExtra, fontSize: 22 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#fff",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
