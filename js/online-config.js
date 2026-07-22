/*
 * Supabase project configuration.
 *
 * The publishable key is safe for browser code when Row Level Security is enabled.
 * The service-role/secret key is used only inside the Supabase Edge Function and
 * must never be placed in this file or committed to GitHub.
 */
window.TRION_ONLINE_CONFIG = {
  enabled: true,
  supabaseUrl: 'https://fcjxzhmjyzbanmhmpdgq.supabase.co',
  supabaseKey: 'sb_publishable_VAmWTiWmnC_0xlOc340i4w_g-K_mXaz',
  registrationFunction: 'register-account-v2',
  snapshotHz: 6,
};
