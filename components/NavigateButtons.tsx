import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { googleMapsDirectionsUrl, wazeUrl, openNavigation } from "@/lib/navigation";
import { colors, radius, space } from "@/lib/theme";

// Two small buttons that hand off to the worker's own navigation app —
// JobSnap only needs to get them to the pin, not replace a real maps app.
export default function NavigateButtons({ lat, lng }: { lat: number; lng: number }) {
  return (
    <View style={{ flexDirection: "row", gap: space.sm, marginBottom: space.md + 2 }}>
      <NavButton icon="navigate-outline" label="Google Maps" onPress={() => openNavigation(googleMapsDirectionsUrl(lat, lng))} />
      <NavButton icon="car-outline" label="Waze" onPress={() => openNavigation(wazeUrl(lat, lng))} />
    </View>
  );
}

function NavButton({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        borderWidth: 1,
        borderColor: colors.inputBorder,
        backgroundColor: colors.card,
        borderRadius: radius.sm,
        paddingVertical: 10,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Ionicons name={icon} size={15} color={colors.steel} />
      <Text style={{ color: colors.body, fontWeight: "700", fontSize: 12.5 }}>{label}</Text>
    </Pressable>
  );
}
