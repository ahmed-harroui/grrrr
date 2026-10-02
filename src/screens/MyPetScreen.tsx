import React, { useEffect, useMemo, useState } from "react";
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { fonts, radii } from "@/theme/theme";
import { useThemedColors } from "@/hooks/useThemedColors";
import { ME } from "@/data/mockPets";
import Header from "@/components/Header";
import { useAuth } from "@/context/AuthContext";
import { useAppState } from "@/context/AppState";
import { PETS as DISCOVERY_PETS } from "@/data/mockPets";
import { createPetProfile, deletePetProfile, LocalPhoto, PetRecord, updatePetProfile, uploadPetPhoto } from "@/data/api/profile";
import AddPetSheet, { SPECIES, speciesLabel } from "@/components/AddPetSheet";
import { useTranslation } from "@/i18n/useTranslation";
import PetProfileEditor, { EMPTY_HEALTH, PetDraft } from "@/components/PetProfileEditor";
import type { Pet } from "@/data/mockPets";
import TreatModel from "@/components/TreatModel";
import { getPetLevel, LEVEL_THRESHOLDS, levelFromXp, PET_RANKS, XP_SOURCES } from "@/utils/petProgression";
import { usePetProgression } from "@/hooks/usePetProgression";
import { replayLevelCelebration } from "@/data/api/progress";

type PetProfileDraft = Omit<PetRecord, "owner_id" | "species" | "tags">;

const DEFAULT_PROFILE: PetProfileDraft = {
  pet_name: ME.name,
  breed: ME.breed,
  age: ME.age,
  city: "Paris",
  bio: ME.bio,
  energy: ME.energy,
  mode: ME.mode,
  photo_url: ME.photo,
  photos: ["https://placedog.net/600/700?id=2", "https://placedog.net/600/700?id=3"],
};

interface PetItem {
  key: string;
  level: number;
  profile: PetProfileDraft;
  species: string;
  gender: string;
  tags: string[];
  likes: number;
  matches: number;
  top: string;
}

const PETS: PetItem[] = [
  { key: "rocky", level: 2, profile: DEFAULT_PROFILE, species: "Dog", gender: "♂ Mâle", tags: ["🎾 Joueur", "⚡ Énergique", "❤️ Sociable"], likes: 128, matches: 24, top: "18%" },
  { key: "luna", level: 3, profile: { ...DEFAULT_PROFILE, pet_name: "Luna", breed: "Labrador", age: 2, bio: "Toujours prête pour une balade ou une sieste au soleil.", mode: 80, photo_url: "https://placedog.net/600/700?id=20", photos: ["https://placedog.net/600/700?id=21", "https://placedog.net/600/700?id=22"] }, species: "Dog", gender: "♀ Femelle", tags: ["🌊 Curieuse", "🎾 Joueuse", "🥰 Douce"], likes: 96, matches: 17, top: "24%" },
  { key: "nala", level: 1, profile: { ...DEFAULT_PROFILE, pet_name: "Nala", breed: "Cat (European)", age: 2, bio: "Curieuse et indépendante, elle adore observer le monde depuis la fenêtre.", mode: 10, photo_url: "https://cataas.com/cat/cute?width=600&height=700", photos: [] }, species: "Cat", gender: "♀ Femelle", tags: ["🛋️ Chill", "🐾 Curieuse", "✨ Indépendante"], likes: 74, matches: 12, top: "31%" },
];

const speciesInfo = (species: string) => SPECIES.find((item) => item.key === species.toLowerCase());

function toPetItem(pet: Pet): PetItem {
  return {
    key: `db-${pet.id}`,
    level: pet.level ?? 1,
    profile: { pet_name: pet.name, breed: pet.breed, age: pet.age, city: pet.city ?? "", bio: pet.bio, energy: pet.energy, mode: pet.mode, photo_url: pet.photo, photos: (pet.photos ?? []).filter((uri) => uri && uri !== pet.photo) },
    species: pet.species,
    gender: pet.gender === "F" ? "♀ Femelle" : "♂ Mâle",
    tags: pet.tags,
    likes: 0,
    matches: 0,
    top: "—",
  };
}

