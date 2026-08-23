import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, space, type } from "@/lib/theme";

interface ScreenHeaderProps {
  title: string;
  right?: React.ReactNode;
}

// Replaces the "←" Text-character back button every screen used to build
// inline — a real chevron icon, consistent hit target and spacing.
export default function ScreenHeader({ title, right }: ScreenHeaderProps) {
  const router = useRouter();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.lg }}>
      <Pressable onPress={() => router.back()} hitSlop={10}>
        <Ionicons name="chevron-back" size={24} color={colors.primary} />
      </Pressable>
      <Text style={{ ...type.h2, color: colors.ink, flex: 1 }}>{title}</Text>
      {right}
    </View>
  );
}
