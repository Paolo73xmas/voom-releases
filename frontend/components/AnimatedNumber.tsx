/**
 * AnimatedNumber — count-up effect using Reanimated.
 */
import React, { useEffect } from 'react';
import { TextStyle } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedProps, withTiming, Easing, runOnJS,
} from 'react-native-reanimated';

interface Props {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  style?: TextStyle | TextStyle[];
}

const AnimatedText = Animated.createAnimatedComponent(
  (require('react-native').Text)
);

export function AnimatedNumber({ value, duration = 800, format, style }: Props) {
  const animated = useSharedValue(0);
  const [display, setDisplay] = React.useState('0');

  useEffect(() => {
    animated.value = 0;
    animated.value = withTiming(value, {
      duration,
      easing: Easing.out(Easing.exp),
    });
  }, [value, duration]);

  useAnimatedProps(() => {
    const current = Math.round(animated.value);
    runOnJS(setDisplay)(format ? format(current) : String(current));
    return {};
  });

  return <AnimatedText style={style}>{display}</AnimatedText>;
}
