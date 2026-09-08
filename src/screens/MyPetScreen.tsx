import React, { useEffect, useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fonts, radii } from "@/theme/theme";
import { ME } from "@/data/mockPets";
import Header from "@/components/Header";
import { useAuth } from "@/context/AuthContext";
import { getProfile, ProfileRecord, saveProfile } from "@/data/api/profile";

const DEFAULT_PROFILE: ProfileRecord = {
  user_id: "demo",
  pet_name: ME.name,
  breed: ME.breed,
  age: ME.age,
  city: "Paris",
  bio: ME.bio,
  energy: ME.energy,
  mode: ME.mode,
  photo_url: ME.photo,
};

const ENERGY_OPTIONS: ProfileRecord["energy"][] = [1, 2, 3, 4];

export default function MyPetScreen() {
  const { session, signOut } = useAuth();
  const [profile, setProfile] = useState<ProfileRecord>(DEFAULT_PROFILE);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session?.user.id) return;
    getProfile(session.user.id).then(({ data }) => {
      if (data) setProfile(data);
    });
  }, [session?.user.id]);

  const update = <K extends keyof ProfileRecord>(key: K, value: ProfileRecord[K]) => {
    setProfile((current) => ({ ...current, [key]: value }));
  };

  const persist = async () => {
    setSaving(true);
    const { error } = await saveProfile({ ...profile, user_id: session?.user.id ?? "demo" });
    setSaving(false);
    if (error) {
      Alert.alert("Impossible d'enregistrer", error.message);
      return;
    }
    setEditing(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Header />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }}>
        <View style={styles.photoWrap}>
          <Image source={{ uri: profile.photo_url }} style={styles.photo} />
          <View style={styles.photoBadge}><Text style={styles.photoBadgeText}>🐾</Text></View>
        </View>
        {editing ? (
          <TextInput value={profile.pet_name} onChangeText={(value) => update("pet_name", value)} style={styles.nameInput} placeholder="Nom de ton compagnon" />
        ) : <Text style={styles.name}>{profile.pet_name}</Text>}
        <Text style={styles.sub}>{profile.breed} · {profile.age} ans · 📍 {profile.city}</Text>

        <View style={styles.statsRow}>
          <Stat big={profile.energy >= 3 ? "⚡ High" : "🌿 Chill"} small="ENERGY" />
          <Stat big="🎾🏃" small="ACTIVITÉS" />
          <Stat big={profile.mode > 65 ? "Hot" : profile.mode < 35 ? "Friend" : "Both"} small="MODE" />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>À propos</Text>
          <Pressable onPress={() => (editing ? persist() : setEditing(true))}>
            <Text style={styles.editText}>{saving ? "..." : editing ? "Enregistrer" : "Modifier"}</Text>
          </Pressable>
        </View>
        <View style={styles.bioCard}>
          {editing ? <TextInput value={profile.bio} onChangeText={(value) => update("bio", value)} multiline style={styles.bioInput} /> : <Text style={styles.bioText}>"{profile.bio}"</Text>}
        </View>

        {editing && (
          <View style={styles.editPanel}>
            <Text style={styles.fieldLabel}>RACE</Text>
            <TextInput value={profile.breed} onChangeText={(value) => update("breed", value)} style={styles.input} />
            <Text style={styles.fieldLabel}>VILLE</Text>
            <TextInput value={profile.city} onChangeText={(value) => update("city", value)} style={styles.input} />
            <Text style={styles.fieldLabel}>NIVEAU D'ÉNERGIE</Text>
            <View style={styles.optionsRow}>{ENERGY_OPTIONS.map((value) => <Pressable key={value} onPress={() => update("energy", value)} style={[styles.option, profile.energy === value && styles.optionActive]}><Text style={[styles.optionText, profile.energy === value && styles.optionTextActive]}>{value}</Text></Pressable>)}</View>
            <Text style={styles.fieldLabel}>INTENTION</Text>
            <View style={styles.optionsRow}>
              {[0, 50, 100].map((value) => <Pressable key={value} onPress={() => update("mode", value)} style={[styles.modeOption, profile.mode === value && styles.modeOptionActive]}><Text style={[styles.modeText, profile.mode === value && styles.modeTextActive]}>{value === 0 ? "Friend" : value === 100 ? "Hot" : "Both"}</Text></Pressable>)}
            </View>
          </View>
        )}

        <View style={styles.compat}>
          <Text style={styles.compatLabel}>COMPATIBILITÉ MOYENNE</Text>
          <Text style={styles.compatValue}>91%</Text>
        </View>
        {session && <Pressable onPress={signOut} style={styles.signOut}><Text style={styles.signOutText}>Se déconnecter</Text></Pressable>}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ big, small }: { big: string; small: string }) {
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={styles.statBig}>{big}</Text>
      <Text style={styles.statSmall}>{small}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  photoWrap: { position: "relative" },
  photo: { width: "100%", height: 230, borderRadius: radii.lg, marginBottom: 14 },
  photoBadge: { position: "absolute", right: 14, bottom: 26, width: 42, height: 42, borderRadius: 21, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  photoBadgeText: { fontSize: 19 },
  name: { fontFamily: fonts.displayExtra, fontSize: 26, color: colors.dark, textAlign: "center" },
  nameInput: { fontFamily: fonts.displayExtra, fontSize: 26, color: colors.dark, textAlign: "center", borderBottomWidth: 1, borderBottomColor: colors.coral, paddingVertical: 0 },
  sub: { fontFamily: fonts.body, fontSize: 13, color: colors.grey, textAlign: "center", marginTop: 2 },
  statsRow: { flexDirection: "row", justifyContent: "center", gap: 22, marginVertical: 16 },
  statBig: { fontFamily: fonts.display, fontSize: 15, color: colors.dark },
  statSmall: { fontFamily: fonts.body, fontSize: 10.5, color: colors.grey, marginTop: 2 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  sectionTitle: { fontFamily: fonts.displaySemi, fontSize: 17, color: colors.dark },
  editText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.coralDark },
  bioCard: {
    backgroundColor: "#fff",
    borderRadius: radii.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
  },
  bioText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: colors.dark },
  bioInput: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: colors.dark, minHeight: 72, textAlignVertical: "top" },
  editPanel: { backgroundColor: colors.white, borderRadius: radii.md, padding: 14, marginTop: 12, borderWidth: 1, borderColor: colors.line },
  fieldLabel: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.grey, marginTop: 4, marginBottom: 6 },
  input: { height: 42, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.cream, paddingHorizontal: 12, color: colors.dark, fontFamily: fonts.body, marginBottom: 8 },
  optionsRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  option: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.cream, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line },
  optionActive: { backgroundColor: colors.coral, borderColor: colors.coral },
  optionText: { fontFamily: fonts.bodySemi, color: colors.grey },
  optionTextActive: { color: colors.white },
  modeOption: { flex: 1, paddingVertical: 10, borderRadius: radii.sm, backgroundColor: colors.cream, alignItems: "center", borderWidth: 1, borderColor: colors.line },
  modeOptionActive: { backgroundColor: colors.cream2, borderColor: colors.hot },
  modeText: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.grey },
  modeTextActive: { color: colors.dark },
  compat: { alignItems: "center", marginTop: 18 },
  compatLabel: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.grey },
  compatValue: { fontFamily: fonts.displayExtra, fontSize: 28, color: colors.coralDark, marginTop: 2 },
  signOut: { alignItems: "center", paddingVertical: 22 },
  signOutText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.grey },
});
