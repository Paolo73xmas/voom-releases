/**
 * AnimatedNumber — count-up effect using Reanimated.
 */
import React, { useCallback, useEffect } from 'react';
import { StyleProp, TextStyle } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedReaction, withTiming, Easing, runOnJS, cancelAnimation,
} from 'react-native-reanimated';

interface Props {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  style?: StyleProp<TextStyle>;
  testID?: string;
}

export function AnimatedNumber({ value, duration = 800, format, style, testID }: Props) {
  const animated = useSharedValue(0);
  const [display, setDisplay] = React.useState('0');
  // Il formatter ricevuto dal chiamante vive sul thread JS, non è un worklet.
  const updateDisplay = useCallback((current: number) => {
    setDisplay(format ? format(current) : String(current));
  }, [format]);

  useEffect(() => {
    animated.value = 0;
    animated.value = withTiming(value, {
      duration,
      easing: Easing.out(Easing.exp),
    });
    return () => cancelAnimation(animated);
  }, [value, duration, animated]);

  useAnimatedReaction(
    () => Math.round(animated.value),
    (current, previous) => {
      if (current !== previous) runOnJS(updateDisplay)(current);
    },
    [updateDisplay],
  );

  useEffect(() => { updateDisplay(Math.round(animated.value)); }, [animated, updateDisplay]);

  return <Animated.Text testID={testID} style={style}>{display}</Animated.Text>;
}
