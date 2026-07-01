import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { ActionButton } from "../components/ActionButton";
import { EmptyState } from "../components/EmptyState";
import { ProjectCard } from "../components/ProjectCard";
import type { DaemonController } from "../hooks/useDaemon";
import { colors } from "../theme";

export function ProjectsScreen({ controller, onOpenProject }: { controller: DaemonController; onOpenProject: (projectId: string) => void }) {
  if (!controller.isConfigured) {
    return <EmptyState title="Daemon URL required" body="Open Settings and enter the reachable AO daemon URL for this phone." />;
  }
  if (controller.isLoading) {
    return <Loading label="Loading projects" />;
  }
  return (
    <View style={styles.stack}>
      <View style={styles.toolbar}>
        <Text style={styles.meta}>{controller.projects.length} projects</Text>
        <ActionButton label={controller.isRefreshing ? "Refreshing" : "Refresh"} secondary disabled={controller.isRefreshing} onPress={() => void controller.refresh()} />
      </View>
      {controller.error ? <Text style={styles.error}>{controller.error}</Text> : null}
      {controller.projects.length === 0 ? (
        <EmptyState title="No projects" body="Register projects from the desktop or CLI, then refresh this app." />
      ) : (
        controller.projects.map((project) => <ProjectCard key={project.id} project={project} onPress={() => onOpenProject(project.id)} />)
      )}
    </View>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.accent} />
      <Text style={styles.meta}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  meta: {
    color: colors.passive,
    fontFamily: "Courier",
    fontSize: 11,
  },
  error: {
    color: colors.error,
    fontFamily: "System",
    fontSize: 12,
    lineHeight: 18,
  },
  loading: {
    alignItems: "center",
    gap: 10,
    padding: 18,
  },
});
