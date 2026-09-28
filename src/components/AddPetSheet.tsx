import React, { useEffect, useRef, useState } from "react";
import { Animated, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { colors, fonts, radii } from "@/theme/theme";
import type { Pet } from "@/data/mockPets";
import type { LocalPhoto } from "@/data/api/profile";

interface Props {
  visible: boolean;
  onClose: () => void;
  /** photoAsset is the picked image (with base64) so the caller can upload it */
  onCreate: (pet: Pet, photoAsset?: LocalPhoto) => void;
}

export const SPECIES: { key: Pet["species"]; label: string; icon: string }[] = [
  { key: "dog", label: "Chien", icon: "🐶" },
  { key: "cat", label: "Chat", icon: "🐱" },
  { key: "hamster", label: "Hamster", icon: "🐹" },
  { key: "rabbit", label: "Lapin", icon: "🐰" },
  { key: "guinea_pig", label: "Cochon d'Inde", icon: "🐹" },
  { key: "mouse", label: "Souris", icon: "🐭" },
  { key: "rat", label: "Rat", icon: "🐀" },
  { key: "ferret", label: "Furet", icon: "🦦" },
  { key: "hedgehog", label: "Hérisson", icon: "🦔" },
  { key: "squirrel", label: "Écureuil", icon: "🐿️" },
  { key: "pig", label: "Cochon", icon: "🐷" },
  { key: "donkey", label: "Âne", icon: "🫏" },
  { key: "horse", label: "Cheval", icon: "🐴" },
  { key: "sheep", label: "Mouton", icon: "🐑" },
  { key: "goat", label: "Chèvre", icon: "🐐" },
  { key: "cow", label: "Vache", icon: "🐮" },
  { key: "llama", label: "Lama", icon: "🦙" },
  { key: "alpaca", label: "Alpaga", icon: "🦙" },
  { key: "camel", label: "Chameau", icon: "🐪" },
  { key: "deer", label: "Cerf", icon: "🦌" },
  { key: "lion", label: "Lion", icon: "🦁" },
  { key: "tiger", label: "Tigre", icon: "🐯" },
  { key: "leopard", label: "Léopard", icon: "🐆" },
  { key: "wolf", label: "Loup", icon: "🐺" },
  { key: "fox", label: "Renard", icon: "🦊" },
  { key: "bear", label: "Ours", icon: "🐻" },
  { key: "elephant", label: "Éléphant", icon: "🐘" },
  { key: "giraffe", label: "Girafe", icon: "🦒" },
  { key: "zebra", label: "Zèbre", icon: "🦓" },
  { key: "monkey", label: "Singe", icon: "🐒" },
  { key: "koala", label: "Koala", icon: "🐨" },
  { key: "bird", label: "Oiseau", icon: "🐦" },
  { key: "parrot", label: "Perroquet", icon: "🦜" },
  { key: "chicken", label: "Poule", icon: "🐔" },
  { key: "duck", label: "Canard", icon: "🦆" },
  { key: "penguin", label: "Manchot", icon: "🐧" },
  { key: "turtle", label: "Tortue", icon: "🐢" },
  { key: "lizard", label: "Lézard", icon: "🦎" },
  { key: "snake", label: "Serpent", icon: "🐍" },
  { key: "crocodile", label: "Crocodile", icon: "🐊" },
  { key: "frog", label: "Grenouille", icon: "🐸" },
  { key: "salamander", label: "Salamandre", icon: "🦎" },
  { key: "fish", label: "Poisson", icon: "🐠" },
  { key: "shark", label: "Requin", icon: "🦈" },
  { key: "dolphin", label: "Dauphin", icon: "🐬" },
  { key: "whale", label: "Baleine", icon: "🐋" },
  { key: "octopus", label: "Pieuvre", icon: "🐙" },
  { key: "crab", label: "Crabe", icon: "🦀" },
  { key: "insect", label: "Insecte", icon: "🐛" },
  { key: "bee", label: "Abeille", icon: "🐝" },
  { key: "butterfly", label: "Papillon", icon: "🦋" },
  { key: "beetle", label: "Scarabée", icon: "🪲" },
  { key: "spider", label: "Araignée", icon: "🕷️" },
  { key: "scorpion", label: "Scorpion", icon: "🦂" },
  { key: "snail", label: "Escargot", icon: "🐌" },
];

const TAGS = ["🎾 Joueur", "⚡ Énergique", "🥰 Câlin", "🛋️ Chill", "🌿 Curieux", "❤️ Sociable"];

export default function AddPetSheet({ visible, onClose, onCreate }: Props) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [species, setSpecies] = useState<Pet["species"]>("dog");
  const [breed, setBreed] = useState("");
  const [age, setAge] = useState("");
  const [city, setCity] = useState("Paris");
  const [energy, setEnergy] = useState<Pet["energy"]>(3);
  const [gender, setGender] = useState<Pet["gender"]>("M");
  const [tags, setTags] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [photoAsset, setPhotoAsset] = useState<LocalPhoto | null>(null);
  const photo = photoAsset?.uri ?? null;
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setStep(0);
      Animated.spring(slide, { toValue: 1, useNativeDriver: true }).start();
    } else slide.setValue(0);
  }, [visible, slide]);

  const close = () => {
    Animated.timing(slide, { toValue: 0, duration: 180, useNativeDriver: true }).start(onClose);
  };

  const create = () => {
    const newPet: Pet = {
      id: Date.now(), name: name.trim() || "Nouveau pet", species, breed: breed.trim() || "À découvrir", gender,
      age: Number(age) || 1, energy, dist: 0, mode: 0, bio: bio.trim() || "Un nouveau compagnon à découvrir.", tags: tags.length ? tags : ["🐾 À découvrir"], photo: photo || (species === "cat" ? "https://cataas.com/cat/cute?width=600&height=700" : "https://placedog.net/600/700?id=90"),
    };
    onCreate(newPet, photoAsset ?? undefined);
    close();
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

  const next = () => step < 3 ? setStep((value) => value + 1) : create();
  const toggleTag = (tag: string) => setTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [620, 0] }) }] }]}>
          <View style={styles.handle} />
          <View style={styles.header}><View><Text style={styles.eyebrow}>NOUVEAU COMPAGNON · {step + 1}/4</Text><Text style={styles.title}>Faisons connaissance ✦</Text></View><Pressable onPress={close}><Text style={styles.close}>×</Text></Pressable></View>
          <View style={styles.progress}><View style={[styles.progressFill, { width: `${((step + 1) / 4) * 100}%` }]} /></View>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {step === 0 && <><Text style={styles.question}>Quel est son petit nom ?</Text><Text style={styles.hint}>Une photo aide les bons compagnons à le reconnaître.</Text><Pressable style={styles.photoPicker} onPress={choosePhoto}>{photo ? <Image source={{ uri: photo }} style={styles.photoPreview} /> : <><Text style={styles.photoIcon}>📸</Text><Text style={styles.photoText}>Ajouter une photo</Text></>}</Pressable><TextInput autoFocus value={name} onChangeText={setName} placeholder="Ex. Cookie" placeholderTextColor={colors.grey} style={styles.input} /><View style={styles.speciesGrid}>{SPECIES.map((item) => <Pressable key={item.key} onPress={() => setSpecies(item.key)} style={[styles.species, species === item.key && styles.selected]}><Text style={styles.speciesIcon}>{item.icon}</Text><Text style={styles.speciesText}>{item.label}</Text></Pressable>)}</View></>}
            {step === 1 && <><Text style={styles.question}>Son profil de vie</Text><Text style={styles.hint}>Ces informations aident à trouver les bons compagnons.</Text><TextInput value={breed} onChangeText={setBreed} placeholder="Race ou type (ex. Labrador)" placeholderTextColor={colors.grey} style={styles.input} /><TextInput value={age} onChangeText={setAge} keyboardType="number-pad" placeholder="Âge" placeholderTextColor={colors.grey} style={styles.input} /><TextInput value={city} onChangeText={setCity} placeholder="Ville" placeholderTextColor={colors.grey} style={styles.input} /><Text style={styles.fieldLabel}>GENRE</Text><View style={styles.genderRow}><Pressable onPress={() => setGender("M")} style={[styles.genderChoice, gender === "M" && styles.selected]}><Text style={styles.choiceText}>♂ Mâle</Text></Pressable><Pressable onPress={() => setGender("F")} style={[styles.genderChoice, gender === "F" && styles.selected]}><Text style={styles.choiceText}>♀ Femelle</Text></Pressable></View></>}
            {step === 2 && <><Text style={styles.question}>Quelle est son énergie ?</Text><Text style={styles.hint}>Cela aide à proposer des compagnons avec le même rythme.</Text><View style={styles.choiceList}>{([1, 2, 3, 4] as Pet["energy"][]).map((value) => <Pressable key={value} onPress={() => setEnergy(value)} style={[styles.choice, energy === value && styles.selected]}><Text style={styles.choiceText}>{value === 1 ? "🌿 Très chill" : value === 2 ? "🙂 Doux" : value === 3 ? "⚡ Actif" : "🔥 Toujours en mouvement"}</Text></Pressable>)}</View></>}
            {step === 3 && <><Text style={styles.question}>Son petit caractère</Text><Text style={styles.hint}>Choisis ce qui lui ressemble le plus.</Text><View style={styles.tags}>{TAGS.map((tag) => <Pressable key={tag} onPress={() => toggleTag(tag)} style={[styles.tag, tags.includes(tag) && styles.tagSelected]}><Text style={styles.tagText}>{tag}</Text></Pressable>)}</View><TextInput value={bio} onChangeText={setBio} multiline placeholder="Un petit mot sur lui..." placeholderTextColor={colors.grey} style={[styles.input, styles.bio]} /></>}
          </ScrollView>
          <View style={styles.footer}><Pressable style={styles.primary} onPress={next}><Text style={styles.primaryText}>{step === 3 ? "Créer son profil" : "Continuer"}</Text></Pressable><Pressable onPress={step === 3 ? create : next}><Text style={styles.later}>{step === 3 ? "Enregistrer avec ces informations" : "Passer cette étape"}</Text></Pressable></View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(43,39,36,0.25)" },
  sheet: { maxHeight: "88%", minHeight: "62%", backgroundColor: colors.cream, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 20, paddingTop: 10, shadowColor: colors.dark, shadowOpacity: 0.18, shadowRadius: 18, elevation: 12 },
  handle: { alignSelf: "center", width: 42, height: 5, borderRadius: 3, backgroundColor: colors.line, marginBottom: 14 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  eyebrow: { fontFamily: fonts.bodyBold, fontSize: 9, color: colors.coralDark, letterSpacing: 0.8 },
  title: { fontFamily: fonts.displayExtra, fontSize: 24, color: colors.dark, marginTop: 4 },
  close: { fontFamily: fonts.body, fontSize: 30, color: colors.grey, lineHeight: 28 },
  progress: { height: 5, backgroundColor: colors.line, borderRadius: 3, marginTop: 14 },
  progressFill: { height: 5, borderRadius: 3, backgroundColor: colors.coral },
  content: { paddingVertical: 22 },
  question: { fontFamily: fonts.displayExtra, fontSize: 25, color: colors.dark, lineHeight: 31 },
  hint: { fontFamily: fonts.body, fontSize: 13, color: colors.grey, marginTop: 6, marginBottom: 18 },
  input: { height: 50, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 14, color: colors.dark, fontFamily: fonts.body, fontSize: 14, marginBottom: 10 },
  speciesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  species: { width: "31%", minHeight: 72, borderRadius: radii.md, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line },
  selected: { borderColor: colors.coral, backgroundColor: colors.cream2 },
  speciesIcon: { fontSize: 25 },
  speciesText: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.dark, marginTop: 4 },
  choiceList: { gap: 8 },
  choice: { padding: 14, borderRadius: radii.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  choiceText: { fontFamily: fonts.bodySemi, color: colors.dark },
  fieldLabel: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.grey, marginTop: 2, marginBottom: 7 },
  genderRow: { flexDirection: "row", gap: 8 },
  genderChoice: { flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: radii.sm, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  modeRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  mode: { flex: 1, alignItems: "center", paddingVertical: 13, borderRadius: radii.sm, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  modeText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.dark },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  tag: { borderRadius: radii.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, paddingVertical: 9 },
  tagSelected: { backgroundColor: colors.cream2, borderColor: colors.coral },
  tagText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.dark },
  bio: { minHeight: 90, paddingTop: 14, textAlignVertical: "top" },
  photoPicker: { width: 112, height: 112, borderRadius: 56, alignSelf: "center", backgroundColor: colors.white, borderWidth: 2, borderColor: colors.coral, borderStyle: "dashed", alignItems: "center", justifyContent: "center", marginBottom: 18, overflow: "hidden" },
  photoPreview: { width: "100%", height: "100%" },
  photoIcon: { fontSize: 27 },
  photoText: { fontFamily: fonts.bodySemi, fontSize: 10, color: colors.coralDark, marginTop: 5 },
  footer: { paddingBottom: 18, paddingTop: 8 },
  primary: { backgroundColor: colors.coral, borderRadius: radii.pill, paddingVertical: 15, alignItems: "center" },
  primaryText: { fontFamily: fonts.bodyBold, color: colors.white, fontSize: 14 },
  later: { textAlign: "center", fontFamily: fonts.bodyMedium, color: colors.grey, fontSize: 11, paddingTop: 12 },
});
