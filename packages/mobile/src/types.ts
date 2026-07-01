export type SessionKind = "worker" | "orchestrator" | string;

export type SessionStatus =
  | "working"
  | "needs_input"
  | "ci_failed"
  | "changes_requested"
  | "mergeable"
  | "approved"
  | "review_pending"
  | "pr_open"
  | "idle"
  | "terminated"
  | "merged"
  | string;

export type PullRequestFacts = {
  id?: string;
  number?: number;
  title?: string;
  url?: string;
  state?: string;
  status?: string;
  branch?: string;
  baseBranch?: string;
};

export type Session = {
  id: string;
  projectId?: string;
  workspaceId?: string;
  workspaceName?: string;
  title?: string;
  displayName?: string;
  kind?: SessionKind;
  provider?: string;
  harness?: string;
  branch?: string;
  status?: SessionStatus;
  createdAt?: string;
  updatedAt?: string;
  terminalHandleId?: string;
  previewUrl?: string;
  prs?: PullRequestFacts[];
};

export type Project = {
  id: string;
  name: string;
  path?: string;
  status?: string;
  sessions?: Session[];
};

export type PullRequestSummary = PullRequestFacts & {
  sessionId?: string;
  projectId?: string;
  projectName?: string;
};

export type MobileSettings = {
  daemonUrl: string;
};

export type CreateTaskInput = {
  title: string;
  prompt: string;
  harness?: string;
};

export type DaemonSnapshot = {
  projects: Project[];
  sessions: Session[];
  pullRequests: PullRequestSummary[];
};
