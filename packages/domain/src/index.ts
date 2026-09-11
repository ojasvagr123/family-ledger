export type MemberRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
export type MemberStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED' | 'LEFT' | 'REMOVED';

export const canApproveMembers = (role: MemberRole) => role === 'OWNER' || role === 'ADMIN';

export const canEditTransaction = (
  role: MemberRole,
  actorUserId: string,
  creatorUserId: string,
) => role === 'OWNER' || role === 'ADMIN' || (role === 'MEMBER' && actorUserId === creatorUserId);

export const calculateSummary = (incomeMinor: bigint, expenseMinor: bigint) => {
  const netMinor = incomeMinor - expenseMinor;
  return {
    incomeMinor,
    expenseMinor,
    netMinor,
    expenseToIncome: incomeMinor === 0n ? null : Number(expenseMinor * 10_000n / incomeMinor) / 100,
    savingsRate: incomeMinor === 0n ? null : Number(netMinor * 10_000n / incomeMinor) / 100,
  };
};
