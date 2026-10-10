import React from "react";
import { Dimensions, Platform, useWindowDimensions, View } from "react-native";
import { useThemedColors } from "@/hooks/useThemedColors";

// The app takes the shape of the device it is opened on:
//   phone   one column, the tab bar at the bottom
//   tablet  the same navigation, each screen at a comfortable width in the middle
//   laptop  a sidebar on the left, the screen beside it
export type DeviceKind = "phone" | "tablet" | "laptop";

const TABLET_FROM = 700;
const LAPTOP_FROM = 1024;

/** Width of the sidebar that replaces the bottom bar on a laptop */
export const SIDEBAR_WIDTH = 236;
/** The widest a swipe card, an onboarding page or a form grows */
export const CARD_WIDTH = 520;
/** The widest a sheet or a full-screen editor opens on a tablet or a laptop */
const MODAL_WIDTH = 640;

export function useDevice() {
  const { width, height } = useWindowDimensions();
  const kind: DeviceKind = width >= LAPTOP_FROM ? "laptop" : width >= TABLET_FROM ? "tablet" : "phone";
  return { kind, isLaptop: kind === "laptop", isWide: kind !== "phone", width, height };
}

/**
 * A screen at the width it reads best, centred in the space the device gives it.
 * Phones get the screen as it is; tablets and laptops get it up to `maxWidth`.
 */
export function framed<P extends object>(Screen: React.ComponentType<P>, maxWidth: number) {
  return function Framed(props: P) {
    const { isWide } = useDevice();
    const colors = useThemedColors();
    if (!isWide) return React.createElement(Screen, props);
    return React.createElement(
      View,
      { style: { flex: 1, alignItems: "center", backgroundColor: colors.cream } },
      React.createElement(View, { style: { flex: 1, width: "100%", maxWidth } }, React.createElement(Screen, props))
    );
  };
}

/**
 * Sheets and full-screen editors are written for a phone: on a wider window they open as a centred panel,
 * the rest of the window dimmed, instead of a band across the whole screen (web only).
 */
export function installWideModals() {
  if (Platform.OS !== "web" || typeof document === "undefined" || document.getElementById("wide-modals")) return;
  const style = document.createElement("style");
  style.id = "wide-modals";
  style.textContent = `@media (min-width: ${TABLET_FROM}px) {
  [aria-modal="true"] { max-width: ${MODAL_WIDTH}px; margin: 0 auto; left: 0 !important; right: 0 !important; box-shadow: 0 0 0 100vmax rgba(0, 0, 0, .45); }
}`;
  document.head.appendChild(style);
}

/** The width a swipe card or an onboarding page really has: the window's on a phone, CARD_WIDTH beyond. Use it instead of Dimensions for anything sized from the screen. */
export function appWidth() {
  const { width } = Dimensions.get("window");
  return width >= TABLET_FROM ? Math.min(width, CARD_WIDTH) : width;
}
