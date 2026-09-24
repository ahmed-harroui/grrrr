import React, { useEffect, useMemo, useState } from "react";
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fonts, radii } from "@/theme/theme";
import { useThemedColors } from "@/hooks/useThemedColors";
import { ME } from "@/data/mockPets";
import Header from "@/components/Header";
import { useAuth } from "@/context/AuthContext";
import { useAppState } from "@/context/AppState";
import { PETS as DISCOVERY_PETS } from "@/data/mockPets";
import { createPetProfile, PetRecord } from "@/data/api/profile";
import AddPetSheet from "@/components/AddPetSheet";
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
};

const ENERGY_OPTIONS: PetProfileDraft["energy"][] = [1, 2, 3, 4];

const PETS = [
  { key: "rocky", level: 2, profile: DEFAULT_PROFILE, species: "Dog", gender: "♂ Mâle", tags: ["🎾 Joueur", "⚡ Énergique", "❤️ Sociable"], likes: 128, matches: 24, top: "18%" },
  { key: "luna", level: 3, profile: { ...DEFAULT_PROFILE, pet_name: "Luna", breed: "Labrador", age: 2, bio: "Toujours prête pour une balade ou une sieste au soleil.", mode: 80, photo_url: "https://placedog.net/600/700?id=20" }, species: "Dog", gender: "♀ Femelle", tags: ["🌊 Curieuse", "🎾 Joueuse", "🥰 Douce"], likes: 96, matches: 17, top: "24%" },
  { key: "nala", level: 1, profile: { ...DEFAULT_PROFILE, pet_name: "Nala", breed: "Cat (European)", age: 2, bio: "Curieuse et indépendante, elle adore observer le monde depuis la fenêtre.", mode: 10, photo_url: "https://cataas.com/cat/cute?width=600&height=700" }, species: "Cat", gender: "♀ Femelle", tags: ["🛋️ Chill", "🐾 Curieuse", "✨ Indépendante"], likes: 74, matches: 12, top: "31%" },
];


