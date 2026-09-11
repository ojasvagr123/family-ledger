import { useState } from 'react';
import { Share } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { createInvitationSchema, revokeInvitationSchema } from '@family-ledger/contracts';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { Card } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { Screen } from '@/components/ui/screen';
import { env } from '@/infrastructure/env';
import { createInvitation, revokeInvitation } from '@/infrastructure/supabase/families';
import { useActiveFamily } from '@/providers/active-family-provider';

export default function InvitationsScreen() {
  const { activeFamily } = useActiveFamily();
  const [invitationId, setInvitationId] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function create() {
    if (!activeFamily) return;
    const input = createInvitationSchema.parse({ familyId: activeFamily.id, expiresInHours: 72, maxUses: 1, idempotencyKey: Crypto.randomUUID() });
    setLoading(true); setError(null);
    try {
      const invite = await createInvitation(input);
      setInvitationId(invite.invitationId);
      const route = `/invite/${encodeURIComponent(invite.token)}`;
      setLink(env?.appEnv === 'development' ? Linking.createURL(route) : `${env?.inviteOrigin ?? 'https://invite.example.com'}${route}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to create invitation.'); }
    finally { setLoading(false); }
  }
  async function revoke() {
    if (!activeFamily || !invitationId) return;
    setLoading(true); setError(null);
    try {
      await revokeInvitation(revokeInvitationSchema.parse({ familyId: activeFamily.id, invitationId, idempotencyKey: Crypto.randomUUID() }));
      setInvitationId(null); setLink(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to revoke invitation.'); }
    finally { setLoading(false); }
  }
  return <Screen title="Invitation links" subtitle="Links create pending requests; they never grant access automatically.">{error && <Notice tone="danger" message={error} />}<Card><AppText variant="heading">Single-use invitation</AppText><AppText muted>Expires after 72 hours. The raw token is shown only after creation.</AppText><AppButton label="Create invitation" loading={loading} onPress={create} />{link && <><Notice message={link} /><AppButton label="Share invitation" onPress={() => Share.share({ title: `Join ${activeFamily?.name}`, message: `Join ${activeFamily?.name} on FamilyLedger: ${link}` })} /><AppButton label="Revoke invitation" kind="secondary" loading={loading} onPress={revoke} /></>}</Card><AppButton label="Back" kind="secondary" onPress={() => router.back()} /></Screen>;
}
