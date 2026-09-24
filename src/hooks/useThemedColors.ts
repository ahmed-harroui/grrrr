import { useTheme } from "@/context/ThemeContext";
import { getThemeColors } from "@/theme/theme";

export function useThemedColors() {
  const { isDark } = useTheme();
  return getThemeColors(isDark);
}
