import { View, type ViewProps, type ViewStyle } from "react-native";
import { colors, radius, shadow, space } from "@/lib/theme";

interface CardProps extends ViewProps {
  // "flat" = subtle 1px border, no shadow (dense lists, nested content).
  // "raised" = elevated surface with shadow (the default — most cards).
  // "tinted" = fills with a supplied background instead of the default card
  //   color, e.g. a colored status/timer card — still gets the same radius
  //   and padding rhythm as everything else.
  variant?: "flat" | "raised" | "tinted";
  padding?: keyof typeof space | number;
  tint?: string;
}

export default function Card({ variant = "raised", padding = "lg", tint, style, children, ...props }: CardProps) {
  const pad = typeof padding === "number" ? padding : space[padding];
  const base: ViewStyle = {
    borderRadius: radius.lg,
    padding: pad,
    backgroundColor: variant === "tinted" ? tint ?? colors.primary : colors.card,
  };
  const variantStyle: ViewStyle =
    variant === "raised"
      ? { ...shadow.sm, borderWidth: 1, borderColor: colors.border }
      : variant === "flat"
        ? { borderWidth: 1, borderColor: colors.border }
        : {};

  return (
    <View style={[base, variantStyle, style]} {...props}>
      {children}
    </View>
  );
}
