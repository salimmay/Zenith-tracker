import { Platform } from 'react-native';
import mobileAds, { AdsConsent, AdsConsentPrivacyOptionsRequirementStatus, AdsConsentStatus } from 'react-native-google-mobile-ads';
import { create } from 'zustand';

interface AdsState {
  /** SDK initialised and consent gathered — slots may request ads. */
  ready: boolean;
  /** Whether the user's choices allow personalised ads. */
  personalized: boolean;
  /** EU/UK users must be able to reopen their choices (Settings shows the row). */
  privacyOptionsRequired: boolean;
}

export const useAdsState = create<AdsState>()(() => ({
  ready: false,
  personalized: false,
  privacyOptionsRequired: false,
}));

let started = false;

async function refreshChoices() {
  const info = await AdsConsent.getConsentInfo();
  let personalized = info.status === AdsConsentStatus.NOT_REQUIRED;
  if (info.status === AdsConsentStatus.OBTAINED) {
    personalized = (await AdsConsent.getUserChoices()).selectPersonalisedAds;
  }
  useAdsState.setState({
    personalized,
    privacyOptionsRequired: info.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED,
  });
  return info;
}

/**
 * Once per launch: consent (Google's form only where the law requires it),
 * then Apple's tracking prompt, then the SDK. Never blocks the UI, and any
 * failure simply means no ads this session.
 */
export async function startAds() {
  if (started || Platform.OS === 'web') return;
  started = true;
  try {
    const info = await AdsConsent.gatherConsent();
    if (!info.canRequestAds) return;
    await refreshChoices();

    if (Platform.OS === 'ios' && useAdsState.getState().personalized) {
      // Required import on iOS only; loaded lazily so Android never touches it.
      const { requestTrackingPermissionsAsync } = await import('expo-tracking-transparency');
      await requestTrackingPermissionsAsync();
    }

    await mobileAds().initialize();
    useAdsState.setState({ ready: true });
  } catch (err) {
    console.warn('[ads] disabled for this session:', (err as Error).message);
  }
}

/** Settings → "Ad privacy choices". */
export async function showAdPrivacyOptions() {
  await AdsConsent.showPrivacyOptionsForm();
  await refreshChoices();
}