export default function MyPetScreen() {
  const colors = useThemedColors();
  const { session, signOut } = useAuth();
  const { activePet, setActivePet, treats, petProgress, progressByPet } = useAppState();
  const [profile, setProfile] = useState<PetProfileDraft>(DEFAULT_PROFILE);
  const styles = getStyles(colors);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [levelInfoOpen, setLevelInfoOpen] = useState(false);
  const [addPetOpen, setAddPetOpen] = useState(false);
  const [customPets, setCustomPets] = useState<typeof PETS>([]);
  const [selectedKey, setSelectedKey] = useState(activePet.name.toLowerCase());
  const [pendingPetKey, setPendingPetKey] = useState<string | null>(null);
  const allPets = useMemo(() => [...PETS, ...customPets], [customPets]);
  const selectedPet = useMemo(() => allPets.find((pet) => pet.key === selectedKey) ?? allPets[0], [allPets, selectedKey]);
  const selectedMode = profile.mode;
  const completion = [profile.pet_name, profile.breed, profile.age, profile.city, profile.bio, profile.photo_url, selectedPet.tags.length].filter(Boolean).length / 7;
  const level = getPetLevel(treats, petProgress, completion);

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

  const createPet = async (pet: Pet) => {
    const profile: PetProfileDraft = { pet_name: pet.name, breed: pet.breed, age: pet.age, city: "Paris", bio: pet.bio, energy: pet.energy, mode: pet.mode, photo_url: pet.photo };
    if (session?.user.id) {
      const { error } = await createPetProfile({ ...profile, owner_id: session.user.id, species: pet.species, tags: pet.tags });
      if (error) {
        Alert.alert("Profil non enregistré", error.message);
        return;
      }
    }
    const item = { key: `custom-${pet.id}`, level: 1, profile, species: pet.species, gender: pet.gender === "F" ? "♀ Femelle" : "♂ Mâle", tags: pet.tags, likes: 0, matches: 0, top: "—" };
    setCustomPets((current) => [...current, item]);
    setSelectedKey(item.key);
    setProfile(profile);
    setActivePet(pet);
    setAddPetOpen(false);
  };

  const update = <K extends keyof PetProfileDraft>(key: K, value: PetProfileDraft[K]) => {
    setProfile((current) => ({ ...current, [key]: value }));
  };

  const confirmPetSwitch = () => {
    const nextPet = allPets.find((pet) => pet.key === pendingPetKey);
    if (!nextPet) return;
    setSelectedKey(nextPet.key);
    setProfile(nextPet.profile);
    setEditing(false);
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
      level: nextPet.level,
    };
    setActivePet(nextActivePet);
    setPendingPetKey(null);
  };

  const persist = async () => {
    setSaving(true);
    setSaving(false);
    setEditing(false);
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
              <View style={[styles.avatarRing, { borderColor: getPetLevel(pet.key === selectedKey ? treats : 0, progressByPet[pet.key === selectedKey ? activePet.id : -1] ?? { matches: 0, outings: 0, messagesReceived: 0, sessions: 0 }, pet.key === selectedKey ? completion : 0).rank.color }]}><Image source={{ uri: pet.profile.photo_url }} style={styles.petAvatar} /></View>
              <Text style={[styles.petChoiceName, selectedKey === pet.key && styles.petChoiceNameActive]}>{pet.profile.pet_name}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.addPet} onPress={() => setAddPetOpen(true)}>
            <Text style={styles.addPetIcon}>＋</Text>
            <Text style={styles.addPetText}>Ajouter</Text>
          </Pressable>
        </ScrollView>

        <View style={styles.profileCard}>
        <View style={styles.photoWrap}>
          <Image source={{ uri: profile.photo_url }} style={styles.photo} />
          <View style={[styles.statusBadge, selectedMode >= 50 ? styles.hotBadge : styles.friendBadge]}>
            <Text style={styles.statusBadgeText}>{selectedMode >= 50 ? "✦ Hot" : "🐾 Friend"}</Text>
          </View>
          <Text style={styles.photoDots}>● ○ ○</Text>
        </View>
        {editing ? (
          <TextInput value={profile.pet_name} onChangeText={(value) => update("pet_name", value)} style={styles.nameInput} placeholder="Nom de ton compagnon" />
        ) : <Text style={styles.name}>{profile.pet_name}</Text>}
        <Text style={styles.sub}>{selectedPet.species} · {profile.breed} · 🎂 {profile.age} ans · {selectedPet.gender}</Text>

        <View style={styles.statsRow}>
          <Stat big={profile.energy >= 3 ? "⚡ High" : "🌿 Chill"} small="ÉNERGIE" />
          <Stat big="🎾🏃" small="ACTIVITÉS" />
          <Stat big={profile.mode >= 50 ? "Hot" : "Friend"} small="STATUT" />
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
          <Pressable onPress={() => (editing ? persist() : setEditing(true))}>
            <Text style={styles.editText}>{saving ? "..." : editing ? "Enregistrer" : "Modifier"}</Text>
          </Pressable>
        </View>
        <View style={styles.bioCard}>
          {editing ? <TextInput value={profile.bio} onChangeText={(value) => update("bio", value)} multiline style={styles.bioInput} /> : <Text style={styles.bioText}>"{profile.bio}"</Text>}
        </View>

        <Text style={styles.sectionTitle}>Ses petites habitudes</Text>
        <View style={styles.tags}>{selectedPet.tags.map((tag) => <View key={tag} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>)}</View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>💕 Ce que {profile.pet_name} recherche</Text>
          <Text style={styles.infoLine}>🐾 Compagnon de balade</Text>
          <Text style={styles.infoLine}>🎾 Partenaire de jeu</Text>
          <Text style={styles.infoLine}>{profile.mode >= 50 ? "✦ Faire une belle rencontre" : "❤️ Se faire un nouvel ami"}</Text>
        </View>

        <View style={styles.statsCard}>
          <Text style={styles.sectionTitle}>🔥 Son petit succès</Text>
          <View style={styles.publicSuccess}><Image source={level.rank.image} style={styles.successBadge} /><View><Text style={styles.popularTitle}>{profile.pet_name} est {level.rank.name.toLowerCase()} !</Text><Text style={styles.successText}>Un compagnon qui crée de belles connexions.</Text></View></View>
          <View style={styles.popularRow}><Stat big={`✦ Niveau ${level.level}`} small="RÉPUTATION" /><Stat big={`💘 ${selectedPet.matches + petProgress.matches}`} small="MATCHS" /><Stat big={`🔥 ${selectedPet.top}`} small="TOP" /></View>
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

        <Pressable style={styles.editButton} onPress={() => (editing ? persist() : setEditing(true))}>
          <Text style={styles.editButtonText}>{saving ? "Enregistrement..." : editing ? "✓ Enregistrer le profil" : "✎ Modifier le profil"}</Text>
        </Pressable>
        <View style={styles.addAnother}><Text style={styles.addAnotherTitle}>🐾 Un nouveau compagnon ?</Text><Text style={styles.addAnotherText}>Ajoute un autre pet à ta famille !</Text><Pressable onPress={() => setAddPetOpen(true)}><Text style={styles.addAnotherAction}>＋ Ajouter un pet</Text></Pressable></View>
        {session && <Pressable onPress={signOut} style={styles.signOut}><Text style={styles.signOutText}>Se déconnecter</Text></Pressable>}
        </View>
      </ScrollView>
      <AddPetSheet visible={addPetOpen} onClose={() => setAddPetOpen(false)} onCreate={createPet} />
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

