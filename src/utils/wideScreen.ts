import { Dimensions, Platform } from "react-native";

/** The widest the app is drawn. Its screens are laid out for a phone: stretched across a desktop, cards and buttons become unreadable bands. */
export const APP_MAX_WIDTH = 560;
const WIDE_FROM = 700;

/** The decor around the column: a soft gradient scattered with paw prints, in the app's colour. */
export interface Backdrop {
  from: string;
  to: string;
  paw: string;
}

// One tile of the pattern: two paws, turned a little, repeated across the page
function pawTile(color: string) {
  const paw = `<ellipse cx="0" cy="8" rx="11" ry="9"/><ellipse cx="-13" cy="-6" rx="4.5" ry="6"/><ellipse cx="-5" cy="-14" rx="4.5" ry="6.5"/><ellipse cx="5" cy="-14" rx="4.5" ry="6.5"/><ellipse cx="13" cy="-6" rx="4.5" ry="6"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" fill="${color}"><g transform="translate(55 60) rotate(-18)">${paw}</g><g transform="translate(165 165) rotate(22) scale(.8)">${paw}</g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const decor = ({ from, to, paw }: Backdrop) => `${pawTile(paw)}, linear-gradient(160deg, ${from}, ${to})`;

/**
 * On tablets and computers (web), the app becomes a centred column on a decorated backdrop.
 * Done on the page itself rather than around the screens, so that modals follow: they are fixed to the window,
 * and a transformed <body> is what "the window" means to them.
 */
export function installWideScreenFrame(backdrop: { light: Backdrop; dark: Backdrop }) {
  if (Platform.OS !== "web" || typeof document === "undefined" || document.getElementById("wide-screen-frame")) return;
  const style = document.createElement("style");
  style.id = "wide-screen-frame";
  style.textContent = `
@media (min-width: ${WIDE_FROM}px) {
  html { background: ${decor(backdrop.light)}; background-attachment: fixed; min-height: 100%; }
  body {
    max-width: ${APP_MAX_WIDTH}px; margin: 0 auto !important; height: 100vh; overflow: hidden;
    transform: translateZ(0);
    box-shadow: 0 0 0 1px rgba(0, 0, 0, .06), 0 30px 90px rgba(0, 0, 0, .22);
  }
}
@media (min-width: ${WIDE_FROM}px) and (prefers-color-scheme: dark) {
  html { background: ${decor(backdrop.dark)}; background-attachment: fixed; }
  body { box-shadow: 0 0 0 1px rgba(255, 255, 255, .08), 0 30px 90px rgba(0, 0, 0, .6); }
}`;
  document.head.appendChild(style);
}

/** The width the app really has: the window's, or the column's when the frame above is on. Use it instead of Dimensions for swipes, pages and anything sized from the screen. */
export function appWidth() {
  const { width } = Dimensions.get("window");
  return Platform.OS === "web" && width >= WIDE_FROM ? Math.min(width, APP_MAX_WIDTH) : width;
}
