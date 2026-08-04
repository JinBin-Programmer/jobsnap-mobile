import { supabase } from "./supabase";

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

// Mirrors jobsnap/lib/push.ts (the web app has the same helper for the
// task-assignment notifications it sends). Fire-and-forget: a push failure
// should never block a job from completing. Clears a token from the
// manager's profile when Expo reports it's permanently dead
// (DeviceNotRegistered — e.g. they reinstalled the app or cleared data), so
// we don't keep silently failing to notify them forever.
export async function sendPushToManagers(
  orgId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
) {
  try {
    const { data: managers } = await supabase
      .from("profiles")
      .select("id, push_token")
      .eq("org_id", orgId)
      .in("role", ["owner", "admin"])
      .not("push_token", "is", null);

    await Promise.all(
      (managers ?? []).map(async (m) => {
        const token = m.push_token as string | null;
        if (!token) return;
        try {
          const res = await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ to: token, sound: "default", title, body, data }),
          });
          const json = (await res.json()) as { data?: ExpoPushTicket };
          if (json.data?.details?.error === "DeviceNotRegistered") {
            await supabase.from("profiles").update({ push_token: null }).eq("id", m.id as string);
          }
        } catch {
          // best-effort
        }
      })
    );
  } catch {
    // best-effort
  }
}
