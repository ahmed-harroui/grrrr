import { Pet } from "../types/pet";

export const MOCK_ME: Pet = {
  id: "pet_000",
  ownerId: "user_000",

  name: "Rocky",
  species: "dog",
  breed: "Golden Retriever",
  gender: "M",

  birthDate: "2023-04-12",

  energy: 3,

  bio: "Je m'appelle Rocky 🐶, j'ai 3 ans, j'adore courir, jouer à la balle et rencontrer de nouveaux copains. Je cherche surtout un partenaire de jeu énergique !",

  tags: [
    "🎾 Play",
    "🏃 Run",
    "🦴 Food lover",
  ],

  photos: [
    "https://placedog.net/600/700?id=1",
    "https://placedog.net/600/700?id=2",
  ],

  latitude: 48.8566,
  longitude: 2.3522,

  mode: "BOTH",
  modePreference: 70,

  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

export const MOCK_PETS: Pet[] = [
  {
    id: "pet_001",
    ownerId: "user_001",

    name: "Luna",
    species: "dog",
    breed: "Labrador",
    gender: "F",

    birthDate: "2024-03-10",

    energy: 3,

    bio: "Toujours prête pour une balade ou une sieste au soleil. Adore l'eau et les balles de tennis.",

    tags: [
      "🎾 Play",
      "🌊 Swim",
      "🍖 Food",
    ],

    photos: [
      "https://placedog.net/600/700?id=20",
      "https://placedog.net/600/700?id=21",
    ],

    latitude: 48.8900,
    longitude: 2.3400,

    mode: "LOVE",
    modePreference: 80,

    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },

  {
    id: "pet_002",
    ownerId: "user_002",

    name: "Bella",
    species: "dog",
    breed: "Border Collie",
    gender: "F",

    birthDate: "2025-02-01",

    energy: 4,

    bio: "Ultra énergique, elle cherche surtout un copain de jeu pour courir toute la journée.",

    tags: [
      "🏃 Run",
      "🎾 Play",
      "🐕 Walk",
    ],

    photos: [
      "https://placedog.net/600/700?id=31",
      "https://placedog.net/600/700?id=32",
    ],

    latitude: 48.8500,
    longitude: 2.3600,

    mode: "FRIEND",
    modePreference: 15,

    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },

  {
    id: "pet_003",
    ownerId: "user_003",

    name: "Max",
    species: "dog",
    breed: "French Bulldog",
    gender: "M",

    birthDate: "2022-08-20",

    energy: 1,

    bio: "Plutôt du genre chill, il préfère les balades tranquilles et les câlins sur le canapé.",

    tags: [
      "🛋️ Chill",
      "🐕 Walk",
    ],

    photos: [
      "https://placedog.net/600/700?id=8",
    ],

    latitude: 48.9100,
    longitude: 2.3300,

    mode: "FRIEND",
    modePreference: 20,

    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },

  {
    id: "pet_004",
    ownerId: "user_004",

    name: "Milo",
    species: "dog",
    breed: "German Shepherd",
    gender: "M",

    birthDate: "2021-05-14",

    energy: 2,

    bio: "Loyal et affectueux, à la recherche d'une belle connexion pour la vie.",

    tags: [
      "🦴 Food",
      "🐕 Walk",
      "❤️ Love",
    ],

    photos: [
      "https://placedog.net/600/700?id=15",
    ],

    latitude: 48.8200,
    longitude: 2.3700,

    mode: "LOVE",
    modePreference: 85,

    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },

  {
    id: "pet_005",
    ownerId: "user_005",

    name: "Coco",
    species: "dog",
    breed: "Australian Shepherd",
    gender: "F",

    birthDate: "2023-07-22",

    energy: 3,

    bio: "Joueuse et douce à la fois, elle cherche un ami — et pourquoi pas plus.",

    tags: [
      "🎾 Play",
      "🏃 Run",
    ],

    photos: [
      "https://placedog.net/600/700?id=42",
      "https://placedog.net/600/700?id=43",
    ],

    latitude: 48.8700,
    longitude: 2.3500,

    mode: "BOTH",
    modePreference: 60,

    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },

  {
    id: "pet_006",
    ownerId: "user_006",

    name: "Nala",
    species: "cat",
    breed: "European Shorthair",
    gender: "F",

    birthDate: "2024-01-18",

    energy: 1,

    bio: "Curieuse et indépendante, elle adore observer le monde depuis la fenêtre.",

    tags: [
      "🛋️ Chill",
      "🐾 Play",
    ],

    photos: [
      "https://cataas.com/cat/cute?width=600&height=700",
    ],

    latitude: 48.8400,
    longitude: 2.3200,

    mode: "FRIEND",
    modePreference: 10,

    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
];