import React, { useEffect, useMemo, useState } from "react";
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fonts, radii } from "@/theme/theme";
import { useThemedColors } from "@/hooks/useThemedColors";
import { ME } from "@/data/mockPets";
import Header from "@/components/Header";
import { useAuth } from "@/context/AuthContext";
import { useAppState } from "@/context/AppState";
import { PETS as DISCOVERY_PETS } from "@/data/mockPets";
import { createPetProfile, LocalPhoto, PetRecord, updatePetProfile, uploadPetPhoto } from "@/data/api/profile";
import AddPetSheet, { SPECIES } from "@/components/AddPetSheet";
import PetProfileEditor, { PetDraft } from "@/components/PetProfileEditor";
import type { Pet } from "@/data/mockPets";
import TreatModel from "@/components/TreatModel";
import { getPetLevel, PET_RANKS } from "@/utils/petProgression";

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
  const [editorOpen, setEditorOpen] = useState(false);
  const [levelInfoOpen, setLevelInfoOpen] = useState(false);
  const [addPetOpen, setAddPetOpen] = useState(false);
  const [customPets, setCustomPets] = useState<PetItem[]>([]);
  // Guest mode: edits to demo pets live only in memory.
  const [localEdits, setLocalEdits] = useState<Record<string, PetItem>>({});
  const [selectedKey, setSelectedKey] = useState(activePet.name.toLowerCase());
  const [pendingPetKey, setPendingPetKey] = useState<string | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [photoWidth, setPhotoWidth] = useState(0);
  // Signed in: only the account's own pets. Demo pets are for guest mode only.
  const allPets = useMemo(() => (session ? ownedPets.map(toPetItem) : [...PETS, ...customPets].map((pet) => localEdits[pet.key] ?? pet)), [customPets, localEdits, ownedPets, session]);
  const selectedPet = useMemo(() => allPets.find((pet) => pet.key === selectedKey) ?? allPets[0] ?? toPetItem(activePet), [activePet, allPets, selectedKey]);
  const selectedMode = profile.mode;
  const gallery = useMemo(() => [profile.photo_url, ...(profile.photos ?? [])].filter(Boolean), [profile.photo_url, profile.photos]);
  const species = speciesInfo(selectedPet.species);
  const completion = [profile.pet_name, profile.breed, profile.age, profile.city, profile.bio, profile.photo_url, selectedPet.tags.length].filter(Boolean).length / 7;
  const level = getPetLevel(treats, petProgress, completion);

  useEffect(() => setPhotoIndex(0), [selectedKey, gallery.length]);

  const editorInitial = useMemo<PetDraft>(() => ({
    name: profile.pet_name,
    species: (speciesInfo(selectedPet.species)?.key ?? "dog") as Pet["species"],
    breed: profile.breed,
    age: profile.age,
    gender: selectedPet.gender.startsWith("♀") ? "F" : "M",
    city: profile.city,
    bio: profile.bio,
    energy: profile.energy,
    mode: profile.mode,
    tags: selectedPet.tags,
    avatar: profile.photo_url ? { uri: profile.photo_url } : null,
    gallery: (profile.photos ?? []).map((uri) => ({ uri })),
  }), [profile, selectedPet]);

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
        if (upload.error) Alert.alert("Photo non envoyée", `${upload.error.message}\n\nTu pourras l'ajouter depuis « Modifier le profil ».`);
        profile.photo_url = upload.url;
      }
      const { error } = await createPetProfile({ ...profile, owner_id: session.user.id, species: pet.species, tags: pet.tags, gender: pet.gender });
      if (error) {
        Alert.alert("Profil non enregistré", error.message);
        return;
      }
      const pets = await refreshOwnedPets();
      const created = pets[pets.length - 1];
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
        Alert.alert("Photos non envoyées", `${failed.error.message}\n\nVérifie que la migration supabase/migrations/003_pet_photos.sql a bien été exécutée.`);
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
        bio: draft.bio,
        energy: draft.energy,
        mode: draft.mode,
        tags: draft.tags,
        photo_url: photoUrl,
        photos,
      });
      if (error) {
        Alert.alert("Profil non enregistré", error.message);
        return false;
      }
      await refreshOwnedPets();
      if (ownedPet.id === activePet.id) setMode(draft.mode);
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

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Header />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.hero}>
          <Text style={styles.heroSticker}>🐾  ✦  ♡</Text>
          <Text style={styles.heroTitle}>Mes petits compagnons !</Text>
          <Text style={styles.heroSubtitle}>Tous tes pets au même endroit</Text>
          <View style={styles.treatPill}><TreatModel /><Text style={styles.treatCount}>{treats}</Text><Text style={styles.treatLabel}>croquettes</Text></View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.petSwitcher}>
          {allPets.map((pet) => (
            <Pressable key={pet.key} onPress={() => {
              if (pet.key !== selectedKey) setPendingPetKey(pet.key);
            }} style={[styles.petChoice, selectedKey === pet.key && styles.petChoiceActive]}>
              <View style={[styles.avatarRing, { borderColor: getPetLevel(pet.key === selectedKey ? treats : 0, progressByPet[pet.key === selectedKey ? activePet.id : -1] ?? { matches: 0, outings: 0, messagesReceived: 0, sessions: 0 }, pet.key === selectedKey ? completion : 0).rank.color }]}>{pet.profile.photo_url ? <Image source={{ uri: pet.profile.photo_url }} style={styles.petAvatar} /> : <View style={[styles.petAvatar, styles.photoPlaceholder]}><Text style={styles.placeholderIconSmall}>{speciesInfo(pet.species)?.icon ?? "🐾"}</Text></View>}</View>
              <Text style={[styles.petChoiceName, selectedKey === pet.key && styles.petChoiceNameActive]}>{pet.profile.pet_name}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.addPet} onPress={() => setAddPetOpen(true)}>
            <Text style={styles.addPetIcon}>＋</Text>
            <Text style={styles.addPetText}>Ajouter</Text>
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
              <Text style={styles.placeholderText}>Ajoute des photos de {profile.pet_name || "ton compagnon"}</Text>
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
        <Text style={styles.sub}>{species ? `${species.icon} ${species.label}` : selectedPet.species}{profile.breed ? ` · ${profile.breed}` : ""} · 🎂 {profile.age} {profile.age > 1 ? "ans" : "an"} · {selectedPet.gender}</Text>
        {profile.city ? <Text style={styles.city}>📍 {profile.city}</Text> : null}

        <View style={styles.statsRow}>
          <Stat big={profile.energy >= 3 ? "⚡ High" : "🌿 Chill"} small="ÉNERGIE" styles={styles} />
          <Stat big="🎾🏃" small="ACTIVITÉS" styles={styles} />
          <Stat big={profile.mode >= 50 ? "Hot" : "Friend"} small="STATUT" styles={styles} />
        </View>

        <Pressable style={styles.levelCard} onPress={() => setLevelInfoOpen(true)}>
          <View style={styles.levelHeader}><View><Text style={styles.levelEyebrow}>PROGRESSION DE {profile.pet_name.toUpperCase()}</Text><Text style={[styles.rankName, { color: level.rank.color }]}>{level.rank.name} · Niveau {level.level}</Text></View><Image source={level.rank.image} style={styles.rankImage} /></View>
          <View style={styles.levelTrack}><View style={[styles.levelFill, { width: `${level.progress * 100}%`, backgroundColor: level.rank.color }]} /></View>
          <Text style={styles.levelHint}>{Math.max(0, level.next - level.xp)} XP avant le niveau {Math.min(7, level.level + 1)}</Text>
          <View style={styles.rankRow}>{PET_RANKS.map((rank) => <View key={rank.name} style={[styles.rankDot, { backgroundColor: rank.color }, rank.name === level.rank.name && styles.rankDotActive]} />)}</View>
          <Text style={styles.levelTapHint}>Voir les niveaux et comment progresser ›</Text>
        </Pressable>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>À propos</Text>
          <Pressable onPress={() => setEditorOpen(true)} hitSlop={8}>
            <Text style={styles.editText}>✎ Modifier</Text>
          </Pressable>
        </View>
        <View style={styles.bioCard}>
          {profile.bio ? <Text style={styles.bioText}>"{profile.bio}"</Text> : <Pressable onPress={() => setEditorOpen(true)}><Text style={styles.emptyText}>Ajoute une petite présentation ✦</Text></Pressable>}
        </View>

        <Text style={[styles.sectionTitle, styles.habitsTitle]}>Ses petites habitudes</Text>
        <View style={styles.tags}>
          {selectedPet.tags.map((tag) => <View key={tag} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>)}
          <Pressable onPress={() => setEditorOpen(true)} style={[styles.tag, styles.tagAdd]}><Text style={styles.tagAddText}>＋ {selectedPet.tags.length ? "Modifier" : "Ajouter"}</Text></Pressable>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>💕 Ce que {profile.pet_name} recherche</Text>
          <Text style={styles.infoLine}>🐾 Compagnon de balade</Text>
          <Text style={styles.infoLine}>🎾 Partenaire de jeu</Text>
          <Text style={styles.infoLine}>{profile.mode >= 50 ? "✦ Faire une belle rencontre" : "❤️ Se faire un nouvel ami"}</Text>
        </View>

        <View style={styles.statsCard}>
          <Text style={styles.sectionTitle}>🔥 Son petit succès</Text>
          <View style={styles.publicSuccess}><Image source={level.rank.image} style={styles.successBadge} /><View><Text style={styles.popularTitle}>{profile.pet_name} est {level.rank.name.toLowerCase()} !</Text><Text style={styles.successText}>Un compagnon qui crée de belles connexions.</Text></View></View>
          <View style={styles.popularRow}><Stat big={`✦ Niveau ${level.level}`} small="RÉPUTATION" styles={styles} /><Stat big={`💘 ${selectedPet.matches + petProgress.matches}`} small="MATCHS" styles={styles} /><Stat big={`🔥 ${selectedPet.top}`} small="TOP" styles={styles} /></View>
        </View>

        <Pressable style={styles.editButton} onPress={() => setEditorOpen(true)}>
          <Text style={styles.editButtonText}>✎ Modifier le profil</Text>
        </Pressable>
        <View style={styles.addAnother}><Text style={styles.addAnotherTitle}>🐾 Un nouveau compagnon ?</Text><Text style={styles.addAnotherText}>Ajoute un autre pet à ta famille !</Text><Pressable onPress={() => setAddPetOpen(true)}><Text style={styles.addAnotherAction}>＋ Ajouter un pet</Text></Pressable></View>
        {session && <Pressable onPress={signOut} style={styles.signOut}><Text style={styles.signOutText}>Se déconnecter</Text></Pressable>}
        </View>
      </ScrollView>
      <AddPetSheet visible={addPetOpen} onClose={() => setAddPetOpen(false)} onCreate={createPet} />
      <PetProfileEditor visible={editorOpen} initial={editorInitial} onClose={() => setEditorOpen(false)} onSave={savePetDraft} />
      <Modal visible={pendingPetKey !== null} transparent animationType="fade" onRequestClose={() => setPendingPetKey(null)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Changer de compagnon ?</Text>
            <Text style={styles.confirmText}>Discover, Matches et Chat afficheront les recommandations, matchs et messages de {allPets.find((pet) => pet.key === pendingPetKey)?.profile.pet_name ?? "ce profil"}.</Text>
            <Pressable style={styles.confirmButton} onPress={confirmPetSwitch}><Text style={styles.confirmButtonText}>Confirmer ce profil</Text></Pressable>
            <Pressable style={styles.cancelButton} onPress={() => setPendingPetKey(null)}><Text style={styles.cancelButtonText}>Annuler</Text></Pressable>
          </View>
        </View>
      </Modal>
      {levelInfoOpen && <View style={styles.modalLayer}><Pressable style={styles.modalBackdrop} onPress={() => setLevelInfoOpen(false)} /><View style={styles.levelModal}><View style={styles.modalHandle} /><Text style={styles.modalTitle}>Les niveaux de {profile.pet_name}</Text><Text style={styles.modalSubtitle}>Chaque pet progresse avec ses propres actions.</Text><ScrollView showsVerticalScrollIndicator={false}>{PET_RANKS.map((rank, index) => <View key={rank.name} style={[styles.levelRow, index + 1 === level.level && styles.levelRowActive]}><Image source={rank.image} style={styles.levelRowImage} /><View style={styles.levelRowCopy}><Text style={[styles.levelRowTitle, { color: rank.color }]}>{rank.name} · Niveau {index + 1}</Text><Text style={styles.levelRowText}>{index === 0 ? "Profil complété et premières connexions" : index === 1 ? "Matchs et sorties régulières" : index === 2 ? "Une vraie présence dans GRRRR" : index === 3 ? "Beaucoup de rencontres positives" : index === 4 ? "Une communauté qui le reconnaît" : "Le niveau maximum"}</Text></View></View>)}</ScrollView><Pressable style={styles.modalClose} onPress={() => setLevelInfoOpen(false)}><Text style={styles.modalCloseText}>Compris</Text></Pressable></View></View>}
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
    levelRowText: { fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.grey, marginTop: 2 },
    modalClose: { backgroundColor: colors.coral, borderRadius: radii.pill, alignItems: "center", paddingVertical: 14, marginTop: 10 },
    modalCloseText: { fontFamily: fonts.bodyBold, color: colors.white, fontSize: 13 },
  });
}
