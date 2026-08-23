import { View, Text } from "react-native";
import { radius } from "@/lib/theme";

interface BadgeProps {
  label: string;
  bg: string;
  fg: string;
}

// Generic bg/fg pill — STATUS_COLORS / PRIORITY_COLORS from lib/theme.ts
// already give the right pair per status, this just renders it consistently
// instead of the inline <View><Text> pair repeated on every screen.
export default function Badge({ label, bg, fg }: BadgeProps) {
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 4 }}>
      <Text style={{ color: fg, fontSize: 10.5, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}
