import { createBrowserClient } from '@supabase/ssr';
import { APP_PUBLIC_CONFIG } from '../../config/app-public-config';

export const createSupabaseBrowserClient = () =>
  createBrowserClient(
    APP_PUBLIC_CONFIG.supabase.url,
    APP_PUBLIC_CONFIG.supabase.publishableKey
  );
