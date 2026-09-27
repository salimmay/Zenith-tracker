import type { ReactNode } from 'react';
import { KeyboardAwareScrollView, KeyboardProvider as NativeKeyboardProvider } from 'react-native-keyboard-controller';
import type { ScrollViewProps } from 'react-native';

/** Tracks the real keyboard position on the UI thread. Wraps the app once, at the root. */
export function KeyboardProvider({ children }: { children: ReactNode }) {
  return <NativeKeyboardProvider>{children}</NativeKeyboardProvider>;
}

/**
 * A ScrollView that keeps the focused input — plus `bottomOffset` of room under
 * it, enough for the next field or the submit button — above the keyboard,
 * moving with the keyboard frame by frame. Needed because edge-to-edge Android
 * no longer resizes the window when the keyboard opens.
 */
export function KeyboardScroll({ bottomOffset = 140, ...props }: ScrollViewProps & { bottomOffset?: number }) {
  return <KeyboardAwareScrollView bottomOffset={bottomOffset} keyboardShouldPersistTaps="handled" {...props} />;
}
