import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.carter75.phoenixfall',
  appName: 'PhoenixFall',
  webDir: 'dist/frontend',
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '108585498879-v35d0d196d4djglodbbjok452pr1e04r.apps.googleusercontent.com',
      forceCodeForRefreshToken: true
    }
  }
};

export default config;
