import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { fonts } from "@/theme/theme";
import { useThemedColors } from "@/hooks/useThemedColors";
import { useTranslation } from "@/i18n/useTranslation";
import { SIDEBAR_WIDTH } from "@/utils/wideScreen";

/** The navigation on a laptop: the tabs of the bottom bar (same icons, same badges) as a labelled column on the left. */
export default function SideTabs({ state, descriptors, navigation, labels }: BottomTabBarProps & { labels: Record<string, [string, string]> }) {
  const colors = useThemedColors();
  const { tx } = useTranslation();

  return (
    <View style={[styles.container, { backgroundColor: colors.white, borderRightColor: colors.line }]}>
      <Text style={[styles.brand, { color: colors.dark }]}>
        G<Text style={{ color: colors.coral }}>RRRR</Text> 🐾
      </Text>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const color = focused ? colors.coralDark : colors.dark;
        const onPress = () => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };
        return (
          <Pressable key={route.key} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: focused }} style={[styles.item, focused && { backgroundColor: "rgba(255,93,115,0.12)" }]}>
            {descriptors[route.key].options.tabBarIcon?.({ focused, color, size: 34 })}
            <Text style={[styles.label, { color, fontFamily: focused ? fonts.bodyBold : fonts.bodySemi }]}>{tx(...labels[route.name])}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: "absolute", left: 0, top: 0, bottom: 0, width: SIDEBAR_WIDTH, borderRightWidth: 1, paddingHorizontal: 12, paddingTop: 22, gap: 6 },
  brand: { fontFamily: fonts.displayExtra, fontSize: 26, paddingHorizontal: 12, marginBottom: 20 },
  item: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, paddingHorizontal: 8, borderRadius: 18 },
  label: { fontSize: 15 },
});
