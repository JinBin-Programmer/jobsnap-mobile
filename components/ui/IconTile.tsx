import { useRef } from "react";
import { Animated, Pressable, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, space } from "@/lib/theme";

interface IconTileProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}

// The Photo / Video / Gallery capture tiles — a tinted icon circle over a
// label, replacing the raw emoji (📷🎥🖼) that used to stand in for icons.
export default function IconTile({ icon, label, onPress }: IconTileProps) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 40 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
        style={{
          backgroundColor: colors.card,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          paddingVertical: space.md,
          alignItems: "center",
        }}
      >
        <Ionicons name={icon} size={22} color={colors.steel} />
        <Text style={{ color: colors.body, marginTop: 6, fontWeight: "600", fontSize: 12 }}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}
