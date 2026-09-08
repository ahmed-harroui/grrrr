export interface Breed {
  id: string;
  species: "dog" | "cat";
  name: string;
}

export interface BreedCompatibility {
  breed: string;
  compatibleBreeds: string[];
}

export const MOCK_BREEDS: Breed[] = [
  {
    id: "dog_golden_retriever",
    species: "dog",
    name: "Golden Retriever",
  },
  {
    id: "dog_labrador",
    species: "dog",
    name: "Labrador",
  },
  {
    id: "dog_border_collie",
    species: "dog",
    name: "Border Collie",
  },
  {
    id: "dog_australian_shepherd",
    species: "dog",
    name: "Australian Shepherd",
  },
  {
    id: "dog_german_shepherd",
    species: "dog",
    name: "German Shepherd",
  },
  {
    id: "dog_french_bulldog",
    species: "dog",
    name: "French Bulldog",
  },
  {
    id: "cat_european_shorthair",
    species: "cat",
    name: "European Shorthair",
  },
];

export const BREED_COMPATIBILITY: BreedCompatibility[] = [
  {
    breed: "Golden Retriever",
    compatibleBreeds: [
      "Golden Retriever",
      "Labrador",
      "Border Collie",
      "Australian Shepherd",
    ],
  },

  {
    breed: "Labrador",
    compatibleBreeds: [
      "Labrador",
      "Golden Retriever",
      "German Shepherd",
    ],
  },

  {
    breed: "Border Collie",
    compatibleBreeds: [
      "Border Collie",
      "Golden Retriever",
      "Australian Shepherd",
    ],
  },

  {
    breed: "Australian Shepherd",
    compatibleBreeds: [
      "Australian Shepherd",
      "Border Collie",
      "Golden Retriever",
    ],
  },

  {
    breed: "German Shepherd",
    compatibleBreeds: [
      "German Shepherd",
      "Labrador",
    ],
  },

  {
    breed: "French Bulldog",
    compatibleBreeds: [
      "French Bulldog",
    ],
  },

  {
    breed: "European Shorthair",
    compatibleBreeds: [
      "European Shorthair",
    ],
  },
];