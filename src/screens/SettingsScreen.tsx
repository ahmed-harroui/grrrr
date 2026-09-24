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
import { getAccountProfile, getPrimaryPetProfile, saveAccountProfile, updatePetProfile } from "@/data/api/profile";
import { supabase } from "@/lib/supabase";

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const { session, demoMode, signOut } = useAuth();
  const { mode: themeMode, setMode: setThemeMode } = useTheme();
  const { language, setLanguage } = useLocalization();
  const { t } = useTranslation();
  const colors = useThemedColors();
  const [loading, setLoading] = useState(Boolean(session));
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [petId, setPetId] = useState<string | null>(null);
  const [petName, setPetName] = useState("");
  const [petBreed, setPetBreed] = useState("");
  const [petCity, setPetCity] = useState("");
  const [petBio, setPetBio] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!session?.user.id) {
      setLoading(false);
      return;
    }

    Promise.all([getAccountProfile(session.user.id), getPrimaryPetProfile(session.user.id)]).then(([account, pet]) => {
      if (account.data) {
        setDisplayName(account.data.display_name ?? "");
        setAvatarUrl(account.data.avatar_url ?? "");
      }
      if (pet.data) {
        setPetId(pet.data.id ?? null);
        setPetName(pet.data.pet_name);
        setPetBreed(pet.data.breed);
        setPetCity(pet.data.city);
        setPetBio(pet.data.bio);
      }
      setLoading(false);
    });
  }, [session?.user.id]);

  const saveSettings = async () => {
    if (!session?.user.id) return;
    setSaving(true);
    const accountResult = await saveAccountProfile({ user_id: session.user.id, display_name: displayName.trim(), avatar_url: avatarUrl.trim() });
    if (accountResult.error) {
      setSaving(false);
      Alert.alert(t.settings.impossible, accountResult.error.message);
      return;
    }

    if (petId) {
      const petResult = await updatePetProfile(petId, session.user.id, {
        pet_name: petName.trim(),
        breed: petBreed.trim(),
        city: petCity.trim(),
        bio: petBio.trim(),
      });
      if (petResult.error) {
        setSaving(false);
        Alert.alert(t.settings.impossible, petResult.error.message);
        return;
      }
    }

    if (password) {
      if (!supabase) {
        setSaving(false);
        Alert.alert(t.common.error, t.settings.supabaseError);
        return;
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setSaving(false);
        Alert.alert(t.settings.passwordFailed, error.message);
        return;
      }
      setPassword("");
    }

    setSaving(false);
    Alert.alert(t.settings.modified, t.settings.modifiedDesc);
  };

  if (loading) return <SafeAreaView style={[styles.container, { backgroundColor: colors.cream }]}><ActivityIndicator color={colors.coral} style={styles.loader} /></SafeAreaView>;

  if (demoMode || !session) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.cream }]} edges={["top", "bottom"]}>
        <View style={[styles.header, { borderBottomColor: colors.line }]}><Pressable onPress={() => navigation.goBack()}><Text style={[styles.back, { color: colors.dark }]}>←</Text></Pressable><Text style={[styles.headerTitle, { color: colors.dark }]}>{t.settings.title}</Text></View>
        <View style={styles.empty}><Text style={[styles.emptyTitle, { color: colors.dark }]}>{t.settings.loginRequired}</Text><Text style={[styles.emptyText, { color: colors.grey }]}>{t.settings.loginDescription}</Text></View>
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

        <Section title={t.settings.pet} colors={colors}>
          {petId ? <>
            <Field label={t.settings.petName} value={petName} onChangeText={setPetName} placeholder={t.settings.petName} colors={colors} />
            <Field label={t.settings.petBreed} value={petBreed} onChangeText={setPetBreed} placeholder={t.settings.petBreed} colors={colors} />
            <Field label={t.settings.petCity} value={petCity} onChangeText={setPetCity} placeholder={t.settings.petCity} colors={colors} />
            <Field label={t.settings.petBio} value={petBio} onChangeText={setPetBio} placeholder={t.settings.petBio} multiline colors={colors} />
          </> : <Text style={[styles.note, { color: colors.grey }]}>{t.settings.createPetFirst}</Text>}
        </Section>

        <Section title={t.settings.security} colors={colors}>
          <Field label={t.settings.newPassword} value={password} onChangeText={setPassword} placeholder={t.settings.passwordHint} secureTextEntry autoCapitalize="none" colors={colors} />
          <Text style={[styles.note, { color: colors.grey }]}>{t.settings.passwordNote}</Text>
        </Section>

        <Pressable style={[styles.saveButton, { backgroundColor: colors.coral }, saving && styles.saveButtonDisabled]} onPress={saveSettings} disabled={saving}>
          <Text style={styles.saveText}>{saving ? t.settings.saving : t.settings.saveChanges}</Text>
        </Pressable>
        <Pressable style={styles.signOutButton} onPress={signOut}><Text style={[styles.signOutText, { color: colors.coralDark }]}>{t.settings.signOut}</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children, colors }: { title: string; children: React.ReactNode; colors: ReturnType<typeof useThemedColors> }) {
  return <View style={[styles.section, { backgroundColor: colors.white, borderColor: colors.line }]}><Text style={[styles.sectionTitle, { color: colors.dark }]}>{title}</Text>{children}</View>;
}

function Field({ label, value, onChangeText, placeholder, editable = true, multiline = false, secureTextEntry = false, autoCapitalize, colors }: { label: string; value: string; onChangeText?: (value: string) => void; placeholder?: string; editable?: boolean; multiline?: boolean; secureTextEntry?: boolean; autoCapitalize?: "none" | "sentences" | "words" | "characters"; colors: ReturnType<typeof useThemedColors> }) {
  return <View style={styles.field}><Text style={[styles.label, { color: colors.dark }]}>{label}</Text><TextInput style={[styles.input, { backgroundColor: colors.cream, borderColor: colors.line, color: colors.dark }, multiline && styles.multiline, !editable && [styles.inputDisabled, { backgroundColor: colors.cream2 }]]} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.grey} editable={editable} multiline={multiline} secureTextEntry={secureTextEntry} autoCapitalize={autoCapitalize} /></View>;
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
