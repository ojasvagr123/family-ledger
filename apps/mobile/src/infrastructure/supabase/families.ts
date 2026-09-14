import type { CreateFamilyInput, CreateInvitationInput, DecideJoinRequestInput, RequestJoinInput, RevokeInvitationInput } from '@family-ledger/contracts';
import { requireSupabase } from './client';
import type { FamilySummary, JoinRequestSummary } from './types';

export type FamilyMemberSummary = {
  user_id: string;
  display_name: string;
  role: string;
};

function unwrap<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  if (data == null) throw new Error('EMPTY_RESPONSE');
  return data;
}

export async function listFamilies(): Promise<FamilySummary[]> {
  const { data, error } = await requireSupabase().rpc('list_my_families');
  return unwrap(data as FamilySummary[] | null, error);
}

export async function createFamily(input: CreateFamilyInput): Promise<FamilySummary> {
  const { data, error } = await requireSupabase().rpc('create_family', {
    p_name: input.name,
    p_currency_code: input.currencyCode,
    p_timezone: input.timezone,
    p_fiscal_start_month: input.fiscalStartMonth,
    p_reporting_start_year: input.reportingStartYear,
    p_idempotency_key: input.idempotencyKey,
  });
  return unwrap(data as FamilySummary | null, error);
}

export async function createInvitation(input: CreateInvitationInput) {
  const { data, error } = await requireSupabase().rpc('create_invitation', {
    p_family_id: input.familyId,
    p_expires_in_hours: input.expiresInHours,
    p_max_uses: input.maxUses,
    p_idempotency_key: input.idempotencyKey,
  });
  return unwrap(data as { invitationId: string; token: string; expiresAt: string } | null, error);
}

export async function requestJoin(input: RequestJoinInput) {
  const { data, error } = await requireSupabase().rpc('request_join', { p_token: input.token, p_idempotency_key: input.idempotencyKey });
  return unwrap(data as { joinRequestId: string; familyId: string; status: 'PENDING' } | null, error);
}

export async function listPendingJoinRequests(familyId: string): Promise<JoinRequestSummary[]> {
  const { data, error } = await requireSupabase().rpc('list_pending_join_requests', { p_family_id: familyId });
  return unwrap(data as JoinRequestSummary[] | null, error);
}

export async function listFamilyMembers(familyId: string): Promise<FamilyMemberSummary[]> {
  const { data, error } = await requireSupabase().rpc('list_family_members', { p_family_id: familyId });
  return unwrap(data as FamilyMemberSummary[] | null, error);
}

export async function decideJoinRequest(input: DecideJoinRequestInput) {
  const { data, error } = await requireSupabase().rpc('decide_join_request', {
    p_family_id: input.familyId,
    p_join_request_id: input.joinRequestId,
    p_decision: input.decision,
    p_idempotency_key: input.idempotencyKey,
  });
  return unwrap(data as { joinRequestId: string; status: 'APPROVED' | 'REJECTED' } | null, error);
}

export async function revokeInvitation(input: RevokeInvitationInput) {
  const { data, error } = await requireSupabase().rpc('revoke_invitation', {
    p_family_id: input.familyId,
    p_invitation_id: input.invitationId,
    p_idempotency_key: input.idempotencyKey,
  });
  return unwrap(data as { invitationId: string; revoked: true } | null, error);
}
