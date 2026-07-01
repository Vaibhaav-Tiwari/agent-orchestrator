import type { ReactNode } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { colors } from "../theme";

type AppFrameProps = {
  eyebrow?: string;
  title: string;
  meta?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function AppFrame({ eyebrow, title, meta, actions, children }: AppFrameProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.header}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <View style={styles.titleRow}>
          <View style={styles.titleBlock}>
            <Text numberOfLines={1} style={styles.title}>
              {title}
            </Text>
            {meta ? <Text style={styles.meta}>{meta}</Text> : null}
          </View>
          {actions}
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 10,
  },
  eyebrow: {
    color: colors.passive,
    fontFamily: "Courier",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.1,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  titleBlock: {
    minWidth: 0,
    flex: 1,
  },
  title: {
    color: colors.fg,
    fontFamily: "System",
    fontSize: 22,
    fontWeight: "600",
  },
  meta: {
    color: colors.passive,
    fontFamily: "Courier",
    fontSize: 11,
    marginTop: 3,
  },
  content: {
    gap: 12,
    padding: 14,
    paddingBottom: 28,
  },
});
