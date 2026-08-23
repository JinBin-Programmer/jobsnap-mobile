import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/components/ui/Toast";
import { colors } from "@/lib/theme";

export default function RootLayout() {
  const router = useRouter();

  // Tapping a "New job assigned" / "New stops added" push notification
  // opens that job directly instead of just launching the app.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const taskId = response.notification.request.content.data?.taskId as string | undefined;
      if (taskId) router.push(`/task/${taskId}`);
    });
    return () => sub.remove();
  }, [router]);

  return (
    <SafeAreaProvider>
      <ToastProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="task/[id]"
              options={{
                headerShown: true,
                title: "Job",
                headerStyle: { backgroundColor: colors.primary },
                headerTintColor: "#fff",
              }}
            />
            <Stack.Screen name="gallery" />
            <Stack.Screen name="new-job" />
          </Stack>
        </AuthProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
