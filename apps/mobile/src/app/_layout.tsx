import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppQueryProvider } from '@/providers/query-provider';
import { AuthProvider } from '@/providers/auth-provider';
import { ActiveFamilyProvider } from '@/providers/active-family-provider';
import { palette } from '@/constants/theme';
export default function RootLayout() { return <AppQueryProvider><AuthProvider><ActiveFamilyProvider><StatusBar style="dark" /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.canvas } }} /></ActiveFamilyProvider></AuthProvider></AppQueryProvider>; }
