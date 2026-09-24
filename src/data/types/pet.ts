export type Gender = "M" | "F";

export type Species =
  | "dog" | "cat" | "rabbit" | "hamster" | "guinea_pig" | "mouse" | "rat" | "ferret" | "hedgehog" | "squirrel"
  | "pig" | "donkey" | "horse" | "sheep" | "goat" | "cow" | "llama" | "alpaca" | "camel" | "deer"
  | "lion" | "tiger" | "leopard" | "wolf" | "fox" | "bear" | "elephant" | "giraffe" | "zebra" | "monkey" | "koala"
  | "bird" | "parrot" | "chicken" | "duck" | "penguin"
  | "turtle" | "lizard" | "snake" | "crocodile"
  | "frog" | "salamander"
  | "fish" | "shark" | "dolphin" | "whale" | "octopus" | "crab"
  | "insect" | "bee" | "butterfly" | "beetle" | "spider" | "scorpion" | "snail";

export type PetMode = "FRIEND" | "LOVE" | "BOTH";

export type Energy = 1 | 2 | 3 | 4;

export interface Pet {
  id: string;
  ownerId: string;

  name: string;
  species: Species;
  breed: string;
  gender: Gender;

  birthDate: string;

  energy: Energy;

  bio: string;
  tags: string[];

  photos: string[];

  latitude: number;
  longitude: number;

  mode: PetMode;

  /**
   * 0 = pure FRIEND
   * 100 = pure HOT / LOVE
   */
  modePreference: number;

  createdAt: string;
  updatedAt: string;
}

export interface CreatePetInput {
  name: string;
  species: Species;
  breed: string;
  gender: Gender;
  birthDate: string;
  energy: Energy;
  bio: string;
  tags: string[];
  photos: string[];
  latitude?: number;
  longitude?: number;
  mode: PetMode;
  modePreference: number;
}

export interface UpdatePetInput {
  name?: string;
  breed?: string;
  gender?: Gender;
  birthDate?: string;
  energy?: Energy;
  bio?: string;
  tags?: string[];
  photos?: string[];
  latitude?: number;
  longitude?: number;
  mode?: PetMode;
  modePreference?: number;
}