import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import Animated, { css } from 'react-native-reanimated';
import { Text } from '@/components/Text';
import { colors, cssEase, radius, space } from '@/theme';
import { useAdsState } from './consent';
import { bannerUnitId } from './units';
import { useAdsEnabled } from './useAdsEnabled';

// Cap the banner so it never grows into a big box — the whole point is "barely noticed".
const MAX_HEIGHT = 60;
// Narrower than this (inner width) and Google has no banner to fill it; the request
// would just fail. Small 320 pt phones give about 272, which fills fine.
const MIN_WIDTH = 250;
const PAD = space.sm;

/**
 * The only ad format in Zenith: one small banner per screen, inline, in a
 * quiet card labelled "Ad". The banner is sized to the card's measured width
 * (a fixed 320 pt banner overflows narrow phones), its height is reserved so
 * nothing jumps when it loads, and if Google has nothing to show the slot
 * removes itself.
 */
export function AdSlot({ style }: { style?: StyleProp<ViewStyle> }) {
  const enabled = useAdsEnabled();
  const personalized = useAdsState((s) => s.personalized);
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading');
  const [width, setWidth] = useState(0);
  const unitId = bannerUnitId();

  const tooNarrow = width > 0 && width < MIN_WIDTH;
  if (!enabled || !unitId || state === 'failed' || tooNarrow) return null;

  return (
    <View
      style={[styles.card, style]}
      accessibilityLabel="Advertisement"
      onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width - PAD * 2))}
    >
      <Text variant="micro" tone="faint" style={styles.label}>
        Ad
      </Text>
      <Animated.View style={[motion.banner, { opacity: state === 'loaded' ? 1 : 0 }]}>
        {width > 0 && (
          <BannerAd
            unitId={unitId}
            size={BannerAdSize.INLINE_ADAPTIVE_BANNER}
            width={width}
            maxHeight={MAX_HEIGHT}
            requestOptions={{ requestNonPersonalizedAdsOnly: !personalized }}
            onAdLoaded={() => setState('loaded')}
            onAdFailedToLoad={() => setState('failed')}
          />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: PAD,
    paddingTop: 6,
    paddingBottom: PAD,
    marginBottom: space.lg,
    overflow: 'hidden',
  },
  label: { marginBottom: 4, marginLeft: 2 },
});

// Reanimated's StyleSheet: the banner fades in rather than popping.
const motion = css.create({
  banner: {
    height: MAX_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    transitionProperty: 'opacity',
    transitionDuration: 200,
    transitionTimingFunction: cssEase.out,
  },
});
