import { StyleSheet, Text, View } from "react-native";
import { colors, radii, statusColor, type StatusTone } from "../theme";
import type { SessionStatus } from "../types";

export function toneForStatus(status?: SessionStatus): StatusTone {
  switch (status) {
    case "working":
      return "working";
    case "needs_input":
    case "changes_requested":
    case "review_pending":
      return "warning";
    case "mergeable":
    case "approved":
    case "merged":
      return "success";
    case "ci_failed":
      return "error";
    default:
      return "muted";
  }
}

export function StatusPill({ label, tone = "muted" }: { label: string; tone?: StatusTone }) {
  const color = statusColor(tone);
  return (
    <View style={[styles.pill, { borderColor: `${color}66`, backgroundColor: `${color}1f` }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.md,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  dot: {
    height: 6,
    width: 6,
    borderRadius: 99,
  },
  label: {
    fontFamily: "Courier",
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
  },
});
