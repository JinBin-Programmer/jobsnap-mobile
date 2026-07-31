// Subset of the web app's lib/types.ts — only what the worker app needs.
// These mirror the shared Supabase tables exactly.

export type TaskStatus =
  | "pending"
  | "in_progress"
  | "on_hold"
  | "completed"
  | "verified"
  | "cancelled";
// "verified" is boss-only, set from the web dashboard after reviewing a
// completed job's proof — never offer it as a worker-settable status.
export const WORKER_SETTABLE_STATUSES: TaskStatus[] = [
  "pending",
  "in_progress",
  "on_hold",
  "completed",
];
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type MediaType = "photo" | "video";

export interface Profile {
  id: string;
  org_id: string | null;
  full_name: string | null;
  email: string | null;
  role: "owner" | "admin" | "worker";
}

export interface Task {
  id: string;
  org_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  expected_start: string | null;
  expected_end: string | null;
  location_address: string | null;
  location_lat: number | null;
  location_lng: number | null;
  upload_radius_m: number;
  self_created: boolean;
  has_stops: boolean;
  // joined for display
  client_name?: string | null;
  job_type_name?: string | null;
}

// One stop within a multi-stop ("delivery run") task — its own pin, its own
// geofence radius, its own done/not-done state. Mirrors the web app's
// TaskStop (supabase/task-stops.sql).
export interface TaskStop {
  id: string;
  org_id: string;
  task_id: string;
  label: string;
  address: string | null;
  lat: number;
  lng: number;
  radius_m: number;
  notes: string | null;
  is_done: boolean;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
}

export interface TaskUpdate {
  id: string;
  task_id: string;
  remark: string | null;
  status: TaskStatus | null;
  lat: number | null;
  lng: number | null;
  checkin_id: string | null;
  stop_id: string | null;
  created_at: string;
}

export interface TaskCheckin {
  id: string;
  org_id: string;
  task_id: string;
  worker_id: string;
  checked_in_at: string;
  checked_out_at: string | null;
}

export interface JobType {
  id: string;
  name: string;
}

export interface Client {
  id: string;
  name: string;
}

export interface MyMedia {
  id: string;
  task_id: string;
  task_title: string;
  storage_path: string;
  type: MediaType;
  size_bytes: number;
  created_at: string;
  url: string | null;
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  on_hold: "On Hold",
  completed: "Completed",
  verified: "Verified",
  cancelled: "Cancelled",
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};