export default function MyPetScreen() {
  const colors = useThemedColors();
  const { session, signOut } = useAuth();
  const { activePet, setActivePet, ownedPets, refreshOwnedPets, setMode, treats, petProgress, progressByPet } = useAppState();
  const [profile, setProfile] = useState<PetProfileDraft>(DEFAULT_PROFILE);
  const styles = getStyles(colors);
  const { tx, language } = useTranslation();
  const [editorOpen, setEditorOpen] = useState(false);
  const [levelInfoOpen, setLevelInfoOpen] = useState(false);
  const [addPetOpen, setAddPetOpen] = useState(false);
  const navigation = useNavigation<any>();
  const [customPets, setCustomPets] = useState<PetItem[]>([]);
  // Guest mode: edits to demo pets live only in memory.
  const [localEdits, setLocalEdits] = useState<Record<string, PetItem>>({});
  const [selectedKey, setSelectedKey] = useState(activePet.name.toLowerCase());
  const [pendingPetKey, setPendingPetKey] = useState<string | null>(null);
  // Long press on an avatar: confirm deleting that pet.
  const [deleteKey, setDeleteKey] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Guest mode: demo pets removed from the list (in memory only).
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());
  const [photoIndex, setPhotoIndex] = useState(0);
  const [photoWidth, setPhotoWidth] = useState(0);
  // Signed in: only the account's own pets. Demo pets are for guest mode only.
  const allPets = useMemo(() => (session ? ownedPets.map(toPetItem) : [...PETS, ...customPets].filter((pet) => !hiddenKeys.has(pet.key)).map((pet) => localEdits[pet.key] ?? pet)), [customPets, hiddenKeys, localEdits, ownedPets, session]);
  const petToDelete = allPets.find((pet) => pet.key === deleteKey) ?? null;
  const selectedPet = useMemo(() => allPets.find((pet) => pet.key === selectedKey) ?? allPets[0] ?? toPetItem(activePet), [activePet, allPets, selectedKey]);
  const selectedMode = profile.mode;
  const gallery = useMemo(() => [profile.photo_url, ...(profile.photos ?? [])].filter(Boolean), [profile.photo_url, profile.photos]);
  const species = speciesInfo(selectedPet.species);
  const completion = [profile.pet_name, profile.breed, profile.age, profile.city, profile.bio, profile.photo_url, selectedPet.tags.length].filter(Boolean).length / 7;
  const selectedDbId = session ? ownedPets.find((pet) => `db-${pet.id}` === selectedPet.key)?.dbId : undefined;
  // Signed in: XP computed by the server from real activity. Guest: local estimate.
  const { progression, error: progressionError, refresh: refreshProgression } = usePetProgression(selectedDbId);
  const level = progression ? levelFromXp(progression.xp) : getPetLevel(treats, petProgress, completion);
  // A level gained since the pets were loaded: reload them, so the ring stays right after switching.
  const selectedItemLevel = allPets.find((pet) => pet.key === selectedKey)?.level;
  useEffect(() => {
    if (session && progression && selectedItemLevel !== undefined && selectedItemLevel !== level.level) void refreshOwnedPets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level.level, selectedItemLevel]);
  // Avatar ring: the rank of each pet's real level (the database's), the selected one with its
  // freshest progression; never a local estimate, which made unselected pets look Bronze.
  const rankColorOf = (pet: PetItem) => {
    const petLevel = pet.key === selectedKey && progression ? level.level : pet.level;
    return PET_RANKS[Math.max(0, Math.min(PET_RANKS.length - 1, petLevel - 1))].color;
  };

  useEffect(() => setPhotoIndex(0), [selectedKey, gallery.length]);

  const editorInitial = useMemo<PetDraft>(() => ({
    name: profile.pet_name,
    species: (speciesInfo(selectedPet.species)?.key ?? "dog") as Pet["species"],
    breed: profile.breed,
    age: profile.age,
    gender: selectedPet.gender.startsWith("♀") ? "F" : "M",
    city: profile.city,
    country: session ? ownedPets.find((pet) => toPetItem(pet).key === selectedPet.key)?.country ?? "" : undefined,
    bio: profile.bio,
    energy: profile.energy,
    mode: profile.mode,
    tags: selectedPet.tags,
    avatar: profile.photo_url ? { uri: profile.photo_url } : null,
    gallery: (profile.photos ?? []).map((uri) => ({ uri })),
    health: session ? ownedPets.find((pet) => toPetItem(pet).key === selectedPet.key)?.health ?? EMPTY_HEALTH : undefined,
  }), [ownedPets, profile, selectedPet, session]);

  useEffect(() => {
    const nextPet = allPets.find((pet) => pet.profile.pet_name === activePet.name);
    if (nextPet) {
      setSelectedKey(nextPet.key);
      setProfile(nextPet.profile);
    }
  }, [activePet.name, allPets]);

  useEffect(() => {
    setProfile((current) => current.pet_name === activePet.name ? { ...current, mode: activePet.mode } : current);
  }, [activePet.mode, activePet.name]);

  const createPet = async (pet: Pet, photoAsset?: LocalPhoto) => {
    const profile: PetProfileDraft = { pet_name: pet.name, breed: pet.breed, age: pet.age, city: "Paris", bio: pet.bio, energy: pet.energy, mode: pet.mode, photo_url: pet.photo };
    if (session?.user.id) {
      if (photoAsset) {
        const upload = await uploadPetPhoto(session.user.id, photoAsset);
        if (upload.error) Alert.alert(tx("Photo non envoyée", "Photo not uploaded"), `${upload.error.message}\n\n${tx("Tu pourras l'ajouter depuis « Modifier le profil ».", "You can add it from \"Edit profile\".")}`);
        profile.photo_url = upload.url;
      }
      // An adopter's family profile becomes this first pet: its adoption requests and
      // conversations stay attached to it.
      const familyProfileId = activePet.adopterOnly ? activePet.dbId : undefined;
      const record = { ...profile, owner_id: session.user.id, species: pet.species, tags: pet.tags, gender: pet.gender };
      const { error } = familyProfileId
        ? await updatePetProfile(familyProfileId, session.user.id, { ...record, adopter_only: false, setup_pending: false })
        : await createPetProfile(record);
      if (error) {
        Alert.alert(tx("Profil non enregistré", "Profile not saved"), error.message);
        return;
      }
      const pets = await refreshOwnedPets();
      const created = familyProfileId ? pets.find((item) => item.dbId === familyProfileId) : pets[pets.length - 1];
      if (created) {
        setSelectedKey(toPetItem(created).key);
        setActivePet(created);
      }
      setAddPetOpen(false);
      return;
    }
    const item = { key: `custom-${pet.id}`, level: 1, profile, species: pet.species, gender: pet.gender === "F" ? "♀ Femelle" : "♂ Mâle", tags: pet.tags, likes: 0, matches: 0, top: "—" };
    setCustomPets((current) => [...current, item]);
    setSelectedKey(item.key);
    setProfile(profile);
    setActivePet(pet);
    setAddPetOpen(false);
  };

  const confirmPetSwitch = () => {
    const nextPet = allPets.find((pet) => pet.key === pendingPetKey);
    if (!nextPet) return;
    setSelectedKey(nextPet.key);
    setProfile(nextPet.profile);
    const ownedPet = ownedPets.find((pet) => toPetItem(pet).key === nextPet.key);
    if (ownedPet) {
      setActivePet(ownedPet);
      setPendingPetKey(null);
      return;
    }
    const basePet = DISCOVERY_PETS.find((candidate) => candidate.name === nextPet.profile.pet_name);
    const nextActivePet: Pet = {
      id: basePet?.id ?? (Number(nextPet.key.replace(/\D/g, "")) || Date.now()),
      name: nextPet.profile.pet_name,
      species: nextPet.species.toLowerCase() as Pet["species"],
      breed: nextPet.profile.breed,
      gender: nextPet.gender.startsWith("♀") ? "F" : "M",
      age: nextPet.profile.age,
      energy: nextPet.profile.energy,
      dist: 0,
      mode: nextPet.profile.mode,
      bio: nextPet.profile.bio,
      tags: nextPet.tags,
      photo: nextPet.profile.photo_url,
      photos: [nextPet.profile.photo_url, ...(nextPet.profile.photos ?? [])].filter(Boolean),
      city: nextPet.profile.city,
      level: nextPet.level,
    };
    setActivePet(nextActivePet);
    setPendingPetKey(null);
  };

  const deletePet = async () => {
    if (!petToDelete) return;
    const ownerId = session?.user.id;
    if (ownerId) {
      const ownedPet = ownedPets.find((pet) => toPetItem(pet).key === petToDelete.key);
      if (!ownedPet?.dbId) return setDeleteKey(null);
      setDeleting(true);
      const { error } = await deletePetProfile(ownedPet.dbId, ownerId);
      setDeleting(false);
      if (error) {
        Alert.alert(tx("Suppression impossible", "Could not delete"), error.message);
        return;
      }
      // Switches to another pet when the deleted one was active.
      await refreshOwnedPets();
      setDeleteKey(null);
      return;
    }
    const remaining = allPets.filter((pet) => pet.key !== petToDelete.key);
    setHiddenKeys((current) => new Set(current).add(petToDelete.key));
    setCustomPets((current) => current.filter((pet) => pet.key !== petToDelete.key));
    if (petToDelete.key === selectedKey && remaining[0]) {
      setSelectedKey(remaining[0].key);
      setProfile(remaining[0].profile);
    }
    setDeleteKey(null);
  };

  const savePetDraft = async (draft: PetDraft) => {
    const ownerId = session?.user.id;
    const ownedPet = ownedPets.find((pet) => toPetItem(pet).key === selectedPet.key);
    let photoUrl = draft.avatar?.uri ?? "";
    let photos = draft.gallery.map((photo) => photo.uri);

    if (ownerId && ownedPet?.dbId) {
      // Picked images are local files: upload them so every user can see them.
      const uploads = await Promise.all([draft.avatar, ...draft.gallery].map((photo) => (photo ? uploadPetPhoto(ownerId, photo) : Promise.resolve({ url: "", error: null }))));
      const failed = uploads.find((upload) => upload.error);
      if (failed?.error) {
        Alert.alert(tx("Photos non envoyées", "Photos not uploaded"), `${failed.error.message}\n\n${tx("Vérifie que la migration supabase/migrations/003_pet_photos.sql a bien été exécutée.", "Check that the supabase/migrations/003_pet_photos.sql migration has been run.")}`);
        return false;
      }
      photoUrl = uploads[0].url;
      photos = uploads.slice(1).map((upload) => upload.url).filter(Boolean);
      const { error } = await updatePetProfile(ownedPet.dbId, ownerId, {
        pet_name: draft.name,
        species: draft.species,
        breed: draft.breed,
        age: draft.age,
        gender: draft.gender,
        city: draft.city,
        country: draft.country || null,
        bio: draft.bio,
        energy: draft.energy,
        mode: draft.mode,
        tags: draft.tags,
        photo_url: photoUrl,
        photos,
        ...(draft.health ?? {}),
      });
      if (error) {
        Alert.alert(tx("Profil non enregistré", "Profile not saved"), error.message);
        return false;
      }
      await refreshOwnedPets();
      if (ownedPet.id === activePet.id) setMode(draft.mode);
      // New photos / filled fields earn XP immediately (and can trigger the level-up animation).
      void refreshProgression();
      return true;
    }

    const nextProfile: PetProfileDraft = { ...profile, pet_name: draft.name, breed: draft.breed, age: draft.age, city: draft.city, bio: draft.bio, energy: draft.energy, mode: draft.mode, photo_url: photoUrl, photos };
    setLocalEdits((current) => ({
      ...current,
      [selectedPet.key]: { ...selectedPet, profile: nextProfile, species: draft.species, gender: draft.gender === "F" ? "♀ Femelle" : "♂ Mâle", tags: draft.tags },
    }));
    setProfile(nextProfile);
    return true;
  };

  // An account that came to adopt has no pet yet: only the way to add one.
  if (activePet.adopterOnly) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <Header />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.hero}>
            <Text style={styles.heroSticker}>🍼  ✦  ♡</Text>
            <Text style={styles.heroTitle}>{tx("Ta famille adopte", "Your family is adopting")}</Text>
            <Text style={styles.heroSubtitle}>{tx("Glisse vers le haut dans Discover les compagnons dont tu veux un bébé, ou parcours Adopt.", "Swipe up in Discover the companions you would like a baby from, or browse Adopt.")}</Text>
          </View>
          <View style={styles.addAnother}>
            <Text style={styles.addAnotherTitle}>🐾 {tx("Tu as déjà un compagnon ?", "Already have a companion?")}</Text>
            <Text style={styles.addAnotherText}>{tx("Ajoute-le pour qu'il ait son profil, ses matchs et son XP.", "Add them so they get their own profile, matches and XP.")}</Text>
            <Pressable onPress={() => setAddPetOpen(true)}><Text style={styles.addAnotherAction}>＋ {tx("Ajouter un pet", "Add a pet")}</Text></Pressable>
            <Pressable onPress={() => navigation.navigate("Adopt")}><Text style={styles.addAnotherAction}>🍼 {tx("Voir les bébés à adopter", "See the babies to adopt")}</Text></Pressable>
          </View>
        </ScrollView>
        <AddPetSheet visible={addPetOpen} onClose={() => setAddPetOpen(false)} onCreate={createPet} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Header />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.hero}>
          <Text style={styles.heroSticker}>🐾  ✦  ♡</Text>
          <Text style={styles.heroTitle}>{tx("Mes petits compagnons !", "My little companions!")}</Text>
          <Text style={styles.heroSubtitle}>{tx("Tous tes pets au même endroit", "All your pets in one place")}</Text>
          <View style={styles.treatPill}><TreatModel /><Text style={styles.treatCount}>{treats}</Text><Text style={styles.treatLabel}>{tx("croquettes", "treats")}</Text></View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.petSwitcher}>
          {allPets.map((pet) => (
            <Pressable key={pet.key} onPress={() => {
              if (pet.key !== selectedKey) setPendingPetKey(pet.key);
            }} onLongPress={() => setDeleteKey(pet.key)} delayLongPress={450} style={[styles.petChoice, selectedKey === pet.key && styles.petChoiceActive]}>
              <View style={[styles.avatarRing, { borderColor: rankColorOf(pet) }]}>{pet.profile.photo_url ? <Image source={{ uri: pet.profile.photo_url }} style={styles.petAvatar} /> : <View style={[styles.petAvatar, styles.photoPlaceholder]}><Text style={styles.placeholderIconSmall}>{speciesInfo(pet.species)?.icon ?? "🐾"}</Text></View>}</View>
              <Text style={[styles.petChoiceName, selectedKey === pet.key && styles.petChoiceNameActive]}>{pet.profile.pet_name}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.addPet} onPress={() => setAddPetOpen(true)}>
            <Text style={styles.addPetIcon}>＋</Text>
            <Text style={styles.addPetText}>{tx("Ajouter", "Add")}</Text>
          </Pressable>
        </ScrollView>

        <View style={styles.profileCard}>
        <View style={styles.photoWrap} onLayout={(event) => setPhotoWidth(event.nativeEvent.layout.width)}>
          {gallery.length > 0 && photoWidth > 0 ? (
            <ScrollView
              key={selectedKey}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(event) => setPhotoIndex(Math.round(event.nativeEvent.contentOffset.x / photoWidth))}
              style={styles.photoPager}
            >
              {gallery.map((uri, index) => <Image key={uri + index} source={{ uri }} style={[styles.photo, { width: photoWidth }]} />)}
            </ScrollView>
          ) : (
            <Pressable onPress={() => setEditorOpen(true)} style={[styles.photo, styles.photoPlaceholder]}>
              <Text style={styles.placeholderIcon}>📸</Text>
              <Text style={styles.placeholderText}>{tx(`Ajoute des photos de ${profile.pet_name || "ton compagnon"}`, `Add photos of ${profile.pet_name || "your companion"}`)}</Text>
            </Pressable>
          )}
          <View style={[styles.statusBadge, selectedMode >= 50 ? styles.hotBadge : styles.friendBadge]}>
            <Text style={styles.statusBadgeText}>{selectedMode >= 50 ? "✦ Hot" : "🐾 Friend"}</Text>
          </View>
          <Pressable onPress={() => setEditorOpen(true)} style={styles.photoEdit} hitSlop={6}><Text style={styles.photoEditText}>✎ Photos</Text></Pressable>
          {gallery.length > 1 && (
            <View style={styles.photoDots}>
              {gallery.map((uri, index) => <View key={uri + index} style={[styles.photoDot, index === photoIndex && styles.photoDotActive]} />)}
            </View>
          )}
        </View>
        {gallery.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>
            {gallery.map((uri, index) => <Image key={uri + index} source={{ uri }} style={[styles.thumb, index === photoIndex && styles.thumbActive]} />)}
          </ScrollView>
        )}
        <Text style={styles.name}>{profile.pet_name}</Text>
        <Text style={styles.sub}>{species ? `${species.icon} ${speciesLabel(species, language)}` : selectedPet.species}{profile.breed ? ` · ${profile.breed}` : ""} · 🎂 {profile.age} {profile.age > 1 ? tx("ans", "yrs") : tx("an", "yr")} · {selectedPet.gender.startsWith("♀") ? tx("♀ Femelle", "♀ Female") : tx("♂ Mâle", "♂ Male")}</Text>
        {profile.city ? <Text style={styles.city}>📍 {profile.city}</Text> : null}

        <View style={styles.statsRow}>
          <Stat big={profile.energy >= 3 ? "⚡ High" : "🌿 Chill"} small={tx("ÉNERGIE", "ENERGY")} styles={styles} />
          <Stat big="🎾🏃" small={tx("ACTIVITÉS", "ACTIVITIES")} styles={styles} />
          <Stat big={profile.mode >= 50 ? "Hot" : "Friend"} small={tx("STATUT", "STATUS")} styles={styles} />
        </View>

        <Pressable style={styles.levelCard} onPress={() => setLevelInfoOpen(true)} onLongPress={() => replayLevelCelebration(selectedDbId ?? "demo", level.level)} delayLongPress={500}>
          <View style={styles.levelHeader}><View><Text style={styles.levelEyebrow}>{tx("PROGRESSION DE", "PROGRESS OF")} {profile.pet_name.toUpperCase()}</Text><Text style={[styles.rankName, { color: level.rank.color }]}>{tx(level.rank.name, level.rank.nameEn)} · {tx("Niveau", "Level")} {level.level}</Text></View><Image source={level.rank.image} style={styles.rankImage} /></View>
          <View style={styles.levelTrack}><View style={[styles.levelFill, { width: `${level.progress * 100}%`, backgroundColor: level.rank.color }]} /></View>
          <Text style={styles.levelHint}>{level.next === null ? `${level.xp} XP · ${tx("Niveau maximum atteint 👑", "Max level reached 👑")}` : `${level.xp} XP · ${tx(`encore ${level.next - level.xp} XP avant le niveau ${level.level + 1}`, `${level.next - level.xp} XP to level ${level.level + 1}`)}`}{progression && progression.weeks_streak > 1 ? `  ·  🔥 ${tx(`${progression.weeks_streak} semaines d'affilée`, `${progression.weeks_streak}-week streak`)}` : ""}</Text>
          <View style={styles.rankRow}>{PET_RANKS.map((rank) => <View key={rank.name} style={[styles.rankDot, { backgroundColor: rank.color }, rank.name === level.rank.name && styles.rankDotActive]} />)}</View>
          <Text style={styles.levelTapHint}>{tx("Voir les niveaux et comment progresser ›", "See levels and how to progress ›")}</Text>
          {progressionError ? <Text style={styles.levelError}>⚠️ {tx("XP non calculée", "XP not computed")} : {progressionError}</Text> : null}
          {session && !selectedDbId ? <Text style={styles.levelError}>⚠️ {tx("Ce pet n'est pas relié à la base de données", "This pet is not linked to the database")}</Text> : null}
        </Pressable>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{tx("À propos", "About")}</Text>
          <Pressable onPress={() => setEditorOpen(true)} hitSlop={8}>
            <Text style={styles.editText}>{tx("✎ Modifier", "✎ Edit")}</Text>
          </Pressable>
        </View>
        <View style={styles.bioCard}>
          {profile.bio ? <Text style={styles.bioText}>"{profile.bio}"</Text> : <Pressable onPress={() => setEditorOpen(true)}><Text style={styles.emptyText}>{tx("Ajoute une petite présentation ✦", "Add a short introduction ✦")}</Text></Pressable>}
        </View>

        <Text style={[styles.sectionTitle, styles.habitsTitle]}>{tx("Ses petites habitudes", "Little habits")}</Text>
        <View style={styles.tags}>
          {selectedPet.tags.map((tag) => <View key={tag} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>)}
          <Pressable onPress={() => setEditorOpen(true)} style={[styles.tag, styles.tagAdd]}><Text style={styles.tagAddText}>＋ {selectedPet.tags.length ? tx("Modifier", "Edit") : tx("Ajouter", "Add")}</Text></Pressable>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>💕 {tx(`Ce que ${profile.pet_name} recherche`, `What ${profile.pet_name} is looking for`)}</Text>
          <Text style={styles.infoLine}>🐾 {tx("Compagnon de balade", "Walking buddy")}</Text>
          <Text style={styles.infoLine}>🎾 {tx("Partenaire de jeu", "Playmate")}</Text>
          <Text style={styles.infoLine}>{profile.mode >= 50 ? tx("✦ Faire une belle rencontre", "✦ Meet someone special") : tx("❤️ Se faire un nouvel ami", "❤️ Make a new friend")}</Text>
        </View>

        <View style={styles.statsCard}>
          <Text style={styles.sectionTitle}>🔥 {tx("Son petit succès", "Their success")}</Text>
          <View style={styles.publicSuccess}><Image source={level.rank.image} style={styles.successBadge} /><View><Text style={styles.popularTitle}>{tx(`${profile.pet_name} est ${level.rank.name.toLowerCase()} !`, `${profile.pet_name} is ${level.rank.nameEn.toLowerCase()}!`)}</Text><Text style={styles.successText}>{tx("Un compagnon qui crée de belles connexions.", "A companion who makes great connections.")}</Text></View></View>
          <View style={styles.popularRow}><Stat big={`✦ ${tx("Niveau", "Level")} ${level.level}`} small={tx("RÉPUTATION", "REPUTATION")} styles={styles} /><Stat big={`💘 ${selectedPet.matches + petProgress.matches}`} small={tx("MATCHS", "MATCHES")} styles={styles} /><Stat big={`🔥 ${selectedPet.top}`} small="TOP" styles={styles} /></View>
        </View>

        <Pressable style={styles.editButton} onPress={() => setEditorOpen(true)}>
          <Text style={styles.editButtonText}>{tx("✎ Modifier le profil", "✎ Edit profile")}</Text>
        </Pressable>
        <View style={styles.addAnother}><Text style={styles.addAnotherTitle}>🐾 {tx("Un nouveau compagnon ?", "A new companion?")}</Text><Text style={styles.addAnotherText}>{tx("Ajoute un autre pet à ta famille !", "Add another pet to your family!")}</Text><Pressable onPress={() => setAddPetOpen(true)}><Text style={styles.addAnotherAction}>＋ {tx("Ajouter un pet", "Add a pet")}</Text></Pressable></View>
        {session && <Pressable onPress={signOut} style={styles.signOut}><Text style={styles.signOutText}>{tx("Se déconnecter", "Sign out")}</Text></Pressable>}
        </View>
      </ScrollView>
      <AddPetSheet visible={addPetOpen} onClose={() => setAddPetOpen(false)} onCreate={createPet} />
      <PetProfileEditor visible={editorOpen} initial={editorInitial} onClose={() => setEditorOpen(false)} onSave={savePetDraft} />
      <Modal visible={pendingPetKey !== null} transparent animationType="fade" onRequestClose={() => setPendingPetKey(null)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>{tx("Changer de compagnon ?", "Switch companion?")}</Text>
            <Text style={styles.confirmText}>{tx(`Discover, Matches et Chat afficheront les recommandations, matchs et messages de ${allPets.find((pet) => pet.key === pendingPetKey)?.profile.pet_name ?? "ce profil"}.`, `Discover, Matches and Chat will show the recommendations, matches and messages of ${allPets.find((pet) => pet.key === pendingPetKey)?.profile.pet_name ?? "this profile"}.`)}</Text>
            <Pressable style={styles.confirmButton} onPress={confirmPetSwitch}><Text style={styles.confirmButtonText}>{tx("Confirmer ce profil", "Confirm this profile")}</Text></Pressable>
            <Pressable style={styles.cancelButton} onPress={() => setPendingPetKey(null)}><Text style={styles.cancelButtonText}>{tx("Annuler", "Cancel")}</Text></Pressable>
          </View>
        </View>
      </Modal>
      <Modal visible={petToDelete !== null} transparent animationType="slide" onRequestClose={() => !deleting && setDeleteKey(null)}>
        <View style={styles.deleteLayer}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => !deleting && setDeleteKey(null)} />
          {petToDelete && (
            <View style={styles.deleteSheet}>
              <View style={styles.modalHandle} />
              {petToDelete.profile.photo_url
                ? <Image source={{ uri: petToDelete.profile.photo_url }} style={styles.deleteAvatar} />
                : <View style={[styles.deleteAvatar, styles.photoPlaceholder]}><Text style={styles.placeholderIconSmall}>{speciesInfo(petToDelete.species)?.icon ?? "🐾"}</Text></View>}
              {allPets.length <= 1 ? (
                <>
                  <Text style={styles.confirmTitle}>{tx(`Garder ${petToDelete.profile.pet_name}`, `Keep ${petToDelete.profile.pet_name}`)}</Text>
                  <Text style={styles.confirmText}>{tx("C'est ton seul compagnon : ajoute un autre pet avant de supprimer celui-ci.", "This is your only companion: add another pet before deleting this one.")}</Text>
                  <Pressable style={styles.confirmButton} onPress={() => { setDeleteKey(null); setAddPetOpen(true); }}><Text style={styles.confirmButtonText}>＋ {tx("Ajouter un pet", "Add a pet")}</Text></Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.confirmTitle}>{tx(`Supprimer ${petToDelete.profile.pet_name} ?`, `Delete ${petToDelete.profile.pet_name}?`)}</Text>
                  <Text style={styles.confirmText}>{tx("Son profil, ses photos, ses matchs, ses messages et son XP seront supprimés définitivement.", "Their profile, photos, matches, messages and XP will be deleted for good.")}</Text>
                  <Pressable style={[styles.deleteButton, deleting && { opacity: 0.6 }]} onPress={deletePet} disabled={deleting}>
                    <Text style={styles.confirmButtonText}>{deleting ? tx("Suppression...", "Deleting...") : tx(`🗑️ Supprimer ${petToDelete.profile.pet_name}`, `🗑️ Delete ${petToDelete.profile.pet_name}`)}</Text>
                  </Pressable>
                </>
              )}
              <Pressable style={styles.cancelButton} onPress={() => setDeleteKey(null)} disabled={deleting}><Text style={styles.cancelButtonText}>{tx("Annuler", "Cancel")}</Text></Pressable>
            </View>
          )}
        </View>
      </Modal>
      {levelInfoOpen &&<View style={styles.modalLayer}><Pressable style={styles.modalBackdrop} onPress={() => setLevelInfoOpen(false)} /><View style={styles.levelModal}><View style={styles.modalHandle} /><Text style={styles.modalTitle}>{tx(`Les niveaux de ${profile.pet_name}`, `${profile.pet_name}'s levels`)}</Text><Text style={styles.modalSubtitle}>{tx("Chaque pet progresse avec ses propres actions.", "Each pet progresses through its own actions.")}</Text><ScrollView showsVerticalScrollIndicator={false}>{PET_RANKS.map((rank, index) => <View key={rank.name} style={[styles.levelRow, index + 1 === level.level && styles.levelRowActive]}><Image source={rank.image} style={styles.levelRowImage} /><View style={styles.levelRowCopy}><Text style={[styles.levelRowTitle, { color: rank.color }]}>{tx(rank.name, rank.nameEn)} · {tx("Niveau", "Level")} {index + 1}  <Text style={styles.levelRowXp}>{LEVEL_THRESHOLDS[index].toLocaleString(language === "en" ? "en-US" : "fr-FR")} XP</Text></Text><Text style={styles.levelRowText}>{index === 0 ? tx("Profil complété et premières connexions", "Completed profile and first connections") : index === 1 ? tx("Matchs et sorties régulières", "Regular matches and outings") : index === 2 ? tx("Une vraie présence dans GRRRR", "A real presence on GRRRR") : index === 3 ? tx("Beaucoup de rencontres positives", "Lots of positive meetups") : index === 4 ? tx("Une communauté qui le reconnaît", "A community that recognizes them") : tx("Le niveau maximum", "The highest level")}</Text></View></View>)}<Text style={styles.questTitle}>{tx("Comment gagner de l'XP", "How to earn XP")}</Text>{(progression?.sources ?? Object.keys(XP_SOURCES).map((key) => ({ key, xp: 0, max: null, count: 0, goal: null }))).map((source) => { const info = XP_SOURCES[source.key as keyof typeof XP_SOURCES]; const fill = source.max ? Math.min(1, source.xp / source.max) : source.xp > 0 ? 1 : 0; return <View key={source.key} style={styles.questRow}><Text style={styles.questIcon}>{info.icon}</Text><View style={styles.levelRowCopy}><View style={styles.questHeader}><Text style={styles.questName}>{tx(info.title, info.titleEn)}</Text><Text style={styles.questXp}>{source.xp} XP{source.max ? ` / ${source.max}` : ""}</Text></View><Text style={styles.levelRowText}>{tx(info.rule, info.ruleEn)}{source.goal ? ` · ${source.count}/${source.goal}` : ""}</Text>{source.max ? <View style={styles.questTrack}><View style={[styles.questFill, { width: `${fill * 100}%` }]} /></View> : null}</View></View>; })}</ScrollView><Pressable style={styles.modalClose} onPress={() => setLevelInfoOpen(false)}><Text style={styles.modalCloseText}>{tx("Compris", "Got it")}</Text></Pressable></View></View>}
    </SafeAreaView>
  );
}

