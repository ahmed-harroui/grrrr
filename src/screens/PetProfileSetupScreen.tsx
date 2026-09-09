import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, fonts, radii } from "@/theme/theme";
import { useAuth } from "@/context/AuthContext";
import { getProfile, ProfileRecord, saveProfile } from "@/data/api/profile";
import { ME } from "@/data/mockPets";

const DEFAULT_PROFILE: ProfileRecord = {
  user_id: "",
  pet_name: ME.name,
  breed: ME.breed,
  age: ME.age,
  city: "Paris",
  bio: ME.bio,
  energy: ME.energy,
  mode: ME.mode,
  photo_url: ME.photo,
};

type Step = "name" | "breed" | "age" | "city" | "bio" | "energy" | "mode";

const STEPS: { key: Step; title: string; subtitle: string; placeholder: string }[] = [
  { key: "name", title: "Comment s'appelle ton compagnon ?", subtitle: "Tu peux passer cette étape et le faire plus tard.", placeholder: "Ex. Rocky" },
  { key: "breed", title: "Quelle est sa race ?", subtitle: "Une race approximative fonctionne aussi.", placeholder: "Ex. Golden Retriever" },
  { key: "age", title: "Quel âge a-t-il ?", subtitle: "Cela nous aide à trouver des profils compatibles.", placeholder: "Ex. 3" },
  { key: "city", title: "Dans quelle ville êtes-vous ?", subtitle: "Pour proposer des rencontres proches.", placeholder: "Ex. Paris" },
  { key: "bio", title: "Présente ton compagnon", subtitle: "Quelques mots sur son caractère et ses habitudes.", placeholder: "Il adore courir et jouer..." },
];

