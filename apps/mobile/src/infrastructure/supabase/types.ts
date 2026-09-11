export type MemberRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
export type MemberStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED' | 'LEFT' | 'REMOVED';

export type FamilySummary = {
  id: string;
  name: string;
  currency_code: string;
  timezone: string;
  fiscal_start_month: number;
  role: MemberRole;
  status: MemberStatus;
  version: number;
};

export type JoinRequestSummary = {
  id: string;
  family_id: string;
  requester_user_id: string;
  requester_display_name: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  created_at: string;
};
