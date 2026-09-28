import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { colors, fonts, radii } from "@/theme/theme";
import { useAuth } from "@/context/AuthContext";
import { createPetProfile, LocalPhoto, PetRecord, uploadPetPhoto } from "@/data/api/profile";

// Start blank: never pre-fill with the demo pet, or skipped steps would save demo data.
const DEFAULT_PET: PetRecord = {
  pet_name: "",
  breed: "",
  age: 0,
  city: "",
  bio: "",
  energy: 2,
  mode: 50,
  photo_url: "",
  owner_id: "",
  species: "dog",
  tags: [],
  gender: "M",
};

type Step = "name" | "breed" | "age" | "city" | "bio" | "energy" | "mode";

const STEPS: { key: Step; title: string; titleEn: string; subtitle: string; subtitleEn: string; placeholder: string; placeholderEn: string }[] = [
  { key: "name", title: "Comment s'appelle ton compagnon ?", titleEn: "What's your companion's name?", subtitle: "Tu peux passer cette étape et le faire plus tard.", subtitleEn: "You can skip this step and do it later.", placeholder: "Ex. Rocky", placeholderEn: "E.g. Rocky" },
  { key: "breed", title: "Quelle est sa race ?", titleEn: "What breed are they?", subtitle: "Une race approximative fonctionne aussi.", subtitleEn: "An approximate breed works too.", placeholder: "Ex. Golden Retriever", placeholderEn: "E.g. Golden Retriever" },
  { key: "age", title: "Quel âge a-t-il ?", titleEn: "How old are they?", subtitle: "Cela nous aide à trouver des profils compatibles.", subtitleEn: "This helps us find compatible profiles.", placeholder: "Ex. 3", placeholderEn: "E.g. 3" },
  { key: "city", title: "Dans quelle ville êtes-vous ?", titleEn: "Which city are you in?", subtitle: "Pour proposer des rencontres proches.", subtitleEn: "To suggest meetups nearby.", placeholder: "Ex. Paris", placeholderEn: "E.g. Paris" },
  { key: "bio", title: "Présente ton compagnon", titleEn: "Introduce your companion", subtitle: "Quelques mots sur son caractère et ses habitudes.", subtitleEn: "A few words about their personality and habits.", placeholder: "Il adore courir et jouer...", placeholderEn: "Loves to run and play..." },
];

import { useTranslation } from "@/i18n/useTranslation";

