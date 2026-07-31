import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "./supabase";

// Show the notification banner + sound even while the app is open in the
// foreground (default Expo behavior hides it unless you opt in).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Asks for notification permission, grabs this device's Expo push token,
// and saves it to the worker's profile so the web dashboard can notify them
// when a job is assigned (see jobsnap/lib/push.ts). Silently no-ops on
// simulators/emulators (no push capability) or if the project hasn't been
// linked to EAS yet — run `eas init` in this repo to get a projectId, then
// rebuild the dev client, before this can actually deliver a token.
export async function registerForPushNotifications(userId: string) {
  if (!Device.isDevice) return;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== "granted") {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== "granted") return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.warn("[JobSnap] No EAS projectId configured — run `eas init` to enable push notifications.");
    return;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase.from("profiles").update({ push_token: token }).eq("id", userId);
  } catch (e) {
    console.warn("[JobSnap] Could not register for push notifications:", e);
  }
}
