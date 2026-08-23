// JobSnap mobile design tokens — mirrors the web dashboard's dark theme
// (jobsnap/app/globals.css .dark block + jobsnap/lib/status-colors.ts) so
// the two apps look like one product. Dark surfaces (near-black background,
// raised dark cards) with the brand's Steel Blue as the primary accent —
// Iron Grey (the old light-mode primary) reads almost flat against a
// near-black background (~1.5:1 contrast), so dark mode promotes Steel Blue
// instead, which already carries ~4:1+ contrast against both the dark
// surfaces and white button text. Several buttons below hardcode white text
// rather than deriving it, which is why primary stays a mid-tone fill
// instead of a light one — a light fill would break every one of them.
import type { TaskStatus, TaskPriority } from "./types";

export const colors = {
  primary: "#4C7A94",
  primaryHover: "#5F8FAB",
  steel: "#4C7A94",
  icy: "#A9CEF4",

  background: "#0E0F11",
  card: "#17181B",
  cardRaised: "#1C1D21",

  border: "#26282C",
  borderStrong: "#34373C",
  divider: "#232529",
  inputBorder: "#34373C",

  ink: "#F2F2F2",
  body: "#C7CBCE",
  muted: "#9BA1A6",

  success: "#2F7D5A",
  successBg: "#1A3327",
  successFg: "#6FCB9B",
  successBorder: "#2F6B4C",

  danger: "#B0432E",
  dangerBg: "#3A2721",
  dangerFg: "#E29483",
  dangerBorder: "#7A4238",
} as const;

// Exact hex pairs mirroring the web app's dark-mode status colors (app/globals.css
// .dark block) so status pills look identical cross-platform.
export const STATUS_COLORS: Record<TaskStatus, { bg: string; fg: string }> = {
  pending: { bg: "#35312A", fg: "#D8CFC0" },
  in_progress: { bg: "#1C3049", fg: "#8FB8DE" },
  on_hold: { bg: "#423922", fg: "#86BCDA" },
  completed: { bg: "#1A3327", fg: "#6FCB9B" },
  verified: { bg: "#182B3D", fg: "#8FC3EA" },
  cancelled: { bg: "#3A2721", fg: "#E29483" },
};

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: "#9AA7AD",
  medium: "#7FB2D0",
  high: "#E3B15C",
  urgent: "#E2745C",
};

// 4px base — one scale used everywhere instead of ad-hoc padding/margin
// numbers, so rhythm stays consistent across screens.
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

// React Native shadow props (iOS) paired with `elevation` (Android) — three
// tiers instead of the one-off shadow values that used to be copy-pasted
// per screen. Shadow color is a cool near-black matching the dark surfaces,
// not pure black, so it reads as depth rather than a smudge.
export const shadow = {
  sm: {
    shadowColor: "#05080A",
    shadowOpacity: 0.28,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  md: {
    shadowColor: "#05080A",
    shadowOpacity: 0.34,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  lg: {
    shadowColor: "#05080A",
    shadowOpacity: 0.42,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
} as const;

// A named type scale (size/weight/letterSpacing) instead of bare numbers
// scattered per screen. "mono" is reserved for what the design brief calls
// out as the one place monospace earns its keep here: real stamped data —
// GPS coordinates, timestamps, the check-in clock — not decoration.
export const type = {
  display: { fontSize: 26, fontWeight: "800" as const, letterSpacing: -0.3 },
  h1: { fontSize: 20, fontWeight: "800" as const, letterSpacing: -0.2 },
  h2: { fontSize: 15, fontWeight: "700" as const },
  label: { fontSize: 12, fontWeight: "700" as const, letterSpacing: 0.4, textTransform: "uppercase" as const },
  body: { fontSize: 14, fontWeight: "500" as const },
  bodyStrong: { fontSize: 14, fontWeight: "700" as const },
  caption: { fontSize: 12, fontWeight: "500" as const },
  mono: { fontSize: 13, fontWeight: "600" as const, fontFamily: "monospace" as const },
  monoLg: { fontSize: 28, fontWeight: "700" as const, fontFamily: "monospace" as const, letterSpacing: 0.5 },
} as const;
