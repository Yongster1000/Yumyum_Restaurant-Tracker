import { Platform } from 'react-native';

// Palette pulled 1:1 from the Claude Design redesign (warm cream + terracotta).
// Light-only by design — the redesign didn't define a dark variant.
export const Colors = {
  background: '#f5ead8',
  surface: '#ebddc5',
  text: '#201e1d',
  accent: '#c67139',
  accent2: '#7a8a5e',
  divider: 'rgba(32, 30, 29, 0.16)',

  neutral100: '#f9f4ed',
  neutral200: '#eee7db',
  neutral300: '#dcd3c4',
  neutral400: '#c0b6a5',
  neutral500: '#a19786',
  neutral600: '#82796a',
  neutral700: '#645c50',
  neutral800: '#474238',
  neutral900: '#2e2b25',

  accent100: '#fff2eb',
  accent200: '#ffe1d0',
  accent300: '#ffc6a5',
  accent400: '#f6a06b',
  accent500: '#d67f48',
  accent600: '#b2622d',
  accent700: '#8c491a',
  accent800: '#643312',
  accent900: '#402310',

  accent2100: '#f0fae1',
  accent2200: '#e1eecc',
  accent2300: '#ccdbb2',
  accent2400: '#aebf92',
  accent2500: '#8fa073',
  accent2600: '#728157',
  accent2700: '#56633f',
  accent2800: '#3d472b',
  accent2900: '#272e1b',
} as const;

export type ThemeColor = keyof typeof Colors;

export const Fonts = {
  heading: 'Caprasimo_400Regular',
  body: 'Figtree_400Regular',
  bodyMedium: 'Figtree_500Medium',
  bodySemibold: 'Figtree_600SemiBold',
  bodyBold: 'Figtree_700Bold',
} as const;

// The redesign's scale is 4.4px steps (1/2/3/4/6/8×) rather than a round-number scale.
export const Spacing = {
  space1: 4.4,
  space2: 8.8,
  space3: 13.2,
  space4: 17.6,
  space6: 26.4,
  space8: 35.2,
} as const;

export const Radius = {
  sm: 8,
  md: 16,
  lg: 28,
  pill: 999,
  // Not part of the design's generic scale, but reused consistently for
  // every list-item/review card across screens.
  card: 32,
} as const;

export const Shadows = {
  sm: Platform.select({
    ios: { shadowColor: '#2e2b25', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.14, shadowRadius: 2 },
    android: { elevation: 2 },
    default: {},
  }),
  md: Platform.select({
    ios: { shadowColor: '#2e2b25', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.16, shadowRadius: 10 },
    android: { elevation: 6 },
    default: {},
  }),
  lg: Platform.select({
    ios: { shadowColor: '#2e2b25', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.22, shadowRadius: 32 },
    android: { elevation: 14 },
    default: {},
  }),
} as const;

// Height reserved at the bottom of scrollable lists so content can't sit
// behind the floating pill tab bar (see components/floating-tab-bar.tsx).
export const BottomTabInset = 120;
