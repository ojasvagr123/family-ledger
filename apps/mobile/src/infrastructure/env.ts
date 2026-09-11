import { z } from 'zod';

const schema = z.object({
  appEnv: z.enum(['development', 'preview', 'production']).default('development'),
  supabaseUrl: z.url(),
  supabasePublishableKey: z.string().min(20),
  inviteOrigin: z.url(),
  enableSocialAuth: z.boolean(),
});

const result = schema.safeParse({
  appEnv: process.env.EXPO_PUBLIC_APP_ENV,
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  inviteOrigin: process.env.EXPO_PUBLIC_INVITE_ORIGIN,
  enableSocialAuth: process.env.EXPO_PUBLIC_ENABLE_SOCIAL_AUTH === 'true',
});

export const env = result.success ? result.data : null;
export const envIssues = result.success ? [] : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
