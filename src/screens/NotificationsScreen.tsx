import React, { useState } from "react";
import { FlatList, Platform, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { fonts, radii } from "@/theme/theme";
import { useThemedColors } from "@/hooks/useThemedColors";
import { useTranslation } from "@/i18n/useTranslation";
import { useAppState } from "@/context/AppState";
import { NotificationPrefs, useNotifications } from "@/context/NotificationsContext";
import NotificationCard from "@/components/NotificationCard";
import { describeNotification, timeAgo } from "@/utils/notificationText";

export default function NotificationsScreen() {
  const navigation = useNavigation<any>();
  const colors = useThemedColors();
  const styles = getStyles(colors);
  const { tx, language } = useTranslation();
  const { activePet } = useAppState();
  const { notifications, unreadCount, prefs, setPref, actorOf, open, markAllRead, clearAll, sendTest } = useNotifications();
  const [showSettings, setShowSettings] = useState(false);

  const toggles: { key: keyof NotificationPrefs; label: string; hint: string }[] = [
    { key: "messages", label: tx("💬 Messages et sorties", "💬 Messages and outings"), hint: tx("Nouveaux messages, propositions de balade", "New messages, outing proposals") },
    { key: "social", label: tx("💌 Likes, matchs et niveaux", "💌 Likes, matches and levels"), hint: tx("Likes reçus, super likes, matchs, rangs gagnés", "Likes received, super likes, matches, ranks earned") },
    { key: "care", label: tx("🩺 Santé et rappels", "🩺 Health and reminders"), hint: tx("Conseils GRRRR Care, anniversaire", "GRRRR Care tips, birthday") },
    { key: "news", label: tx("🛍️ Boutique et nouveautés", "🛍️ Shop and news"), hint: tx("Nouveautés de la boutique, nouveaux threads, infos de l'app", "Shop news, new threads, app updates") },
    ...(Platform.OS === "web" ? [{ key: "system" as const, label: tx("🔔 Notifications du navigateur", "🔔 Browser notifications"), hint: tx("Quand l'onglet GRRRR est en arrière-plan", "When the GRRRR tab is in the background") }] : []),
  ];

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}><Text style={styles.back}>←</Text></Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        <Pressable onPress={() => setShowSettings((current) => !current)} hitSlop={10}><Text style={styles.headerAction}>{showSettings ? tx("Fermer", "Close") : tx("Réglages", "Settings")}</Text></Pressable>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {showSettings && (
              <View style={styles.settings}>
                {toggles.map((toggle) => (
                  <View key={toggle.key} style={styles.toggleRow}>
                    <View style={styles.toggleCopy}>
                      <Text style={styles.toggleLabel}>{toggle.label}</Text>
                      <Text style={styles.toggleHint}>{toggle.hint}</Text>
                    </View>
                    <Switch value={prefs[toggle.key]} onValueChange={(value) => setPref(toggle.key, value)} trackColor={{ true: colors.coral, false: colors.line }} />
                  </View>
                ))}
                <Pressable onPress={sendTest} style={styles.testButton}><Text style={styles.testText}>{tx("🔔 Envoyer une notification de test", "🔔 Send a test notification")}</Text></Pressable>
              </View>
            )}
            {notifications.length > 0 && (
              <View style={styles.actions}>
                <Text style={styles.count}>{unreadCount > 0 ? tx(`${unreadCount} non lue${unreadCount > 1 ? "s" : ""}`, `${unreadCount} unread`) : tx("Tout est lu", "All read")}</Text>
                <View style={styles.actionButtons}>
                  {unreadCount > 0 && <Pressable onPress={markAllRead} hitSlop={8}><Text style={styles.action}>{tx("Tout marquer lu", "Mark all read")}</Text></Pressable>}
                  <Pressable onPress={clearAll} hitSlop={8}><Text style={styles.actionMuted}>{tx("Effacer", "Clear")}</Text></Pressable>
                </View>
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyTitle}>{tx("Rien pour l'instant", "Nothing yet")}</Text>
            <Text style={styles.emptyText}>{tx(`Les likes, matchs et messages de ${activePet.name} arriveront ici.`, `${activePet.name}'s likes, matches and messages will show up here.`)}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const actor = actorOf(item);
          const text = describeNotification(item, language, activePet.name);
          return <NotificationCard photo={actor.photo} species={actor.species} icon={text.icon} title={text.title} body={text.body} time={timeAgo(item.createdAt, language)} unread={!item.read} onPress={() => open(item)} />;
        }}
      />
    </SafeAreaView>
  );
}

function getStyles(colors: ReturnType<typeof useThemedColors>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.cream },
    header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
    back: { fontSize: 24, color: colors.dark },
    headerTitle: { flex: 1, fontFamily: fonts.displaySemi, fontSize: 20, color: colors.dark },
    headerAction: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.coralDark },
    list: { padding: 16, paddingBottom: 36, gap: 10 },
    settings: { backgroundColor: colors.white, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, padding: 14, marginBottom: 6 },
    toggleRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
    toggleCopy: { flex: 1 },
    toggleLabel: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.dark },
    toggleHint: { fontFamily: fonts.body, fontSize: 11, color: colors.grey, marginTop: 2 },
    testButton: { alignItems: "center", borderWidth: 1.5, borderColor: colors.coral, borderRadius: radii.pill, paddingVertical: 11, marginTop: 10 },
    testText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.coralDark },
    actions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 2 },
    count: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.grey },
    actionButtons: { flexDirection: "row", gap: 16 },
    action: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.coralDark },
    actionMuted: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.grey },
    empty: { alignItems: "center", paddingHorizontal: 36, paddingVertical: 60 },
    emptyIcon: { fontSize: 40 },
    emptyTitle: { fontFamily: fonts.displaySemi, fontSize: 19, color: colors.dark, marginTop: 10 },
    emptyText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.grey, textAlign: "center", marginTop: 6 },
  });
}
