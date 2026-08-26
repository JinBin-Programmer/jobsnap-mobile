import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, BackHandler } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import {
  getTask,
  getCurrentLocation,
  submitUpdate,
  submitStopUpdate,
  listTaskStops,
  checkIn,
  checkOutAndComplete,
  checkOutOnly,
  getOpenCheckin,
  getCheckinLocationStatus,
  listCheckinUpdateTimes,
  distanceMeters,
  getMoneyKpiEnabled,
  NotOnSiteError,
  type Coords,
  type UploadProgressCallback,
} from "@/lib/tasks";
import { useAuth } from "@/lib/auth";
import type { Task, TaskStop, CheckinLocationStatus } from "@/lib/types";
import { colors, radius, shadow, space, type } from "@/lib/theme";
import ProofCaptureForm, { type CaptureSubmitPayload } from "@/components/ProofCaptureForm";
import StopsMapView from "@/components/StopsMapView";
import NavigateButtons from "@/components/NavigateButtons";
import Button from "@/components/ui/Button";
import StatusDot from "@/components/ui/StatusDot";
import { useToast } from "@/components/ui/Toast";
import { isOnline, queueTaskSubmission, queueStopSubmission, flushQueue, getPendingCount } from "@/lib/offlineQueue";

// How often to refresh GPS while this screen is open, to keep the
// on-site/not-on-site banner reasonably live without hammering the battery.
const LOCATION_REFRESH_MS = 15000;

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const { show: showToast } = useToast();

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [moneyKpiEnabled, setMoneyKpiEnabled] = useState(false);

  const [checkedIn, setCheckedIn] = useState(false);
  const [checkinId, setCheckinId] = useState<string | null>(null);
  const [checkinStatus, setCheckinStatus] = useState<CheckinLocationStatus | null>(null);
  const [checkInAt, setCheckInAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [sessionUpdates, setSessionUpdates] = useState<{ time: string }[]>([]);
  const [checkingIn, setCheckingIn] = useState(false);
  const [completing, setCompleting] = useState(false);

  // Multi-stop ("delivery run") state — unused for a classic single-site task.
  const [stops, setStops] = useState<TaskStop[]>([]);
  const [activeStop, setActiveStop] = useState<TaskStop | null>(null);

  // Offline queue — submissions saved locally because there was no
  // connection when the worker tried to send them.
  const [pendingCount, setPendingCount] = useState(0);
  const [flushing, setFlushing] = useState(false);

  const attemptFlush = async () => {
    if (flushing) return;
    setFlushing(true);
    try {
      const { remaining } = await flushQueue();
      setPendingCount(remaining);
    } finally {
      setFlushing(false);
    }
  };

  useEffect(() => {
    getPendingCount().then(setPendingCount);
    attemptFlush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!id) return;
    getTask(id).then((t) => {
      setTask(t);
      setLoading(false);
      if (t?.has_stops) listTaskStops(id).then(setStops);
      if (t?.org_id) getMoneyKpiEnabled(t.org_id).then(setMoneyKpiEnabled);
    });
  }, [id]);

  // Restore an in-progress visit — without this, backgrounding or killing
  // the app mid-visit silently forgets the worker was checked in.
  useEffect(() => {
    if (!id || !profile?.id) return;
    let cancelled = false;
    getOpenCheckin(id, profile.id).then(async (open) => {
      if (cancelled || !open) return;
      setCheckinId(open.id);
      setCheckinStatus(open.location_status);
      setCheckInAt(new Date(open.checked_in_at).getTime());
      setNow(Date.now());
      setCheckedIn(true);
      const times = await listCheckinUpdateTimes(open.id);
      if (cancelled) return;
      setSessionUpdates(
        times.map((t) => ({ time: new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }))
      );
    });
    return () => {
      cancelled = true;
    };
  }, [id, profile?.id]);

  // Re-check the pending/approved/rejected state whenever this screen comes
  // back into focus — no realtime channel in this app, so a manager's
  // approve/reject decision only shows up here on the next visit (a push
  // notification also fires the moment they act, from checkIn()/the web
  // dashboard's actions.ts).
  useFocusEffect(
    useCallback(() => {
      if (!checkinId) return;
      let cancelled = false;
      getCheckinLocationStatus(checkinId).then((status) => {
        if (cancelled || !status) return;
        setCheckinStatus((prev) => {
          if (prev === "remote_pending" && status === "remote_approved") {
            showToast("Your check-in was approved.", "success");
          } else if (prev === "remote_pending" && status === "remote_rejected") {
            showToast("Your check-in wasn't approved — those hours won't count.", "error");
          }
          return status;
        });
      });
      return () => {
        cancelled = true;
      };
    }, [checkinId, showToast])
  );

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

  // A fresh GPS read is taken right here (not the periodically-polled
  // `coords`, which can be up to LOCATION_REFRESH_MS stale) so the on-site
  // decision reflects where the worker actually is the moment they tap the
  // button — mirrors what handleTaskSubmit already does for uploads.
  const handleCheckIn = async (manuallyRequested: boolean = false) => {
    if (!task || !profile?.org_id || !profile.id) return;
    setCheckingIn(true);
    try {
      const freshCoords = await getCurrentLocation();
      setCoords(freshCoords);
      const result = await checkIn({
        taskId: task.id,
        workerId: profile.id,
        orgId: profile.org_id,
        taskTitle: task.title,
        taskLat: task.location_lat,
        taskLng: task.location_lng,
        radiusM: task.upload_radius_m,
        coords: freshCoords,
        manuallyRequested,
      });
      setCheckinId(result.id);
      setCheckinStatus(result.locationStatus);
      setCheckInAt(Date.now());
      setNow(Date.now());
      setSessionUpdates([]);
      setCheckedIn(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      if (e instanceof NotOnSiteError) {
        Alert.alert("You're not at the job site", `${e.message} You can still check in, but it'll need your admin's approval before the hours count.`, [
          { text: "Cancel", style: "cancel" },
          { text: "Check in anyway", onPress: () => handleCheckIn(true) },
        ]);
      } else {
        Alert.alert("Could not check in", e instanceof Error ? e.message : "Please try again.");
      }
    } finally {
      setCheckingIn(false);
    }
  };

  const handleTaskSubmit = async (payload: CaptureSubmitPayload, onProgress?: UploadProgressCallback) => {
    if (!task || !profile?.org_id || !profile.id) return;
    const freshCoords = await getCurrentLocation();
    setCoords(freshCoords);
    const args = {
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
      amountCollected: payload.amountCollected,
    };

    if (!(await isOnline())) {
      await queueTaskSubmission(args, task.title);
      setPendingCount((n) => n + 1);
      showToast("Saved offline — will send once you're back online", "error");
      return;
    }
    try {
      await submitUpdate(args, onProgress);
    } catch (e) {
      if (!(await isOnline())) {
        await queueTaskSubmission(args, task.title);
        setPendingCount((n) => n + 1);
        showToast("Connection dropped — saved to send later", "error");
        return;
      }
      throw e;
    }
    setSessionUpdates((prev) => [
      ...prev,
      { time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
    ]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const photoCount = payload.media.length;
    showToast(photoCount > 0 ? `${photoCount} photo${photoCount === 1 ? "" : "s"} uploaded — update sent` : "Update sent");
  };

  const handleStopSubmit = async (payload: CaptureSubmitPayload, onProgress?: UploadProgressCallback) => {
    if (!task || !profile?.org_id || !profile.id || !activeStop) return;
    const freshCoords = await getCurrentLocation();
    setCoords(freshCoords);
    const args = {
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
    };

    const label = `${task.title} — ${activeStop.label}`;
    if (!(await isOnline())) {
      await queueStopSubmission(args, label);
      setPendingCount((n) => n + 1);
      showToast("Saved offline — will send once you're back online", "error");
      return;
    }
    try {
      await submitStopUpdate(args, onProgress);
    } catch (e) {
      if (!(await isOnline())) {
        await queueStopSubmission(args, label);
        setPendingCount((n) => n + 1);
        showToast("Connection dropped — saved to send later", "error");
        return;
      }
      throw e;
    }
    refreshTaskAndStops();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const photoCount = payload.media.length;
    const photoNote = photoCount > 0 ? `${photoCount} photo${photoCount === 1 ? "" : "s"} uploaded — ` : "";
    if (payload.markDone) {
      showToast(`${photoNote}Stop delivered`);
      setActiveStop(null);
    } else {
      showToast(`${photoNote}Update sent`);
    }
  };

  const handleComplete = async () => {
    if (!task || !checkinId) return;
    setCompleting(true);
    try {
      // Re-check GPS at the moment of completing, not just at check-in — a
      // worker could check in, then leave, then tap this from anywhere.
      // Completion is a claim of finished work, so it's gated the same way
      // proof uploads are. If they've genuinely already left, a manager can
      // still complete it from the web dashboard — that path isn't gated.
      if (isGated) {
        const freshCoords = await getCurrentLocation();
        setCoords(freshCoords);
        const dist = freshCoords
          ? distanceMeters(freshCoords, { lat: task.location_lat!, lng: task.location_lng! })
          : null;
        if (dist == null || dist > task.upload_radius_m) {
          Alert.alert(
            "Not on-site",
            `You must be within ${task.upload_radius_m}m of the job site to mark it complete. If you've already left, ask your manager to complete it from the dashboard.`
          );
          return;
        }
      }
      await checkOutAndComplete(checkinId, task.id);
      setCheckedIn(false);
      setCheckinId(null);
      setCheckinStatus(null);
      setCheckInAt(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast("Job completed");
      router.back();
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
      setCheckinStatus(null);
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
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background, padding: space.xl }}>
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

  // The one signature moment in the app: a live-pulsing dot + a real
  // instrument-style monospace readout, standing in for "this GPS-verified
  // visit is happening right now" — the whole product's value prop in one
  // small piece of UI.
  const timerCard = (
    <View style={{ backgroundColor: colors.primary, borderRadius: radius.md, padding: space.lg, marginBottom: space.lg, ...shadow.md }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <Text style={{ ...type.label, color: "rgba(255,255,255,0.78)" }}>Checked in</Text>
        <StatusDot color="#7FD79A" size={7} />
      </View>
      <Text style={{ ...type.monoLg, color: "#fff", marginBottom: 4 }}>
        {hh}:{mm}:{ss}
      </Text>
      <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.78)" }}>Since {checkInTimeLabel}</Text>
      {checkinStatus === "remote_pending" && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            backgroundColor: colors.dangerBg,
            borderRadius: radius.sm,
            paddingVertical: 6,
            paddingHorizontal: 10,
            marginTop: space.md,
            alignSelf: "flex-start",
          }}
        >
          <Ionicons name="time-outline" size={13} color={colors.dangerFg} />
          <Text style={{ fontSize: 11.5, fontWeight: "700", color: colors.dangerFg }}>
            Not on-site — waiting on your admin&apos;s approval
          </Text>
        </View>
      )}
    </View>
  );

  const pendingBanner =
    pendingCount > 0 ? (
      <Pressable
        onPress={attemptFlush}
        disabled={flushing}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: space.sm,
          backgroundColor: colors.dangerBg,
          borderWidth: 1,
          borderColor: colors.dangerBorder,
          borderRadius: radius.sm,
          padding: space.md,
          marginBottom: space.lg,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        {flushing ? (
          <ActivityIndicator size="small" color={colors.danger} />
        ) : (
          <Ionicons name="cloud-offline-outline" size={17} color={colors.danger} />
        )}
        <Text style={{ fontSize: 12.5, color: colors.dangerFg, flex: 1 }}>
          {pendingCount} update{pendingCount === 1 ? "" : "s"} saved offline, not sent yet — tap to retry now
        </Text>
      </Pressable>
    ) : null;

  if (task.has_stops) {
    const doneCount = stops.filter((s) => s.is_done).length;
    const pct = stops.length ? Math.round((doneCount / stops.length) * 100) : 0;
    const allDone = stops.length > 0 && doneCount === stops.length;

    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl + 8 }}>
        <Text style={{ fontSize: 12.5, color: colors.muted, marginBottom: space.lg }}>
          {task.client_name ?? "—"} · {task.location_address ?? "No route set"}
        </Text>

        {pendingBanner}

        {!checkedIn ? (
          <View style={{ marginBottom: space.lg }}>
            <Button
              label="Check in to start this run"
              onPress={() => handleCheckIn()}
              loading={checkingIn}
              icon={!checkingIn && <Ionicons name="log-in-outline" size={17} color="#fff" />}
            />
          </View>
        ) : (
          <>
            {timerCard}

            {!activeStop ? (
              <>
                <View style={{ marginBottom: space.lg }}>
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
                  <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, backgroundColor: colors.successBg, borderRadius: radius.sm, padding: space.md, marginBottom: space.lg }}>
                    <Ionicons name="checkmark-circle" size={18} color={colors.successFg} />
                    <Text style={{ color: colors.successFg, fontWeight: "700", fontSize: 13, flex: 1 }}>
                      All stops delivered — this job is marked completed.
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

                <View style={{ marginTop: space.lg, marginBottom: space.lg }}>
                  {stops.map((s) => (
                    <Pressable
                      key={s.id}
                      onPress={() => setActiveStop(s)}
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        backgroundColor: colors.card,
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: radius.sm,
                        padding: space.md,
                        marginBottom: space.sm,
                        opacity: pressed ? 0.85 : 1,
                      })}
                    >
                      <StatusDot color={s.is_done ? colors.success : colors.steel} size={10} pulse={false} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13.5, fontWeight: "700", color: colors.ink }}>{s.label}</Text>
                        {s.address && <Text style={{ fontSize: 11.5, color: colors.muted }}>{s.address}</Text>}
                      </View>
                      <Text style={{ fontSize: 11.5, fontWeight: "700", color: s.is_done ? colors.success : colors.muted }}>
                        {s.is_done ? "Delivered" : "Pending"}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Button label="End visit" onPress={handleEndVisit} loading={completing} variant="outline" />
              </>
            ) : (
              <>
                <Pressable onPress={() => setActiveStop(null)} style={{ flexDirection: "row", alignItems: "center", marginBottom: space.md + 2 }} hitSlop={8}>
                  <Ionicons name="chevron-back" size={18} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13.5, marginLeft: 0 }}>Back to stops</Text>
                </Pressable>

                <Text style={{ fontSize: 15, fontWeight: "800", color: colors.ink, marginBottom: 2 }}>
                  {activeStop.label}
                </Text>
                {activeStop.address && (
                  <Text style={{ fontSize: 12.5, color: colors.muted, marginBottom: 6 }}>{activeStop.address}</Text>
                )}
                {activeStop.notes && (
                  <Text style={{ fontSize: 12.5, color: colors.body, marginBottom: space.sm + 2, fontStyle: "italic" }}>
                    {activeStop.notes}
                  </Text>
                )}

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space.sm,
                    backgroundColor: activeStopNotOnSite ? colors.dangerBg : colors.successBg,
                    borderWidth: 1,
                    borderColor: activeStopNotOnSite ? colors.dangerBorder : colors.successBorder,
                    borderRadius: radius.sm,
                    padding: space.md,
                    marginBottom: space.lg,
                  }}
                >
                  <StatusDot color={activeStopNotOnSite ? colors.danger : colors.success} size={9} pulse={!activeStopNotOnSite} />
                  <Text style={{ fontSize: 12.5, color: activeStopNotOnSite ? colors.dangerFg : colors.successFg, flex: 1 }}>
                    {activeStopNotOnSite
                      ? `Not at this stop · ${activeStopDistance != null ? Math.round(activeStopDistance) : "?"}m away, must be within ${activeStop.radius_m}m to upload`
                      : `On-site · within ${activeStop.radius_m}m of this stop`}
                  </Text>
                </View>

                {activeStopNotOnSite && <NavigateButtons lat={activeStop.lat} lng={activeStop.lng} />}

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
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl + 8 }}>
      <Text style={{ fontSize: 12.5, color: colors.muted, marginBottom: space.lg }}>
        {task.client_name ?? "—"} · {task.location_address ?? "No address"}
      </Text>

      {pendingBanner}

      {isGated && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: space.sm,
            backgroundColor: notOnSite ? colors.dangerBg : colors.successBg,
            borderWidth: 1,
            borderColor: notOnSite ? colors.dangerBorder : colors.successBorder,
            borderRadius: radius.sm,
            padding: space.md,
            marginBottom: space.lg,
          }}
        >
          <StatusDot color={notOnSite ? colors.danger : colors.success} size={9} pulse={!notOnSite} />
          <Text style={{ fontSize: 12.5, color: notOnSite ? colors.dangerFg : colors.successFg, flex: 1 }}>
            {notOnSite
              ? `Not on-site · ${distance != null ? Math.round(distance) : "?"}m away, must be within ${task.upload_radius_m}m to upload`
              : `On-site · GPS locked (${Math.round(distance ?? 0)}m from site, within ${task.upload_radius_m}m radius)`}
          </Text>
        </View>
      )}

      {isGated && notOnSite && (
        <NavigateButtons lat={task.location_lat!} lng={task.location_lng!} />
      )}

      {!checkedIn ? (
        <View style={{ marginBottom: space.lg }}>
          <Button
            label={notOnSite ? "Not on-site — request check-in" : "Check in to start visit"}
            onPress={() => handleCheckIn()}
            loading={checkingIn}
            icon={
              !checkingIn && <Ionicons name={notOnSite ? "alert-circle-outline" : "log-in-outline"} size={17} color="#fff" />
            }
          />
        </View>
      ) : (
        <>
          {timerCard}
          <Text style={{ fontSize: 12, color: colors.muted, marginTop: -12, marginBottom: space.lg }}>
            {sessionUpdates.length} update{sessionUpdates.length === 1 ? "" : "s"} sent
          </Text>

          <ProofCaptureForm
            mode="task"
            notOnSite={notOnSite}
            moneyKpiEnabled={moneyKpiEnabled}
            onSubmit={handleTaskSubmit}
          />

          {sessionUpdates.length > 0 && (
            <>
              <Text style={{ ...sectionTitle, marginTop: 4 }}>Sent this visit</Text>
              {sessionUpdates.map((u, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space.sm,
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: radius.sm,
                    padding: 10,
                    marginBottom: space.sm,
                  }}
                >
                  <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                  <Text style={{ ...type.mono, color: colors.body }}>{u.time} · proof sent</Text>
                </View>
              ))}
            </>
          )}

          <View style={{ marginTop: 4 }}>
            <Button label="Mark task complete" onPress={handleComplete} loading={completing} variant="outline" />
          </View>
        </>
      )}
    </ScrollView>
  );
}

const sectionTitle = {
  ...type.label,
  color: colors.muted,
  marginBottom: space.sm,
} as const;
