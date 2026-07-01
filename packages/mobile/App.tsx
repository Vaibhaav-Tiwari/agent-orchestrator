import { StatusBar } from "expo-status-bar";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";

export default function App() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Text style={styles.eyebrow}>Agent Orchestrator</Text>
        <Text style={styles.title}>Mobile supervisor</Text>
        <Text style={styles.body}>Connect to your AO daemon to watch projects, sessions, and pull requests.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0a0b0d",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  eyebrow: {
    color: "#646a73",
    fontFamily: "System",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    marginTop: 8,
    color: "#f4f5f7",
    fontFamily: "System",
    fontSize: 28,
    fontWeight: "600",
  },
  body: {
    marginTop: 10,
    maxWidth: 320,
    color: "#9ba1aa",
    fontFamily: "System",
    fontSize: 14,
    lineHeight: 21,
  },
});
