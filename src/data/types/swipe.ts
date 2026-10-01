export type SwipeAction =
  | "LIKE"
  | "SKIP"
  | "SUPER_LIKE";

/** The mood a like is sent in; decides the match type once it's mutual */
export type LikeIntent = "HOT" | "FRIEND";

export interface Swipe {
  id: string;

  fromPetId: string;
  toPetId: string;

  action: SwipeAction;

  createdAt: string;
}