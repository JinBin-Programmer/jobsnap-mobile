import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Network from "expo-network";
import { submitUpdate, submitStopUpdate, type SubmitUpdateArgs, type SubmitStopUpdateArgs } from "./tasks";

// Pragmatic v1: not a full background-sync system. If a submission fails
// while genuinely offline, it's saved here (photo/video URIs still point at
// the on-device cache, not re-uploaded bytes) instead of just erroring out
// and losing the worker's photos and remark. Flushed on next app open, on
// reconnect, and via a manual retry — not a silent background job.
const QUEUE_KEY = "jobsnap_pending_submissions_v1";

type QueuedSubmission =
  | { id: string; kind: "task"; args: SubmitUpdateArgs; queuedAt: string; label: string }
  | { id: string; kind: "stop"; args: SubmitStopUpdateArgs; queuedAt: string; label: string };

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

async function readQueue(): Promise<QueuedSubmission[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedSubmission[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueuedSubmission[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function isOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return !!state.isConnected && state.isInternetReachable !== false;
  } catch {
    return true; // don't block a submission just because the check itself failed
  }
}

export async function queueTaskSubmission(args: SubmitUpdateArgs, label: string) {
  const queue = await readQueue();
  queue.push({ id: makeId(), kind: "task", args, queuedAt: new Date().toISOString(), label });
  await writeQueue(queue);
}

export async function queueStopSubmission(args: SubmitStopUpdateArgs, label: string) {
  const queue = await readQueue();
  queue.push({ id: makeId(), kind: "stop", args, queuedAt: new Date().toISOString(), label });
  await writeQueue(queue);
}

export async function getPendingSubmissions(): Promise<QueuedSubmission[]> {
  return readQueue();
}

export async function getPendingCount(): Promise<number> {
  return (await readQueue()).length;
}

// Attempts to send every queued submission in order; removes each on
// success, leaves failures (still offline, or a real error) queued for
// next time.
export async function flushQueue(): Promise<{ sent: number; remaining: number }> {
  const queue = await readQueue();
  if (queue.length === 0) return { sent: 0, remaining: 0 };

  const stillPending: QueuedSubmission[] = [];
  let sent = 0;
  for (const item of queue) {
    try {
      if (item.kind === "task") {
        await submitUpdate(item.args);
      } else {
        await submitStopUpdate(item.args);
      }
      sent++;
    } catch {
      stillPending.push(item);
    }
  }
  await writeQueue(stillPending);
  return { sent, remaining: stillPending.length };
}
