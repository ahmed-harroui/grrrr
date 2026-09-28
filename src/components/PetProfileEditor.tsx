import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { fonts, radii } from "@/theme/theme";
import { useThemedColors } from "@/hooks/useThemedColors";
import { SPECIES, speciesLabel } from "@/components/AddPetSheet";
import { useTranslation } from "@/i18n/useTranslation";
import type { LocalPhoto } from "@/data/api/profile";
import type { Pet, PetHealth } from "@/data/mockPets";

export interface PetDraft {
  name: string;
  species: Pet["species"];
  breed: string;
  age: number;
  gender: Pet["gender"];
  city: string;
  /** Used by Discover to show nearby pets first */
  country?: string;
  bio: string;
  energy: Pet["energy"];
  mode: number;
  tags: string[];
  avatar: LocalPhoto | null;
  gallery: LocalPhoto[];
  /** Shared with GRRRR Care; only shown for pets saved in the database */
  health?: PetHealth;
}

export const EMPTY_HEALTH: PetHealth = { birthday: null, weight: null, microchip: null, sterilized: null, color: null, allergies: null };

interface Props {
  visible: boolean;
  initial: PetDraft;
  onClose: () => void;
  /** Resolves true when saved; the editor stays open otherwise */
  onSave: (draft: PetDraft) => Promise<boolean>;
}

const MAX_GALLERY = 6;
const MAX_TAGS = 8;
const MAX_BIO = 300;
const WHITE = "#FFFFFF";

const TAG_SUGGESTIONS = {
  fr: ["🎾 Joueur", "⚡ Énergique", "🥰 Câlin", "🛋️ Chill", "🌿 Curieux", "❤️ Sociable", "🏃 Sportif", "🌊 Aime l'eau", "🍖 Gourmand", "😴 Dormeur", "🐾 Explorateur", "🧠 Malin", "🤝 Gentil avec les enfants", "🐱 Ami des chats"],
  en: ["🎾 Playful", "⚡ Energetic", "🥰 Cuddly", "🛋️ Chill", "🌿 Curious", "❤️ Sociable", "🏃 Sporty", "🌊 Loves water", "🍖 Foodie", "😴 Sleepyhead", "🐾 Explorer", "🧠 Clever", "🤝 Good with kids", "🐱 Cat friendly"],
};

const ENERGY_CHOICES: { value: Pet["energy"]; icon: string; label: string; labelEn: string }[] = [
  { value: 1, icon: "🌿", label: "Très chill", labelEn: "Very chill" },
  { value: 2, icon: "🙂", label: "Doux", labelEn: "Gentle" },
  { value: 3, icon: "⚡", label: "Actif", labelEn: "Active" },
  { value: 4, icon: "🔥", label: "Infatigable", labelEn: "Tireless" },
];

const MODE_CHOICES = [
  { value: 0, icon: "🐾", label: "Friend", hint: "Se faire des amis", hintEn: "Make friends" },
  { value: 50, icon: "✨", label: "Both", hint: "Ouvert à tout", hintEn: "Open to anything" },
  { value: 100, icon: "❤️", label: "Hot", hint: "Belle rencontre", hintEn: "A special someone" },
];

const nearestMode = (mode: number) => (mode < 25 ? 0 : mode > 75 ? 100 : 50);

