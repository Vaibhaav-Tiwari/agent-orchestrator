import type { CreateTaskInput, DaemonSnapshot, Project, PullRequestSummary, Session } from "../types";

type ErrorEnvelope = {
  error?: {
    code?: string;
    message?: string;
    requestId?: string;
  };
  requestId?: string;
  message?: string;
};

export class DaemonApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly requestId?: string;

  constructor(message: string, status: number, code?: string, requestId?: string) {
    super(message);
    this.name = "DaemonApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

export type DaemonClient = {
  readonly baseUrl: string;
  getWorkspaces: () => Promise<Project[]>;
  getSessions: (projectId?: string) => Promise<Session[]>;
  getSession: (sessionId: string) => Promise<Session>;
  getPullRequests: () => Promise<PullRequestSummary[]>;
  createTask: (projectId: string, input: CreateTaskInput) => Promise<Session>;
  renameSession: (sessionId: string, name: string) => Promise<Session>;
  stopSession: (sessionId: string) => Promise<Session>;
  killSession: (sessionId: string) => Promise<Session>;
  snapshot: () => Promise<DaemonSnapshot>;
};

export function normalizeDaemonUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  return withProtocol.replace(/\/+$/, "");
}

export function formatApiError(error: unknown): string {
  if (error instanceof DaemonApiError) {
    const suffix = error.requestId ? ` (${error.requestId})` : "";
    return `${error.message}${suffix}`;
  }
  if (error instanceof TypeError) return "Could not reach the daemon. Check the URL and network.";
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

export function createDaemonClient(baseUrlInput: string): DaemonClient {
  const baseUrl = normalizeDaemonUrl(baseUrlInput);
  const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
    if (!baseUrl) throw new DaemonApiError("Daemon URL is not configured.", 0, "NO_DAEMON_URL");
    const response = await fetch(`${baseUrl}/api/v1${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
    const text = await response.text();
    const body = parseJson(text);
    if (!response.ok) throw toApiError(response.status, body);
    return body as T;
  };

  const getWorkspaces = async () => {
    const body = await request<{ projects?: Project[] }>("/projects");
    return body.projects ?? [];
  };

  const getSessions = async (projectId?: string) => {
    const suffix = projectId ? `?project=${encodeURIComponent(projectId)}` : "";
    const body = await request<{ sessions?: Session[] }>(`/sessions${suffix}`);
    return body.sessions ?? [];
  };

  const getSession = async (sessionId: string) => {
    const body = await request<{ session?: Session }>(`/sessions/${encodeURIComponent(sessionId)}`);
    if (!body.session) throw new DaemonApiError("Session was not returned by the daemon.", 502, "MISSING_SESSION");
    return body.session;
  };

  const getPullRequests = async () => {
    const sessions = await getSessions();
    return sessions.flatMap((session) =>
      (session.prs ?? []).map((pr) => ({
        ...pr,
        sessionId: session.id,
        projectId: session.projectId ?? session.workspaceId,
        projectName: session.workspaceName,
      })),
    );
  };

  return {
    baseUrl,
    getWorkspaces,
    getSessions,
    getSession,
    getPullRequests,
    createTask: async (projectId, input) => {
      const body = await request<{ session?: Session }>("/sessions", {
        method: "POST",
        body: JSON.stringify({
          projectId,
          kind: "worker",
          harness: input.harness ?? "codex",
          displayName: input.title,
          prompt: input.prompt,
        }),
      });
      if (!body.session) throw new DaemonApiError("Created session was not returned by the daemon.", 502, "MISSING_SESSION");
      return body.session;
    },
    renameSession: async (sessionId, name) => {
      const body = await request<{ session?: Session }>(`/sessions/${encodeURIComponent(sessionId)}`, {
        method: "PATCH",
        body: JSON.stringify({ displayName: name }),
      });
      if (!body.session) throw new DaemonApiError("Renamed session was not returned by the daemon.", 502, "MISSING_SESSION");
      return body.session;
    },
    stopSession: async (sessionId) => {
      const body = await request<{ session?: Session }>(`/sessions/${encodeURIComponent(sessionId)}/activity`, {
        method: "POST",
        body: JSON.stringify({ state: "idle" }),
      });
      return body.session ?? getSession(sessionId);
    },
    killSession: async (sessionId) => {
      const body = await request<{ session?: Session }>(`/sessions/${encodeURIComponent(sessionId)}/kill`, { method: "POST" });
      return body.session ?? getSession(sessionId);
    },
    snapshot: async () => {
      const [projects, sessions] = await Promise.all([getWorkspaces(), getSessions()]);
      const sessionsByProject = new Map<string, Session[]>();
      for (const session of sessions) {
        const projectId = session.projectId ?? session.workspaceId ?? "";
        if (!projectId) continue;
        const group = sessionsByProject.get(projectId) ?? [];
        group.push(session);
        sessionsByProject.set(projectId, group);
      }
      return {
        projects: projects.map((project) => ({ ...project, sessions: project.sessions ?? sessionsByProject.get(project.id) ?? [] })),
        sessions,
        pullRequests: sessions.flatMap((session) =>
          (session.prs ?? []).map((pr) => ({
            ...pr,
            sessionId: session.id,
            projectId: session.projectId ?? session.workspaceId,
            projectName: session.workspaceName,
          })),
        ),
      };
    },
  };
}

function parseJson(text: string): unknown {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function toApiError(status: number, body: unknown): DaemonApiError {
  const envelope = body as ErrorEnvelope;
  const message = envelope.error?.message ?? envelope.message ?? `Daemon request failed with HTTP ${status}.`;
  return new DaemonApiError(message, status, envelope.error?.code, envelope.error?.requestId ?? envelope.requestId);
}
