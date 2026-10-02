import { createNavigationContainerRef } from "@react-navigation/native";

// Lets code outside the screens (notification banner) navigate and know the current screen.
export const navigationRef = createNavigationContainerRef<any>();
