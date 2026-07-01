import { Pressable, StyleSheet, Text, View } from "react-native";
import { EmptyState } from "../components/EmptyState";
import { StatusPill } from "../components/StatusPill";
import type { DaemonController } from "../hooks/useDaemon";
import { colors, radii } from "../theme";

export function PullRequestsScreen({ controller, onOpenSession }: { controller: DaemonController; onOpenSession: (sessionId: string) => void }) {
  if (!controller.isConfigured) {
    return <EmptyState title="Daemon URL required" body="Configure the daemon before loading pull requests." />;
  }
  if (controller.pullRequests.length === 0) {
    return <EmptyState title="No pull requests" body="PRs linked to sessions will appear here." />;
  }
  return (
    <View style={styles.stack}>
      {controller.pullRequests.map((pr) => (
        <Pressable key={`${pr.sessionId}-${pr.url ?? pr.number}`} onPress={() => pr.sessionId && onOpenSession(pr.sessionId)} style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.title}>#{pr.number ?? "?"} {pr.title ?? pr.url ?? "Pull request"}</Text>
            <StatusPill label={pr.status ?? pr.state ?? "open"} tone={pr.status === "ci_failed" ? "error" : pr.status === "mergeable" ? "success" : "muted"} />
          </View>
          <Text style={styles.meta}>{pr.projectName ?? pr.projectId ?? "project"} · {pr.url ?? "no url"}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 10,
  },
  card: {
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.bg1,
    padding: 12,
  },
  row: {
    gap: 8,
  },
  title: {
    color: colors.fg,
    fontFamily: "System",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  meta: {
    color: colors.passive,
    fontFamily: "Courier",
    fontSize: 10,
  },
});
