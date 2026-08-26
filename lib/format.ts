// Shared date formatting so the Jobs list and Gallery don't each grow their
// own slightly-different version. "12 Aug" — no year, everything shown here
// is recent enough that the year is implied.
export function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// Plain YYYY-MM-DD for comparing against a task's expected_end (a date, not
// a timestamp) — mirrors the string comparison the web dashboard's overdue
// query already uses (app/dashboard/page.tsx), so "overdue" means the same
// thing on both apps.
export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}