export default function PetProfileSetupScreen({ onDone }: { onDone: () => void }) {
  const { session } = useAuth();
  const { tx } = useTranslation();
  const [stepIndex, setStepIndex] = useState(0);
  const [profile, setProfile] = useState<PetRecord>(DEFAULT_PET);
  const [loading, setLoading] = useState(Boolean(session));
  const [saving, setSaving] = useState(false);
  const [photoAsset, setPhotoAsset] = useState<LocalPhoto | null>(null);
  const photo = photoAsset?.uri ?? "";
  const step = STEPS[stepIndex];
  const isChoiceStep = stepIndex >= STEPS.length;

  useEffect(() => {
    if (!session?.user.id) return;
    setLoading(false);
  }, [session?.user.id]);

  const updateText = (value: string) => {
    if (step.key === "age") setProfile((current) => ({ ...current, age: Number(value.replace(/[^0-9]/g, "")) || 0 }));
    else setProfile((current) => ({ ...current, [step.key === "name" ? "pet_name" : step.key]: value }));
  };

  const finish = async () => {
    if (!profile.pet_name.trim()) {
      Alert.alert(tx("Il manque un nom", "Name missing"), tx("Donne au moins un nom à ton compagnon pour créer son profil.", "Give your companion at least a name to create their profile."));
      setStepIndex(0);
      return;
    }
    setSaving(true);
    if (session?.user.id) {
      let photoUrl = "";
      if (photoAsset) {
        const upload = await uploadPetPhoto(session.user.id, photoAsset);
        if (upload.error) Alert.alert(tx("Photo non envoyée", "Photo not uploaded"), `${upload.error.message}\n\n${tx("Tu pourras l'ajouter depuis ton profil.", "You can add it from your profile.")}`);
        photoUrl = upload.url;
      }
      const { error } = await createPetProfile({ ...profile, photo_url: photoUrl, owner_id: session.user.id });
      if (error) {
        setSaving(false);
        Alert.alert(tx("Profil non enregistré", "Profile not saved"), error.message);
        return;
      }
    }
    setSaving(false);
    onDone();
  };

  const choosePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: true });
    if (!result.canceled) {
      const asset = result.assets[0];
      setPhotoAsset({ uri: asset.uri, base64: asset.base64, mimeType: asset.mimeType });
    }
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
        <Pressable onPress={skip} hitSlop={10}><Text style={styles.skip}>{tx("Passer", "Skip")}</Text></Pressable>
      </View>
      <View style={styles.progressTrack}><View style={[styles.progress, { width: `${((stepIndex + 1) / 7) * 100}%` }]} /></View>

      {!isChoiceStep ? (
        <View style={styles.content}>
          <Pressable onPress={choosePhoto} style={styles.photoPicker}>{photo ? <Image source={{ uri: photo }} style={styles.photoPreview} /> : <View style={styles.photoEmpty}><Text style={styles.photoEmptyText}>🐾</Text></View>}<View style={styles.cameraBadge}><Text>📸</Text></View></Pressable>
          <Text style={styles.emoji}>🐾</Text>
          <Text style={styles.title}>{tx(step.title, step.titleEn)}</Text>
          <Text style={styles.subtitle}>{tx(step.subtitle, step.subtitleEn)}</Text>
          <TextInput
            autoFocus
            value={step.key === "name" ? profile.pet_name : step.key === "age" ? (profile.age ? String(profile.age) : "") : String(profile[step.key] ?? "")}
            onChangeText={updateText}
            placeholder={tx(step.placeholder, step.placeholderEn)}
            placeholderTextColor={colors.grey}
            keyboardType={step.key === "age" ? "number-pad" : "default"}
            multiline={step.key === "bio"}
            style={[styles.input, step.key === "bio" && styles.bioInput]}
          />
        </View>
      ) : (
        <View style={styles.content}>
          <Text style={styles.emoji}>⚡</Text>
          <Text style={styles.title}>{tx("Quel est son niveau d'énergie ?", "What's their energy level?")}</Text>
          <Text style={styles.subtitle}>{tx("Tu pourras modifier cette préférence depuis ton profil.", "You can change this from your profile.")}</Text>
          <View style={styles.options}>{([1, 2, 3, 4] as const).map((value) => <Pressable key={value} onPress={() => setProfile((current) => ({ ...current, energy: value }))} style={[styles.option, profile.energy === value && styles.optionActive]}><Text style={[styles.optionText, profile.energy === value && styles.optionTextActive]}>{value === 1 ? "Chill" : value === 2 ? tx("Calme", "Calm") : value === 3 ? tx("Actif", "Active") : tx("Très actif", "Very active")}</Text></Pressable>)}</View>
          <Text style={[styles.title, styles.secondaryTitle]}>{tx("Son intention de rencontre", "What they're looking for")}</Text>
          <View style={styles.modeRow}>{([0, 50, 100] as const).map((value) => <Pressable key={value} onPress={() => setProfile((current) => ({ ...current, mode: value }))} style={[styles.modeOption, profile.mode === value && styles.modeActive]}><Text style={styles.modeText}>{value === 0 ? "Friend" : value === 50 ? "Both" : "Hot"}</Text></Pressable>)}</View>
          <Text style={[styles.title, styles.secondaryTitle]}>{tx("Son genre", "Their gender")}</Text>
          <View style={styles.modeRow}>
            <Pressable onPress={() => setProfile((current) => ({ ...current, gender: "M" }))} style={[styles.modeOption, profile.gender === "M" && styles.modeActive]}><Text style={styles.modeText}>{tx("♂ Mâle", "♂ Male")}</Text></Pressable>
            <Pressable onPress={() => setProfile((current) => ({ ...current, gender: "F" }))} style={[styles.modeOption, profile.gender === "F" && styles.modeActive]}><Text style={styles.modeText}>{tx("♀ Femelle", "♀ Female")}</Text></Pressable>
          </View>
        </View>
      )}

      <View style={styles.footer}>
        <Pressable style={styles.primary} onPress={isChoiceStep ? finish : next} disabled={saving}><Text style={styles.primaryText}>{saving ? tx("Enregistrement...", "Saving...") : isChoiceStep ? tx("Terminer", "Finish") : tx("Continuer", "Continue")}</Text></Pressable>
        {!isChoiceStep && <Pressable onPress={skip} style={styles.skipBottom}><Text style={styles.skipBottomText}>{tx("Répondre plus tard", "Answer later")}</Text></Pressable>}
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
  photoPicker: { width: 118, height: 118, borderRadius: 59, alignSelf: "flex-start", backgroundColor: colors.white, borderWidth: 3, borderColor: colors.coral, marginBottom: 18, overflow: "visible" },
  photoPreview: { width: "100%", height: "100%", borderRadius: 56 },
  photoEmpty: { width: "100%", height: "100%", borderRadius: 56, alignItems: "center", justifyContent: "center", backgroundColor: colors.cream2 },
  photoEmptyText: { fontSize: 40 },
  cameraBadge: { position: "absolute", right: -4, bottom: -4, width: 34, height: 34, borderRadius: 17, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line },
});
