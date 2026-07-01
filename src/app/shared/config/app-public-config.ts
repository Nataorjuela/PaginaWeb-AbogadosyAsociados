type PublicAppConfig = {
  name: string;
  production: boolean;
  enableDemoData: boolean;
  showEnvironmentBadge: boolean;
  apiBaseUrl: string;
  googleClientId: string;
  supabase: {
    url: string;
    publishableKey: string;
  };
};

declare global {
  interface Window {
    __ORJUELA_CONFIG__?: Partial<PublicAppConfig>;
  }
}

const runtimeConfig = typeof window !== 'undefined' ? window.__ORJUELA_CONFIG__ || {} : {};

export const APP_PUBLIC_CONFIG: PublicAppConfig = {
  name: runtimeConfig.name || 'production',
  production: runtimeConfig.production ?? true,
  enableDemoData: runtimeConfig.enableDemoData ?? false,
  showEnvironmentBadge: runtimeConfig.showEnvironmentBadge ?? false,
  apiBaseUrl: runtimeConfig.apiBaseUrl || '',
  googleClientId: runtimeConfig.googleClientId || '',
  supabase: {
    url: runtimeConfig.supabase?.url || '',
    publishableKey: runtimeConfig.supabase?.publishableKey || ''
  }
};
