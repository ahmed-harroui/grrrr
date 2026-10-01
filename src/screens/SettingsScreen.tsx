import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { fonts, radii } from "@/theme/theme";
import { useAuth } from "@/context/AuthContext";
import { useTheme, ThemeMode } from "@/context/ThemeContext";
import { useLocalization } from "@/context/LocalizationContext";
import { useTranslation } from "@/i18n/useTranslation";
import { useThemedColors } from "@/hooks/useThemedColors";
import { getAccountProfile, saveAccountProfile, updatePetProfile } from "@/data/api/profile";
import { useAppState } from "@/context/AppState";
import { supabase } from "@/lib/supabase";

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const { session, demoMode, signOut } = useAuth();
  const { mode: themeMode, setMode: setThemeMode } = useTheme();
  const { language, setLanguage } = useLocalization();
  const { t, tx } = useTranslation();
  const colors = useThemedColors();
  const { activePet, ownedPets, refreshOwnedPets, setMode } = useAppState();
  const [loading, setLoading] = useState(Boolean(session));
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  // The pet being edited: the active one (the one used in Discover, Matches and Chat).
  const pet = ownedPets.find((item) => item.id === activePet.id) ?? ownedPets[0];
  const [petName, setPetName] = useState("");
  const [petBreed, setPetBreed] = useState("");
  const [petAge, setPetAge] = useState("");
  const [petGender, setPetGender] = useState<"M" | "F">("M");
  const [petCity, setPetCity] = useState("");
  const [petCountry, setPetCountry] = useState("");
  const [petBio, setPetBio] = useState("");
  const [petEnergy, setPetEnergy] = useState<1 | 2 | 3 | 4>(2);
  const [petMode, setPetMode] = useState(50);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (!session?.user.id) {
      setLoading(false);
      return;
    }
    getAccountProfile(session.user.id).then((account) => {
      if (account.data) {
        setDisplayName(account.data.display_name ?? "");
        setAvatarUrl(account.data.avatar_url ?? "");
      }
      setLoading(false);
    });
  }, [session?.user.id]);

  // Fill the pet fields with what was entered when the pet was created.
  useEffect(() => {
    if (!pet) return;
    setPetName(pet.name);
    setPetBreed(pet.breed);
    setPetAge(pet.age ? String(pet.age) : "");
    setPetGender(pet.gender);
    setPetCity(pet.city ?? "");
    setPetCountry(pet.country ?? "");
    setPetBio(pet.bio);
    setPetEnergy(pet.energy);
    setPetMode(nearestMode(pet.mode));
  }, [pet?.dbId]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveSettings = async () => {
    if (!session?.user.id) return;
    if (pet?.dbId && !petName.trim()) {
      Alert.alert(tx("Il manque un nom", "Name missing"), tx("Ton compagnon doit avoir un nom.", "Your companion needs a name."));
      return;
    }
    setSaving(true);
    const accountResult = await saveAccountProfile({ user_id: session.user.id, display_name: displayName.trim(), avatar_url: avatarUrl.trim() });
    if (accountResult.error) {
      setSaving(false);
      Alert.alert(t.settings.impossible, accountResult.error.message);
      return;
    }

    if (pet?.dbId) {
      const petResult = await updatePetProfile(pet.dbId, session.user.id, {
        pet_name: petName.trim(),
        breed: petBreed.trim(),
        age: Math.min(80, Number(petAge) || 0),
        gender: petGender,
        city: petCity.trim(),
        country: petCountry.trim() || null,
        bio: petBio.trim(),
        energy: petEnergy,
        mode: petMode,
      });
      if (petResult.error) {
        setSaving(false);
        Alert.alert(t.settings.impossible, petResult.error.message);
        return;
      }
      await refreshOwnedPets();
      if (pet.id === activePet.id) setMode(petMode);
    }

    setSaving(false);
    Alert.alert(t.settings.modified, t.settings.modifiedDesc);
  };

  const changePassword = async () => {
    if (password.length < 6) {
      Alert.alert(t.settings.passwordFailed, tx("Le mot de passe doit contenir au moins 6 caractères.", "The password must be at least 6 characters."));
      return;
    }
    if (password !== passwordConfirm) {
      Alert.alert(t.settings.passwordFailed, tx("Les deux mots de passe ne sont pas identiques.", "The two passwords don't match."));
      return;
    }
    if (!supabase) {
      Alert.alert(t.common.error, t.settings.supabaseError);
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password });
    setChangingPassword(false);
    if (error) {
      Alert.alert(t.settings.passwordFailed, error.message);
      return;
    }
    setPassword("");
    setPasswordConfirm("");
    Alert.alert(tx("Mot de passe modifié ✓", "Password changed ✓"), tx("Utilise-le à ta prochaine connexion.", "Use it next time you sign in."));
  };

  if (loading) return <SafeAreaView style={[styles.container, { backgroundColor: colors.cream }]}><ActivityIndicator color={colors.coral} style={styles.loader} /></SafeAreaView>;

  if (demoMode || !session) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.cream }]} edges={["top", "bottom"]}>
        <View style={[styles.header, { borderBottomColor: colors.line }]}><Pressable onPress={() => navigation.goBack()}><Text style={[styles.back, { color: colors.dark }]}>←</Text></Pressable><Text style={[styles.headerTitle, { color: colors.dark }]}>{t.settings.title}</Text></View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Section title={t.settings.appearance} colors={colors}>
            <LanguageSelector language={language} onLanguageChange={setLanguage} colors={colors} />
            <ThemeSelector themeMode={themeMode} onThemeChange={setThemeMode} colors={colors} />
          </Section>
          <View style={styles.empty}><Text style={[styles.emptyTitle, { color: colors.dark }]}>{t.settings.loginRequired}</Text><Text style={[styles.emptyText, { color: colors.grey }]}>{t.settings.loginDescription}</Text></View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.cream }]} edges={["top", "bottom"]}>
      <View style={[styles.header, { borderBottomColor: colors.line }]}><Pressable onPress={() => navigation.goBack()} hitSlop={10}><Text style={[styles.back, { color: colors.dark }]}>←</Text></Pressable><Text style={[styles.headerTitle, { color: colors.dark }]}>{t.settings.title}</Text></View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.intro, { color: colors.grey }]}>{t.settings.manageInfo}</Text>

        <Section title={t.settings.account} colors={colors}>
          <Field label={t.settings.email} value={session.user.email ?? ""} editable={false} colors={colors} />
          <Field label={t.settings.displayName} value={displayName} onChangeText={setDisplayName} placeholder={t.settings.displayName} colors={colors} />
          <Field label={t.settings.avatarUrl} value={avatarUrl} onChangeText={setAvatarUrl} placeholder="https://..." autoCapitalize="none" colors={colors} />
        </Section>

        <Section title={t.settings.appearance} colors={colors}>
          <LanguageSelector language={language} onLanguageChange={setLanguage} colors={colors} />
          <ThemeSelector themeMode={themeMode} onThemeChange={setThemeMode} colors={colors} />
        </Section>

        <Section title={pet ? `${t.settings.pet} · ${pet.name}` : t.settings.pet} colors={colors}>
          {pet?.dbId ? <>
            <Text style={[styles.note, { color: colors.grey, marginTop: 0 }]}>{tx("Les infos données à la création. Pour les photos, l'espèce et les habitudes : My Pet › Modifier le profil.", "The info given at creation. For photos, species and habits: My Pet › Edit profile.")}</Text>
            <Field label={t.settings.petName} value={petName} onChangeText={setPetName} placeholder={t.settings.petName} colors={colors} />
            <Field label={t.settings.petBreed} value={petBreed} onChangeText={setPetBreed} placeholder={t.settings.petBreed} colors={colors} />
            <Field label={tx("Âge", "Age")} value={petAge} onChangeText={(value) => setPetAge(value.replace(/[^0-9]/g, ""))} placeholder={tx("Ex. 3", "E.g. 3")} keyboardType="number-pad" colors={colors} />
            <Choice label={tx("Genre", "Gender")} value={petGender} onChange={setPetGender} options={[["M", tx("♂ Mâle", "♂ Male")], ["F", tx("♀ Femelle", "♀ Female")]]} colors={colors} />
            <Field label={t.settings.petCity} value={petCity} onChangeText={setPetCity} placeholder={t.settings.petCity} colors={colors} />
            <Field label={tx("Pays", "Country")} value={petCountry} onChangeText={setPetCountry} placeholder={tx("Ex. France", "E.g. France")} colors={colors} />
            <Field label={t.settings.petBio} value={petBio} onChangeText={setPetBio} placeholder={t.settings.petBio} multiline colors={colors} />
            <Choice label={tx("Énergie", "Energy")} value={petEnergy} onChange={setPetEnergy} options={[[1, "Chill"], [2, tx("Calme", "Calm")], [3, tx("Actif", "Active")], [4, tx("Très actif", "Very active")]]} colors={colors} />
            <Choice label={tx("Intention de rencontre", "Looking for")} value={petMode} onChange={setPetMode} options={[[0, "🐾 Friend"], [50, "✨ Both"], [100, "❤️ Hot"]]} colors={colors} />
          </> : <Text style={[styles.note, { color: colors.grey }]}>{t.settings.createPetFirst}</Text>}
        </Section>

        <Pressable style={[styles.saveButton, { backgroundColor: colors.coral }, saving && styles.saveButtonDisabled]} onPress={saveSettings} disabled={saving}>
          <Text style={styles.saveText}>{saving ? t.settings.saving : t.settings.saveChanges}</Text>
        </Pressable>

        <Section title={t.settings.security} colors={colors}>
          <Field label={t.settings.newPassword} value={password} onChangeText={setPassword} placeholder={t.settings.passwordHint} secureTextEntry autoCapitalize="none" colors={colors} />
          <Field label={tx("Confirmer le mot de passe", "Confirm password")} value={passwordConfirm} onChangeText={setPasswordConfirm} placeholder={tx("Retape le nouveau mot de passe", "Type the new password again")} secureTextEntry autoCapitalize="none" colors={colors} />
          <Text style={[styles.note, { color: colors.grey }]}>{t.settings.passwordNote}</Text>
          <Pressable style={[styles.passwordButton, { borderColor: colors.coral }, (changingPassword || !password) && styles.saveButtonDisabled]} onPress={changePassword} disabled={changingPassword || !password}>
            <Text style={[styles.passwordButtonText, { color: colors.coralDark }]}>{changingPassword ? tx("Modification...", "Changing...") : tx("🔒 Changer le mot de passe", "🔒 Change password")}</Text>
          </Pressable>
        </Section>
        <Pressable style={styles.signOutButton} onPress={signOut}><Text style={[styles.signOutText, { color: colors.coralDark }]}>{t.settings.signOut}</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children, colors }: { title: string; children: React.ReactNode; colors: ReturnType<typeof useThemedColors> }) {
  return <View style={[styles.section, { backgroundColor: colors.white, borderColor: colors.line }]}><Text style={[styles.sectionTitle, { color: colors.dark }]}>{title}</Text>{children}</View>;
}

