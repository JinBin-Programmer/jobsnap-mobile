import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { colors } from "@/lib/theme";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.replace("/(tabs)");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}>
        <View style={{ alignItems: "center", marginBottom: 32 }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              backgroundColor: colors.primary,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 12,
            }}
          >
            <View style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: colors.icy }} />
          </View>
          <Text style={{ color: colors.ink, fontSize: 26, fontWeight: "800" }}>JobSnap</Text>
          <Text style={{ color: colors.muted, marginTop: 4 }}>Your jobs for the day.</Text>
        </View>

        <Text style={{ color: colors.body, fontSize: 13, marginBottom: 6 }}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor={colors.muted}
          style={inputStyle}
        />

        <Text style={{ color: colors.body, fontSize: 13, marginBottom: 6, marginTop: 16 }}>
          Password
        </Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor={colors.muted}
          style={inputStyle}
        />

        {error && <Text style={{ color: colors.danger, marginTop: 14 }}>{error}</Text>}

        <TouchableOpacity
          onPress={submit}
          disabled={loading}
          style={{
            backgroundColor: colors.primary,
            borderRadius: 9,
            paddingVertical: 15,
            alignItems: "center",
            marginTop: 24,
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>Log In</Text>
          )}
        </TouchableOpacity>

        <Text style={{ color: colors.muted, marginTop: 20, textAlign: "center", fontSize: 13 }}>
          Your account is created by your manager. Ask them for your login if you don&apos;t have one.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const inputStyle = {
  backgroundColor: colors.card,
  borderColor: colors.inputBorder,
  borderWidth: 1,
  borderRadius: 8,
  paddingHorizontal: 14,
  paddingVertical: 12,
  color: colors.ink,
  fontSize: 16,
} as const;
