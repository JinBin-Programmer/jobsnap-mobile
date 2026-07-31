import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, BackHandler } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  getTask,
  getCurrentLocation,
  submitUpdate,
  submitStopUpdate,
  listTaskStops,
  checkIn,
  checkOutAndComplete,
  checkOutOnly,
  distanceMeters,
  type Coords,
} from "@/lib/tasks";
import { useAuth } from "@/lib/auth";
import type { Task, TaskStop } from "@/lib/types";
import { colors } from "@/lib/theme";
import ProofCaptureForm, { type CaptureSubmitPayload } from "@/components/ProofCaptureForm";
import StopsMapView from "@/components/StopsMapView";

// How often to refresh GPS while this screen is open, to keep the
// on-site/not-on-site banner reasonably live without hammering the battery.
const LOCATION_REFRESH_MS = 15000;

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [coords, setCoords] = useState<Coords | null>(null);

  const [checkedIn, setCheckedIn] = useState(false);
  const [checkinId, setCheckinId] = useState<string | null>(null);
  const [checkInAt, setCheckInAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [sessionUpdates, setSessionUpdates] = useState<{ time: string }[]>([]);
  const [checkingIn, setCheckingIn] = useState(false);
  const [completing, setCompleting] = useState(false);

  // Multi-stop ("delivery run") state — unused for a classic single-site task.
  const [stops, setStops] = useState<TaskStop[]>([]);
  const [activeStop, setActiveStop] = useState<TaskStop | null>(null);

  useEffect(() => {
    if (!id) return;
    getTask(id).then((t) => {
      setTask(t);
      setLoading(false);
      if (t?.has_stops) listTaskStops(id).then(setStops);
    });
  }, [id]);

  const refreshTaskAndStops = () => {
    if (!id) return;
    getTask(id).then((t) => t && setTask(t));
    listTaskStops(id).then(setStops);
  };

  useEffect(() => {
    let cancelled = false;
    const refreshLocation = () => {
      getCurrentLocation().then((c) => {
        if (!cancelled) setCoords(c);
      });
    };
    refreshLocation();
    const interval = setInterval(refreshLocation, LOCATION_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!checkedIn) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [checkedIn]);

  // Android hardware back inside a stop's capture form should return to the
  // stop checklist, not leave the whole screen.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (activeStop) {
        setActiveStop(null);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [activeStop]);

  const isGated = task?.location_lat != null && task?.location_lng != null;
  const distance =
    isGated && coords ? distanceMeters(coords, { lat: task!.location_lat!, lng: task!.location_lng! }) : null;
  const notOnSite = isGated && (distance == null || distance > (task?.upload_radius_m ?? 150));

  const activeStopDistance =
    activeStop && coords ? distanceMeters(coords, { lat: activeStop.lat, lng: activeStop.lng }) : null;
  const activeStopNotOnSite = !!activeStop && (activeStopDistance == null || activeStopDistance > activeStop.radius_m);

  const handleCheckIn = async () => {
    if (!task || !profile?.org_id || !profile.id) return;
    setCheckingIn(true);
    try {
      const newCheckinId = await checkIn(task.id, profile.id, profile.org_id);
      setCheckinId(newCheckinId);
      setCheckInAt(Date.now());
      setNow(Date.now());
      setSessionUpdates([]);
      setCheckedIn(true);
    } catch (e) {
      Alert.alert("Could not check in", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setCheckingIn(false);
    }
  };

  const handleTaskSubmit = async (payload: CaptureSubmitPayload) => {
    if (!task || !profile?.org_id || !profile.id) return;
    const freshCoords = await getCurrentLocation();
    setCoords(freshCoords);
    await submitUpdate({
      orgId: profile.org_id,
      taskId: task.id,
      workerId: profile.id,
      remark: payload.remark,
      status: payload.status,
      coords: freshCoords,
      media: payload.media,
      taskLat: task.location_lat,
      taskLng: task.location_lng,
      radiusM: task.upload_radius_m,
      checkinId,
    });
    setSessionUpdates((prev) => [
      ...prev,
      { time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
    ]);
    Alert.alert("Update sent", "Your manager can now see your update.");
  };

  const handleStopSubmit = async (payload: CaptureSubmitPayload) => {
    if (!task || !profile?.org_id || !profile.id || !activeStop) return;
    const freshCoords = await getCurrentLocation();
    setCoords(freshCoords);
    await submitStopUpdate({
      orgId: profile.org_id,
      taskId: task.id,
      stopId: activeStop.id,
      workerId: profile.id,
      remark: payload.remark,
      coords: freshCoords,
      media: payload.media,
      stopLat: activeStop.lat,
      stopLng: activeStop.lng,
      radiusM: activeStop.radius_m,
      checkinId,
      markDone: payload.markDone,
    });
    refreshTaskAndStops();
    if (payload.markDone) {
      Alert.alert("Stop delivered", "Nice — marked as delivered.", [{ text: "OK", onPress: () => setActiveStop(null) }]);
    } else {
      Alert.alert("Update sent", "Your manager can now see your update.");
    }
  };

  const handleComplete = async () => {
    if (!task || !checkinId) return;
    setCompleting(true);
    try {
      await checkOutAndComplete(checkinId, task.id);
      setCheckedIn(false);
      setCheckinId(null);
      setCheckInAt(null);
      Alert.alert("Job completed", "Marked as completed for your manager to review.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert("Could not complete", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setCompleting(false);
    }
  };

  // Multi-stop tasks: ending a visit does NOT mark the job done — a worker
  // can plausibly stop mid-route and resume tomorrow. Completion is derived
  // automatically once every stop is delivered (see maybeCompleteStopsTask).
  const handleEndVisit = async () => {
    if (!checkinId) return;
    setCompleting(true);
    try {
      await checkOutOnly(checkinId);
      setCheckedIn(false);
      setCheckinId(null);
      setCheckInAt(null);
    } catch (e) {
      Alert.alert("Could not end visit", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!task) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background, padding: 24 }}>
        <Text style={{ color: colors.muted }}>This job is no longer available.</Text>
      </View>
    );
  }

  const elapsedMs = checkedIn && checkInAt ? Math.max(0, now - checkInAt) : 0;
  const totalSec = Math.floor(elapsedMs / 1000);
  const hh = String(Math.floor(totalSec / 3600)).padStart(2, "0");
  const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  const checkInTimeLabel = checkInAt
    ? new Date(checkInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  const timerCard = (
    <View style={{ backgroundColor: colors.primary, borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
        <Text style={{ fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.3, color: "rgba(255,255,255,0.78)" }}>
          Checked in
        </Text>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#7FD79A" }} />
      </View>
      <Text style={{ fontFamily: "monospace", fontSize: 26, fontWeight: "600", color: "#fff", marginBottom: 4 }}>
        {hh}:{mm}:{ss}
      </Text>
      <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.78)" }}>Since {checkInTimeLabel}</Text>
    </View>
  );

  if (task.has_stops) {
    const doneCount = stops.filter((s) => s.is_done).length;
    const pct = stops.length ? Math.round((doneCount / stops.length) * 100) : 0;
    const allDone = stops.length > 0 && doneCount === stops.length;

    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={{ fontSize: 12.5, color: colors.muted, marginBottom: 16 }}>
          {task.client_name ?? "—"} · {task.location_address ?? "No route set"}
        </Text>

        {!checkedIn ? (
          <TouchableOpacity
            onPress={handleCheckIn}
            disabled={checkingIn}
            style={{ backgroundColor: colors.primary, borderRadius: 9, paddingVertical: 14, alignItems: "center", marginBottom: 16 }}
          >
            {checkingIn ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14.5 }}>Check in to start this run</Text>
            )}
          </TouchableOpacity>
        ) : (
          <>
            {timerCard}

            {!activeStop ? (
              <>
                <View style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <Text style={sectionTitle}>
                      Stops — {doneCount} of {stops.length} delivered
                    </Text>
                    <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>{pct}%</Text>
                  </View>
                  <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: "hidden" }}>
                    <View style={{ height: "100%", width: `${pct}%`, backgroundColor: colors.primary, borderRadius: 4 }} />
                  </View>
                </View>

                {allDone && (
                  <View style={{ backgroundColor: colors.successBg, borderRadius: 10, padding: 12, marginBottom: 16 }}>
                    <Text style={{ color: colors.successFg, fontWeight: "700", fontSize: 13 }}>
                      🎉 All stops delivered — this job is marked completed.
                    </Text>
                  </View>
                )}

                {stops.length > 0 && (
                  <StopsMapView
                    stops={stops.map((s) => ({ id: s.id, lat: s.lat, lng: s.lng, done: s.is_done }))}
                    onStopPress={(stopId) => {
                      const s = stops.find((x) => x.id === stopId);
                      if (s) setActiveStop(s);
                    }}
                  />
                )}

                <View style={{ marginTop: 16, marginBottom: 16 }}>
                  {stops.map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      onPress={() => setActiveStop(s)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        backgroundColor: colors.card,
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 10,
                        padding: 12,
                        marginBottom: 8,
                      }}
                    >
                      <View
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: s.is_done ? colors.success : colors.steel,
                        }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13.5, fontWeight: "700", color: colors.ink }}>{s.label}</Text>
                        {s.address && <Text style={{ fontSize: 11.5, color: colors.muted }}>{s.address}</Text>}
                      </View>
                      <Text style={{ fontSize: 11.5, fontWeight: "700", color: s.is_done ? colors.success : colors.muted }}>
                        {s.is_done ? "Delivered" : "Pending"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  onPress={handleEndVisit}
                  disabled={completing}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.primary,
                    backgroundColor: colors.card,
                    borderRadius: 9,
                    paddingVertical: 13,
                    alignItems: "center",
                  }}
                >
                  {completing ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 14.5 }}>End visit</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  onPress={() => setActiveStop(null)}
                  style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}
                >
                  <Text style={{ color: colors.primary, fontSize: 18 }}>‹</Text>
                  <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13.5, marginLeft: 2 }}>
                    Back to stops
                  </Text>
                </TouchableOpacity>

                <Text style={{ fontSize: 15, fontWeight: "800", color: colors.ink, marginBottom: 2 }}>
                  {activeStop.label}
                </Text>
                {activeStop.address && (
                  <Text style={{ fontSize: 12.5, color: colors.muted, marginBottom: 6 }}>{activeStop.address}</Text>
                )}
                {activeStop.notes && (
                  <Text style={{ fontSize: 12.5, color: colors.body, marginBottom: 10, fontStyle: "italic" }}>
                    {activeStop.notes}
                  </Text>
                )}

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    backgroundColor: activeStopNotOnSite ? colors.dangerBg : colors.successBg,
                    borderWidth: 1,
                    borderColor: activeStopNotOnSite ? colors.dangerBorder : colors.successBorder,
                    borderRadius: 10,
                    padding: 12,
                    marginBottom: 16,
                  }}
                >
                  <Text style={{ color: activeStopNotOnSite ? colors.danger : colors.success, fontWeight: "700" }}>●</Text>
                  <Text style={{ fontSize: 12.5, color: activeStopNotOnSite ? colors.dangerFg : colors.successFg, flex: 1 }}>
                    {activeStopNotOnSite
                      ? `Not at this stop · ${activeStopDistance != null ? Math.round(activeStopDistance) : "?"}m away, must be within ${activeStop.radius_m}m to upload`
                      : `On-site · within ${activeStop.radius_m}m of this stop`}
                  </Text>
                </View>

                <ProofCaptureForm mode="stop" notOnSite={activeStopNotOnSite} onSubmit={handleStopSubmit} />
              </>
            )}
          </>
        )}
      </ScrollView>
    );
  }

  // Classic single-location task — unchanged behavior.
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={{ fontSize: 12.5, color: colors.muted, marginBottom: 16 }}>
        {task.client_name ?? "—"} · {task.location_address ?? "No address"}
      </Text>

      {isGated && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            backgroundColor: notOnSite ? colors.dangerBg : colors.successBg,
            borderWidth: 1,
            borderColor: notOnSite ? colors.dangerBorder : colors.successBorder,
            borderRadius: 10,
            padding: 12,
            marginBottom: 16,
          }}
        >
          <Text style={{ color: notOnSite ? colors.danger : colors.success, fontWeight: "700" }}>●</Text>
          <Text style={{ fontSize: 12.5, color: notOnSite ? colors.dangerFg : colors.successFg, flex: 1 }}>
            {notOnSite
              ? `Not on-site · ${distance != null ? Math.round(distance) : "?"}m away, must be within ${task.upload_radius_m}m to upload`
              : `On-site · GPS locked (${Math.round(distance ?? 0)}m from site, within ${task.upload_radius_m}m radius)`}
          </Text>
        </View>
      )}

      {!checkedIn ? (
        <TouchableOpacity
          onPress={handleCheckIn}
          disabled={notOnSite || checkingIn}
          style={{
            backgroundColor: notOnSite ? colors.inputBorder : colors.primary,
            borderRadius: 9,
            paddingVertical: 14,
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          {checkingIn ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14.5 }}>
              {notOnSite ? "Move closer to site to check in" : "Check in to start visit"}
            </Text>
          )}
        </TouchableOpacity>
      ) : (
        <>
          {timerCard}
          <Text style={{ fontSize: 12, color: colors.muted, marginTop: -12, marginBottom: 16 }}>
            {sessionUpdates.length} update{sessionUpdates.length === 1 ? "" : "s"} sent
          </Text>

          <ProofCaptureForm mode="task" notOnSite={notOnSite} onSubmit={handleTaskSubmit} />

          {sessionUpdates.length > 0 && (
            <>
              <Text style={[sectionTitle, { marginTop: 4 }]}>Sent this visit</Text>
              {sessionUpdates.map((u, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 10,
                    padding: 10,
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ color: colors.success, fontWeight: "700" }}>✓</Text>
                  <Text style={{ fontSize: 12.5, color: colors.body, fontFamily: "monospace" }}>
                    {u.time} · proof sent
                  </Text>
                </View>
              ))}
            </>
          )}

          <TouchableOpacity
            onPress={handleComplete}
            disabled={completing}
            style={{
              borderWidth: 1,
              borderColor: colors.primary,
              backgroundColor: colors.card,
              borderRadius: 9,
              paddingVertical: 13,
              alignItems: "center",
              marginTop: 4,
            }}
          >
            {completing ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 14.5 }}>Mark task complete</Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const sectionTitle = {
  fontSize: 12,
  fontWeight: "700",
  color: colors.muted,
  textTransform: "uppercase",
  letterSpacing: 0.3,
  marginBottom: 8,
} as const;
