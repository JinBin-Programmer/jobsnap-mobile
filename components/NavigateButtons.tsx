import { View, Text, TouchableOpacity } from "react-native";
import { googleMapsDirectionsUrl, wazeUrl, openNavigation } from "@/lib/navigation";
import { colors } from "@/lib/theme";

// Two small buttons that hand off to the worker's own navigation app —
// JobSnap only needs to get them to the pin, not replace a real maps app.
export default function NavigateButtons({ lat, lng }: { lat: number; lng: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
      <TouchableOpacity
        onPress={() => openNavigation(googleMapsDirectionsUrl(lat, lng))}
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          backgroundColor: colors.card,
          borderRadius: 8,
          paddingVertical: 10,
        }}
      >
        <Text style={{ fontSize: 14 }}>🧭</Text>
        <Text style={{ color: colors.body, fontWeight: "700", fontSize: 12.5 }}>Google Maps</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => openNavigation(wazeUrl(lat, lng))}
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          backgroundColor: colors.card,
          borderRadius: 8,
          paddingVertical: 10,
        }}
      >
        <Text style={{ fontSize: 14 }}>🚗</Text>
        <Text style={{ color: colors.body, fontWeight: "700", fontSize: 12.5 }}>Waze</Text>
      </TouchableOpacity>
    </View>
  );
}
