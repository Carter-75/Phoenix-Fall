import { Capacitor } from '@capacitor/core';

export const environment = {
  production: true,
  // If running natively in Capacitor (Android/iOS), point to Vercel production.
  // Otherwise, use relative path which works for Vercel/localhost web.
  apiUrl: Capacitor.isNativePlatform() ? 'https://phoenix-fall.vercel.app/api' : '/api'
};
