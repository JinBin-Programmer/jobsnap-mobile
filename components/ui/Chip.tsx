import { useRef } from "react";
import { Animated, Pressable, Text } from "react-native";
import { colors, radius, space } from "@/lib/theme";

interface ChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
  tone?: "primary" | "success";
}

export default function Chip({ label, active, onPress, tone = "primary" }: ChipProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const activeColor = tone === "success" ? colors.success : colors.primary;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 40 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
        style={{
          paddingHorizontal: space.md,
          paddingVertical: 8,
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: active ? activeColor : colors.inputBorder,
          backgroundColor: active ? activeColor : colors.card,
        }}
      >
        <Text style={{ color: active ? "#fff" : colors.body, fontWeight: "600", fontSize: 12.5 }}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}
