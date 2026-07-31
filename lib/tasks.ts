import * as FileSystem from "expo-file-system";
import * as Location from "expo-location";
import { Alert, Linking } from "react-native";
import { decode } from "base64-arraybuffer";
import { supabase } from "./supabase";
import { sendPushToManagers } from "./push";
import type { Task, TaskStatus, TaskPriority, MediaType, JobType, Client, MyMedia, TaskStop } from "./types";

// ---- Reads ---------------------------------------------------------------

const TASK_FIELDS =
  "id, org_id, title, description, status, priority, expected_start, expected_end, location_address, location_lat, location_lng, upload_radius_m, self_created, has_stops, client:client_id(name), job_type:job_type_id(name)";

function mapTask(t: Record<string, unknown>): Task {
  return {
    id: t.id as string,
    org_id: t.org_id as string,
    title: t.title as string,
    description: (t.description as string) ?? null,
    status: t.status as TaskStatus,
    priority: t.priority as Task["priority"],
    expected_start: (t.expected_start as string) ?? null,
    expected_end: (t.expected_end as string) ?? null,
    location_address: (t.location_address as string) ?? null,
    location_lat: (t.location_lat as number) ?? null,
    location_lng: (t.location_lng as number) ?? null,
    upload_radius_m: (t.upload_radius_m as number) ?? 150,
    self_created: (t.self_created as boolean) ?? false,
    has_stops: (t.has_stops as boolean) ?? false,
    client_name: (t.client as { name?: string } | null)?.name ?? null,
    job_type_name: (t.job_type as { name?: string } | null)?.name ?? null,
  };
}

// Tasks assigned to the signed-in worker. RLS also enforces this server-side.
export async function listMyTasks(userId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_FIELDS)
    .eq("assigned_to", userId)
    .neq("status", "cancelled")
    .order("expected_end", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((t) => mapTask(t as Record<string, unknown>));
}

export async function getTask(taskId: string): Promise<Task | null> {
  const { data, error } = await supabase.from("tasks").select(TASK_FIELDS).eq("id", taskId).single();
  if (error) return null;
  return mapTask(data as Record<string, unknown>);
}

export async function listTaskStops(taskId: string): Promise<TaskStop[]> {
  const { data, error } = await supabase
    .from("task_stops")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as TaskStop[];
}

export async function listJobTypes(orgId: string): Promise<JobType[]> {
  const { data, error } = await supabase.from("job_types").select("id, name").eq("org_id", orgId).order("name");
  if (error) throw error;
  return data ?? [];
}

export async function listClients(orgId: string): Promise<Client[]> {
  const { data, error } = await supabase.from("clients").select("id, name").eq("org_id", orgId).order("name");
  if (error) throw error;
  return data ?? [];
}

// ---- Location ------------------------------------------------------------

export interface Coords {
  lat: number;
  lng: number;
  accuracy: number | null;
}

const GPS_TIMEOUT_MS = 15000;

export async function getCurrentLocation(): Promise<Coords | null> {
  const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    if (!canAskAgain) {
      // Permanently denied — re-requesting silently returns denied again.
      Alert.alert(
        "Location access needed",
        "JobSnap needs your location to verify you're on-site. You've previously denied it — open Settings to turn it on.",
        [
          { text: "Not now", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ]
      );
    }
    return null;
  }

  try {
    // GPS can hang indefinitely with poor signal (basements, dense
    // buildings) — never let it spin forever with no feedback.
    const pos = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("GPS timeout")), GPS_TIMEOUT_MS)),
    ]);
    return {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy ?? null,
    };
  } catch {
    return null;
  }
}

