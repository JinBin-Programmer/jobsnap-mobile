import { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, RefreshControl, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "@/lib/auth";
import { listMyTasks } from "@/lib/tasks";
import { flushQueue } from "@/lib/offlineQueue";
import { STATUS_LABELS, type Task } from "@/lib/types";
import { colors, STATUS_COLORS, radius, shadow, space, type } from "@/lib/theme";
import KpiProgressCard from "@/components/KpiProgressCard";
import EmptyState from "@/components/ui/EmptyState";
import Badge from "@/components/ui/Badge";

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
          paddingHorizontal: space.lg,
          paddingTop: space.md,
          paddingBottom: space.lg,
        }}
      >
        <View>
          <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 2 }}>Good morning,</Text>
          <Text style={{ ...type.h1, color: colors.ink }}>{firstName}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <HeaderAction icon="add" label="New job" onPress={() => router.push("/new-job")} filled />
          <HeaderAction icon="images-outline" label="Uploads" onPress={() => router.push("/gallery")} />
        </View>
      </View>

      <KpiProgressCard />

      <FlatList
        data={tasks}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxl }}
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
          tasks.length > 0 ? <Text style={{ ...type.label, color: colors.muted, marginBottom: 10 }}>Today&apos;s jobs</Text> : null
        }
        ListEmptyComponent={
          <View style={{ marginTop: 60 }}>
            <EmptyState
              icon="checkmark-done-circle-outline"
              tone="success"
              title="No jobs assigned"
              subtitle={error ?? "When your manager assigns you a job, it shows up here."}
            />
          </View>
        }
        renderItem={({ item }) => {
          const sc = STATUS_COLORS[item.status];
          return (
            <Pressable
              onPress={() => router.push(`/task/${item.id}`)}
              style={({ pressed }) => ({
                backgroundColor: colors.card,
                borderRadius: radius.lg,
                padding: space.md,
                marginBottom: 10,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: pressed ? 0.85 : 1,
                ...shadow.sm,
              })}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <Text style={{ fontSize: 14.5, fontWeight: "700", color: colors.ink, flex: 1, marginRight: 8 }}>
                  {item.title}
                </Text>
                <Badge label={STATUS_LABELS[item.status]} bg={sc.bg} fg={sc.fg} />
              </View>
              <Text style={{ fontSize: 12.5, color: colors.muted }}>
                {item.client_name ?? "—"} · {item.location_address ?? "No address"}
              </Text>
              {item.self_created && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
                  <Ionicons name="star" size={11} color={colors.steel} />
                  <Text style={{ fontSize: 11, color: colors.steel, fontWeight: "600" }}>Added by you</Text>
                </View>
              )}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

function HeaderAction({
  icon,
  label,
  onPress,
  filled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  filled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        backgroundColor: filled ? colors.primary : colors.card,
        borderWidth: filled ? 0 : 1,
        borderColor: colors.inputBorder,
        paddingHorizontal: space.md,
        paddingVertical: 9,
        borderRadius: radius.md,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Ionicons name={icon} size={14} color={filled ? "#fff" : colors.primary} />
      <Text style={{ color: filled ? "#fff" : colors.primary, fontSize: 12.5, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

const center = {
  flex: 1,
  justifyContent: "center",
  alignItems: "center",
  backgroundColor: colors.background,
} as const;
