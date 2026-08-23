import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { colors, radius, space, type } from "@/lib/theme";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

export default function SettingsScreen() {
  const { session, profile } = useAuth();
  const router = useRouter();

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const initial = (profile?.full_name || session?.user.email || "?").trim().charAt(0).toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: space.lg }}>
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: radius.lg,
              backgroundColor: colors.cardRaised,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: colors.steel, fontSize: 18, fontWeight: "800" }}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...type.h2, color: colors.ink }}>{profile?.full_name || session?.user.email}</Text>
            <Text style={{ color: colors.body, fontSize: 12.5, marginTop: 1 }}>{session?.user.email}</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: space.md }}>
          <Ionicons name="briefcase-outline" size={14} color={colors.muted} />
          <Text style={{ color: colors.muted, fontSize: 12.5, textTransform: "capitalize" }}>
            {profile?.role ?? "worker"}
          </Text>
        </View>
      </Card>

      <View style={{ marginTop: space.md }}>
        <Button
          label="Sign out"
          variant="danger"
          icon={<Ionicons name="log-out-outline" size={17} color={colors.danger} />}
          onPress={signOut}
        />
      </View>

      <Text style={{ color: colors.muted, textAlign: "center", marginTop: space.xl, fontSize: 12 }}>
        JobSnap Worker · v1.0.0
      </Text>
    </View>
  );
}
