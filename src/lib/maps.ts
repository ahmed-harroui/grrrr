import { Platform } from "react-native";

// On Android, react-native-maps draws Google Maps, which closes the app without an API key.
// The key (EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in .env) is also put in the Android manifest by
// android/app/build.gradle. Without it, the screens show a tappable area instead of the map.
// iOS uses Apple Maps (no key); the web has its own placeholder (maps.web.tsx).
export const NATIVE_MAPS_AVAILABLE = Platform.OS === "ios" || (Platform.OS === "android" && Boolean(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY));
