import { Colors } from '@/constants/colors';
import { useColorScheme } from './useColorScheme';

export function useThemeColor(
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const theme = useColorScheme();
  return Colors[theme][colorName];
}

export function useThemeColors() {
  const theme = useColorScheme();
  return Colors[theme];
}
