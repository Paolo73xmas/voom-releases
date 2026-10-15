import React, { createContext, forwardRef, useContext, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View, type ViewProps } from 'react-native';
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
  type KeyboardAwareScrollViewProps,
  type KeyboardStickyViewProps,
} from 'react-native-keyboard-controller';

const FooterContext = createContext({ height: 0, measure: (_height: number) => {} });
type Identified<T> = T & { testID: string };

/** One scope per screen/modal. Never wrap an aware form in an enabled KAV. */
export function KeyboardForm({ children, style, footerBottomInset = 0, ...props }: Identified<ViewProps> & { footerBottomInset?: number }) {
  const [height, measure] = useState(0);
  const footer = useMemo(() => ({ height: height + footerBottomInset, measure }), [height, footerBottomInset]);
  return (
    <FooterContext.Provider value={footer}>
      <View {...props} style={[styles.shrinkable, style]}>{children}</View>
    </FooterContext.Provider>
  );
}

/** Controller owns caret scrolling and IME space; native automatic insets stay off. */
export const KeyboardFormScrollView = forwardRef<ScrollView, Identified<KeyboardAwareScrollViewProps>>(
  function KeyboardFormScrollView({ style, ...props }, ref) {
    const { height } = useContext(FooterContext);
    return (
      <KeyboardAwareScrollView
        {...props}
        ref={ref}
        style={[styles.scroll, style]}
        bottomOffset={height + 12}
        extraKeyboardSpace={0}
        keyboardShouldPersistTaps="handled"
        // RN Web treats programmatic focus scrolling as a drag and blurs the input.
        keyboardDismissMode={Platform.OS === 'web' ? 'none' : 'on-drag'}
        automaticallyAdjustKeyboardInsets={false}
        contentInsetAdjustmentBehavior="never"
        removeClippedSubviews={false}
        disableScrollOnKeyboardHide
      />
    );
  },
);

/** Translation only: does NOT resize the scroller or add a second IME padding. */
export function KeyboardFormFooter({ onLayout, style, ...props }: Identified<KeyboardStickyViewProps>) {
  const { measure } = useContext(FooterContext);
  return (
    <KeyboardStickyView
      {...props}
      style={[styles.footer, style]}
      onLayout={event => { measure(event.nativeEvent.layout.height); onLayout?.(event); }}
    />
  );
}

const styles = StyleSheet.create({
  shrinkable: { minHeight: 0 },
  scroll: { flex: 1, minHeight: 0 },
  footer: { flexShrink: 0, zIndex: 1 },
});