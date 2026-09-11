import { Platform } from 'react-native';

export const palette = {
  canvas: '#F8F5EF', surface: '#FFFDF9', surfaceMuted: '#EEE9DF',
  text: '#16252B', textMuted: '#607077', border: '#D8D1C5',
  action: '#294C56', actionText: '#FFFFFF', income: '#D9EDF3',
  incomeStrong: '#5E94A3', expense: '#F3DDD6', expenseStrong: '#C26D58',
  success: '#DDEBDD', warning: '#F4E8BE', danger: '#F5D4D2', destructive: '#9B2C2C',
} as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 18 } as const;
export const fonts = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });
