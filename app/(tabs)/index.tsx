import { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "@/lib/auth";
import { listMyTasks } from "@/lib/tasks";
import { flushQueue } from "@/lib/offlineQueue";
import { STATUS_LABELS, type Task } from "@/lib/types";
import { colors, STATUS_COLORS } from "@/lib/theme";

export default function MyJobsScreen() {
  const { session, profile } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      setError(null);
      const data = await listMyTasks(session.user.id);
      setTasks(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load jobs.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
      // Quietly retry anything saved offline from an earlier visit — no UI
      // here (the task screen shows the detailed banner); this just gives
      // queued submissions another chance to go out as soon as the app is
      // opened, not only when the worker happens to revisit that job.
      flushQueue().catch(() => {});
    }, [load])
  );

  const firstName = (profile?.full_name || "").trim().split(" ")[0] || "there";

  if (loading) {
    return (
      <View style={center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 16,
        }}
      >
        <View>
          <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 2 }}>Good morning,</Text>
          <Text style={{ fontSize: 20, fontWeight: "800", color: colors.ink }}>{firstName}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            onPress={() => router.push("/new-job")}
            style={{
              backgroundColor: colors.primary,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 12.5, fontWeight: "600" }}>+ New job</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push("/gallery")}
            style={{
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.inputBorder,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: colors.primary, fontSize: 12.5, fontWeight: "600" }}>My uploads</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          tasks.length > 0 ? (
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: colors.muted,
                textTransform: "uppercase",
                letterSpacing: 0.3,
                marginBottom: 10,
              }}
            >
              Today&apos;s jobs
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 80, paddingHorizontal: 24 }}>
            <Text style={{ fontSize: 40, marginBottom: 8 }}>✅</Text>
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.ink }}>No jobs assigned</Text>
            <Text style={{ color: colors.muted, textAlign: "center", marginTop: 4 }}>
              {error ?? "When your manager assigns you a job, it shows up here."}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const sc = STATUS_COLORS[item.status];
          return (
            <TouchableOpacity
              onPress={() => router.push(`/task/${item.id}`)}
              style={{
                backgroundColor: colors.card,
                borderRadius: 16,
                padding: 14,
                marginBottom: 10,
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: "#1C2A30",
                shadowOpacity: 0.08,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 2 },
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <Text style={{ fontSize: 14.5, fontWeight: "700", color: colors.ink, flex: 1, marginRight: 8 }}>
                  {item.title}
                </Text>
                <View style={{ backgroundColor: sc.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ color: sc.fg, fontSize: 10.5, fontWeight: "700" }}>
                    {STATUS_LABELS[item.status]}
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 12.5, color: colors.muted }}>
                {item.client_name ?? "—"} · {item.location_address ?? "No address"}
              </Text>
              {item.self_created && (
                <Text style={{ fontSize: 11, color: colors.steel, fontWeight: "600", marginTop: 4 }}>
                  ★ Added by you
                </Text>
              )}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const center = {
  flex: 1,
  justifyContent: "center",
  alignItems: "center",
  backgroundColor: colors.background,
} as const;
