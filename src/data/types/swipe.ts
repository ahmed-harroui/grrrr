export type SwipeAction =
  | "LIKE"
  | "SKIP"
  | "SUPER_LIKE";

export interface Swipe {
  id: string;

  fromPetId: string;
  toPetId: string;

  action: SwipeAction;

  createdAt: string;
}