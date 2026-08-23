import { useRef } from "react";
import { Animated, Pressable, Text, ActivityIndicator, type ViewStyle, type GestureResponderEvent } from "react-native";
import { colors, radius, space, type } from "@/lib/theme";

type Variant = "primary" | "outline" | "danger" | "ghost";
type Size = "md" | "lg";

interface ButtonProps {
  label: string;
  onPress: (e: GestureResponderEvent) => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  fullWidth?: boolean;
}

// One Pressable-driven button with a consistent, subtle press-scale
// (0.97) instead of TouchableOpacity's flat opacity dim — every button in
// the app used to reimplement its own version of this inline.
export default function Button({
  label,
  onPress,
  variant = "primary",
  size = "lg",
  loading,
  disabled,
  icon,
  style,
  fullWidth = true,
}: ButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const isDisabled = disabled || loading;

  const pressIn = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 40 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start();

  const palette: Record<Variant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: colors.primary, fg: "#fff" },
    outline: { bg: colors.card, fg: colors.primary, border: colors.primary },
    danger: { bg: colors.card, fg: colors.danger, border: colors.dangerBorder },
    ghost: { bg: "transparent", fg: colors.primary },
  };
  const p = palette[variant];

  return (
    <Animated.View style={{ transform: [{ scale }], width: fullWidth ? "100%" : undefined }}>
      <Pressable
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        disabled={isDisabled}
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: space.sm,
            backgroundColor: p.bg,
            borderRadius: radius.md,
            borderWidth: p.border ? 1 : 0,
            borderColor: p.border,
            paddingVertical: size === "lg" ? 14 : 10,
            opacity: isDisabled ? 0.5 : 1,
          },
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={p.fg} />
        ) : (
          <>
            {icon}
            <Text style={{ color: p.fg, fontSize: size === "lg" ? 14.5 : 13, fontWeight: type.bodyStrong.fontWeight }}>
              {label}
            </Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}
