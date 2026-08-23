import { useEffect, useRef } from "react";
import { Animated, Easing, AccessibilityInfo } from "react-native";

interface StatusDotProps {
  color: string;
  size?: number;
  pulse?: boolean;
}

// The one deliberate ambient animation in the app — a soft pulsing ring
// behind the on-site/checked-in dot, standing in for "this GPS lock is
// live right now" rather than a static screenshot of a badge. Everywhere
// else stays still on purpose. Respects reduce-motion.
export default function StatusDot({ color, size = 8, pulse = true }: StatusDotProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled || reduced || !pulse) return;
      Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(scale, { toValue: 2.2, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
            Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(opacity, { toValue: 0, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0.6, duration: 0, useNativeDriver: true }),
          ]),
        ])
      ).start();
    });
    return () => {
      cancelled = true;
    };
  }, [pulse, scale, opacity]);

  return (
    <Animated.View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          transform: [{ scale }],
          opacity,
        }}
      />
      <Animated.View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </Animated.View>
  );
}
