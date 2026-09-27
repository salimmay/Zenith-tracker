import type { ReactNode } from 'react';
import { ScrollView, type ScrollViewProps } from 'react-native';

// Web: the browser moves focused inputs into view itself.
export function KeyboardProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function KeyboardScroll({ bottomOffset: _bottomOffset, ...props }: ScrollViewProps & { bottomOffset?: number }) {
  return <ScrollView keyboardShouldPersistTaps="handled" {...props} />;
}
