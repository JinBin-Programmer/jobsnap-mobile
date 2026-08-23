import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, space, type } from "@/lib/theme";

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  tone?: "neutral" | "success";
}

export default function EmptyState({ icon, title, subtitle, tone = "neutral" }: EmptyStateProps) {
  const tint = tone === "success" ? colors.success : colors.steel;
  const tintBg = tone === "success" ? colors.successBg : colors.cardRaised;

  return (
    <View style={{ alignItems: "center", paddingHorizontal: space.xl, paddingVertical: space.xxl }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: radius.xl,
          backgroundColor: tintBg,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: space.md,
        }}
      >
        <Ionicons name={icon} size={26} color={tint} />
      </View>
      <Text style={{ ...type.h2, color: colors.ink, marginBottom: 4 }}>{title}</Text>
      {subtitle && (
        <Text style={{ ...type.caption, color: colors.muted, textAlign: "center", lineHeight: 18 }}>{subtitle}</Text>
      )}
    </View>
  );
}
