import { Capacitor } from '@capacitor/core';

export const environment = {
  production: true,
  // If running natively in Capacitor (Android/iOS), point to your Render production URL.
  // Replace 'your-render-url.onrender.com' with your actual Render deployment link!
  apiUrl: Capacitor.isNativePlatform() ? 'https://phoenix-fall.onrender.com' : '/api',
  
  googlePlay: {
    skuTier1: 'com.phoenix.gems.tier1',
    skuTier2: 'com.phoenix.gems.tier2',
    skuTier3: 'com.phoenix.gems.tier3',
    skuWhale: 'com.phoenix.gems.whale',
    subMonthlyStandard: 'com.phoenix.sub.monthly',
    subMonthlyPremium: 'com.phoenix.sub.premium',
    skuTempMultiplierX2: 'com.phoenix.temp.multiplier.x2',
    skuTempMultiplierX10: 'com.phoenix.temp.multiplier.x10'
  }
};
