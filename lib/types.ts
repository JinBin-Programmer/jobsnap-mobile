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
  amount_collected: number | null;
  created_at: string;
}

// Where a check-in happened relative to the task's site pin. A check-in made
// off-site is optimistic: it starts immediately as 'remote_pending' and only
// flips to 'remote_approved'/'remote_rejected' once a manager reviews it on
// the web dashboard — see supabase/attendance.sql.
export type CheckinLocationStatus = "on_site" | "no_site_set" | "remote_pending" | "remote_approved" | "remote_rejected";

export interface TaskCheckin {
  id: string;
  org_id: string;
  task_id: string;
  worker_id: string;
  checked_in_at: string;
  checked_out_at: string | null;
  location_status: CheckinLocationStatus;
  check_in_distance_m: number | null;
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

// KPI tracking — see supabase/kpi.sql. One row per worker, as returned by
// the kpi_progress() RPC (a worker's own session only ever gets their own
// row). Mirrors the web app's KpiProgressRow.
export type KpiPeriod = "daily" | "weekly" | "monthly";

export interface KpiProgressRow {
  worker_id: string;
  full_name: string | null;
  task_enabled: boolean;
  task_period: KpiPeriod;
  task_target: number | null;
  task_achieved: number;
  task_bonus: number;
  money_enabled: boolean;
  money_period: KpiPeriod;
  money_target: number | null;
  money_achieved: number;
  money_bonus: number;
  hours_enabled: boolean;
  hours_period: KpiPeriod;
  hours_target: number | null;
  hours_achieved: number;
  hours_bonus: number;
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
