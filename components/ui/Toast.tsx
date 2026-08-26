import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Animated, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, shadow, space, type } from "@/lib/theme";

type ToastKind = "success" | "error";
interface ToastState {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastContextValue {
  show: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// A lightweight in-app toast for routine confirmations ("Update sent",
// "Job completed") — those used to pop a full native Alert.alert(), which
// is a modal the worker has to dismiss for something that isn't a decision.
// Real Alert.alert() stays for actual confirmations (delete, permissions).
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const translateY = useRef(new Animated.Value(80)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 80, duration: 200, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setToast(null));
  }, [translateY, opacity]);

  const show = useCallback(
    (message: string, kind: ToastKind = "success") => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setToast({ id: Date.now(), message, kind });
      translateY.setValue(80);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 6 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      timerRef.current = setTimeout(dismiss, 2600);
    },
    [translateY, opacity, dismiss]
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        <Animated.View
          style={{
            position: "absolute",
            left: space.lg,
            right: space.lg,
            bottom: insets.bottom + space.lg,
            transform: [{ translateY }],
            opacity,
          }}
          pointerEvents="none"
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: space.sm + 2,
              backgroundColor: colors.cardRaised,
              borderWidth: 1,
              borderColor: toast.kind === "success" ? colors.successBorder : colors.borderStrong,
              borderRadius: radius.md,
              paddingVertical: toast.kind === "success" ? 15 : 12,
              paddingHorizontal: space.md + 2,
              ...shadow.lg,
            }}
          >
            <Ionicons
              name={toast.kind === "success" ? "checkmark-circle" : "alert-circle"}
              size={toast.kind === "success" ? 23 : 18}
              color={toast.kind === "success" ? colors.successFg : colors.danger}
            />
            <Text
              style={{
                ...(toast.kind === "success" ? type.bodyStrong : type.body),
                color: colors.ink,
                flex: 1,
              }}
            >
              {toast.message}
            </Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
