import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { fonts, radii } from "@/theme/theme";
import { useThemedColors } from "@/hooks/useThemedColors";
import { SPECIES } from "@/components/AddPetSheet";

interface Props {
  /** Avatar of the pet the notification is about */
  photo?: string;
  species?: string;
  /** Small icon of the notification type, shown before the title */
  icon?: string;
  title: string;
  body?: string;
  time?: string;
  unread?: boolean;
  /** Banner above the screens: gets a shadow */
  floating?: boolean;
  onPress?: () => void;
  onClose?: () => void;
}

// A notification: the pet's avatar on the left, the text, its species icon on the right.
export default function NotificationCard({ photo, species, icon, title, body, time, unread, floating, onPress, onClose }: Props) {
  const colors = useThemedColors();
  const styles = getStyles(colors);
  const speciesIcon = SPECIES.find((item) => item.key === species?.toLowerCase())?.icon ?? "🐾";
  return (
    <Pressable style={[styles.card, unread && styles.cardUnread, floating && styles.floating]} onPress={onPress} disabled={!onPress}>
      {photo ? <Image source={{ uri: photo }} style={styles.avatar} /> : <View style={[styles.avatar, styles.avatarEmpty]}><Text style={styles.avatarEmptyIcon}>{speciesIcon}</Text></View>}
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          {unread && <View style={styles.unreadDot} />}
          <Text style={styles.title} numberOfLines={1}>{icon ? `${icon} ` : ""}{title}</Text>
        </View>
        {!!body && <Text style={styles.body} numberOfLines={2}>{body}</Text>}
        {!!time && <Text style={styles.time}>{time}</Text>}
      </View>
      <View style={styles.species}><Text style={styles.speciesIcon}>{speciesIcon}</Text></View>
      {onClose && <Pressable onPress={onClose} hitSlop={10} style={styles.close}><Text style={styles.closeText}>✕</Text></Pressable>}
    </Pressable>
  );
}

function getStyles(colors: ReturnType<typeof useThemedColors>) {
  return StyleSheet.create({
    card: { minHeight: 72, borderRadius: radii.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", padding: 10, gap: 10 },
    cardUnread: { borderColor: colors.coral, backgroundColor: colors.cream2 },
    floating: { backgroundColor: colors.white, borderColor: colors.line, shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 12 },
    avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.line },
    avatarEmpty: { alignItems: "center", justifyContent: "center" },
    avatarEmptyIcon: { fontSize: 24 },
    copy: { flex: 1, minWidth: 0 },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.coral },
    title: { flexShrink: 1, fontFamily: fonts.bodyBold, fontSize: 14, color: colors.dark },
    body: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.dark, marginTop: 2 },
    time: { fontFamily: fonts.body, fontSize: 10, color: colors.grey, marginTop: 3 },
    species: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.cream, alignItems: "center", justifyContent: "center" },
    speciesIcon: { fontSize: 18 },
    close: { position: "absolute", top: 5, right: 8 },
    closeText: { color: colors.grey, fontSize: 11, fontFamily: fonts.bodyBold },
  });
}
