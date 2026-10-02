import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { fonts } from "@/theme/theme";
import { useThemedColors } from "@/hooks/useThemedColors";
import { useNotifications } from "@/context/NotificationsContext";
import DailyRewards from "@/components/DailyRewards";

export default function Header() {
  const navigation = useNavigation<any>();
  const colors = useThemedColors();
  const { unreadCount } = useNotifications();

  return (
    <View style={styles.row}>
      <Text style={[styles.logo, { color: colors.dark }]}>
        GR<Text style={{ color: colors.coral }}>RRR</Text> 🐾
      </Text>
      <View style={styles.buttons}>
        {/* Daily gifts: the week's chain */}
        <DailyRewards />
        <Pressable
          style={[styles.iconBtn, { borderColor: colors.line }]}
          onPress={() => navigation.navigate("Notifications")}
        >
          <Text style={{ fontSize: 16 }}>🔔</Text>
          {unreadCount > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.coral }]}>
              <Text style={styles.badgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
            </View>
          )}
        </Pressable>
        <Pressable
          style={[styles.iconBtn, { borderColor: colors.line }]}
          onPress={() => navigation.navigate("Settings")}
        >
          <Text style={{ fontSize: 16 }}>⚙️</Text>
        </Pressable>
      </View>
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
  buttons: { flexDirection: "row", gap: 8 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#fff",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: { position: "absolute", right: -5, top: -5, minWidth: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badgeText: { color: "#FFFFFF", fontFamily: fonts.bodyBold, fontSize: 10 },
});
