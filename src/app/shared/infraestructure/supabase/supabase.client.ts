import { createBrowserClient } from '@supabase/ssr';
import { environment } from '../../../../environments/environment';

export const createSupabaseBrowserClient = () =>
  createBrowserClient(
    environment.supabase.url,
    environment.supabase.publishableKey
  );
