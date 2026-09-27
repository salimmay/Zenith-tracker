import { create } from 'zustand';

// The web build is ad-free: same API as consent.ts, nothing ever turns on.
export const useAdsState = create(() => ({ ready: false, personalized: false, privacyOptionsRequired: false }));
export async function startAds() {}
export async function showAdPrivacyOptions() {}
