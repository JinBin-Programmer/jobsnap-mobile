import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { colors, radius, shadow, space, type } from "@/lib/theme";
import Button from "@/components/ui/Button";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [fade]);

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
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: space.xl }} keyboardShouldPersistTaps="handled">
        <Animated.View style={{ opacity: fade }}>
          <View style={{ alignItems: "center", marginBottom: space.xxl }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: radius.xl,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: space.md,
                ...shadow.md,
              }}
            >
              <Image source={require("@/assets/logo-mark.png")} style={{ width: 44, height: 44, borderRadius: 10 }} />
            </View>
            <Text style={{ ...type.display, color: colors.ink }}>JobSnap</Text>
            <Text style={{ color: colors.muted, marginTop: 4, fontSize: 13.5 }}>Your jobs for the day.</Text>
          </View>

          <Text style={{ ...type.label, color: colors.muted, marginBottom: space.sm }}>Email</Text>
          <View style={fieldWrap}>
            <Ionicons name="mail-outline" size={18} color={colors.muted} />
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor={colors.muted}
              style={fieldInput}
            />
          </View>

          <Text style={{ ...type.label, color: colors.muted, marginBottom: space.sm, marginTop: space.lg }}>
            Password
          </Text>
          <View style={fieldWrap}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.muted} />
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={colors.muted}
              style={fieldInput}
            />
          </View>

          {error && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: space.lg }}>
              <Ionicons name="alert-circle" size={16} color={colors.danger} />
              <Text style={{ color: colors.danger, fontSize: 13, flex: 1 }}>{error}</Text>
            </View>
          )}

          <View style={{ marginTop: space.xl }}>
            <Button label="Log in" onPress={submit} loading={loading} />
          </View>

          <Text style={{ color: colors.muted, marginTop: space.lg, textAlign: "center", fontSize: 12.5, lineHeight: 18 }}>
            Your account is created by your manager. Ask them for your login if you don&apos;t have one.
          </Text>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const fieldWrap = {
  flexDirection: "row",
  alignItems: "center",
  gap: space.sm,
  backgroundColor: colors.card,
  borderColor: colors.inputBorder,
  borderWidth: 1,
  borderRadius: radius.md,
  paddingHorizontal: space.md,
} as const;

const fieldInput = {
  flex: 1,
  paddingVertical: 13,
  color: colors.ink,
  fontSize: 16,
} as const;
