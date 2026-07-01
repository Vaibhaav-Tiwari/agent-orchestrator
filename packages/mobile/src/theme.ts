export const colors = {
  bg: "#0a0b0d",
  bg1: "#15171b",
  bg2: "#1c1f24",
  border: "rgba(255, 255, 255, 0.09)",
  borderStrong: "rgba(255, 255, 255, 0.16)",
  fg: "#f4f5f7",
  muted: "#9ba1aa",
  passive: "#646a73",
  accent: "#4d8dff",
  working: "#f59f4c",
  warning: "#e8c14a",
  success: "#74b98a",
  error: "#ef6b6b",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const radii = {
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
} as const;

export const typography = {
  mono: "Courier",
  system: "System",
} as const;

export type StatusTone = "working" | "warning" | "success" | "error" | "muted";

export function statusColor(tone: StatusTone): string {
  switch (tone) {
    case "working":
      return colors.working;
    case "warning":
      return colors.warning;
    case "success":
      return colors.success;
    case "error":
      return colors.error;
    case "muted":
      return colors.passive;
  }
}
