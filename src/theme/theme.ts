export const lightColors = {
  coral: "#FF5D73",
  coralDark: "#E64863",
  hot: "#FF9E4F",
  friend: "#2FBDB4",
  cream: "#FFF7EF",
  cream2: "#FFEEE0",
  dark: "#2B2724",
  grey: "#8A8078",
  line: "#EFE4D8",
  white: "#FFFFFF",
};

export const darkColors = {
  coral: "#FF6E84",
  coralDark: "#FF5D73",
  hot: "#FFB366",
  friend: "#4FD4C6",
  cream: "#1A1815",
  cream2: "#2D2620",
  dark: "#F5F5F5",
  grey: "#A89F96",
  line: "#3D3830",
  white: "#0D0D0D",
};

export const fonts = {
  display: "Baloo2_700Bold",
  displaySemi: "Baloo2_600SemiBold",
  displayExtra: "Baloo2_800ExtraBold",
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemi: "Inter_600SemiBold",
  bodyBold: "Inter_700Bold",
};

export const radii = {
  sm: 12,
  md: 18,
  lg: 26,
  pill: 999,
  round: 999,
};

export const spacing = (n: number) => n * 4;

export const getThemeColors = (isDark: boolean) => isDark ? darkColors : lightColors;

// For backwards compatibility, export lightColors as colors
export const colors = lightColors;

export default { colors, lightColors, darkColors, fonts, radii, spacing };
