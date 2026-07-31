import { supabase } from "./supabase";

// Mirrors jobsnap/lib/push.ts (the web app has the same helper for the
// task-assignment notifications it sends). Fire-and-forget: a push failure
// should never block a job from completing.
export async function sendPushToManagers(
  orgId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
) {
  try {
    const { data: managers } = await supabase
      .from("profiles")
      .select("push_token")
      .eq("org_id", orgId)
      .in("role", ["owner", "admin"])
      .not("push_token", "is", null);
    const tokens = (managers ?? []).map((m) => m.push_token as string).filter(Boolean);

    await Promise.all(
      tokens.map((token) =>
        fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ to: token, sound: "default", title, body, data }),
        })
      )
    );
  } catch {
    // best-effort
  }
}
