import { Platform } from 'react-native';
import { TestIds } from 'react-native-google-mobile-ads';

/**
 * Banner unit for this platform. Development builds always use Google's test
 * unit: tapping your own live ads can get an AdMob account suspended.
 */
export function bannerUnitId(): string | null {
  if (__DEV__) return TestIds.BANNER;
  const id =
    Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS : process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID;
  return id || null; // no unit configured → no ads, never a broken slot
}
