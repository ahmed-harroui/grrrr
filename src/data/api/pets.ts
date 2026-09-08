import {
  Pet,
  CreatePetInput,
  UpdatePetInput,
} from "../types/pet";

import {
  MOCK_ME,
  MOCK_PETS,
} from "../mock/pets";

export async function getMyPet(): Promise<Pet> {
  return Promise.resolve(MOCK_ME);
}

export async function getMyPets(): Promise<Pet[]> {
  return Promise.resolve([MOCK_ME]);
}

export async function getPetById(
  petId: string
): Promise<Pet | null> {
  const allPets = [MOCK_ME, ...MOCK_PETS];

  const pet = allPets.find(
    (item) => item.id === petId
  );

  return Promise.resolve(pet ?? null);
}

export async function createPet(
  input: CreatePetInput
): Promise<Pet> {
  const now = new Date().toISOString();

  const newPet: Pet = {
    id: `pet_${Date.now()}`,
    ownerId: "user_current",

    ...input,

    latitude: input.latitude ?? 48.8566,
    longitude: input.longitude ?? 2.3522,

    createdAt: now,
    updatedAt: now,
  };

  return Promise.resolve(newPet);
}

export async function updatePet(
  petId: string,
  input: UpdatePetInput
): Promise<Pet | null> {
  const pet = await getPetById(petId);

  if (!pet) {
    return null;
  }

  const updatedPet: Pet = {
    ...pet,
    ...input,
    updatedAt: new Date().toISOString(),
  };

  return Promise.resolve(updatedPet);
}

export async function deletePet(
  petId: string
): Promise<boolean> {
  const pet = await getPetById(petId);

  return Promise.resolve(Boolean(pet));
}