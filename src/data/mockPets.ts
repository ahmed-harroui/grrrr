export type Gender = "M" | "F";

export interface Pet {
  id: number;
  name: string;
  breed: string;
  gender: Gender;
  age: number;
  /** 1=chill 2=medium 3=high 4=crazy */
  energy: 1 | 2 | 3 | 4;
  dist: number; // km
  /** 0 = pure FRIEND, 100 = pure HOT/LOVE */
  mode: number;
  bio: string;
  tags: string[];
  photo: string;
}

export const ME: Pet = {
  id: 0,
  name: "Rocky",
  breed: "Golden Retriever",
  gender: "M",
  age: 3,
  energy: 3,
  dist: 0,
  mode: 70,
  bio: "Je m'appelle Rocky 🐶, j'ai 3 ans, j'adore courir, jouer à la balle et rencontrer de nouveaux copains. Je cherche surtout un partenaire de jeu énergique !",
  tags: ["🎾 Play", "🏃 Run", "🦴 Food lover"],
  photo: "https://placedog.net/600/700?id=1",
};

export const BREED_COMPAT: Record<string, string[]> = {
  "Golden Retriever": ["Golden Retriever", "Labrador", "Border Collie", "Australian Shepherd"],
  Labrador: ["Labrador", "Golden Retriever", "German Shepherd"],
  "French Bulldog": ["French Bulldog", "Cat (European)"],
  "Border Collie": ["Border Collie", "Golden Retriever", "Australian Shepherd"],
  "German Shepherd": ["German Shepherd", "Labrador"],
  "Australian Shepherd": ["Australian Shepherd", "Border Collie", "Golden Retriever"],
  "Cat (European)": ["Cat (European)", "French Bulldog"],
};

export const PETS: Pet[] = [
  {
    id: 1,
    name: "Luna",
    breed: "Labrador",
    gender: "F",
    age: 2,
    energy: 3,
    dist: 4,
    mode: 80,
    bio: "Toujours prête pour une balade ou une sieste au soleil. Adore l'eau et les balles de tennis.",
    tags: ["🎾 Play", "🌊 Swim", "🍖 Food"],
    photo: "https://placedog.net/600/700?id=20",
  },
  {
    id: 2,
    name: "Bella",
    breed: "Border Collie",
    gender: "F",
    age: 1,
    energy: 4,
    dist: 2,
    mode: 15,
    bio: "Ultra énergique, elle cherche surtout un copain de jeu pour courir toute la journée.",
    tags: ["🏃 Run", "🎾 Play", "🐕 Walk"],
    photo: "https://placedog.net/600/700?id=31",
  },
  {
    id: 3,
    name: "Max",
    breed: "French Bulldog",
    gender: "M",
    age: 4,
    energy: 1,
    dist: 6,
    mode: 20,
    bio: "Plutôt du genre chill, il préfère les balades tranquilles et les câlins sur le canapé.",
    tags: ["🛋️ Chill", "🐕 Walk"],
    photo: "https://placedog.net/600/700?id=8",
  },
  {
    id: 4,
    name: "Milo",
    breed: "German Shepherd",
    gender: "M",
    age: 5,
    energy: 2,
    dist: 9,
    mode: 85,
    bio: "Loyal et affectueux, à la recherche d'une belle connexion pour la vie.",
    tags: ["🦴 Food", "🐕 Walk", "❤️ Love"],
    photo: "https://placedog.net/600/700?id=15",
  },
  {
    id: 5,
    name: "Coco",
    breed: "Australian Shepherd",
    gender: "F",
    age: 3,
    energy: 3,
    dist: 3,
    mode: 60,
    bio: "Joueuse et douce à la fois, elle cherche un ami — et pourquoi pas plus.",
    tags: ["🎾 Play", "🏃 Run"],
    photo: "https://placedog.net/600/700?id=42",
  },
  {
    id: 6,
    name: "Nala",
    breed: "Cat (European)",
    gender: "F",
    age: 2,
    energy: 1,
    dist: 1,
    mode: 10,
    bio: "Curieuse et indépendante, elle adore observer le monde depuis la fenêtre.",
    tags: ["🛋️ Chill", "🐾 Play"],
    photo: "https://cataas.com/cat/cute?width=600&height=700",
  },
];

/** Pets that will always produce a reciprocal like, for demo purposes. */
export const WILL_MATCH = new Set([1, 2, 4, 5]);

export const ENERGY_LABEL: Record<number, string> = {
  1: "🐢 Chill",
  2: "😊 Medium",
  3: "⚡ High",
  4: "🔥 Crazy",
};