export default function PetProfileSetupScreen({ onDone }: { onDone: () => void }) {
  const { session } = useAuth();
  const [stepIndex, setStepIndex] = useState(0);
  const [profile, setProfile] = useState<ProfileRecord>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(Boolean(session));
  const [saving, setSaving] = useState(false);
  const step = STEPS[stepIndex];
  const isChoiceStep = stepIndex >= STEPS.length;

  useEffect(() => {
    if (!session?.user.id) return;
    getProfile(session.user.id).then(({ data }) => {
      if (data) setProfile(data);
      setLoading(false);
    });
  }, [session?.user.id]);

  const updateText = (value: string) => {
    if (step.key === "age") setProfile((current) => ({ ...current, age: Number(value.replace(/[^0-9]/g, "")) || 0 }));
    else setProfile((current) => ({ ...current, [step.key === "name" ? "pet_name" : step.key]: value }));
  };

  const finish = async () => {
    setSaving(true);
    if (session?.user.id) {
      const { error } = await saveProfile({ ...profile, user_id: session.user.id });
      if (error) {
        setSaving(false);
        Alert.alert("Profil non enregistré", error.message);
        return;
      }
    }
    setSaving(false);
    onDone();
  };

  const next = () => {
    if (stepIndex < STEPS.length - 1) setStepIndex((current) => current + 1);
    else setStepIndex(STEPS.length);
  };

  const skip = () => {
    if (isChoiceStep) return finish();
    next();
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.coral} /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Text style={styles.counter}>{isChoiceStep ? "6 / 7" : `${stepIndex + 1} / 7`}</Text>
        <Pressable onPress={skip} hitSlop={10}><Text style={styles.skip}>Passer</Text></Pressable>
      </View>
      <View style={styles.progressTrack}><View style={[styles.progress, { width: `${((stepIndex + 1) / 7) * 100}%` }]} /></View>

      {!isChoiceStep ? (
        <View style={styles.content}>
          <Text style={styles.emoji}>🐾</Text>
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.subtitle}>{step.subtitle}</Text>
          <TextInput
            autoFocus
            value={step.key === "name" ? profile.pet_name : String(profile[step.key] ?? "")}
            onChangeText={updateText}
            placeholder={step.placeholder}
            placeholderTextColor={colors.grey}
            keyboardType={step.key === "age" ? "number-pad" : "default"}
            multiline={step.key === "bio"}
            style={[styles.input, step.key === "bio" && styles.bioInput]}
          />
        </View>
      ) : (
        <View style={styles.content}>
          <Text style={styles.emoji}>⚡</Text>
          <Text style={styles.title}>Quel est son niveau d'énergie ?</Text>
          <Text style={styles.subtitle}>Tu pourras modifier cette préférence depuis ton profil.</Text>
          <View style={styles.options}>{([1, 2, 3, 4] as const).map((value) => <Pressable key={value} onPress={() => setProfile((current) => ({ ...current, energy: value }))} style={[styles.option, profile.energy === value && styles.optionActive]}><Text style={[styles.optionText, profile.energy === value && styles.optionTextActive]}>{value === 1 ? "Chill" : value === 2 ? "Calme" : value === 3 ? "Actif" : "Très actif"}</Text></Pressable>)}</View>
          <Text style={[styles.title, styles.secondaryTitle]}>Son intention de rencontre</Text>
          <View style={styles.modeRow}>{([0, 50, 100] as const).map((value) => <Pressable key={value} onPress={() => setProfile((current) => ({ ...current, mode: value }))} style={[styles.modeOption, profile.mode === value && styles.modeActive]}><Text style={styles.modeText}>{value === 0 ? "Friend" : value === 50 ? "Both" : "Hot"}</Text></Pressable>)}</View>
        </View>
      )}

      <View style={styles.footer}>
        <Pressable style={styles.primary} onPress={isChoiceStep ? finish : next} disabled={saving}><Text style={styles.primaryText}>{saving ? "Enregistrement..." : isChoiceStep ? "Terminer" : "Continuer"}</Text></Pressable>
        {!isChoiceStep && <Pressable onPress={skip} style={styles.skipBottom}><Text style={styles.skipBottomText}>Répondre plus tard</Text></Pressable>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream, padding: 24 },
  loading: { flex: 1, backgroundColor: colors.cream, alignItems: "center", justifyContent: "center" },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 14 },
  counter: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.grey },
  skip: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.grey },
  progressTrack: { height: 5, backgroundColor: colors.line, borderRadius: 3, marginTop: 14 },
  progress: { height: 5, backgroundColor: colors.coral, borderRadius: 3 },
  content: { flex: 1, justifyContent: "center" },
  emoji: { fontSize: 48, marginBottom: 20 },
  title: { fontFamily: fonts.displayExtra, color: colors.dark, fontSize: 28, lineHeight: 34 },
  subtitle: { fontFamily: fonts.body, color: colors.grey, fontSize: 14, lineHeight: 21, marginTop: 10, maxWidth: 320 },
  input: { height: 58, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 16, color: colors.dark, fontFamily: fonts.body, fontSize: 16, marginTop: 26 },
  bioInput: { height: 130, paddingTop: 16, textAlignVertical: "top" },
  options: { gap: 10, marginTop: 26 },
  option: { padding: 16, borderRadius: radii.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  optionActive: { borderColor: colors.coral, backgroundColor: colors.cream2 },
  optionText: { fontFamily: fonts.bodySemi, color: colors.dark },
  optionTextActive: { color: colors.coralDark },
  secondaryTitle: { fontSize: 20, marginTop: 30 },
  modeRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  modeOption: { flex: 1, alignItems: "center", paddingVertical: 13, borderRadius: radii.sm, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  modeActive: { borderColor: colors.hot, backgroundColor: colors.cream2 },
  modeText: { fontFamily: fonts.bodySemi, color: colors.dark },
  footer: { paddingBottom: 12 },
  primary: { backgroundColor: colors.coral, paddingVertical: 16, borderRadius: radii.lg, alignItems: "center" },
  primaryText: { fontFamily: fonts.displaySemi, color: colors.white, fontSize: 15 },
  skipBottom: { alignItems: "center", paddingTop: 16 },
  skipBottomText: { fontFamily: fonts.bodySemi, color: colors.grey, fontSize: 12 },
});
