import { StyleSheet, Text, TextInput, View } from "react-native";
import { useState } from "react";
import { ActionButton } from "../components/ActionButton";
import { AppFrame } from "../components/AppFrame";
import type { DaemonController } from "../hooks/useDaemon";
import { colors, radii } from "../theme";

export function NewTaskScreen({ controller, onBack, projectId }: { controller: DaemonController; onBack: () => void; projectId: string }) {
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const canSubmit = title.trim().length > 0 && prompt.trim().length > 0 && controller.busyAction !== "createTask";
  const submit = async () => {
    const session = await controller.createTask(projectId, { title: title.trim(), prompt: prompt.trim() });
    if (session) onBack();
  };
  return (
    <AppFrame title="New task" eyebrow="Spawn worker" actions={<ActionButton label="Back" secondary onPress={onBack} />}>
      <View style={styles.panel}>
        <Text style={styles.label}>Name</Text>
        <TextInput value={title} onChangeText={setTitle} placeholder="write-tests" placeholderTextColor={colors.passive} style={styles.input} />
        <Text style={styles.label}>Prompt</Text>
        <TextInput
          multiline
          value={prompt}
          onChangeText={setPrompt}
          placeholder="Describe the focused task for the worker."
          placeholderTextColor={colors.passive}
          style={[styles.input, styles.textarea]}
        />
        <ActionButton label={controller.busyAction === "createTask" ? "Spawning" : "Spawn worker"} disabled={!canSubmit} onPress={() => void submit()} />
      </View>
      {controller.actionError ? <Text style={styles.error}>{controller.actionError}</Text> : null}
    </AppFrame>
  );
}

const styles = StyleSheet.create({
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
  textarea: {
    minHeight: 120,
    paddingTop: 10,
    textAlignVertical: "top",
  },
  error: {
    color: colors.error,
    fontSize: 12,
  },
});
