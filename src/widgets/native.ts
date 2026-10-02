import type { WidgetSnapshot } from "@/widgets/snapshot";

// Web: no home-screen widgets. Android and iOS have their own native.android.tsx / native.ios.tsx.

export function registerWidgets() {}

export async function pushWidgets(_snapshot: WidgetSnapshot | null) {}
