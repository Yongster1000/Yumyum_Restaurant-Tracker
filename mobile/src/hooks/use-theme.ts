import { Colors } from '@/constants/theme';

// The app is light-only (see constants/theme.ts) so this has no branching
// logic today, but stays a hook so call sites don't need to change if a
// dark variant is designed later.
export function useTheme() {
  return Colors;
}