export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Blocks photo/video uploads unless the worker is at the job's location.
// If the manager hasn't set a location pin on the task, there's nothing to
// check against, so uploads aren't gated. Each task has its own radius
// (tasks.upload_radius_m, default 150m — configurable per task).
function assertOnSite(
  coords: Coords | null,
  taskLat: number | null,
  taskLng: number | null,
  radiusM: number
) {
  if (taskLat == null || taskLng == null) return; // no pin set — not gated

  if (!coords) {
    throw new Error(
      "This job requires your location to upload photos, but we couldn't get your GPS. Enable location and try again, or ask your admin to add this update from the web dashboard."
    );
  }

  const distance = distanceMeters(coords, { lat: taskLat, lng: taskLng });
  if (distance > radiusM) {
    throw new Error(
      `You're too far from this job's site to upload photos (must be within ${radiusM}m). Ask your admin to add this update from the web dashboard instead.`
    );
  }
}

// ---- Check-in / visit sessions --------------------------------------------

export interface OpenCheckin {
  id: string;
  checked_in_at: string;
}

// The screen calls this on mount to restore an in-progress visit — without
// it, backgrounding or killing the app mid-visit silently forgets the
// worker was checked in, resetting the timer and letting them "check in"
// again, which would otherwise create a second open visit row forever
// orphaning the first (nothing ever sets its checked_out_at).
export async function getOpenCheckin(taskId: string, workerId: string): Promise<OpenCheckin | null> {
  const { data } = await supabase
    .from("task_checkins")
    .select("id, checked_in_at")
    .eq("task_id", taskId)
    .eq("worker_id", workerId)
    .is("checked_out_at", null)
    .order("checked_in_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as OpenCheckin) ?? null;
}

// Updates sent during a specific visit — used to rebuild the "Sent this
// visit" list on rehydration, not just on a fresh check-in.
export async function listCheckinUpdateTimes(checkinId: string): Promise<string[]> {
  const { data } = await supabase
    .from("task_updates")
    .select("created_at")
    .eq("checkin_id", checkinId)
    .order("created_at", { ascending: true });
  return (data ?? []).map((u) => u.created_at as string);
}

export async function checkIn(taskId: string, workerId: string, orgId: string): Promise<string> {
  // Reuse an existing open visit instead of creating a duplicate — the UI
  // rehydrates from getOpenCheckin on mount, but this is the authoritative
  // guard (e.g. a double-tap, or rehydration racing a fresh mount).
  const existing = await getOpenCheckin(taskId, workerId);
  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("task_checkins")
    .insert({ org_id: orgId, task_id: taskId, worker_id: workerId })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("Failed to check in");
  return data.id as string;
}

export async function checkOutAndComplete(checkinId: string, taskId: string) {
  const { error: coErr } = await supabase
    .from("task_checkins")
    .update({ checked_out_at: new Date().toISOString() })
    .eq("id", checkinId);
  if (coErr) throw coErr;

  const { data: task, error: tErr } = await supabase
    .from("tasks")
    .update({ status: "completed" })
    .eq("id", taskId)
    .select("org_id, title")
    .single();
  if (tErr) throw tErr;

  if (task) {
    sendPushToManagers(task.org_id as string, "Job completed", `"${task.title}" was marked complete.`, { taskId });
  }
}

// Ends the visit WITHOUT marking the task done — for a multi-stop task a
// worker plausibly checks out mid-route (end of shift, 6/10 delivered) and
// resumes tomorrow. Completion for those tasks is derived automatically
// from stop state instead — see maybeCompleteStopsTask.
export async function checkOutOnly(checkinId: string) {
  const { error } = await supabase
    .from("task_checkins")
    .update({ checked_out_at: new Date().toISOString() })
    .eq("id", checkinId);
  if (error) throw error;
}

// ---- Self-created tasks ----------------------------------------------------

interface CreateSelfTaskArgs {
  orgId: string;
  workerId: string;
  title: string;
  jobTypeId: string | null;
  clientId: string | null;
  priority: TaskPriority;
  coords: Coords | null;
  radiusM: number;
}

// Workers can add a job the admin left off the roster. There's no in-app map
// here, so "placing the pin" uses the worker's own current GPS position —
// the realistic case is a worker standing at the site adding it right now.
export async function createSelfTask(args: CreateSelfTaskArgs): Promise<string> {
  const { orgId, workerId, title, jobTypeId, clientId, priority, coords, radiusM } = args;

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      org_id: orgId,
      title: title.trim() || "Untitled job",
      job_type_id: jobTypeId,
      client_id: clientId,
      assigned_to: workerId,
      created_by: workerId,
      self_created: true,
      status: "pending",
      priority,
      location_lat: coords?.lat ?? null,
      location_lng: coords?.lng ?? null,
      upload_radius_m: radiusM,
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("Failed to create job");
  return data.id as string;
}

// ---- Submit an update ----------------------------------------------------

export interface MediaItem {
  uri: string;
  type: MediaType;
  fileName?: string;
}

export interface SubmitUpdateArgs {
  orgId: string;
  taskId: string;
  workerId: string;
  remark: string;
  status: TaskStatus | null; // null = note only, don't change task status
  coords: Coords | null;
  media: MediaItem[];
  // The job's site location + radius, if the manager (or the worker, for a
  // self-created job) set one. When present, photo/video uploads are gated
  // to workers who are actually near it — see assertOnSite().
  taskLat: number | null;
  taskLng: number | null;
  radiusM: number;
  // Which check-in "visit" this update belongs to, if the worker is
  // currently checked in.
  checkinId: string | null;
}

function guessContentType(uri: string, type: MediaType) {
  const ext = uri.split(".").pop()?.toLowerCase();
  if (type === "video") return ext === "mov" ? "video/quicktime" : "video/mp4";
  if (ext === "png") return "image/png";
  if (ext === "heic") return "image/heic";
  return "image/jpeg";
}

// Storage-quota error raised by the DB trigger (see supabase/storage-limits.sql).
const QUOTA_MESSAGE =
  "Your company's photo storage is full for its current plan. Ask your manager to upgrade the plan, or free up space by removing old job photos.";

// Pre-check so we skip uploading entirely when there's clearly no room,
// instead of burning the worker's mobile data on an upload that will be
// rejected anyway. The DB trigger (enforce_media_storage_limit) is what
// actually protects the quota — this is just a courtesy check.
async function assertRoomFor(media: MediaItem[]) {
  if (media.length === 0) return;

  const sizes = await Promise.all(
    media.map(async (m) => {
      const info = await FileSystem.getInfoAsync(m.uri, { size: true });
      return info.exists ? info.size ?? 0 : 0;
    })
  );
  const incomingBytes = sizes.reduce((a, b) => a + b, 0);

  const { data, error } = await supabase.rpc("org_storage_status").maybeSingle();
  if (error || !data) return; // don't block the submission if the check itself fails

  const { used_bytes, limit_mb } = data as { used_bytes: number; limit_mb: number | null };
  if (limit_mb == null) return; // unlimited plan

  if (used_bytes + incomingBytes > limit_mb * 1024 * 1024) {
    throw new Error(QUOTA_MESSAGE);
  }
}

// Uploads each media file for an already-inserted task_updates row and
// records it. Shared by submitUpdate (whole-task proof) and
// submitStopUpdate (per-stop proof) — identical storage-path convention and
// quota handling either way.
async function uploadMediaFiles(orgId: string, taskId: string, updateId: string, media: MediaItem[]) {
  for (let i = 0; i < media.length; i++) {
    const m = media[i];
    const ext = m.uri.split(".").pop()?.split("?")[0] || (m.type === "video" ? "mp4" : "jpg");
    const path = `${orgId}/${taskId}/${updateId}/${Date.now()}_${i}.${ext}`;

    const base64 = await FileSystem.readAsStringAsync(m.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const bytes = decode(base64);

    const { error: upErr } = await supabase.storage
      .from("task-media")
      .upload(path, bytes, {
        contentType: guessContentType(m.uri, m.type),
        upsert: false,
      });
    if (upErr) throw upErr;

    const { error: mediaErr } = await supabase.from("task_update_media").insert({
      org_id: orgId,
      update_id: updateId,
      task_id: taskId,
      storage_path: path,
      type: m.type,
      size_bytes: bytes.byteLength,
    });
    if (mediaErr) {
      if (mediaErr.message?.includes("STORAGE_LIMIT_REACHED")) throw new Error(QUOTA_MESSAGE);
      throw mediaErr;
    }
  }
}

export async function submitUpdate(args: SubmitUpdateArgs) {
  const { orgId, taskId, workerId, remark, status, coords, media, taskLat, taskLng, radiusM, checkinId } =
    args;

  // Gate on-site whenever this update carries proof of progress (a photo, or
  // a status change/completion claim) — not just photos. A status change
  // with no media would otherwise skip the location check entirely.
  if (media.length > 0 || status) assertOnSite(coords, taskLat, taskLng, radiusM);
  await assertRoomFor(media);

  const { data: update, error: updErr } = await supabase
    .from("task_updates")
    .insert({
      org_id: orgId,
      task_id: taskId,
      worker_id: workerId,
      remark: remark.trim() || null,
      status,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      accuracy: coords?.accuracy ?? null,
      checkin_id: checkinId,
    })
    .select("id")
    .single();
  if (updErr || !update) throw updErr ?? new Error("Failed to save update");

  await uploadMediaFiles(orgId, taskId, update.id as string, media);

  // If the worker set a status, move the task too.
  if (status) {
    const { error: tErr } = await supabase
      .from("tasks")
      .update({ status })
      .eq("id", taskId);
    if (tErr) throw tErr;
  }

  return update.id as string;
}

// ---- Multi-stop ("delivery run") proof --------------------------------

export interface SubmitStopUpdateArgs {
  orgId: string;
  taskId: string;
  stopId: string;
  workerId: string;
  remark: string;
  coords: Coords | null;
  media: MediaItem[];
  stopLat: number;
  stopLng: number;
  radiusM: number;
  checkinId: string | null;
  markDone: boolean;
}

// Same shape as submitUpdate, but gated on-site using THIS STOP's
// coordinates/radius (not the task's — a multi-stop task has no single
// site), and tags the update with stop_id so the timeline/report can tell
// which stop the proof was for.
export async function submitStopUpdate(args: SubmitStopUpdateArgs) {
  const { orgId, taskId, stopId, workerId, remark, coords, media, stopLat, stopLng, radiusM, checkinId, markDone } =
    args;

  // Same reasoning as submitUpdate — gate whenever proof or a delivered
  // claim is involved, not just when there's a photo.
  if (media.length > 0 || markDone) assertOnSite(coords, stopLat, stopLng, radiusM);
  await assertRoomFor(media);

  const { data: update, error: updErr } = await supabase
    .from("task_updates")
    .insert({
      org_id: orgId,
      task_id: taskId,
      worker_id: workerId,
      remark: remark.trim() || null,
      status: null,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      accuracy: coords?.accuracy ?? null,
      checkin_id: checkinId,
      stop_id: stopId,
    })
    .select("id")
    .single();
  if (updErr || !update) throw updErr ?? new Error("Failed to save update");

  await uploadMediaFiles(orgId, taskId, update.id as string, media);

  if (markDone) {
    const { error: stopErr } = await supabase
      .from("task_stops")
      .update({ is_done: true, completed_at: new Date().toISOString(), completed_by: workerId })
      .eq("id", stopId);
    if (stopErr) throw stopErr;

    await maybeCompleteStopsTask(taskId, checkinId);
  }

  return update.id as string;
}

// After a stop flips to done, check whether the whole task is now finished.
// If every stop is done: complete the task, and close the visit too if it's
// still open (mirrors what checkOutAndComplete does for a single-location
// task, just triggered by "last stop done" instead of a manual button). If
// stops remain but at least one is done, nudge a still-"pending" task to
// "in_progress" so the web dashboard reflects that work has started. Never
// overrides a task a manager has already moved to completed/verified/cancelled.
export async function maybeCompleteStopsTask(taskId: string, checkinId: string | null) {
  const { data: stops, error } = await supabase.from("task_stops").select("is_done").eq("task_id", taskId);
  if (error || !stops || stops.length === 0) return;

  const total = stops.length;
  const done = stops.filter((s) => s.is_done).length;

  const { data: task } = await supabase.from("tasks").select("status, org_id, title").eq("id", taskId).single();
  const currentStatus = task?.status as TaskStatus | undefined;
  if (currentStatus === "completed" || currentStatus === "verified" || currentStatus === "cancelled") return;

  if (done >= total) {
    await supabase.from("tasks").update({ status: "completed" }).eq("id", taskId);
    if (task) {
      sendPushToManagers(task.org_id as string, "Job completed", `"${task.title}" was marked complete.`, { taskId });
    }
    if (checkinId) {
      await supabase
        .from("task_checkins")
        .update({ checked_out_at: new Date().toISOString() })
        .eq("id", checkinId)
        .is("checked_out_at", null);
    }
  } else if (currentStatus === "pending") {
    await supabase.from("tasks").update({ status: "in_progress" }).eq("id", taskId);
  }
}

// ---- My uploads (gallery) --------------------------------------------------

// Requires supabase/worker-media-delete.sql — see this fork's report for why.
export async function listMyMedia(workerId: string): Promise<MyMedia[]> {
  const { data: updates } = await supabase.from("task_updates").select("id").eq("worker_id", workerId);
  const updateIds = (updates ?? []).map((u) => u.id as string);
  if (updateIds.length === 0) return [];

  const { data: media } = await supabase
    .from("task_update_media")
    .select("id, update_id, task_id, storage_path, type, size_bytes, created_at")
    .in("update_id", updateIds)
    .order("created_at", { ascending: false });
  if (!media || media.length === 0) return [];

  const taskIds = [...new Set(media.map((m) => m.task_id as string))];
  const { data: tasks } = await supabase.from("tasks").select("id, title").in("id", taskIds);
  const titleById: Record<string, string> = {};
  (tasks ?? []).forEach((t) => {
    titleById[t.id as string] = t.title as string;
  });

  const paths = media.map((m) => m.storage_path as string);
  const { data: signed } = await supabase.storage.from("task-media").createSignedUrls(paths, 3600);

  return media.map((m, i) => ({
    id: m.id as string,
    task_id: m.task_id as string,
    task_title: titleById[m.task_id as string] ?? "Job",
    storage_path: m.storage_path as string,
    type: m.type as MediaType,
    size_bytes: m.size_bytes as number,
    created_at: m.created_at as string,
    url: signed?.[i]?.signedUrl ?? null,
  }));
}

// Requires supabase/worker-media-delete.sql to have been run — otherwise RLS
// blocks both deletes and this silently removes nothing.
export async function deleteMyMedia(mediaId: string, storagePath: string) {
  const { error: storageErr } = await supabase.storage.from("task-media").remove([storagePath]);
  if (storageErr) throw storageErr;

  const { error: rowErr } = await supabase.from("task_update_media").delete().eq("id", mediaId);
  if (rowErr) throw rowErr;
}

export async function getMyStorageUsedBytes(workerId: string): Promise<number> {
  const { data: updates } = await supabase.from("task_updates").select("id").eq("worker_id", workerId);
  const updateIds = (updates ?? []).map((u) => u.id as string);
  if (updateIds.length === 0) return 0;

  const { data: media } = await supabase
    .from("task_update_media")
    .select("size_bytes")
    .in("update_id", updateIds);
  return (media ?? []).reduce((sum, m) => sum + ((m.size_bytes as number) ?? 0), 0);
}
