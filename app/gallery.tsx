import { useCallback, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator, Alert } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "@/lib/auth";
import { listMyMedia, deleteMyMedia, getMyStorageUsedBytes } from "@/lib/tasks";
import { supabase } from "@/lib/supabase";
import type { MyMedia } from "@/lib/types";
import { colors } from "@/lib/theme";

function formatMb(bytes: number) {
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)}GB` : `${mb.toFixed(1)}MB`;
}

export default function GalleryScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [media, setMedia] = useState<MyMedia[]>([]);
  const [usedBytes, setUsedBytes] = useState(0);
  const [limitMb, setLimitMb] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session) return;
    const workerId = session.user.id;
    const [myMedia, used, quota] = await Promise.all([
      listMyMedia(workerId),
      getMyStorageUsedBytes(workerId),
      supabase.rpc("org_storage_status").maybeSingle(),
    ]);
    setMedia(myMedia);
    setUsedBytes(used);
    setLimitMb((quota.data as { limit_mb: number | null } | null)?.limit_mb ?? null);
    setLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleDelete = (m: MyMedia) => {
    Alert.alert("Delete photo?", "This frees up space but can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteMyMedia(m.id, m.storage_path);
            setMedia((prev) => prev.filter((x) => x.id !== m.id));
            setUsedBytes((prev) => Math.max(0, prev - m.size_bytes));
          } catch (e) {
            Alert.alert(
              "Could not delete",
              e instanceof Error ? e.message : "Ask your admin to remove it from the web dashboard instead."
            );
          }
        },
      },
    ]);
  };

  const limitBytes = limitMb != null ? limitMb * 1024 * 1024 : null;
  const pct = limitBytes ? Math.min(100, (usedBytes / limitBytes) * 100) : 0;

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 16 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ fontSize: 20, color: colors.primary }}>←</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 15, fontWeight: "700", color: colors.ink }}>My uploads</Text>
      </View>

      <FlatList
        data={media}
        keyExtractor={(m) => m.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 10 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 10 }}
        ListHeaderComponent={
          <View style={{ backgroundColor: colors.primary, borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.3, color: "rgba(255,255,255,0.78)" }}>
                Your storage
              </Text>
              <Text style={{ fontSize: 12, color: "#fff", fontWeight: "700" }}>
                {formatMb(usedBytes)} of {limitMb != null ? formatMb(limitBytes!) : "∞"}
              </Text>
            </View>
            {limitBytes != null && (
              <View style={{ height: 6, backgroundColor: "#3D4F56", borderRadius: 3, overflow: "hidden" }}>
                <View style={{ width: `${pct}%`, height: "100%", backgroundColor: colors.icy, borderRadius: 3 }} />
              </View>
            )}
            <Text style={{ fontSize: 11.5, color: "rgba(255,255,255,0.78)", marginTop: 6 }}>
              Delete old photos to free up space for new jobs.
            </Text>
          </View>
        }
        ListEmptyComponent={
          <Text style={{ color: colors.muted, fontSize: 13.5, textAlign: "center", paddingVertical: 30 }}>
            No uploads yet.
          </Text>
        }
        renderItem={({ item }) => (
          <View
            style={{
              flex: 1,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <View style={{ height: 90, backgroundColor: colors.border }}>
              {item.url && (
                <Image source={{ uri: item.url }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
              )}
            </View>
            <TouchableOpacity
              onPress={() => handleDelete(item)}
              style={{
                position: "absolute",
                top: 6,
                right: 6,
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: "rgba(31,36,48,0.55)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 12, lineHeight: 12 }}>✕</Text>
            </TouchableOpacity>
            <View style={{ padding: 8 }}>
              <Text numberOfLines={1} style={{ fontSize: 11.5, fontWeight: "600", color: colors.ink }}>
                {item.task_title}
              </Text>
              <Text style={{ fontSize: 10.5, color: colors.muted, fontFamily: "monospace" }}>
                {formatMb(item.size_bytes)}
              </Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}
