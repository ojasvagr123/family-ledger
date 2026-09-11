import { z } from 'zod';

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
