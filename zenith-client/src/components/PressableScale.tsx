import { useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, type PressableProps } from 'react-native';
import Animated, { css } from 'react-native-reanimated';
import { cssEase } from '@/theme';

// One element, so layout styles (flex, width, margins) passed by callers
// land on the node that actually sits in the parent's layout.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  /** Plain or Reanimated CSS styles (transitions are allowed here). */
  style?: ComponentProps<typeof Animated.View>['style'];
  /** Scale while pressed. Keep subtle: 0.95–0.98. */
  scale?: number;
};

/**
 * Every tappable surface in the app. Feedback lands on press-in (the latency
 * users actually perceive), the action commits on release. A CSS transition
 * is enough — no gesture, so no shared value.
 */
export function PressableScale({ children, style, scale = 0.97, disabled, onPressIn, onPressOut, ...rest }: Props) {
  const [pressed, setPressed] = useState(false);
  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      hitSlop={rest.hitSlop ?? 8}
      pressRetentionOffset={16}
      onPressIn={(e) => {
        setPressed(true);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        onPressOut?.(e);
      }}
      style={[
        motion.base,
        style,
        { transform: [{ scale: pressed && !disabled ? scale : 1 }] },
        disabled && motion.disabled,
      ]}
    >
      {children}
    </AnimatedPressable>
  );
}

const motion = css.create({
  base: {
    transitionProperty: 'transform',
    transitionDuration: 120,
    transitionTimingFunction: cssEase.out,
  },
  disabled: { opacity: 0.45 },
});
