import {
  Swipe,
  SwipeAction,
} from "../types/swipe";

const swipeHistory: Swipe[] = [];

export async function createSwipe(
  fromPetId: string,
  toPetId: string,
  action: SwipeAction
): Promise<Swipe> {
  const swipe: Swipe = {
    id: `swipe_${Date.now()}`,
    fromPetId,
    toPetId,
    action,
    createdAt: new Date().toISOString(),
  };

  swipeHistory.push(swipe);

  return Promise.resolve(swipe);
}

export async function getSwipeHistory(
  petId: string
): Promise<Swipe[]> {
  return Promise.resolve(
    swipeHistory.filter(
      (swipe) =>
        swipe.fromPetId === petId
    )
  );
}

export async function hasAlreadySwiped(
  fromPetId: string,
  toPetId: string
): Promise<boolean> {
  return Promise.resolve(
    swipeHistory.some(
      (swipe) =>
        swipe.fromPetId === fromPetId &&
        swipe.toPetId === toPetId
    )
  );
}