import { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, Image, RefreshControl, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@/lib/auth";
import { listMyMedia, deleteMyMedia, getMyStorageUsedBytes } from "@/lib/tasks";
import { supabase } from "@/lib/supabase";
import { formatShortDate } from "@/lib/format";
import type { MyMedia } from "@/lib/types";
import { colors, radius, space, type } from "@/lib/theme";
import ScreenHeader from "@/components/ui/ScreenHeader";
import EmptyState from "@/components/ui/EmptyState";
import PhotoViewer from "@/components/ui/PhotoViewer";
import Skeleton from "@/components/ui/Skeleton";

function formatMb(bytes: number) {
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)}GB` : `${mb.toFixed(1)}MB`;
}

export default function GalleryScreen() {
  const { session } = useAuth();
  const [media, setMedia] = useState<MyMedia[]>([]);
  const [usedBytes, setUsedBytes] = useState(0);
  const [limitMb, setLimitMb] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);

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
    setRefreshing(false);
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
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="My uploads" />
        <View style={{ paddingHorizontal: space.lg }}>
          <Skeleton height={70} radius={radius.md} style={{ marginBottom: space.lg }} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} width="48%" height={140} radius={radius.md} />
            ))}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="My uploads" />

      <FlatList
        data={media}
        keyExtractor={(m) => m.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 10 }}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xl, gap: 10 }}
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
          <View style={{ backgroundColor: colors.primary, borderRadius: radius.md, padding: space.md, marginBottom: space.lg }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <Text style={{ ...type.label, color: "rgba(255,255,255,0.78)" }}>Your storage</Text>
              <Text style={{ ...type.mono, color: "#fff" }}>
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
          <EmptyState icon="images-outline" title="No uploads yet" subtitle="Photos and videos you send from a job land here." />
        }
        renderItem={({ item }) => (
          <View
            style={{
              flex: 1,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              overflow: "hidden",
            }}
          >
            <View style={{ height: 90, backgroundColor: colors.border, alignItems: "center", justifyContent: "center" }}>
              {item.type === "photo" ? (
                item.url ? (
                  <Pressable onPress={() => setViewerUri(item.url!)} style={{ width: "100%", height: "100%" }}>
                    <Image source={{ uri: item.url }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                  </Pressable>
                ) : (
                  <Ionicons name="image-outline" size={22} color={colors.muted} />
                )
              ) : (
                <View style={{ alignItems: "center" }}>
                  <Ionicons name="play-circle" size={26} color={colors.muted} />
                  <Text style={{ fontSize: 10, fontWeight: "700", color: colors.muted, marginTop: 2 }}>VIDEO</Text>
                </View>
              )}
            </View>
            <Pressable
              onPress={() => handleDelete(item)}
              hitSlop={6}
              style={({ pressed }) => ({
                position: "absolute",
                top: 6,
                right: 6,
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: "rgba(20,22,26,0.68)",
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Ionicons name="close" size={14} color="#fff" />
            </Pressable>
            <View style={{ padding: 8 }}>
              <Text numberOfLines={1} style={{ fontSize: 11.5, fontWeight: "600", color: colors.ink }}>
                {item.task_title}
              </Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 1 }}>
                <Text style={{ ...type.mono, fontSize: 10.5, color: colors.muted }}>{formatMb(item.size_bytes)}</Text>
                <Text style={{ fontSize: 10, color: colors.muted }}>{formatShortDate(item.created_at)}</Text>
              </View>
            </View>
          </View>
        )}
      />
      <PhotoViewer uri={viewerUri} onClose={() => setViewerUri(null)} />
    </View>
  );
}
