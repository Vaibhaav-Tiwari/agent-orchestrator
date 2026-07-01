import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii } from "../theme";
import type { Project } from "../types";
import { StatusPill } from "./StatusPill";

export function ProjectCard({ project, onPress }: { project: Project; onPress: () => void }) {
  const sessions = project.sessions ?? [];
  const active = sessions.filter((session) => session.status !== "terminated" && session.status !== "merged").length;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.row}>
        <View style={styles.titleBlock}>
          <Text numberOfLines={1} style={styles.title}>
            {project.name || project.id}
          </Text>
          {project.path ? (
            <Text numberOfLines={1} style={styles.path}>
              {project.path}
            </Text>
          ) : null}
        </View>
        <StatusPill label={`${active} active`} tone={active > 0 ? "working" : "muted"} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.bg1,
    padding: 13,
  },
  pressed: {
    borderColor: colors.borderStrong,
    backgroundColor: colors.bg2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  titleBlock: {
    minWidth: 0,
    flex: 1,
  },
  title: {
    color: colors.fg,
    fontFamily: "System",
    fontSize: 14,
    fontWeight: "600",
  },
  path: {
    color: colors.passive,
    fontFamily: "Courier",
    fontSize: 11,
    marginTop: 4,
  },
});
