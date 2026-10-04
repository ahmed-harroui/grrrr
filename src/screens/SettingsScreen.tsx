import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { fonts, radii } from "@/theme/theme";
import { useAuth } from "@/context/AuthContext";
import { useTheme, ThemeMode } from "@/context/ThemeContext";
import { useLocalization } from "@/context/LocalizationContext";
import { useTranslation } from "@/i18n/useTranslation";
import { useThemedColors } from "@/hooks/useThemedColors";
import { deleteMyAccount, getAccountProfile, saveAccountProfile } from "@/data/api/profile";
import { supabase } from "@/lib/supabase";

const SITE_URL = "https://grrrr-main.vercel.app";

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const { session, demoMode, signOut } = useAuth();
  const { mode: themeMode, setMode: setThemeMode } = useTheme();
  const { language, setLanguage } = useLocalization();
  const { t, tx } = useTranslation();
  const colors = useThemedColors();
  const [loading, setLoading] = useState(Boolean(session));
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // For good: the account, its pets, matches, messages and health records (migration 026).
  const confirmDelete = () => {
    Alert.alert(
      tx("Supprimer ton compte ?", "Delete your account?"),
      tx("Ton compte, tes compagnons, tes matchs, tes messages et le carnet de santé GRR Care seront supprimés définitivement. C'est irréversible.", "Your account, your pets, matches, messages and the GRR Care health record will be deleted for good. This cannot be undone."),
      [
        { text: tx("Annuler", "Cancel"), style: "cancel" },
        {
          text: tx("Supprimer définitivement", "Delete for good"),
          style: "destructive",
          onPress: async () => {
            if (!session?.user.id) return;
            setDeleting(true);
            const { error } = await deleteMyAccount(session.user.id);
            setDeleting(false);
            if (error) Alert.alert(tx("Suppression impossible", "Could not delete"), tx("Réessaie dans un instant.", "Try again in a moment."));
            else await signOut();
          },
        },
      ]
    );
  };

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

  const saveSettings = async () => {
    if (!session?.user.id) return;
    setSaving(true);
    const accountResult = await saveAccountProfile({ user_id: session.user.id, display_name: displayName.trim(), avatar_url: avatarUrl.trim() });
    if (accountResult.error) {
      setSaving(false);
      Alert.alert(t.settings.impossible, accountResult.error.message);
      return;
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

        {/* The pet's own details are edited in My Pet › Edit profile, not here. */}
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

        {/* Legal pages (on the website) and account deletion, both asked for by the stores */}
        <View style={styles.legalRow}>
          <Pressable onPress={() => Linking.openURL(`${SITE_URL}/privacy`)}><Text style={[styles.legalLink, { color: colors.grey }]}>{tx("Confidentialité", "Privacy")}</Text></Pressable>
          <Text style={{ color: colors.grey }}>·</Text>
          <Pressable onPress={() => Linking.openURL(`${SITE_URL}/terms`)}><Text style={[styles.legalLink, { color: colors.grey }]}>{tx("Conditions", "Terms")}</Text></Pressable>
        </View>
        <Pressable style={styles.deleteButton} onPress={confirmDelete} disabled={deleting}>
          <Text style={styles.deleteText}>{deleting ? tx("Suppression…", "Deleting…") : tx("Supprimer mon compte", "Delete my account")}</Text>
        </Pressable>
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

function LanguageSelector({ language, onLanguageChange, colors }: { language: string; onLanguageChange: (lang: "fr" | "en") => Promise<void>; colors: ReturnType<typeof useThemedColors> }) {
  const { t } = useTranslation();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.dark }]}>{t.common.language}</Text>
      <View style={[styles.languageButtons, { borderColor: colors.line }]}>
        <Pressable style={[styles.langBtn, { borderRightColor: colors.line }, language === "fr" && [styles.langBtnActive, { backgroundColor: colors.coral }]]} onPress={() => onLanguageChange("fr")}>
          <Text style={[styles.langBtnText, { color: language === "fr" ? "#FFFFFF" : colors.dark }]}>Français</Text>
        </Pressable>
        <Pressable style={[styles.langBtn, { borderRightWidth: 0 }, language === "en" && [styles.langBtnActive, { backgroundColor: colors.coral }]]} onPress={() => onLanguageChange("en")}>
          <Text style={[styles.langBtnText, { color: language === "en" ? "#FFFFFF" : colors.dark }]}>English</Text>
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
            style={[styles.themeBtn, { borderRightColor: colors.line }, mode === "system" && { borderRightWidth: 0 }, themeMode === mode && [styles.themeBtnActive, { backgroundColor: colors.coral }]]}
            onPress={() => onThemeChange(mode)}
          >
            <Text style={[styles.themeBtnText, { color: themeMode === mode ? "#FFFFFF" : colors.dark }]}>
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
  legalRow: { flexDirection: "row", justifyContent: "center", gap: 10, marginTop: 4 },
  legalLink: { fontFamily: fonts.bodySemi, fontSize: 12, textDecorationLine: "underline" },
  deleteButton: { alignItems: "center", paddingVertical: 18 },
  deleteText: { fontFamily: fonts.bodySemi, fontSize: 12, color: "#C0392B" },
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
