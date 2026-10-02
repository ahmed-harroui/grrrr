import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { colors, fonts, radii } from "@/theme/theme";
import { useAuth } from "@/context/AuthContext";
import { becomeAdopter, createPetProfile, getAccountProfile, getOwnedPetProfiles, LocalPhoto, PetRecord, updatePetProfile, uploadPetPhoto } from "@/data/api/profile";
import { SPECIES, speciesLabel } from "@/components/AddPetSheet";
import { useTranslation } from "@/i18n/useTranslation";

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

// One question per screen, answered mostly by tapping; the pet's card builds itself above.
type Step = "species" | "name" | "gender" | "breed" | "age" | "city" | "personality" | "energy" | "photos";
const STEPS: Step[] = ["species", "name", "gender", "breed", "age", "city", "personality", "energy", "photos"];
const MAX_GALLERY = 6;
const MAX_TAGS = 5;
const MAIN_SPECIES = 8;

const BREEDS: Record<string, string[]> = {
  dog: ["Golden Retriever", "Labrador", "Berger Allemand", "Bouledogue français", "Border Collie", "Berger Australien", "Jack Russell", "Chihuahua", "Cavalier King Charles", "Croisé"],
  cat: ["Européen", "Maine Coon", "Siamois", "Persan", "Bengal", "British Shorthair", "Sacré de Birmanie", "Ragdoll", "Croisé"],
};
const CITIES = ["Paris", "Lyon", "Marseille", "Bordeaux", "Toulouse", "Lille", "Nantes", "Nice"];
// [French, English]; the French one is saved as a tag, like the rest of the app's tags.
const PERSONALITY: [string, string][] = [
  ["🎾 Joueur", "🎾 Playful"], ["🛋️ Câlin", "🛋️ Cuddly"], ["🏃 Sportif", "🏃 Sporty"], ["🌊 Aime l'eau", "🌊 Loves water"], ["🍖 Gourmand", "🍖 Foodie"],
  ["🐕 Sociable", "🐕 Sociable"], ["😴 Dormeur", "😴 Sleepy"], ["🧠 Malin", "🧠 Clever"], ["✨ Indépendant", "✨ Independent"], ["🐾 Curieux", "🐾 Curious"],
];
const ENERGY: { value: 1 | 2 | 3 | 4; icon: string; fr: string; en: string }[] = [
  { value: 1, icon: "🐢", fr: "Chill", en: "Chill" },
  { value: 2, icon: "😊", fr: "Calme", en: "Calm" },
  { value: 3, icon: "⚡", fr: "Actif", en: "Active" },
  { value: 4, icon: "🔥", fr: "Très actif", en: "Very active" },
];
const MODES: { value: number; icon: string; fr: string; en: string; hint: string; hintEn: string }[] = [
  { value: 0, icon: "🐾", fr: "Friend", en: "Friend", hint: "Copains de jeu", hintEn: "Playmates" },
  { value: 50, icon: "✦", fr: "Les deux", en: "Both", hint: "Ouvert à tout", hintEn: "Open to all" },
  { value: 100, icon: "❤️", fr: "Hot", en: "Hot", hint: "L'âme sœur", hintEn: "A soulmate" },
];

