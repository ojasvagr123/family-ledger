import { Platform } from 'react-native';

export const palette = {
  canvas: '#F4F7FB', surface: '#FFFFFF', surfaceMuted: '#EEF2F7',
  surfaceStrong: '#E7ECF4', text: '#101828', textMuted: '#667085',
  textSoft: '#98A2B3', border: '#E4E7EC', borderStrong: '#D0D5DD',
  action: '#5B5BD6', actionPressed: '#4848B8', actionSoft: '#EEEEFF', actionText: '#FFFFFF',
  navy: '#172B4D', income: '#E8F8F1', incomeStrong: '#169B68',
  expense: '#FFF0ED', expenseStrong: '#E05252', success: '#E8F8F1',
  warning: '#FFF7DB', danger: '#FFE9E7', destructive: '#C43232',
  shadow: '#101828', white: '#FFFFFF',
} as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 16, lg: 22, pill: 999 } as const;
export const fonts = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });
export const elevation = {
  card: Platform.select({
    ios: { shadowColor: palette.shadow, shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
    android: { elevation: 2 },
    default: {},
  }),
  floating: Platform.select({
    ios: { shadowColor: palette.shadow, shadowOpacity: 0.14, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
    android: { elevation: 8 },
    default: {},
  }),
} as const;
