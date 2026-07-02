import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { sessionTitle } from "../../lib/api";
import { useApp } from "../../lib/store";
import { statusVisual, theme } from "../../lib/theme";
import { Button, Dot } from "../../lib/ui";

export default function SessionScreen() {
	const { id } = useLocalSearchParams<{ id: string; projectId?: string }>();
	const router = useRouter();
	const { sessions, kill } = useApp();
	const [busy, setBusy] = useState(false);

	const session = sessions.find((s) => s.id === id);
	const v = statusVisual(session?.status);
	const title = session ? sessionTitle(session) : (id ?? "Session");

	const onKill = () => {
		if (!id) return;
		Alert.alert("Kill session?", `Terminate ${id}. This cannot be undone.`, [
			{ text: "Cancel", style: "cancel" },
			{
				text: "Kill",
				style: "destructive",
				onPress: async () => {
					setBusy(true);
					try {
						await kill(id);
						router.back();
					} catch (e) {
						Alert.alert("Kill failed", e instanceof Error ? e.message : "Unknown error");
						setBusy(false);
					}
				},
			},
		]);
	};

	return (
		<View style={styles.screen}>
			<Stack.Screen options={{ title }} />

			<View style={styles.statusRow}>
				<Dot color={v.color} breathing={v.breathing} size={8} />
				<Text style={[styles.status, { color: v.color }]}>{v.label}</Text>
				<View style={{ flex: 1 }} />
				<Text style={styles.id}>{id}</Text>
			</View>

			<View style={styles.placeholder}>
				<View style={styles.icon}>
					<Feather name="terminal" size={26} color={theme.textTertiary} />
				</View>
				<Text style={styles.phTitle}>Live terminal coming soon</Text>
				<Text style={styles.phMsg}>
					The interactive terminal isn't available on mobile yet. You can still kill this session below.
				</Text>
			</View>

			<View style={styles.actions}>
				<Button title="Kill session" variant="danger" icon="x" loading={busy} onPress={onKill} />
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	screen: { flex: 1, backgroundColor: theme.bgBase, padding: 16 },
	statusRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: theme.borderSubtle,
	},
	status: { fontSize: 13, fontWeight: "600" },
	id: { color: theme.textTertiary, fontSize: 12, fontFamily: theme.fontMono },
	placeholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
	icon: {
		width: 64,
		height: 64,
		borderRadius: 18,
		backgroundColor: theme.bgElevated,
		borderWidth: 1,
		borderColor: theme.borderSubtle,
		alignItems: "center",
		justifyContent: "center",
		marginBottom: 6,
	},
	phTitle: { color: theme.textPrimary, fontSize: 17, fontWeight: "700", textAlign: "center" },
	phMsg: {
		color: theme.textSecondary,
		fontSize: 13,
		lineHeight: 20,
		textAlign: "center",
		maxWidth: 300,
	},
	actions: { paddingBottom: 8 },
});
