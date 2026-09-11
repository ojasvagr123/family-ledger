import * as SecureStore from 'expo-secure-store';

const KEY = 'family-ledger.pending-invite-token';

export const savePendingInvite = (token: string) => SecureStore.setItemAsync(KEY, token);
export const getPendingInvite = () => SecureStore.getItemAsync(KEY);
export const clearPendingInvite = () => SecureStore.deleteItemAsync(KEY);
