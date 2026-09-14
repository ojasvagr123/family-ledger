import { z } from 'zod';
export type { Database } from './database';

export const uuidSchema = z.uuid();

export const createFamilySchema = z.object({
  name: z.string().trim().min(1).max(100),
  currencyCode: z.string().regex(/^[A-Z]{3}$/).default('INR'),
  timezone: z.string().trim().min(1).max(100).default('Asia/Kolkata'),
  fiscalStartMonth: z.number().int().min(1).max(12).default(1),
  reportingStartYear: z.number().int().min(1900).max(2200),
  idempotencyKey: uuidSchema,
});

export const createInvitationSchema = z.object({
  familyId: uuidSchema,
  expiresInHours: z.number().int().min(1).max(168).default(72),
  maxUses: z.number().int().min(1).max(20).default(1),
  idempotencyKey: uuidSchema,
});

export const requestJoinSchema = z.object({
  token: z.string().min(32).max(512),
  idempotencyKey: uuidSchema,
});

export const decideJoinRequestSchema = z.object({
  familyId: uuidSchema,
  joinRequestId: uuidSchema,
  decision: z.enum(['APPROVED', 'REJECTED']),
  idempotencyKey: uuidSchema,
});

export const revokeInvitationSchema = z.object({
  familyId: uuidSchema,
  invitationId: uuidSchema,
  idempotencyKey: uuidSchema,
});

export type CreateFamilyInput = z.infer<typeof createFamilySchema>;
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type RequestJoinInput = z.infer<typeof requestJoinSchema>;
export type DecideJoinRequestInput = z.infer<typeof decideJoinRequestSchema>;
export type RevokeInvitationInput = z.infer<typeof revokeInvitationSchema>;

export const minorAmountSchema = z.string().regex(/^[0-9]{1,15}$/).refine((value) => BigInt(value) > 0n, 'Amount must be positive');
export const accountSchema = z.object({ familyId: uuidSchema, name: z.string().trim().min(1).max(80), accountType: z.enum(['CASH','SAVINGS','CURRENT','CREDIT_CARD','WALLET','OTHER']), openingDate: z.iso.date(), balanceMinor: z.string().regex(/^-?[0-9]{1,15}$/), idempotencyKey: uuidSchema });
export const saveTransactionSchema = z.object({ familyId: uuidSchema, transactionId: uuidSchema.nullable(), expectedVersion: z.number().int().positive().nullable(), type: z.enum(['INCOME','EXPENSE']), localDate: z.iso.date(), amountMinor: minorAmountSchema, accountId: uuidSchema, categoryId: uuidSchema, description: z.string().trim().max(240), remarks: z.string().trim().max(2000), idempotencyKey: uuidSchema });
export const deleteTransactionSchema = z.object({ familyId: uuidSchema, transactionId: uuidSchema, expectedVersion: z.number().int().positive(), deleted: z.boolean(), idempotencyKey: uuidSchema });
