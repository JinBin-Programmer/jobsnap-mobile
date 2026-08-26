import { useEffect, useRef } from "react";
import { Animated, Easing, AccessibilityInfo, type DimensionValue } from "react-native";
import { colors, radius as radiusTokens } from "@/lib/theme";

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: object;
}

// A pulsing placeholder block for "this is where your data will be" loading
// states — replaces the bare centered spinner that used to stand in for the
// whole screen on first load. Respects reduce-motion, same as StatusDot.
export default function Skeleton({ width = "100%", height = 16, radius = radiusTokens.sm, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled || reduced) return;
      Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.9, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.45, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    });
    return () => {
      cancelled = true;
    };
  }, [opacity]);

  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: colors.border, opacity }, style]}
    />
  );
}
