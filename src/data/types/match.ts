// ADOPT: a conversation opened by an adoption request (migration 012), not a like-back match.
export type MatchType = "FRIEND" | "LOVE" | "BOTH" | "ADOPT";

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