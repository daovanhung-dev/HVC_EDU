/**
 * Public browser configuration only. Never put service-role, secret, DB
 * password, or CI access tokens in this file.
 */
export const SUPABASE_CONFIG = {
  url: 'https://YOUR_PROJECT_REF.supabase.co',
  publishableKey: 'sb_publishable_YOUR_PUBLIC_KEY',
} as const;
