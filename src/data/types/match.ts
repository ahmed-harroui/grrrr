export type MatchType = "FRIEND" | "LOVE" | "BOTH";

export interface MatchScore {
  total: number;

  breed: number;
  distance: number;
  age: number;
  energy: number;
  gender: number;
  mode: number;
  tags: number;

  reasons: string[];
}

export interface Match {
  id: string;

  pet1Id: string;
  pet2Id: string;

  type: MatchType;

  compatibilityScore: number;

  createdAt: string;
}