function Stat({ big, small }: { big: string; small: string }) {
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
    profileCard: { backgroundColor: "rgba(255,254,252,0.94)", borderRadius: 30, padding: 12, borderWidth: 1, borderColor: colors.line, shadowColor: colors.dark, shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
    photoWrap: { position: "relative" },
    photo: { width: "100%", height: 255, borderRadius: 24, marginBottom: 14 },
    statusBadge: { position: "absolute", top: 14, left: 14, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radii.pill, borderWidth: 2, borderColor: colors.white, shadowColor: colors.dark, shadowOpacity: 0.12, shadowRadius: 5, elevation: 2 },
    hotBadge: { backgroundColor: colors.coral },
    friendBadge: { backgroundColor: colors.friend },
    statusBadgeText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.white },
    photoDots: { position: "absolute", bottom: 23, alignSelf: "center", color: colors.white, fontSize: 11, letterSpacing: 3 },
    name: { fontFamily: fonts.displayExtra, fontSize: 26, color: colors.dark, textAlign: "center" },
    nameInput: { fontFamily: fonts.displayExtra, fontSize: 26, color: colors.dark, textAlign: "center", borderBottomWidth: 1, borderBottomColor: colors.coral, paddingVertical: 0 },
    sub: { fontFamily: fonts.body, fontSize: 13, color: colors.grey, textAlign: "center", marginTop: 2 },
    statsRow: { flexDirection: "row", justifyContent: "center", gap: 22, marginVertical: 16 },
    statBig: { fontFamily: fonts.display, fontSize: 15, color: colors.dark },
    statSmall: { fontFamily: fonts.body, fontSize: 10.5, color: colors.grey, marginTop: 2 },
    levelCard: { backgroundColor: "#FFFDF9", borderRadius: radii.md, padding: 15, marginBottom: 16, borderWidth: 1, borderColor: colors.line },
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
    backgroundColor: "#fff",
    borderRadius: radii.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
  },
    bioText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: colors.dark },
    bioInput: { fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: colors.dark, minHeight: 72, textAlignVertical: "top" },
    editPanel: { backgroundColor: colors.white, borderRadius: radii.md, padding: 14, marginTop: 12, borderWidth: 1, borderColor: colors.line },
    tags: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 16 },
    tag: { backgroundColor: "#FFF0F2", borderRadius: radii.pill, borderWidth: 1, borderColor: "#FFE0E5", paddingVertical: 8, paddingHorizontal: 11 },
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
