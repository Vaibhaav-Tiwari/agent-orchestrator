import { useCallback, useEffect, useMemo, useState } from "react";
import { createDaemonClient, formatApiError, normalizeDaemonUrl } from "../api/client";
import { loadSettings, saveSettings } from "../storage/settings";
import type { CreateTaskInput, DaemonSnapshot, MobileSettings, Project, PullRequestSummary, Session } from "../types";

type MutationName = "createTask" | "renameSession" | "stopSession" | "killSession" | "saveSettings";

export type DaemonController = {
  settings: MobileSettings;
  normalizedDaemonUrl: string;
  projects: Project[];
  sessions: Session[];
  pullRequests: PullRequestSummary[];
  selectedProject?: Project;
  selectedSession?: Session;
  isConfigured: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  actionError: string | null;
  busyAction: MutationName | null;
  selectProject: (projectId: string | null) => void;
  selectSession: (sessionId: string | null) => void;
  refresh: () => Promise<void>;
  updateSettings: (settings: MobileSettings) => Promise<void>;
  createTask: (projectId: string, input: CreateTaskInput) => Promise<Session | null>;
  renameSession: (sessionId: string, name: string) => Promise<Session | null>;
  stopSession: (sessionId: string) => Promise<Session | null>;
  killSession: (sessionId: string) => Promise<Session | null>;
};

const emptySnapshot: DaemonSnapshot = { projects: [], sessions: [], pullRequests: [] };

export function useDaemonController(): DaemonController {
  const [settings, setSettings] = useState<MobileSettings>({ daemonUrl: "" });
  const [snapshot, setSnapshot] = useState<DaemonSnapshot>(emptySnapshot);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<MutationName | null>(null);

  const normalizedDaemonUrl = normalizeDaemonUrl(settings.daemonUrl);
  const client = useMemo(() => createDaemonClient(normalizedDaemonUrl), [normalizedDaemonUrl]);
  const isConfigured = normalizedDaemonUrl.length > 0;

  const refresh = useCallback(async () => {
    if (!normalizedDaemonUrl) {
      setSnapshot(emptySnapshot);
      setError(null);
      setIsLoading(false);
      return;
    }
    setIsRefreshing(true);
    try {
      setSnapshot(await client.snapshot());
      setError(null);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [client, normalizedDaemonUrl]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const loaded = await loadSettings();
      if (cancelled) return;
      setSettings(loaded);
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const updateSettings = useCallback(
    async (nextSettings: MobileSettings) => {
      setBusyAction("saveSettings");
      setActionError(null);
      try {
        const normalized = { daemonUrl: normalizeDaemonUrl(nextSettings.daemonUrl) };
        await saveSettings(normalized);
        setSettings(normalized);
      } catch (err) {
        setActionError(formatApiError(err));
      } finally {
        setBusyAction(null);
      }
    },
    [],
  );

  const runMutation = useCallback(
    async <T,>(name: MutationName, action: () => Promise<T>): Promise<T | null> => {
      setBusyAction(name);
      setActionError(null);
      try {
        const result = await action();
        await refresh();
        return result;
      } catch (err) {
        setActionError(formatApiError(err));
        return null;
      } finally {
        setBusyAction(null);
      }
    },
    [refresh],
  );

  const selectedProject = snapshot.projects.find((project) => project.id === selectedProjectId) ?? snapshot.projects[0];
  const selectedSession = snapshot.sessions.find((session) => session.id === selectedSessionId);

  return {
    settings,
    normalizedDaemonUrl,
    projects: snapshot.projects,
    sessions: snapshot.sessions,
    pullRequests: snapshot.pullRequests,
    selectedProject,
    selectedSession,
    isConfigured,
    isLoading,
    isRefreshing,
    error,
    actionError,
    busyAction,
    selectProject: setSelectedProjectId,
    selectSession: setSelectedSessionId,
    refresh,
    updateSettings,
    createTask: (projectId, input) => runMutation("createTask", () => client.createTask(projectId, input)),
    renameSession: (sessionId, name) => runMutation("renameSession", () => client.renameSession(sessionId, name)),
    stopSession: (sessionId) => runMutation("stopSession", () => client.stopSession(sessionId)),
    killSession: (sessionId) => runMutation("killSession", () => client.killSession(sessionId)),
  };
}
