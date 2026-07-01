import { StyleSheet, Text, View } from "react-native";
import { colors, radii } from "../theme";

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.bg1,
    padding: 14,
  },
  title: {
    color: colors.muted,
    fontFamily: "System",
    fontSize: 13,
    fontWeight: "600",
  },
  body: {
    color: colors.passive,
    fontFamily: "System",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },
});