function Field({ label, value, onChangeText, placeholder, editable = true, multiline = false, secureTextEntry = false, autoCapitalize, keyboardType, colors }: { label: string; value: string; onChangeText?: (value: string) => void; placeholder?: string; editable?: boolean; multiline?: boolean; secureTextEntry?: boolean; autoCapitalize?: "none" | "sentences" | "words" | "characters"; keyboardType?: "default" | "number-pad"; colors: ReturnType<typeof useThemedColors> }) {
  return <View style={styles.field}><Text style={[styles.label, { color: colors.dark }]}>{label}</Text><TextInput style={[styles.input, { backgroundColor: colors.cream, borderColor: colors.line, color: colors.dark }, multiline && styles.multiline, !editable && [styles.inputDisabled, { backgroundColor: colors.cream2 }]]} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.grey} editable={editable} multiline={multiline} secureTextEntry={secureTextEntry} autoCapitalize={autoCapitalize} keyboardType={keyboardType} /></View>;
}

// Snaps any saved mode to the three choices offered at creation.
const nearestMode = (mode: number) => (mode < 25 ? 0 : mode > 75 ? 100 : 50);

function Choice<T extends string | number>({ label, value, onChange, options, colors }: { label: string; value: T; onChange: (value: T) => void; options: [T, string][]; colors: ReturnType<typeof useThemedColors> }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.dark }]}>{label}</Text>
      <View style={styles.choiceRow}>
        {options.map(([option, text]) => {
          const active = option === value;
          return (
            <Pressable key={String(option)} onPress={() => onChange(option)} style={[styles.choice, { borderColor: active ? colors.coral : colors.line, backgroundColor: active ? colors.cream2 : colors.cream }]}>
              <Text style={[styles.choiceText, { color: active ? colors.coralDark : colors.dark }]}>{text}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function LanguageSelector({ language, onLanguageChange, colors }: { language: string; onLanguageChange: (lang: "fr" | "en") => Promise<void>; colors: ReturnType<typeof useThemedColors> }) {
  const { t } = useTranslation();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.dark }]}>{t.common.language}</Text>
      <View style={[styles.languageButtons, { borderColor: colors.line }]}>
        <Pressable style={[styles.langBtn, language === "fr" && [styles.langBtnActive, { backgroundColor: colors.coral }]]} onPress={() => onLanguageChange("fr")}>
          <Text style={[styles.langBtnText, language === "fr" && { color: colors.white }]}>Français</Text>
        </Pressable>
        <Pressable style={[styles.langBtn, language === "en" && [styles.langBtnActive, { backgroundColor: colors.coral }]]} onPress={() => onLanguageChange("en")}>
          <Text style={[styles.langBtnText, language === "en" && { color: colors.white }]}>English</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ThemeSelector({ themeMode, onThemeChange, colors }: { themeMode: ThemeMode; onThemeChange: (mode: ThemeMode) => Promise<void>; colors: ReturnType<typeof useThemedColors> }) {
  const { t } = useTranslation();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.dark }]}>{t.common.theme}</Text>
      <View style={[styles.themeButtons, { borderColor: colors.line }]}>
        {(["light", "dark", "system"] as const).map((mode) => (
          <Pressable
            key={mode}
            style={[styles.themeBtn, themeMode === mode && [styles.themeBtnActive, { backgroundColor: colors.coral }]]}
            onPress={() => onThemeChange(mode)}
          >
            <Text style={[styles.themeBtnText, themeMode === mode && { color: colors.white }]}>
              {mode === "light" ? t.common.lightMode : mode === "dark" ? t.common.darkMode : t.common.systemMode}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1 },
  back: { fontSize: 24 },
  headerTitle: { fontFamily: fonts.displaySemi, fontSize: 20 },
  content: { padding: 20, paddingBottom: 36 },
  intro: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, marginBottom: 16 },
  section: { borderWidth: 1, borderRadius: radii.md, padding: 14, marginBottom: 12 },
  sectionTitle: { fontFamily: fonts.displaySemi, fontSize: 16, marginBottom: 8 },
  field: { marginTop: 10 },
  label: { fontFamily: fonts.bodySemi, fontSize: 11, marginBottom: 5 },
  input: { minHeight: 42, borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: 12, paddingVertical: 9, fontFamily: fonts.body, fontSize: 13 },
  inputDisabled: { opacity: 0.6 },
  multiline: { minHeight: 82, textAlignVertical: "top" },
  note: { fontFamily: fonts.body, fontSize: 11, lineHeight: 16, marginTop: 8 },
  saveButton: { borderRadius: radii.pill, alignItems: "center", paddingVertical: 14, marginTop: 8 },
  saveButtonDisabled: { opacity: 0.6 },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  choice: { flexGrow: 1, alignItems: "center", borderWidth: 1, borderRadius: radii.sm, paddingVertical: 10, paddingHorizontal: 8 },
  choiceText: { fontFamily: fonts.bodySemi, fontSize: 12 },
  passwordButton: { borderWidth: 1.5, borderRadius: radii.pill, alignItems: "center", paddingVertical: 12, marginTop: 12 },
  passwordButtonText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  saveText: { color: "#FFFFFF", fontFamily: fonts.bodyBold, fontSize: 13 },
  signOutButton: { alignItems: "center", paddingVertical: 16 },
  signOutText: { fontFamily: fonts.bodySemi, fontSize: 13 },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", padding: 36 },
  emptyTitle: { fontFamily: fonts.displaySemi, fontSize: 19, textAlign: "center" },
  emptyText: { fontFamily: fonts.body, fontSize: 13, textAlign: "center", marginTop: 8 },
  languageButtons: { flexDirection: "row", borderWidth: 1, borderRadius: radii.sm, overflow: "hidden" },
  langBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRightWidth: 1 },
  langBtnActive: { opacity: 1 },
  langBtnText: { fontFamily: fonts.bodySemi, fontSize: 12 },
  themeButtons: { flexDirection: "row", borderWidth: 1, borderRadius: radii.sm, overflow: "hidden" },
  themeBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRightWidth: 1 },
  themeBtnActive: { opacity: 1 },
  themeBtnText: { fontFamily: fonts.bodySemi, fontSize: 11 },
});
