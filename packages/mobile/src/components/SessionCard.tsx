import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii } from "../theme";
import type { Session } from "../types";
import { StatusPill, toneForStatus } from "./StatusPill";

export function sessionTitle(session: Session): string {
  return session.displayName || session.title || session.id;
}

export function SessionCard({ session, onPress }: { session: Session; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.header}>
        <StatusPill label={session.status ?? "idle"} tone={toneForStatus(session.status)} />
        <Text style={styles.agent}>{session.provider ?? session.harness ?? "agent"}</Text>
      </View>
      <Text numberOfLines={2} style={styles.title}>
        {sessionTitle(session)}
      </Text>
      {session.branch ? <Text style={styles.branch}>{session.branch}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.bg1,
    padding: 12,
  },
  pressed: {
    borderColor: colors.borderStrong,
    backgroundColor: colors.bg2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 9,
  },
  agent: {
    color: colors.passive,
    fontFamily: "Courier",
    fontSize: 10,
    textTransform: "uppercase",
  },
  title: {
    color: colors.fg,
    fontFamily: "System",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 19,
  },
  branch: {
    color: colors.passive,
    fontFamily: "Courier",
    fontSize: 11,
    marginTop: 7,
  },
});
