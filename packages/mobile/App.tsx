import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppFrame } from "./src/components/AppFrame";
import { useDaemonController } from "./src/hooks/useDaemon";
import { colors } from "./src/theme";
import type { Session } from "./src/types";
import { NewTaskScreen } from "./src/screens/NewTaskScreen";
import { ProjectDetailScreen } from "./src/screens/ProjectDetailScreen";
import { ProjectsScreen } from "./src/screens/ProjectsScreen";
import { PullRequestsScreen } from "./src/screens/PullRequestsScreen";
import { SessionDetailScreen } from "./src/screens/SessionDetailScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";

type Tab = "projects" | "prs" | "settings";
type Route =
  | { name: "tabs"; tab: Tab }
  | { name: "project"; projectId: string }
  | { name: "session"; sessionId: string }
  | { name: "newTask"; projectId: string };

export default function App() {
  const controller = useDaemonController();
  const [route, setRoute] = useState<Route>({ name: "tabs", tab: "projects" });

  const openProject = (projectId: string) => {
    controller.selectProject(projectId);
    setRoute({ name: "project", projectId });
  };
  const openSession = (session: Session) => {
    controller.selectSession(session.id);
    setRoute({ name: "session", sessionId: session.id });
  };
  const openNewTask = (projectId: string) => setRoute({ name: "newTask", projectId });
  const openTab = (tab: Tab) => setRoute({ name: "tabs", tab });

  useEffect(() => {
    if (!controller.isConfigured && route.name !== "tabs") setRoute({ name: "tabs", tab: "settings" });
  }, [controller.isConfigured, route.name]);

  const body =
    route.name === "project" ? (
      <ProjectDetailScreen
        controller={controller}
        onBack={() => openTab("projects")}
        onNewTask={() => openNewTask(route.projectId)}
        onOpenSession={openSession}
        projectId={route.projectId}
      />
    ) : route.name === "session" ? (
      <SessionDetailScreen controller={controller} onBack={() => openProject(controller.selectedSession?.projectId ?? controller.selectedSession?.workspaceId ?? "")} />
    ) : route.name === "newTask" ? (
      <NewTaskScreen controller={controller} onBack={() => openProject(route.projectId)} projectId={route.projectId} />
    ) : (
      <AppFrame title={titleForTab(route.tab)} eyebrow="Agent Orchestrator" meta={controller.normalizedDaemonUrl || "No daemon configured"}>
        <Tabs active={route.tab} onPress={openTab} />
        {route.tab === "projects" ? (
          <ProjectsScreen controller={controller} onOpenProject={openProject} />
        ) : route.tab === "prs" ? (
          <PullRequestsScreen
            controller={controller}
            onOpenSession={(sessionId) => {
              controller.selectSession(sessionId);
              setRoute({ name: "session", sessionId });
            }}
          />
        ) : (
          <SettingsScreen controller={controller} />
        )}
      </AppFrame>
    );

  return body;
}

function titleForTab(tab: Tab): string {
  switch (tab) {
    case "projects":
      return "Projects";
    case "prs":
      return "Pull Requests";
    case "settings":
      return "Settings";
  }
}

function Tabs({ active, onPress }: { active: Tab; onPress: (tab: Tab) => void }) {
  return (
    <View style={styles.tabs}>
      {(["projects", "prs", "settings"] as const).map((tab) => (
        <Pressable key={tab} onPress={() => onPress(tab)} style={[styles.tab, active === tab && styles.activeTab]}>
          <Text style={[styles.tabLabel, active === tab && styles.activeTabLabel]}>{titleForTab(tab)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 2,
  },
  tab: {
    minHeight: 32,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 6,
    backgroundColor: colors.bg1,
  },
  activeTab: {
    borderColor: "rgba(77, 141, 255, 0.6)",
    backgroundColor: "rgba(77, 141, 255, 0.14)",
  },
  tabLabel: {
    color: colors.passive,
    fontFamily: "Courier",
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  activeTabLabel: {
    color: colors.accent,
  },
});
