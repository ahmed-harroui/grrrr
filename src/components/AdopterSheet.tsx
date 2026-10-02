import React from "react";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { fonts, radii } from "@/theme/theme";
import { useThemedColors } from "@/hooks/useThemedColors";
import { useTranslation } from "@/i18n/useTranslation";
import type { AdoptionInterest } from "@/data/api/adoption";
import { timeAgo } from "@/utils/notificationText";

const ADOPT = "#FFB35C";
const BUY = "#2FBDB4";

// Someone with no pet of their own (adopter mode) waiting for my pet's babies: a person, not a
// pet profile. Their photo if they have one, their name and city, and what they wait for.
export default function AdopterSheet({ interest, petName, onClose, onRemove }: { interest: AdoptionInterest | null; petName: string; onClose: () => void; onRemove: () => void }) {
  const colors = useThemedColors();
  const styles = getStyles(colors);
  const { tx, language } = useTranslation();
  if (!interest) return null;
  const { pet, intent, since } = interest;
  const buy = intent === "BUY";
  const tint = buy ? BUY : ADOPT;
  const place = [pet.city, pet.country].filter(Boolean).join(", ");

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={[styles.ring, { backgroundColor: tint }]}>
            {pet.photo ? (
              <Image source={{ uri: pet.photo }} style={styles.photo} />
            ) : (
              <View style={[styles.photo, styles.placeholder]}>
                <Text style={styles.placeholderIcon}>👤</Text>
              </View>
            )}
          </View>
          <Text style={styles.name} numberOfLines={1}>{pet.name || tx("Un futur adoptant", "A future adopter")}</Text>
          {!!place && <Text style={styles.place}>📍 {place}</Text>}
          <Text style={[styles.status, { backgroundColor: tint }]}>{buy ? tx("💶 Veut acheter", "💶 Wants to buy") : tx("🍼 Veut adopter", "🍼 Wants to adopt")}</Text>
          <Text style={styles.text}>
            {tx(`N'a pas encore de pet : attend les bébés de ${petName}.`, `Has no pet yet: waiting for ${petName}'s babies.`)}
          </Text>
          <Text style={styles.hint}>🕒 {timeAgo(since, language)}</Text>
          <Text style={styles.hint}>{tx("Sa demande partira dès que tu proposeras une relation 💞 dans un chat.", "Their request leaves as soon as you propose a relationship 💞 in a chat.")}</Text>
          <View style={styles.actions}>
            <Pressable style={[styles.button, styles.removeButton]} onPress={onRemove}>
              <Text style={styles.removeText}>{tx("Retirer", "Remove")}</Text>
            </Pressable>
            <Pressable style={[styles.button, { backgroundColor: tint }]} onPress={onClose}>
              <Text style={styles.closeText}>{tx("Fermer", "Close")}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function getStyles(colors: ReturnType<typeof useThemedColors>) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: 28 },
    card: { width: "100%", maxWidth: 360, alignItems: "center", padding: 22, borderRadius: radii.lg, backgroundColor: colors.white },
    ring: { width: 104, height: 104, borderRadius: 52, padding: 3 },
    photo: { width: "100%", height: "100%", borderRadius: 50, backgroundColor: colors.cream2 },
    placeholder: { alignItems: "center", justifyContent: "center" },
    placeholderIcon: { fontSize: 42 },
    name: { fontFamily: fonts.displayExtra, fontSize: 24, color: colors.dark, marginTop: 12 },
    place: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.grey, marginTop: 2 },
    status: { fontFamily: fonts.bodyBold, fontSize: 12, color: "#FFFFFF", paddingHorizontal: 12, paddingVertical: 5, borderRadius: radii.pill, overflow: "hidden", marginTop: 12 },
    text: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.dark, textAlign: "center", marginTop: 12 },
    hint: { fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.grey, textAlign: "center", marginTop: 6 },
    actions: { flexDirection: "row", gap: 10, marginTop: 18, alignSelf: "stretch" },
    button: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: radii.pill },
    removeButton: { backgroundColor: colors.cream2 },
    removeText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.grey },
    closeText: { fontFamily: fonts.bodyBold, fontSize: 13, color: "#FFFFFF" },
  });
}
