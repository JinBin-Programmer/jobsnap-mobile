import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { colors } from "@/lib/theme";

export default function SettingsScreen() {
  const { session, profile } = useAuth();
  const router = useRouter();

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 16,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Text style={{ color: colors.muted, fontSize: 12 }}>Signed in as</Text>
        <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "700", marginTop: 2 }}>
          {profile?.full_name || session?.user.email}
        </Text>
        <Text style={{ color: colors.body, marginTop: 2 }}>{session?.user.email}</Text>
        <Text style={{ color: colors.muted, marginTop: 6, textTransform: "capitalize" }}>
          Role: {profile?.role ?? "worker"}
        </Text>
      </View>

      <TouchableOpacity
        onPress={signOut}
        style={{
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 16,
          marginTop: 12,
          borderWidth: 1,
          borderColor: colors.dangerBorder,
          alignItems: "center",
        }}
      >
        <Text style={{ color: colors.danger, fontWeight: "700", fontSize: 16 }}>Sign out</Text>
      </TouchableOpacity>

      <Text style={{ color: colors.muted, textAlign: "center", marginTop: 24, fontSize: 12 }}>
        JobSnap Worker · v1.0.0
      </Text>
    </View>
  );
}