export default function PetProfileEditor({ visible, initial, onClose, onSave }: Props) {
  const colors = useThemedColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { tx, language } = useTranslation();
  const [draft, setDraft] = useState<PetDraft>(initial);
  const [customTag, setCustomTag] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setDraft(initial);
      setCustomTag("");
    }
    // Reset only when the editor opens, not on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const completionItems = [draft.avatar, draft.gallery.length > 0, draft.name.trim(), draft.breed.trim(), draft.age > 0, draft.city.trim(), draft.bio.trim(), draft.tags.length > 0];
  const completion = completionItems.filter(Boolean).length / completionItems.length;

  const set = <K extends keyof PetDraft>(key: K, value: PetDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const setHealth = <K extends keyof PetHealth>(key: K, value: PetHealth[K]) => setDraft((current) => ({ ...current, health: { ...(current.health ?? EMPTY_HEALTH), [key]: value } }));
  const [weightText, setWeightText] = useState("");
  useEffect(() => {
    if (visible) setWeightText(initial.health?.weight != null ? String(initial.health.weight) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const pickImages = async (source: "camera" | "library", options: { square: boolean; multiple: number }): Promise<LocalPhoto[]> => {
    const permission = source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(tx("Autorisation refusée", "Permission denied"), source === "camera" ? tx("Autorise l'appareil photo dans les réglages pour prendre une photo.", "Allow camera access in settings to take a photo.") : tx("Autorise l'accès aux photos dans les réglages pour en ajouter.", "Allow photo access in settings to add some."));
      return [];
    }
    const multiple = source === "library" && options.multiple > 1;
    const pickerOptions: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      quality: 0.7,
      base64: true,
      allowsEditing: !multiple,
      aspect: options.square ? [1, 1] : [4, 5],
      allowsMultipleSelection: multiple,
      selectionLimit: multiple ? options.multiple : 1,
    };
    const result = source === "camera" ? await ImagePicker.launchCameraAsync(pickerOptions) : await ImagePicker.launchImageLibraryAsync(pickerOptions);
    if (result.canceled) return [];
    return result.assets.map((asset) => ({ uri: asset.uri, base64: asset.base64, mimeType: asset.mimeType }));
  };

  const askSource = (onPick: (source: "camera" | "library") => void) => {
    Alert.alert(tx("Ajouter une photo", "Add a photo"), undefined, [
      { text: tx("📸 Prendre une photo", "📸 Take a photo"), onPress: () => onPick("camera") },
      { text: tx("🖼️ Choisir dans la galerie", "🖼️ Choose from gallery"), onPress: () => onPick("library") },
      { text: tx("Annuler", "Cancel"), style: "cancel" },
    ]);
  };

  const changeAvatar = () => askSource(async (source) => {
    const [photo] = await pickImages(source, { square: true, multiple: 1 });
    if (photo) set("avatar", photo);
  });

  const addGalleryPhotos = () => {
    const remaining = MAX_GALLERY - draft.gallery.length;
    if (remaining <= 0) return;
    askSource(async (source) => {
      const photos = await pickImages(source, { square: false, multiple: remaining });
      if (photos.length) setDraft((current) => ({ ...current, gallery: [...current.gallery, ...photos].slice(0, MAX_GALLERY) }));
    });
  };

  const galleryActions = (index: number) => {
    const photo = draft.gallery[index];
    Alert.alert("Photo " + (index + 1), undefined, [
      {
        text: tx("⭐ Mettre en photo principale", "⭐ Set as main photo"),
        onPress: () => setDraft((current) => {
          const gallery = current.gallery.filter((_, i) => i !== index);
          // The previous avatar goes back into the gallery so nothing is lost.
          return { ...current, avatar: photo, gallery: current.avatar ? [current.avatar, ...gallery] : gallery };
        }),
      },
      ...(index > 0 ? [{ text: tx("⬅️ Déplacer en premier", "⬅️ Move to first"), onPress: () => setDraft((current) => ({ ...current, gallery: [photo, ...current.gallery.filter((_, i) => i !== index)] })) }] : []),
      { text: tx("🗑️ Supprimer", "🗑️ Delete"), style: "destructive" as const, onPress: () => removeGalleryPhoto(index) },
      { text: tx("Annuler", "Cancel"), style: "cancel" as const },
    ]);
  };

  const removeGalleryPhoto = (index: number) => setDraft((current) => ({ ...current, gallery: current.gallery.filter((_, i) => i !== index) }));

  const toggleTag = (tag: string) => setDraft((current) => {
    if (current.tags.includes(tag)) return { ...current, tags: current.tags.filter((item) => item !== tag) };
    if (current.tags.length >= MAX_TAGS) {
      Alert.alert(tx("Maximum atteint", "Limit reached"), tx(`Tu peux choisir jusqu'à ${MAX_TAGS} traits de caractère.`, `You can pick up to ${MAX_TAGS} traits.`));
      return current;
    }
    return { ...current, tags: [...current.tags, tag] };
  });

  const addCustomTag = () => {
    const tag = customTag.trim();
    if (!tag) return;
    if (!draft.tags.includes(tag)) toggleTag(tag);
    setCustomTag("");
  };

  const cancel = () => {
    if (!dirty || saving) return onClose();
    Alert.alert(tx("Abandonner les modifications ?", "Discard changes?"), tx("Tes changements ne seront pas enregistrés.", "Your changes won't be saved."), [
      { text: tx("Continuer l'édition", "Keep editing"), style: "cancel" },
      { text: tx("Abandonner", "Discard"), style: "destructive", onPress: onClose },
    ]);
  };

  const save = async () => {
    if (draft.health?.birthday && !/^\d{4}-\d{2}-\d{2}$/.test(draft.health.birthday)) {
      Alert.alert(tx("Date invalide", "Invalid date"), tx("La date de naissance doit ressembler à 2021-05-20.", "Birthday must look like 2021-05-20."));
      return;
    }
    if (!draft.name.trim()) {
      Alert.alert(tx("Il manque un nom", "Name missing"), tx("Donne un nom à ton compagnon avant d'enregistrer.", "Give your companion a name before saving."));
      return;
    }
    setSaving(true);
    const saved = await onSave({ ...draft, name: draft.name.trim(), breed: draft.breed.trim(), city: draft.city.trim(), country: draft.country?.trim(), bio: draft.bio.trim() });
    setSaving(false);
    if (saved) onClose();
  };

  const suggestions = TAG_SUGGESTIONS[language];
  const allTags = [...suggestions, ...draft.tags.filter((tag) => !suggestions.includes(tag))];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={cancel}>
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.topBar}>
          <Pressable onPress={cancel} hitSlop={10} disabled={saving}><Text style={styles.cancel}>{tx("Annuler", "Cancel")}</Text></Pressable>
          <Text style={styles.topTitle}>{tx("Modifier le profil", "Edit profile")}</Text>
          <Pressable onPress={save} hitSlop={10} disabled={saving}>{saving ? <ActivityIndicator color={colors.coral} /> : <Text style={styles.topSave}>OK</Text>}</Pressable>
        </View>

        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.completionCard}>
              <View style={styles.completionHeader}>
                <Text style={styles.completionLabel}>{tx("Profil complété", "Profile completed")}</Text>
                <Text style={styles.completionValue}>{Math.round(completion * 100)}%</Text>
              </View>
              <View style={styles.completionTrack}><View style={[styles.completionFill, { width: `${completion * 100}%` }]} /></View>
              {completion < 1 && <Text style={styles.completionHint}>{tx("Un profil complet attire plus de compagnons 🐾", "A complete profile attracts more companions 🐾")}</Text>}
            </View>

            {/* Avatar */}
            <View style={styles.avatarSection}>
              <Pressable onPress={changeAvatar} style={styles.avatarRing}>
                {draft.avatar?.uri ? <Image source={{ uri: draft.avatar.uri }} style={styles.avatar} /> : <View style={[styles.avatar, styles.avatarEmpty]}><Text style={styles.avatarEmptyIcon}>🐾</Text></View>}
                <View style={styles.cameraBadge}><Text style={styles.cameraIcon}>📸</Text></View>
              </Pressable>
              <Pressable onPress={changeAvatar}><Text style={styles.link}>{draft.avatar ? tx("Changer la photo principale", "Change main photo") : tx("Ajouter une photo principale", "Add a main photo")}</Text></Pressable>
            </View>

            {/* Gallery */}
            <Section title={tx("Galerie photos", "Photo gallery")} hint={`${draft.gallery.length}/${MAX_GALLERY} · ${tx("Touche une photo pour plus d'options", "Tap a photo for more options")}`} styles={styles}>
              <View style={styles.galleryGrid}>
                {draft.gallery.map((photo, index) => (
                  <Pressable key={photo.uri + index} onPress={() => galleryActions(index)} style={styles.galleryCell}>
                    <Image source={{ uri: photo.uri }} style={styles.galleryImage} />
                    {index === 0 && <View style={styles.galleryFirst}><Text style={styles.galleryFirstText}>{tx("1ʳᵉ", "1st")}</Text></View>}
                    <Pressable onPress={() => removeGalleryPhoto(index)} hitSlop={8} style={styles.galleryRemove}><Text style={styles.galleryRemoveText}>✕</Text></Pressable>
                  </Pressable>
                ))}
                {draft.gallery.length < MAX_GALLERY && (
                  <Pressable onPress={addGalleryPhotos} style={[styles.galleryCell, styles.galleryAdd]}>
                    <Text style={styles.galleryAddIcon}>＋</Text>
                    <Text style={styles.galleryAddText}>{tx("Ajouter", "Add")}</Text>
                  </Pressable>
                )}
              </View>
            </Section>

            {/* Identity */}
            <Section title={tx("Identité", "Identity")} styles={styles}>
              <Field label={tx("NOM", "NAME")} styles={styles}>
                <TextInput value={draft.name} onChangeText={(value) => set("name", value)} placeholder={tx("Ex. Rocky", "E.g. Rocky")} placeholderTextColor={colors.grey} style={styles.input} maxLength={30} />
              </Field>
              <Field label={tx("ESPÈCE", "SPECIES")} styles={styles}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                  {SPECIES.map((item) => (
                    <Pressable key={item.key} onPress={() => set("species", item.key)} style={[styles.speciesChip, draft.species === item.key && styles.chipActive]}>
                      <Text style={styles.speciesIcon}>{item.icon}</Text>
                      <Text style={[styles.chipText, draft.species === item.key && styles.chipTextActive]}>{speciesLabel(item, language)}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </Field>
              <Field label={tx("RACE", "BREED")} styles={styles}>
                <TextInput value={draft.breed} onChangeText={(value) => set("breed", value)} placeholder={tx("Ex. Golden Retriever", "E.g. Golden Retriever")} placeholderTextColor={colors.grey} style={styles.input} maxLength={40} />
              </Field>
              <View style={styles.row}>
                <Field label={tx("ÂGE", "AGE")} styles={styles} style={styles.flex}>
                  <View style={styles.stepper}>
                    <Pressable onPress={() => set("age", Math.max(0, draft.age - 1))} style={styles.stepperButton}><Text style={styles.stepperSign}>−</Text></Pressable>
                    <Text style={styles.stepperValue}>{draft.age} {draft.age > 1 ? tx("ans", "yrs") : tx("an", "yr")}</Text>
                    <Pressable onPress={() => set("age", Math.min(80, draft.age + 1))} style={styles.stepperButton}><Text style={styles.stepperSign}>+</Text></Pressable>
                  </View>
                </Field>
                <Field label={tx("GENRE", "GENDER")} styles={styles} style={styles.flex}>
                  <View style={styles.segment}>
                    {(["M", "F"] as const).map((gender) => (
                      <Pressable key={gender} onPress={() => set("gender", gender)} style={[styles.segmentItem, draft.gender === gender && styles.segmentActive]}>
                        <Text style={[styles.segmentText, draft.gender === gender && styles.segmentTextActive]}>{gender === "M" ? tx("♂ Mâle", "♂ Male") : tx("♀ Femelle", "♀ Female")}</Text>
                      </Pressable>
                    ))}
                  </View>
                </Field>
              </View>
              <Field label={tx("VILLE", "CITY")} styles={styles}>
                <TextInput value={draft.city} onChangeText={(value) => set("city", value)} placeholder={tx("Ex. Paris", "E.g. Paris")} placeholderTextColor={colors.grey} style={styles.input} maxLength={40} />
              </Field>
              <Field label={tx("PAYS", "COUNTRY")} styles={styles}>
                <TextInput value={draft.country ?? ""} onChangeText={(value) => set("country", value)} placeholder={tx("Ex. France", "E.g. France")} placeholderTextColor={colors.grey} style={styles.input} maxLength={40} />
              </Field>
            </Section>

            {/* Bio */}
            <Section title={tx("À propos", "About")} hint={`${draft.bio.length}/${MAX_BIO}`} styles={styles}>
              <TextInput value={draft.bio} onChangeText={(value) => set("bio", value.slice(0, MAX_BIO))} multiline placeholder={tx("Son caractère, ses habitudes, ce qu'il adore...", "Personality, habits, what they love...")} placeholderTextColor={colors.grey} style={[styles.input, styles.bioInput]} />
            </Section>

            {/* Energy */}
            <Section title={tx("Niveau d'énergie", "Energy level")} styles={styles}>
              <View style={styles.energyGrid}>
                {ENERGY_CHOICES.map((choice) => (
                  <Pressable key={choice.value} onPress={() => set("energy", choice.value)} style={[styles.energyCard, draft.energy === choice.value && styles.chipActive]}>
                    <Text style={styles.energyIcon}>{choice.icon}</Text>
                    <Text style={[styles.chipText, draft.energy === choice.value && styles.chipTextActive]}>{tx(choice.label, choice.labelEn)}</Text>
                  </Pressable>
                ))}
              </View>
            </Section>

            {/* Mode */}
            <Section title={tx("Ce qu'il recherche", "Looking for")} styles={styles}>
              <View style={styles.row}>
                {MODE_CHOICES.map((choice) => {
                  const active = nearestMode(draft.mode) === choice.value;
                  return (
                    <Pressable key={choice.value} onPress={() => set("mode", choice.value)} style={[styles.modeCard, active && (choice.value === 0 ? styles.modeFriend : styles.modeHot)]}>
                      <Text style={styles.energyIcon}>{choice.icon}</Text>
                      <Text style={[styles.modeLabel, active && styles.modeLabelActive]}>{choice.label}</Text>
                      <Text style={[styles.modeHint, active && styles.modeLabelActive]}>{tx(choice.hint, choice.hintEn)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </Section>

            {/* Health, shared with GRRRR Care */}
            {draft.health && (
              <Section title={tx("Santé", "Health")} hint={tx("Partagé avec GRRRR Care", "Shared with GRRRR Care")} styles={styles}>
                <View style={styles.row}>
                  <Field label={tx("POIDS (KG)", "WEIGHT (KG)")} styles={styles} style={styles.flex}>
                    <TextInput value={weightText} onChangeText={(value) => { const clean = value.replace(",", ".").replace(/[^0-9.]/g, ""); setWeightText(clean); setHealth("weight", clean && !Number.isNaN(Number(clean)) ? Number(clean) : null); }} keyboardType="decimal-pad" placeholder={tx("Ex. 12.5", "E.g. 12.5")} placeholderTextColor={colors.grey} style={styles.input} maxLength={6} />
                  </Field>
                  <Field label={tx("NAISSANCE", "BIRTHDAY")} styles={styles} style={styles.flex}>
                    <TextInput value={draft.health.birthday ?? ""} onChangeText={(value) => setHealth("birthday", value.trim() || null)} placeholder="2021-05-20" placeholderTextColor={colors.grey} style={styles.input} maxLength={10} />
                  </Field>
                </View>
                <Field label={tx("NUMÉRO DE PUCE", "MICROCHIP NUMBER")} styles={styles}>
                  <TextInput value={draft.health.microchip ?? ""} onChangeText={(value) => setHealth("microchip", value.trim() ? value : null)} placeholder="250268..." placeholderTextColor={colors.grey} style={styles.input} maxLength={20} />
                </Field>
                <Field label={tx("STÉRILISÉ(E)", "NEUTERED / SPAYED")} styles={styles}>
                  <View style={styles.segment}>
                    {([true, false] as const).map((value) => (
                      <Pressable key={String(value)} onPress={() => setHealth("sterilized", draft.health?.sterilized === value ? null : value)} style={[styles.segmentItem, draft.health?.sterilized === value && styles.segmentActive]}>
                        <Text style={[styles.segmentText, draft.health?.sterilized === value && styles.segmentTextActive]}>{value ? tx("Oui", "Yes") : tx("Non", "No")}</Text>
                      </Pressable>
                    ))}
                  </View>
                </Field>
                <Field label={tx("ROBE / COULEUR", "COAT / COLOR")} styles={styles}>
                  <TextInput value={draft.health.color ?? ""} onChangeText={(value) => setHealth("color", value.trim() ? value : null)} placeholder={tx("Ex. fauve, tache blanche", "E.g. fawn, white patch")} placeholderTextColor={colors.grey} style={styles.input} maxLength={60} />
                </Field>
                <Field label={tx("ALLERGIES", "ALLERGIES")} styles={styles}>
                  <TextInput value={draft.health.allergies ?? ""} onChangeText={(value) => setHealth("allergies", value.trim() ? value : null)} placeholder={tx("Ex. poulet, pollen", "E.g. chicken, pollen")} placeholderTextColor={colors.grey} style={styles.input} maxLength={120} />
                </Field>
              </Section>
            )}

            {/* Tags */}
            <Section title={tx("Ses petites habitudes", "Little habits")} hint={`${draft.tags.length}/${MAX_TAGS}`} styles={styles}>
              <View style={styles.tagsWrap}>
                {allTags.map((tag) => {
                  const active = draft.tags.includes(tag);
                  return (
                    <Pressable key={tag} onPress={() => toggleTag(tag)} style={[styles.tag, active && styles.chipActive]}>
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{tag}{active ? "  ✓" : ""}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.customTagRow}>
                <TextInput value={customTag} onChangeText={setCustomTag} onSubmitEditing={addCustomTag} placeholder={tx("Ajouter un trait (ex. 🦴 Adore les os)", "Add a trait (e.g. 🦴 Loves bones)")} placeholderTextColor={colors.grey} style={[styles.input, styles.flex]} maxLength={28} returnKeyType="done" />
                <Pressable onPress={addCustomTag} style={[styles.customTagButton, !customTag.trim() && styles.disabled]} disabled={!customTag.trim()}><Text style={styles.customTagButtonText}>＋</Text></Pressable>
              </View>
            </Section>
          </ScrollView>
        </KeyboardAvoidingView>

        <View style={styles.footer}>
          <Pressable onPress={save} disabled={saving} style={[styles.saveButton, saving && styles.disabled]}>
            {saving ? <><ActivityIndicator color={WHITE} /><Text style={styles.saveText}>  {tx("Envoi des photos...", "Uploading photos...")}</Text></> : <Text style={styles.saveText}>{tx("✓ Enregistrer le profil", "✓ Save profile")}</Text>}
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

type Styles = ReturnType<typeof getStyles>;

function Section({ title, hint, children, styles }: { title: string; hint?: string; children: React.ReactNode; styles: Styles }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Field({ label, children, styles, style }: { label: string; children: React.ReactNode; styles: Styles; style?: object }) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function getStyles(colors: ReturnType<typeof useThemedColors>) {
  return StyleSheet.create({
    flex: { flex: 1 },
    container: { flex: 1, backgroundColor: colors.cream },
    topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
    cancel: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.grey },
    topTitle: { fontFamily: fonts.displaySemi, fontSize: 18, color: colors.dark },
    topSave: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.coralDark },
    content: { padding: 18, paddingBottom: 40 },
    completionCard: { backgroundColor: colors.cream2, borderRadius: radii.md, padding: 14, borderWidth: 1, borderColor: colors.line },
    completionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    completionLabel: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.dark },
    completionValue: { fontFamily: fonts.displayExtra, fontSize: 18, color: colors.coralDark },
    completionTrack: { height: 8, borderRadius: 4, backgroundColor: colors.line, marginTop: 8, overflow: "hidden" },
    completionFill: { height: "100%", borderRadius: 4, backgroundColor: colors.coral },
    completionHint: { fontFamily: fonts.body, fontSize: 11, color: colors.grey, marginTop: 7 },
    avatarSection: { alignItems: "center", marginTop: 22, marginBottom: 6 },
    avatarRing: { width: 132, height: 132, borderRadius: 66, borderWidth: 4, borderColor: colors.coral, padding: 3, backgroundColor: colors.white },
    avatar: { width: "100%", height: "100%", borderRadius: 62 },
    avatarEmpty: { alignItems: "center", justifyContent: "center", backgroundColor: colors.cream2 },
    avatarEmptyIcon: { fontSize: 42 },
    cameraBadge: { position: "absolute", right: -2, bottom: 2, width: 40, height: 40, borderRadius: 20, backgroundColor: colors.coral, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: colors.cream },
    cameraIcon: { fontSize: 17 },
    link: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.coralDark, marginTop: 12 },
    section: { backgroundColor: colors.white, borderRadius: radii.lg, padding: 16, marginTop: 16, borderWidth: 1, borderColor: colors.line },
    sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 },
    sectionTitle: { fontFamily: fonts.displaySemi, fontSize: 17, color: colors.dark },
    sectionHint: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.grey },
    galleryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    galleryCell: { width: "31.8%", aspectRatio: 4 / 5, borderRadius: radii.sm, overflow: "hidden", backgroundColor: colors.cream2 },
    galleryImage: { width: "100%", height: "100%" },
    galleryFirst: { position: "absolute", left: 6, bottom: 6, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: radii.pill, paddingHorizontal: 7, paddingVertical: 2 },
    galleryFirstText: { fontFamily: fonts.bodyBold, fontSize: 10, color: WHITE },
    galleryRemove: { position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
    galleryRemoveText: { color: WHITE, fontSize: 11, fontFamily: fonts.bodyBold },
    galleryAdd: { alignItems: "center", justifyContent: "center", borderWidth: 2, borderStyle: "dashed", borderColor: colors.coral },
    galleryAddIcon: { fontSize: 28, color: colors.coralDark },
    galleryAddText: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.coralDark, marginTop: 2 },
    field: { marginBottom: 12 },
    fieldLabel: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 0.6, color: colors.grey, marginBottom: 6 },
    input: { minHeight: 46, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.cream, paddingHorizontal: 13, color: colors.dark, fontFamily: fonts.body, fontSize: 14 },
    bioInput: { minHeight: 110, paddingTop: 12, textAlignVertical: "top", lineHeight: 20 },
    row: { flexDirection: "row", gap: 10 },
    chipsRow: { gap: 8, paddingRight: 8 },
    speciesChip: { alignItems: "center", paddingVertical: 8, paddingHorizontal: 12, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.cream, minWidth: 72 },
    speciesIcon: { fontSize: 22 },
    chipActive: { borderColor: colors.coral, backgroundColor: colors.cream2 },
    chipText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.dark, marginTop: 3 },
    chipTextActive: { color: colors.coralDark, fontFamily: fonts.bodyBold },
    stepper: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 46, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.cream, paddingHorizontal: 5 },
    stepperButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.cream2, alignItems: "center", justifyContent: "center" },
    stepperSign: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.coralDark },
    stepperValue: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.dark },
    segment: { flexDirection: "row", height: 46, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.cream, padding: 3 },
    segmentItem: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 9 },
    segmentActive: { backgroundColor: colors.coral },
    segmentText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.grey },
    segmentTextActive: { color: WHITE },
    energyGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    energyCard: { width: "48.5%", alignItems: "center", paddingVertical: 12, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.cream },
    energyIcon: { fontSize: 24 },
    modeCard: { flex: 1, alignItems: "center", paddingVertical: 12, paddingHorizontal: 4, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.cream },
    modeFriend: { backgroundColor: colors.friend, borderColor: colors.friend },
    modeHot: { backgroundColor: colors.coral, borderColor: colors.coral },
    modeLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.dark, marginTop: 4 },
    modeHint: { fontFamily: fonts.body, fontSize: 10, color: colors.grey, marginTop: 2, textAlign: "center" },
    modeLabelActive: { color: WHITE },
    tagsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
    tag: { borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.cream, paddingHorizontal: 12, paddingVertical: 6 },
    customTagRow: { flexDirection: "row", gap: 8, marginTop: 12 },
    customTagButton: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.coral, alignItems: "center", justifyContent: "center" },
    customTagButtonText: { color: WHITE, fontSize: 22, fontFamily: fonts.bodyBold },
    disabled: { opacity: 0.5 },
    footer: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 8, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.cream },
    saveButton: { flexDirection: "row", backgroundColor: colors.coral, borderRadius: radii.pill, paddingVertical: 16, alignItems: "center", justifyContent: "center" },
    saveText: { fontFamily: fonts.bodyBold, color: WHITE, fontSize: 14 },
  });
}