export default function PetProfileSetupScreen({ onDone }: { onDone: () => void }) {
  const { session } = useAuth();
  const { tx, language } = useTranslation();
  const [stepIndex, setStepIndex] = useState(0);
  const [profile, setProfile] = useState<PetRecord>(DEFAULT_PET);
  const [loading, setLoading] = useState(Boolean(session));
  const [saving, setSaving] = useState(false);
  const [photoAsset, setPhotoAsset] = useState<LocalPhoto | null>(null);
  const [gallery, setGallery] = useState<LocalPhoto[]>([]);
  const [allSpecies, setAllSpecies] = useState(false);
  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;
  const name = profile.pet_name.trim();
  const species = SPECIES.find((item) => item.key === profile.species) ?? SPECIES[0];

  // Starter card created with the account (migration 008): this setup fills it in.
  const [starterPetId, setStarterPetId] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user.id) return;
    getOwnedPetProfiles(session.user.id)
      .then(({ data }) => setStarterPetId(data.find((pet) => pet.setup_pending)?.id ?? null))
      .finally(() => setLoading(false));
  }, [session?.user.id]);

  // Each question slides in; the card pops when it changes.
  const enter = useRef(new Animated.Value(1)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const goTo = (index: number) => {
    const target = Math.max(0, Math.min(index, STEPS.length - 1));
    enter.setValue(0);
    setStepIndex(target);
    Animated.spring(enter, { toValue: 1, useNativeDriver: true, friction: 8, tension: 60 }).start();
  };
  const next = () => goTo(stepIndex + 1);
  const back = () => goTo(stepIndex - 1);
  const update = (changes: Partial<PetRecord>) => {
    setProfile((current) => ({ ...current, ...changes }));
    pop.setValue(0.94);
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, friction: 4, tension: 140 }).start();
  };
  // A single tap answers: move on right after.
  const pickAndNext = (changes: Partial<PetRecord>) => {
    update(changes);
    setTimeout(next, 280);
  };

  const toggleTag = (tag: string) => {
    const tags = profile.tags ?? [];
    if (tags.includes(tag)) update({ tags: tags.filter((item) => item !== tag) });
    else if (tags.length < MAX_TAGS) update({ tags: [...tags, tag] });
  };

  // "Write it for me": a first bio from what was answered, to edit freely.
  const writeBio = () => {
    const traits = (profile.tags ?? []).map((tag) => tag.replace(/^\S+\s/, "").toLowerCase());
    const who = [name || tx("Ton compagnon", "Your companion"), profile.age ? tx(`${profile.age} an${profile.age > 1 ? "s" : ""}`, `${profile.age} year${profile.age > 1 ? "s" : ""} old`) : "", profile.breed].filter(Boolean).join(", ");
    const personality = traits.length ? tx(` Plutôt ${traits.join(", ")}.`, ` Rather ${traits.join(", ")}.`) : "";
    const looking = profile.mode >= 75 ? tx(" Cherche l'âme sœur ❤️", " Looking for a soulmate ❤️") : profile.mode <= 25 ? tx(" Cherche des copains de balade 🐾", " Looking for walking buddies 🐾") : tx(" Ouvert aux belles rencontres ✦", " Open to great meetups ✦");
    update({ bio: `${who}.${personality}${looking}` });
  };

  const finish = async () => {
    if (!name) {
      Alert.alert(tx("Il manque un nom", "Name missing"), tx("Donne au moins un nom à ton compagnon pour créer son profil.", "Give your companion at least a name to create their profile."));
      goTo(STEPS.indexOf("name"));
      return;
    }
    setSaving(true);
    if (session?.user.id) {
      const ownerId = session.user.id;
      // Main photo first, then the gallery; a failed upload is skipped, not fatal.
      const uploads = await Promise.all([photoAsset, ...gallery].map((asset) => (asset ? uploadPetPhoto(ownerId, asset) : Promise.resolve(null))));
      const failed = uploads.find((upload) => upload?.error);
      if (failed?.error) Alert.alert(tx("Photo non envoyée", "Photo not uploaded"), `${failed.error.message}\n\n${tx("Tu pourras l'ajouter depuis ton profil.", "You can add it from your profile.")}`);
      const urls = uploads.map((upload) => (upload && !upload.error ? upload.url : ""));
      const [avatarUrl, ...galleryUrls] = urls;
      const photos = galleryUrls.filter(Boolean);
      // No main photo but a gallery: the first gallery picture becomes the avatar.
      const photoUrl = avatarUrl || photos.shift() || "";
      const record = { ...profile, pet_name: name, photo_url: photoUrl, photos, owner_id: ownerId };
      const { error } = starterPetId
        ? await updatePetProfile(starterPetId, ownerId, { ...record, setup_pending: false })
        : await createPetProfile(record);
      if (error) {
        setSaving(false);
        Alert.alert(tx("Profil non enregistré", "Profile not saved"), error.message);
        return;
      }
    }
    setSaving(false);
    onDone();
  };

  const pickImages = async (source: "camera" | "library", options: { square: boolean; limit: number }): Promise<LocalPhoto[]> => {
    const permission = source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(tx("Autorisation refusée", "Permission denied"), source === "camera" ? tx("Autorise l'appareil photo dans les réglages pour prendre une photo.", "Allow camera access in settings to take a photo.") : tx("Autorise l'accès aux photos dans les réglages pour en ajouter.", "Allow photo access in settings to add some."));
      return [];
    }
    const multiple = source === "library" && options.limit > 1;
    const pickerOptions: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      quality: 0.7,
      base64: true,
      allowsEditing: !multiple,
      aspect: options.square ? [1, 1] : [4, 5],
      allowsMultipleSelection: multiple,
      selectionLimit: multiple ? options.limit : 1,
    };
    const result = source === "camera" ? await ImagePicker.launchCameraAsync(pickerOptions) : await ImagePicker.launchImageLibraryAsync(pickerOptions);
    if (result.canceled) return [];
    return result.assets.map((asset) => ({ uri: asset.uri, base64: asset.base64, mimeType: asset.mimeType }));
  };

  const chooseMainPhoto = async (source: "camera" | "library") => {
    const [photo] = await pickImages(source, { square: true, limit: 1 });
    if (photo) {
      setPhotoAsset(photo);
      update({});
    }
  };

  const addGalleryPhotos = async (source: "camera" | "library") => {
    const remaining = MAX_GALLERY - gallery.length;
    if (remaining <= 0) return;
    const photos = await pickImages(source, { square: false, limit: remaining });
    if (photos.length) setGallery((current) => [...current, ...photos].slice(0, MAX_GALLERY));
  };

  // "I came to adopt": no pet to create now; one can be added later from My Pet.
  const continueAsAdopter = async () => {
    if (!session?.user.id) return onDone();
    setSaving(true);
    const ownerId = session.user.id;
    const { data: account } = await getAccountProfile(ownerId);
    const familyName = account?.display_name?.trim() || session.user.email?.split("@")[0] || tx("Famille adoptante", "Adopting family");
    const { error } = await becomeAdopter(ownerId, starterPetId, familyName);
    setSaving(false);
    if (error) {
      Alert.alert(tx("Impossible pour le moment", "Not possible right now"), error.message);
      return;
    }
    onDone();
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.coral} /></View>;

  const ageLabel = profile.age === 0 ? tx("Moins d'1 an", "Under 1 year") : tx(`${profile.age} an${profile.age > 1 ? "s" : ""}`, `${profile.age} year${profile.age > 1 ? "s" : ""}`);
  const ageStage = profile.age < 1 ? tx("Bébé 🍼", "Baby 🍼") : profile.age < 3 ? tx("Jeune 🌱", "Young 🌱") : profile.age < 8 ? tx("Adulte 💪", "Adult 💪") : tx("Senior 🎖️", "Senior 🎖️");
  const meta = [profile.breed.trim(), profile.age || step === "age" ? ageLabel : "", profile.city.trim()].filter(Boolean).join(" · ");
  const energy = ENERGY.find((item) => item.value === profile.energy);
  const mode = MODES.find((item) => item.value === profile.mode);
  const breedSuggestions = BREEDS[profile.species] ?? [tx("Croisé", "Mixed"), tx("Inconnue", "Unknown")];

  const titles: Record<Step, [string, string]> = {
    species: ["Qui est ton compagnon ?", "Who is your companion?"],
    name: ["Comment s'appelle-t-il ?", "What's their name?"],
    gender: [`${name || "Ton compagnon"} est…`, `${name || "Your companion"} is…`],
    breed: ["Quelle est sa race ?", "What breed?"],
    age: [`Quel âge a ${name || "ton compagnon"} ?`, `How old is ${name || "your companion"}?`],
    city: ["Où vivez-vous ?", "Where do you live?"],
    personality: [`Le caractère de ${name || "ton compagnon"}`, `${name || "Your companion"}'s personality`],
    energy: ["Son énergie et ce qu'il cherche", "Their energy and what they want"],
    photos: [`Montre-nous ${name || "ton compagnon"} !`, `Show us ${name || "your companion"}!`],
  };
  const subtitles: Record<Step, [string, string]> = {
    species: ["Touche son espèce.", "Tap their species."],
    name: [name ? `Enchanté ${name} ! 🐾` : "Son petit nom, celui qu'il reconnaît.", name ? `Nice to meet you ${name}! 🐾` : "The name they answer to."],
    gender: ["Utile pour les rencontres Hot et les relations.", "Useful for Hot meetups and relationships."],
    breed: ["Touche une suggestion ou écris-la.", "Tap a suggestion or type it."],
    age: ["Utilise − et +.", "Use − and +."],
    city: ["Pour te proposer des rencontres près de chez toi.", "To suggest meetups near you."],
    personality: [`Jusqu'à ${MAX_TAGS} traits, puis une bio (on peut l'écrire pour toi).`, `Up to ${MAX_TAGS} traits, then a bio (we can write it for you).`],
    energy: ["Ça aide à trouver les bons copains.", "It helps find the right buddies."],
    photos: ["Les profils avec photos reçoivent bien plus de likes.", "Profiles with photos get far more likes."],
  };

  const answered = (() => {
    switch (step) {
      case "name": return Boolean(name);
      case "breed": return Boolean(profile.breed.trim());
      case "city": return Boolean(profile.city.trim());
      case "personality": return Boolean((profile.tags ?? []).length || profile.bio.trim());
      case "photos": return Boolean(photoAsset || gallery.length);
      default: return true;
    }
  })();

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.topRow}>
        {stepIndex > 0 ? <Pressable onPress={back} hitSlop={10}><Text style={styles.backText}>← {tx("Retour", "Back")}</Text></Pressable> : <Text style={styles.counter}>{tx("Création du profil", "Profile setup")}</Text>}
        <Text style={styles.counter}>{`${stepIndex + 1} / ${STEPS.length}`}</Text>
      </View>
      <View style={styles.progressTrack}>
        {STEPS.map((item, index) => (
          <Pressable key={item} style={[styles.progressDot, index <= stepIndex && styles.progressDotDone]} onPress={() => index < stepIndex && goTo(index)} hitSlop={4} />
        ))}
      </View>

      {/* The pet's card, built live from the answers */}
      <Animated.View style={[styles.preview, { transform: [{ scale: pop }] }]}>
        <View style={styles.previewAvatar}>
          {photoAsset ? <Image source={{ uri: photoAsset.uri }} style={styles.previewPhoto} /> : <Text style={styles.previewIcon}>{species.icon}</Text>}
        </View>
        <View style={styles.previewCopy}>
          <Text style={styles.previewName} numberOfLines={1}>
            {name || tx("Ton compagnon", "Your companion")} {stepIndex > STEPS.indexOf("gender") || step === "gender" ? (profile.gender === "F" ? "♀" : "♂") : ""}
          </Text>
          <Text style={styles.previewMeta} numberOfLines={1}>{meta || speciesLabel(species, language)}</Text>
          <View style={styles.previewChips}>
            {stepIndex >= STEPS.indexOf("energy") && energy && <Text style={styles.previewChip}>{energy.icon} {tx(energy.fr, energy.en)}</Text>}
            {stepIndex >= STEPS.indexOf("energy") && mode && <Text style={styles.previewChip}>{mode.icon} {tx(mode.fr, mode.en)}</Text>}
            {(profile.tags ?? []).slice(0, 3).map((tag) => <Text key={tag} style={styles.previewChip}>{tag}</Text>)}
          </View>
        </View>
      </Animated.View>

      <Animated.View style={[styles.flex, { opacity: enter, transform: [{ translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [36, 0] }) }] }]}>
        <ScrollView style={styles.flex} contentContainerStyle={styles.stepContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>{tx(...titles[step])}</Text>
          <Text style={styles.subtitle}>{tx(...subtitles[step])}</Text>

          {step === "species" && (
            <>
              <View style={styles.grid}>
                {(allSpecies ? SPECIES : SPECIES.slice(0, MAIN_SPECIES)).map((item) => (
                  <Tile key={item.key} active={profile.species === item.key} onPress={() => pickAndNext({ species: item.key, breed: profile.species === item.key ? profile.breed : "" })} style={styles.speciesTile}>
                    <Text style={styles.tileIcon}>{item.icon}</Text>
                    <Text style={[styles.tileText, profile.species === item.key && styles.tileTextActive]} numberOfLines={1}>{speciesLabel(item, language)}</Text>
                  </Tile>
                ))}
              </View>
              {!allSpecies && <Pressable onPress={() => setAllSpecies(true)} style={styles.linkButton}><Text style={styles.linkText}>{tx("Autre animal…", "Another animal…")}</Text></Pressable>}
              {/* Here to adopt: no pet to create now */}
              <Pressable style={styles.adopterCard} onPress={continueAsAdopter} disabled={saving}>
                <Text style={styles.adopterTitle}>🍼 {tx("Tu viens pour adopter ?", "Here to adopt?")}</Text>
                <Text style={styles.adopterText}>{tx("Passe la création du pet : tu pourras en ajouter un plus tard dans Mon pet.", "Skip creating a pet: you can add one later in My Pet.")}</Text>
              </Pressable>
            </>
          )}

          {step === "name" && (
            <TextInput autoFocus value={profile.pet_name} onChangeText={(value) => update({ pet_name: value })} onSubmitEditing={() => name && next()} returnKeyType="next" placeholder={tx("Ex. Rocky", "E.g. Rocky")} placeholderTextColor={colors.grey} maxLength={30} style={[styles.input, styles.bigInput]} />
          )}

          {step === "gender" && (
            <View style={styles.row}>
              {(["M", "F"] as const).map((value) => (
                <Tile key={value} active={profile.gender === value} onPress={() => pickAndNext({ gender: value })} style={styles.bigTile}>
                  <Text style={styles.bigTileIcon}>{value === "M" ? "♂" : "♀"}</Text>
                  <Text style={[styles.tileText, profile.gender === value && styles.tileTextActive]}>{value === "M" ? tx("Mâle", "Male") : tx("Femelle", "Female")}</Text>
                </Tile>
              ))}
            </View>
          )}

          {step === "breed" && (
            <>
              <TextInput value={profile.breed} onChangeText={(value) => update({ breed: value })} placeholder={tx("Ex. Golden Retriever", "E.g. Golden Retriever")} placeholderTextColor={colors.grey} style={styles.input} />
              <View style={styles.chips}>
                {breedSuggestions.map((breed) => (
                  <Chip key={breed} label={breed} active={profile.breed === breed} onPress={() => update({ breed })} />
                ))}
              </View>
            </>
          )}

          {step === "age" && (
            <View style={styles.ageBox}>
              <View style={styles.ageRow}>
                <Pressable style={styles.ageButton} onPress={() => update({ age: Math.max(0, profile.age - 1) })}><Text style={styles.ageButtonText}>−</Text></Pressable>
                <View style={styles.ageValueBox}>
                  <Text style={styles.ageValue}>{profile.age === 0 ? "<1" : profile.age}</Text>
                  <Text style={styles.ageUnit}>{profile.age <= 1 ? tx("an", "year") : tx("ans", "years")}</Text>
                </View>
                <Pressable style={styles.ageButton} onPress={() => update({ age: Math.min(30, profile.age + 1) })}><Text style={styles.ageButtonText}>+</Text></Pressable>
              </View>
              <Text style={styles.ageStage}>{ageStage}</Text>
            </View>
          )}

          {step === "city" && (
            <>
              <TextInput value={profile.city} onChangeText={(value) => update({ city: value })} placeholder={tx("Ex. Paris", "E.g. Paris")} placeholderTextColor={colors.grey} style={styles.input} />
              <View style={styles.chips}>
                {CITIES.map((city) => <Chip key={city} label={`📍 ${city}`} active={profile.city === city} onPress={() => update({ city })} />)}
              </View>
            </>
          )}

          {step === "personality" && (
            <>
              <View style={styles.chips}>
                {PERSONALITY.map(([fr, en]) => <Chip key={fr} label={tx(fr, en)} active={(profile.tags ?? []).includes(fr)} onPress={() => toggleTag(fr)} />)}
              </View>
              <View style={styles.bioHeader}>
                <Text style={styles.label}>{tx("SA BIO", "THEIR BIO")}</Text>
                <Pressable onPress={writeBio} hitSlop={6}><Text style={styles.linkText}>✨ {tx("Écrire pour moi", "Write it for me")}</Text></Pressable>
              </View>
              <TextInput value={profile.bio} onChangeText={(value) => update({ bio: value })} multiline placeholder={tx("Il adore courir et jouer…", "Loves to run and play…")} placeholderTextColor={colors.grey} style={[styles.input, styles.bioInput]} />
            </>
          )}

          {step === "energy" && (
            <>
              <View style={styles.grid}>
                {ENERGY.map((item) => (
                  <Tile key={item.value} active={profile.energy === item.value} onPress={() => update({ energy: item.value })} style={styles.energyTile}>
                    <Text style={styles.tileIcon}>{item.icon}</Text>
                    <Text style={[styles.tileText, profile.energy === item.value && styles.tileTextActive]}>{tx(item.fr, item.en)}</Text>
                  </Tile>
                ))}
              </View>
              <Text style={styles.label}>{tx("IL CHERCHE", "LOOKING FOR")}</Text>
              <View style={styles.row}>
                {MODES.map((item) => (
                  <Tile key={item.value} active={profile.mode === item.value} onPress={() => update({ mode: item.value })} style={styles.modeTile}>
                    <Text style={styles.tileIcon}>{item.icon}</Text>
                    <Text style={[styles.tileText, profile.mode === item.value && styles.tileTextActive]}>{tx(item.fr, item.en)}</Text>
                    <Text style={styles.tileHint}>{tx(item.hint, item.hintEn)}</Text>
                  </Tile>
                ))}
              </View>
            </>
          )}

          {step === "photos" && (
            <>
              <Text style={styles.label}>{tx("PHOTO PRINCIPALE", "MAIN PHOTO")}</Text>
              <View style={styles.mainPhotoRow}>
                <Pressable onPress={() => chooseMainPhoto("library")} style={styles.photoPicker}>
                  {photoAsset ? <Image source={{ uri: photoAsset.uri }} style={styles.photoPreview} /> : <View style={styles.photoEmpty}><Text style={styles.photoEmptyText}>{species.icon}</Text></View>}
                  <View style={styles.cameraBadge}><Text>📸</Text></View>
                </Pressable>
                <View style={styles.sourceButtons}>
                  <Pressable onPress={() => chooseMainPhoto("camera")} style={styles.sourceButton}><Text style={styles.sourceText}>{tx("📸 Prendre une photo", "📸 Take a photo")}</Text></Pressable>
                  <Pressable onPress={() => chooseMainPhoto("library")} style={styles.sourceButton}><Text style={styles.sourceText}>{tx("🖼️ Galerie", "🖼️ Gallery")}</Text></Pressable>
                </View>
              </View>

              <View style={styles.galleryHeader}>
                <Text style={styles.label}>{tx("GALERIE", "GALLERY")}</Text>
                <Text style={styles.galleryCount}>{gallery.length}/{MAX_GALLERY}</Text>
              </View>
              <View style={styles.galleryGrid}>
                {gallery.map((item, index) => (
                  <View key={item.uri + index} style={styles.galleryCell}>
                    <Image source={{ uri: item.uri }} style={styles.galleryImage} />
                    <Pressable onPress={() => setGallery((current) => current.filter((_, i) => i !== index))} hitSlop={8} style={styles.galleryRemove}><Text style={styles.galleryRemoveText}>✕</Text></Pressable>
                  </View>
                ))}
                {gallery.length < MAX_GALLERY && (
                  <Pressable onPress={() => addGalleryPhotos("library")} style={[styles.galleryCell, styles.galleryAdd]}>
                    <Text style={styles.galleryAddIcon}>＋</Text>
                    <Text style={styles.galleryAddText}>{tx("Galerie", "Gallery")}</Text>
                  </Pressable>
                )}
                {gallery.length < MAX_GALLERY && (
                  <Pressable onPress={() => addGalleryPhotos("camera")} style={[styles.galleryCell, styles.galleryAdd]}>
                    <Text style={styles.galleryAddIcon}>📸</Text>
                    <Text style={styles.galleryAddText}>{tx("Appareil", "Camera")}</Text>
                  </Pressable>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </Animated.View>

      <View style={styles.footer}>
        <Pressable style={[styles.primary, step === "name" && !name && styles.primaryOff]} onPress={isLast ? finish : next} disabled={saving || (step === "name" && !name)}>
          <Text style={styles.primaryText}>{saving ? tx("Enregistrement…", "Saving…") : isLast ? tx(`Créer le profil de ${name || "mon compagnon"} 🐾`, `Create ${name || "my companion"}'s profile 🐾`) : tx("Continuer", "Continue")}</Text>
        </Pressable>
        {step !== "name" && !answered && (
          <Pressable onPress={isLast ? finish : next} style={styles.skipBottom}><Text style={styles.skipBottomText}>{isLast ? tx("Ajouter les photos plus tard", "Add photos later") : tx("Répondre plus tard", "Answer later")}</Text></Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// A choice that bounces when tapped.
function Tile({ active, onPress, style, children }: { active: boolean; onPress: () => void; style?: object; children: React.ReactNode }) {
  const scale = useRef(new Animated.Value(1)).current;
  const press = () => {
    scale.setValue(0.9);
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 3, tension: 160 }).start();
    onPress();
  };
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable onPress={press} style={[styles.tile, active && styles.tileActive]}>{children}</Pressable>
    </Animated.View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream, paddingHorizontal: 22, paddingTop: 40 },
  loading: { flex: 1, backgroundColor: colors.cream, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  counter: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.grey },
  backText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.coralDark },
  progressTrack: { flexDirection: "row", gap: 5, marginTop: 12 },
  progressDot: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.line },
  progressDotDone: { backgroundColor: colors.coral },
  preview: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16, padding: 12, borderRadius: radii.lg, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, shadowColor: colors.coralDark, shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  previewAvatar: { width: 62, height: 62, borderRadius: 31, borderWidth: 3, borderColor: colors.coral, backgroundColor: colors.cream2, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  previewPhoto: { width: "100%", height: "100%" },
  previewIcon: { fontSize: 30 },
  previewCopy: { flex: 1, minWidth: 0 },
  previewName: { fontFamily: fonts.display, fontSize: 19, color: colors.dark },
  previewMeta: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.grey, marginTop: 1 },
  previewChips: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 5 },
  previewChip: { fontFamily: fonts.bodySemi, fontSize: 10, color: colors.coralDark, backgroundColor: colors.cream2, paddingHorizontal: 7, paddingVertical: 2, borderRadius: radii.pill, overflow: "hidden" },
  stepContent: { paddingTop: 22, paddingBottom: 16 },
  title: { fontFamily: fonts.displayExtra, color: colors.dark, fontSize: 26, lineHeight: 31 },
  subtitle: { fontFamily: fonts.body, color: colors.grey, fontSize: 14, lineHeight: 20, marginTop: 6 },
  label: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 0.6, color: colors.grey, marginTop: 22, marginBottom: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 18 },
  row: { flexDirection: "row", gap: 10, marginTop: 18 },
  tile: { alignItems: "center", justifyContent: "center", paddingVertical: 14, paddingHorizontal: 6, borderRadius: radii.md, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.line },
  tileActive: { borderColor: colors.coral, backgroundColor: colors.cream2 },
  tileIcon: { fontSize: 30 },
  tileText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.dark, marginTop: 4 },
  tileTextActive: { color: colors.coralDark },
  tileHint: { fontFamily: fonts.body, fontSize: 10, color: colors.grey, marginTop: 2, textAlign: "center" },
  speciesTile: { width: "23%" },
  energyTile: { width: "48%" },
  modeTile: { flex: 1 },
  bigTile: { flex: 1 },
  bigTileIcon: { fontFamily: fonts.displayExtra, fontSize: 44, color: colors.coralDark },
  linkButton: { alignSelf: "flex-start", paddingVertical: 10 },
  linkText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.coralDark },
  adopterCard: { marginTop: 14, padding: 14, borderRadius: radii.md, backgroundColor: "rgba(255,179,92,0.16)", borderWidth: 1, borderColor: "#FFB35C" },
  adopterTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.dark },
  adopterText: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.grey, marginTop: 3 },
  input: { minHeight: 54, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 16, color: colors.dark, fontFamily: fonts.body, fontSize: 16, marginTop: 18 },
  bigInput: { fontFamily: fonts.display, fontSize: 24, minHeight: 64 },
  bioInput: { height: 120, paddingTop: 14, textAlignVertical: "top", marginTop: 0 },
  bioHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  chip: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.coral, borderColor: colors.coral },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.dark },
  chipTextActive: { color: "#FFFFFF" },
  ageBox: { alignItems: "center", marginTop: 26 },
  ageRow: { flexDirection: "row", alignItems: "center", gap: 22 },
  ageButton: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.coral, alignItems: "center", justifyContent: "center" },
  ageButtonText: { fontFamily: fonts.bodyBold, fontSize: 28, color: colors.coralDark, lineHeight: 32 },
  ageValueBox: { alignItems: "center", minWidth: 90 },
  ageValue: { fontFamily: fonts.displayExtra, fontSize: 56, lineHeight: 62, color: colors.dark },
  ageUnit: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.grey },
  ageStage: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.coralDark, marginTop: 14 },
  footer: { paddingTop: 8, paddingBottom: 22 },
  primary: { backgroundColor: colors.coral, paddingVertical: 16, borderRadius: radii.lg, alignItems: "center" },
  primaryOff: { opacity: 0.45 },
  primaryText: { fontFamily: fonts.displaySemi, color: colors.white, fontSize: 15 },
  skipBottom: { alignItems: "center", paddingTop: 14 },
  skipBottomText: { fontFamily: fonts.bodySemi, color: colors.grey, fontSize: 12 },
  mainPhotoRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  sourceButtons: { flex: 1, gap: 8 },
  sourceButton: { borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingVertical: 11, alignItems: "center" },
  sourceText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.dark },
  galleryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  galleryCount: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.grey },
  galleryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  galleryCell: { width: "31.8%", aspectRatio: 4 / 5, borderRadius: radii.sm, overflow: "hidden", backgroundColor: colors.cream2 },
  galleryImage: { width: "100%", height: "100%" },
  galleryRemove: { position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  galleryRemoveText: { color: colors.white, fontSize: 11, fontFamily: fonts.bodyBold },
  galleryAdd: { alignItems: "center", justifyContent: "center", borderWidth: 2, borderStyle: "dashed", borderColor: colors.coral },
  galleryAddIcon: { fontSize: 24, color: colors.coralDark },
  galleryAddText: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.coralDark, marginTop: 2 },
  photoPicker: { width: 118, height: 118, borderRadius: 59, backgroundColor: colors.white, borderWidth: 3, borderColor: colors.coral, overflow: "visible" },
  photoPreview: { width: "100%", height: "100%", borderRadius: 56 },
  photoEmpty: { width: "100%", height: "100%", borderRadius: 56, alignItems: "center", justifyContent: "center", backgroundColor: colors.cream2 },
  photoEmptyText: { fontSize: 44 },
  cameraBadge: { position: "absolute", right: -4, bottom: -4, width: 34, height: 34, borderRadius: 17, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line },
});
