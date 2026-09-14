import { Stack } from 'expo-router';
import { FamilyGate } from '@/components/family-gate';
export default function Layout() { return <FamilyGate><Stack screenOptions={{ headerShown: false }} /></FamilyGate>; }