function Stat({ big, small, styles }: { big: string; small: string; styles: ReturnType<typeof getStyles> }) {
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={styles.statBig}>{big}</Text>
      <Text style={styles.statSmall}>{small}</Text>
    </View>
  );
}

function getStyles(colors: ReturnType<typeof useThemedColors>) {
    return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.cream },
    scrollContent: { paddingHorizontal: 18, paddingBottom: 36 },
    hero: { alignItems: "center", paddingVertical: 8 },
    heroSticker: { color: colors.hot, fontSize: 16, marginBottom: 2 },
    heroTitle: { fontFamily: fonts.displayExtra, fontSize: 27, color: colors.coralDark, textAlign: "center" },
    heroSubtitle: { fontFamily: fonts.body, fontSize: 12, color: colors.grey, marginTop: 2 },
    treatPill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.8)", borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, paddingVertical: 6, marginTop: 10 },
    treatIcon: { fontSize: 15 },
    treatCount: { fontFamily: fonts.displayExtra, fontSize: 16, color: colors.coralDark },
    treatLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.grey },
    petSwitcher: { gap: 12, paddingVertical: 16, paddingHorizontal: 4 },
    petChoice: { alignItems: "center", padding: 4, minWidth: 70 },
    petChoiceActive: { backgroundColor: "rgba(255,93,115,0.1)", borderRadius: radii.md },
    avatarRing: { width: 66, height: 66, borderRadius: 33, borderWidth: 4, alignItems: "center", justifyContent: "center", backgroundColor: colors.white },
    petAvatar: { width: 56, height: 56, borderRadius: 28 },
    petChoiceName: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.grey, marginTop: 5 },
    petChoiceNameActive: { color: colors.coralDark, fontFamily: fonts.bodyBold },
    addPet: { alignItems: "center", justifyContent: "center", minWidth: 70 },
    addPetIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.coral, color: colors.white, textAlign: "center", fontSize: 30, lineHeight: 40 },
    addPetText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.coralDark, marginTop: 5 },
    profileCard: { backgroundColor: colors.white, borderRadius: 30, padding: 12, borderWidth: 1, borderColor: colors.line, shadowColor: colors.dark, shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
    photoWrap: { position: "relative", marginBottom: 12 },
    photoPager: { borderRadius: 24 },
    photo: { width: "100%", height: 300, borderRadius: 24 },
    photoPlaceholder: { alignItems: "center", justifyContent: "center", backgroundColor: colors.cream2, borderWidth: 2, borderStyle: "dashed", borderColor: colors.coral },
    placeholderIcon: { fontSize: 40 },
    placeholderIconSmall: { fontSize: 24 },
    placeholderText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.coralDark, marginTop: 8, textAlign: "center", paddingHorizontal: 20 },
    photoEdit: { position: "absolute", top: 14, right: 14, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 7 },
    photoEditText: { fontFamily: fonts.bodyBold, fontSize: 12, color: "#FFFFFF" },
    photoDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.55)" },
    photoDotActive: { width: 20, backgroundColor: "#FFFFFF" },
    thumbs: { gap: 8, paddingBottom: 12 },
    thumb: { width: 52, height: 52, borderRadius: 12, opacity: 0.55 },
    thumbActive: { opacity: 1, borderWidth: 2, borderColor: colors.coral },
    city: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.coralDark, textAlign: "center", marginTop: 4 },
    emptyText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.coralDark },
    habitsTitle: { marginTop: 16, marginBottom: 8 },
    tagAdd: { borderStyle: "dashed", borderColor: colors.coral, backgroundColor: "transparent" },
    tagAddText: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.coralDark },
    statusBadge: { position: "absolute", top: 14, left: 14, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radii.pill, borderWidth: 2, borderColor: colors.white, shadowColor: colors.dark, shadowOpacity: 0.12, shadowRadius: 5, elevation: 2 },
    hotBadge: { backgroundColor: colors.coral },
    friendBadge: { backgroundColor: colors.friend },
    statusBadgeText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.white },
    photoDots: { position: "absolute", bottom: 14, alignSelf: "center", flexDirection: "row", gap: 5 },
    name: { fontFamily: fonts.displayExtra, fontSize: 26, color: colors.dark, textAlign: "center" },
    nameInput: { fontFamily: fonts.displayExtra, fontSize: 26, color: colors.dark, textAlign: "center", borderBottomWidth: 1, borderBottomColor: colors.coral, paddingVertical: 0 },
    sub: { fontFamily: fonts.body, fontSize: 13, color: colors.grey, textAlign: "center", marginTop: 2 },
    statsRow: { flexDirection: "row", justifyContent: "center", gap: 22, marginVertical: 16 },
    statBig: { fontFamily: fonts.display, fontSize: 15, color: colors.dark },
    statSmall: { fontFamily: fonts.body, fontSize: 10.5, color: colors.grey, marginTop: 2 },
    levelCard: { backgroundColor: colors.cream2, borderRadius: radii.md, padding: 15, marginBottom: 16, borderWidth: 1, borderColor: colors.line },
    levelHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    levelEyebrow: { fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 0.8, color: colors.grey },
    rankName: { fontFamily: fonts.displayExtra, fontSize: 21, marginTop: 3 },
    rankImage: { width: 48, height: 48 },
    levelTrack: { height: 12, borderRadius: 6, backgroundColor: colors.line, marginTop: 14, overflow: "hidden" },
    levelFill: { height: "100%", borderRadius: 6 },
    levelHint: { fontFamily: fonts.body, fontSize: 11, color: colors.grey, marginTop: 7 },
    rankRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 13, paddingHorizontal: 2 },
    rankDot: { width: 12, height: 12, borderRadius: 6, opacity: 0.35 },
    rankDotActive: { width: 17, height: 17, borderRadius: 9, opacity: 1, borderWidth: 2, borderColor: colors.white },
    levelTapHint: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.coralDark, marginTop: 12 },
    sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
    sectionTitle: { fontFamily: fonts.displaySemi, fontSize: 17, color: colors.dark },
    editText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.coralDark },
    bioCard: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
  },
    bioText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: colors.dark },
    bioInput: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: colors.dark, minHeight: 72, textAlignVertical: "top" },
    editPanel: { backgroundColor: colors.white, borderRadius: radii.md, padding: 14, marginTop: 12, borderWidth: 1, borderColor: colors.line },
    tags: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 16 },
    tag: { backgroundColor: colors.cream2, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line, paddingVertical: 8, paddingHorizontal: 11 },
    tagText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.grey },
    infoCard: { backgroundColor: colors.cream, borderRadius: radii.md, padding: 15, marginBottom: 12 },
    infoLine: { fontFamily: fonts.body, color: colors.dark, fontSize: 13, marginTop: 9 },
    statsCard: { backgroundColor: colors.cream2, borderRadius: radii.md, padding: 15, marginBottom: 14 },
    popularTitle: { fontFamily: fonts.displaySemi, fontSize: 15, color: colors.coralDark, marginTop: 5 },
    publicSuccess: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 },
    successBadge: { width: 48, height: 48 },
    successText: { fontFamily: fonts.body, fontSize: 11, color: colors.grey, marginTop: 3 },
    popularRow: { flexDirection: "row", justifyContent: "space-around", marginTop: 14 },
    editButton: { backgroundColor: colors.coral, borderRadius: radii.pill, paddingVertical: 15, alignItems: "center", borderWidth: 3, borderColor: colors.white, shadowColor: colors.coralDark, shadowOpacity: 0.2, shadowRadius: 10, elevation: 3 },
    editButtonText: { fontFamily: fonts.bodyBold, color: colors.white, fontSize: 13 },
    addAnother: { alignItems: "center", paddingVertical: 22 },
    addAnotherTitle: { fontFamily: fonts.displaySemi, fontSize: 17, color: colors.dark },
    addAnotherText: { fontFamily: fonts.body, fontSize: 12, color: colors.grey, marginTop: 4 },
    addAnotherAction: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.coralDark, marginTop: 12 },
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
    confirmOverlay: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(43,39,36,0.48)", alignItems: "center", justifyContent: "center", padding: 22, zIndex: 30 },
    confirmCard: { width: "100%", maxWidth: 360, backgroundColor: colors.cream, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, padding: 20 },
    confirmTitle: { fontFamily: fonts.displaySemi, fontSize: 21, color: colors.dark, textAlign: "center" },
    confirmText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.grey, textAlign: "center", marginTop: 8, marginBottom: 18 },
    confirmButton: { backgroundColor: colors.coral, borderRadius: radii.pill, alignItems: "center", paddingVertical: 13 },
    confirmButtonText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.white },
    cancelButton: { alignItems: "center", paddingVertical: 12 },
    deleteLayer: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(43,39,36,0.45)" },
    deleteSheet: { backgroundColor: colors.cream, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 22, paddingTop: 10, paddingBottom: 26, alignItems: "stretch" },
    deleteAvatar: { width: 78, height: 78, borderRadius: 39, alignSelf: "center", marginTop: 6, marginBottom: 12, borderWidth: 3, borderColor: colors.coral },
    deleteButton: { backgroundColor: "#D93A4F", borderRadius: radii.pill, alignItems: "center", paddingVertical: 13 },
    cancelButtonText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.grey },
    modalLayer: { ...StyleSheet.absoluteFill, justifyContent: "flex-end", backgroundColor: "rgba(43,39,36,0.25)", zIndex: 20 },
    modalBackdrop: { ...StyleSheet.absoluteFill },
    levelModal: { maxHeight: "78%", backgroundColor: colors.cream, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 20, paddingBottom: 24 },
    modalHandle: { width: 42, height: 5, borderRadius: 3, backgroundColor: colors.line, alignSelf: "center", marginBottom: 16 },
    modalTitle: { fontFamily: fonts.displayExtra, fontSize: 25, color: colors.dark },
    modalSubtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.grey, marginTop: 5, marginBottom: 16 },
    levelRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: radii.md, marginBottom: 7 },
    levelRowActive: { backgroundColor: colors.cream2, borderWidth: 1, borderColor: colors.coral },
    levelRowImage: { width: 43, height: 43 },
    levelRowCopy: { flex: 1 },
    levelRowTitle: { fontFamily: fonts.displaySemi, fontSize: 16 },
    levelError: { fontFamily: fonts.bodySemi, fontSize: 11, color: "#D93838", marginTop: 8 },
    levelRowXp: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.grey },
    questTitle: { fontFamily: fonts.displaySemi, fontSize: 17, color: colors.dark, marginTop: 14, marginBottom: 8 },
    questRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 10, borderRadius: radii.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, marginBottom: 7 },
    questIcon: { fontSize: 20, marginTop: 1 },
    questHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    questName: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.dark },
    questXp: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.coralDark },
    questTrack: { height: 6, borderRadius: 3, backgroundColor: colors.line, marginTop: 6, overflow: "hidden" },
    questFill: { height: "100%", borderRadius: 3, backgroundColor: colors.coral },
    levelRowText: { fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.grey, marginTop: 2 },
    modalClose: { backgroundColor: colors.coral, borderRadius: radii.pill, alignItems: "center", paddingVertical: 14, marginTop: 10 },
    modalCloseText: { fontFamily: fonts.bodyBold, color: colors.white, fontSize: 13 },
  });
}
