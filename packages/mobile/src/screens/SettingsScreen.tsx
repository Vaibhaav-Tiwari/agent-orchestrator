import { StyleSheet, Text, TextInput, View } from "react-native";
import { useEffect, useState } from "react";
import { ActionButton } from "../components/ActionButton";
import type { DaemonController } from "../hooks/useDaemon";
import { colors, radii } from "../theme";

export function SettingsScreen({ controller }: { controller: DaemonController }) {
  const [daemonUrl, setDaemonUrl] = useState(controller.settings.daemonUrl);
  useEffect(() => setDaemonUrl(controller.settings.daemonUrl), [controller.settings.daemonUrl]);
  return (
    <View style={styles.stack}>
      <View style={styles.panel}>
        <Text style={styles.label}>Daemon URL</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          onChangeText={setDaemonUrl}
          placeholder="http://192.168.1.20:34115"
          placeholderTextColor={colors.passive}
          style={styles.input}
          value={daemonUrl}
        />
        <Text style={styles.help}>Use a LAN-reachable daemon URL. Phones cannot reach the desktop daemon through 127.0.0.1.</Text>
        <View style={styles.actions}>
          <ActionButton label={controller.busyAction === "saveSettings" ? "Saving" : "Save"} disabled={controller.busyAction === "saveSettings"} onPress={() => void controller.updateSettings({ daemonUrl })} />
          <ActionButton label="Refresh" secondary disabled={!controller.isConfigured || controller.isRefreshing} onPress={() => void controller.refresh()} />
        </View>
      </View>
      <View style={styles.panel}>
        <Text style={styles.label}>Diagnostics</Text>
        <Text style={styles.value}>Normalized: {controller.normalizedDaemonUrl || "not configured"}</Text>
        <Text style={styles.value}>Projects: {controller.projects.length}</Text>
        <Text style={styles.value}>Sessions: {controller.sessions.length}</Text>
        {controller.error ? <Text style={styles.error}>{controller.error}</Text> : null}
        {controller.actionError ? <Text style={styles.error}>{controller.actionError}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
  },
  panel: {
    gap: 9,
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
  help: {
    color: colors.passive,
    fontSize: 12,
    lineHeight: 18,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  value: {
    color: colors.muted,
    fontFamily: "Courier",
    fontSize: 11,
  },
  error: {
    color: colors.error,
    fontSize: 12,
    lineHeight: 18,
  },
});
