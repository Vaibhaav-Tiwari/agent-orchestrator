import { useEffect, useLayoutEffect, useRef, useState } from "react";

const DEFAULT_ENTRANCE_MS = 4200;
const DEFAULT_RECENT_SPAWN_MS = 60_000;

export type SessionEntranceItem = {
	id: string;
	createdAt?: string;
};

function isRecentlyCreated(item: SessionEntranceItem, now: number, recentSpawnMs: number): boolean {
	if (!item.createdAt) return false;
	const createdAt = Date.parse(item.createdAt);
	return Number.isFinite(createdAt) && now - createdAt >= 0 && now - createdAt <= recentSpawnMs;
}

export function useNewSessionEntrances(
	sessions: readonly SessionEntranceItem[] | undefined,
	durationMs = DEFAULT_ENTRANCE_MS,
	recentSpawnMs = DEFAULT_RECENT_SPAWN_MS,
): ReadonlySet<string> {
	const knownIdsRef = useRef<Set<string> | null>(null);
	const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
	const [enteringIds, setEnteringIds] = useState<ReadonlySet<string>>(() => new Set());
	const signature = sessions?.map((session) => `${session.id}\0${session.createdAt ?? ""}`).join("\x01");

	useLayoutEffect(() => {
		if (!sessions) return;

		const knownIds = knownIdsRef.current;
		let newlyVisibleIds: string[] = [];
		if (!knownIds) {
			knownIdsRef.current = new Set(sessions.map((session) => session.id));
			const now = Date.now();
			newlyVisibleIds = sessions.filter((session) => isRecentlyCreated(session, now, recentSpawnMs)).map((session) => session.id);
		} else {
			for (const session of sessions) {
				if (!knownIds.has(session.id)) {
					newlyVisibleIds.push(session.id);
					knownIds.add(session.id);
				}
			}
		}

		if (newlyVisibleIds.length === 0) return;

		setEnteringIds((prev) => {
			const next = new Set(prev);
			for (const id of newlyVisibleIds) next.add(id);
			return next;
		});

		for (const id of newlyVisibleIds) {
			const previousTimer = timersRef.current.get(id);
			if (previousTimer) clearTimeout(previousTimer);
			const timer = setTimeout(() => {
				timersRef.current.delete(id);
				setEnteringIds((prev) => {
					if (!prev.has(id)) return prev;
					const next = new Set(prev);
					next.delete(id);
					return next;
				});
			}, durationMs);
			timersRef.current.set(id, timer);
		}
	}, [durationMs, recentSpawnMs, signature, sessions]);

	useEffect(() => {
		return () => {
			for (const timer of timersRef.current.values()) clearTimeout(timer);
			timersRef.current.clear();
		};
	}, []);

	return enteringIds;
}
