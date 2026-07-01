import { StyleSheet, Text, View } from "react-native";
import { ActionButton } from "../components/ActionButton";
import { AppFrame } from "../components/AppFrame";
import { EmptyState } from "../components/EmptyState";
import { SessionCard } from "../components/SessionCard";
import type { DaemonController } from "../hooks/useDaemon";
import { colors } from "../theme";
import type { Session } from "../types";

const ZONES = [
  { key: "working", label: "Working" },
  { key: "action", label: "Needs you" },
  { key: "pending", label: "In review" },
  { key: "merge", label: "Ready to merge" },
  { key: "done", label: "Done / Terminated" },
] as const;

export function ProjectDetailScreen({
  controller,
  onBack,
  onNewTask,
  onOpenSession,
  projectId,
}: {
  controller: DaemonController;
  onBack: () => void;
  onNewTask: () => void;
  onOpenSession: (session: Session) => void;
  projectId: string;
}) {
  const project = controller.projects.find((item) => item.id === projectId);
  const sessions = project?.sessions ?? controller.sessions.filter((session) => (session.projectId ?? session.workspaceId) === projectId);
  return (
    <AppFrame
      eyebrow="Project"
      title={project?.name ?? projectId}
      meta={`${sessions.length} sessions`}
      actions={<ActionButton label="Back" secondary onPress={onBack} />}
    >
      <ActionButton label="New task" onPress={onNewTask} />
      {sessions.length === 0 ? (
        <EmptyState title="No sessions" body="Spawn a task to create the first worker session for this project." />
      ) : (
        ZONES.map((zone) => {
          const grouped = sessions.filter((session) => zoneForSession(session) === zone.key);
          if (grouped.length === 0) return null;
          return (
            <View key={zone.key} style={styles.zone}>
              <Text style={styles.zoneTitle}>{zone.label}</Text>
              {grouped.map((session) => (
                <SessionCard key={session.id} session={session} onPress={() => onOpenSession(session)} />
              ))}
            </View>
          );
        })
      )}
    </AppFrame>
  );
}

function zoneForSession(session: Session): (typeof ZONES)[number]["key"] {
  switch (session.status) {
    case "needs_input":
    case "ci_failed":
    case "changes_requested":
      return "action";
    case "review_pending":
    case "pr_open":
      return "pending";
    case "mergeable":
    case "approved":
      return "merge";
    case "terminated":
    case "merged":
      return "done";
    default:
      return "working";
  }
}

const styles = StyleSheet.create({
  zone: {
    gap: 9,
  },
  zoneTitle: {
    color: colors.passive,
    fontFamily: "Courier",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
});
