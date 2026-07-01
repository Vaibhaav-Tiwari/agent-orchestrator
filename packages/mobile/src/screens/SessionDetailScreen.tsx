import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { useEffect, useState } from "react";
import { ActionButton } from "../components/ActionButton";
import { AppFrame } from "../components/AppFrame";
import { EmptyState } from "../components/EmptyState";
import { sessionTitle } from "../components/SessionCard";
import { StatusPill, toneForStatus } from "../components/StatusPill";
import type { DaemonController } from "../hooks/useDaemon";
import { colors, radii } from "../theme";

export function SessionDetailScreen({ controller, onBack }: { controller: DaemonController; onBack: () => void }) {
  const session = controller.selectedSession;
  const [name, setName] = useState("");

  useEffect(() => {
    if (session) setName(sessionTitle(session));
  }, [session]);

  if (!session) {
    return (
      <AppFrame title="Session" eyebrow="Missing" actions={<ActionButton label="Back" secondary onPress={onBack} />}>
        <EmptyState title="Session not found" body="Refresh projects and open the session again." />
      </AppFrame>
    );
  }

  const saveName = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== sessionTitle(session)) void controller.renameSession(session.id, trimmed);
  };
  const confirmKill = () => {
    Alert.alert("Kill session?", "This stops the runtime for this session.", [
      { text: "Cancel", style: "cancel" },
      { text: "Kill", style: "destructive", onPress: () => void controller.killSession(session.id) },
    ]);
  };

  return (
    <AppFrame title={sessionTitle(session)} eyebrow={session.kind ?? "Session"} meta={session.branch} actions={<ActionButton label="Back" secondary onPress={onBack} />}>
      <StatusPill label={session.status ?? "idle"} tone={toneForStatus(session.status)} />
      <View style={styles.panel}>
        <Text style={styles.label}>Display name</Text>
        <TextInput value={name} onChangeText={setName} placeholderTextColor={colors.passive} style={styles.input} />
        <ActionButton label={controller.busyAction === "renameSession" ? "Saving" : "Save name"} disabled={controller.busyAction === "renameSession"} onPress={saveName} />
      </View>
      <View style={styles.panel}>
        <Text style={styles.label}>Runtime</Text>
        <Text style={styles.value}>{session.provider ?? session.harness ?? "agent"} · {session.terminalHandleId ?? session.id}</Text>
        <View style={styles.actions}>
          <ActionButton label="Mark idle" secondary disabled={controller.busyAction === "stopSession"} onPress={() => void controller.stopSession(session.id)} />
          <ActionButton label="Kill" destructive disabled={controller.busyAction === "killSession"} onPress={confirmKill} />
        </View>
      </View>
      <View style={styles.panel}>
        <Text style={styles.label}>Pull requests</Text>
        {(session.prs ?? []).length === 0 ? (
          <Text style={styles.value}>No PR linked yet.</Text>
        ) : (
          (session.prs ?? []).map((pr) => (
            <Text key={pr.url ?? pr.id ?? pr.number} style={styles.value}>
              #{pr.number ?? "?"} · {pr.status ?? pr.state ?? "open"} · {pr.title ?? pr.url}
            </Text>
          ))
        )}
      </View>
      {controller.actionError ? <Text style={styles.error}>{controller.actionError}</Text> : null}
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.bg1,
    padding: 12,
  },
  label: {
    color: colors.passive,
    fontFamily: "Courier",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  input: {
    minHeight: 38,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    color: colors.fg,
    paddingHorizontal: 10,
  },
  value: {
    color: colors.muted,
    fontFamily: "System",
    fontSize: 12,
    lineHeight: 18,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  error: {
    color: colors.error,
    fontSize: 12,
  },
});
