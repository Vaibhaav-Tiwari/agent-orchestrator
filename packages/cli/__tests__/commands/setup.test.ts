import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

// ---------------------------------------------------------------------------
// Hoisted mocks — must be defined before any imports that use them
// ---------------------------------------------------------------------------

const { mockFindConfigFile } = vi.hoisted(() => ({
  mockFindConfigFile: vi.fn(),
}));

const {
  mockReadFileSync,
  mockWriteFileSync,
  mockExistsSync,
  mockMkdirSync,
  mockCpSync,
  mockRmSync,
} = vi.hoisted(() => ({
  mockReadFileSync: vi.fn(),
  mockWriteFileSync: vi.fn(),
  mockExistsSync: vi.fn(),
  mockMkdirSync: vi.fn(),
  mockCpSync: vi.fn(),
  mockRmSync: vi.fn(),
}));

const { mockExecFileSync } = vi.hoisted(() => ({
  mockExecFileSync: vi.fn(),
}));

const { mockProbeGateway, mockValidateToken, mockDetectOpenClawInstallation } = vi.hoisted(() => ({
  mockProbeGateway: vi.fn(),
  mockValidateToken: vi.fn(),
  mockDetectOpenClawInstallation: vi.fn(),
}));

const {
  mockComposioConstructorOptions,
  mockAuthConfigsList,
  mockAuthConfigsCreate,
  mockAuthConfigsRetrieve,
  mockConnectedAccountsList,
  mockConnectedAccountsGet,
  mockConnectedAccountsLink,
  mockConnectedAccountsInitiate,
  mockConnectedAccountsWaitForConnection,
  mockToolkitsAuthorize,
} = vi.hoisted(() => ({
  mockComposioConstructorOptions: [] as Array<Record<string, unknown>>,
  mockAuthConfigsList: vi.fn(),
  mockAuthConfigsCreate: vi.fn(),
  mockAuthConfigsRetrieve: vi.fn(),
  mockConnectedAccountsList: vi.fn(),
  mockConnectedAccountsGet: vi.fn(),
  mockConnectedAccountsLink: vi.fn(),
  mockConnectedAccountsInitiate: vi.fn(),
  mockConnectedAccountsWaitForConnection: vi.fn(),
  mockToolkitsAuthorize: vi.fn(),
}));

const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}));

vi.mock("@aoagents/ao-core", () => ({
  CONFIG_SCHEMA_URL:
    "https://raw.githubusercontent.com/ComposioHQ/agent-orchestrator/main/schema/config.schema.json",
  findConfigFile: (...args: unknown[]) => mockFindConfigFile(...args),
  isCanonicalGlobalConfigPath: (configPath: string | undefined) =>
    configPath === join(homedir(), ".agent-orchestrator", "config.yaml"),
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
    writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
    existsSync: (...args: unknown[]) => mockExistsSync(...args),
    mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
    cpSync: (...args: unknown[]) => mockCpSync(...args),
    rmSync: (...args: unknown[]) => mockRmSync(...args),
  };
});

vi.mock("node:child_process", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    execFileSync: (...args: unknown[]) => mockExecFileSync(...args),
  };
});

vi.mock("../../src/lib/openclaw-probe.js", () => ({
  probeGateway: (...args: unknown[]) => mockProbeGateway(...args),
  validateToken: (...args: unknown[]) => mockValidateToken(...args),
  detectOpenClawInstallation: (...args: unknown[]) => mockDetectOpenClawInstallation(...args),
  DEFAULT_OPENCLAW_URL: "http://127.0.0.1:18789",
  HOOKS_PATH: "/hooks/agent",
}));

vi.mock("@composio/core", () => {
  function MockComposio(opts: Record<string, unknown>) {
    mockComposioConstructorOptions.push(opts);
    return {
      authConfigs: {
        list: mockAuthConfigsList,
        create: mockAuthConfigsCreate,
        get: mockAuthConfigsRetrieve,
        retrieve: mockAuthConfigsRetrieve,
      },
      connectedAccounts: {
        list: mockConnectedAccountsList,
        get: mockConnectedAccountsGet,
        link: mockConnectedAccountsLink,
        initiate: mockConnectedAccountsInitiate,
        waitForConnection: mockConnectedAccountsWaitForConnection,
      },
      toolkits: {
        authorize: mockToolkitsAuthorize,
      },
    };
  }
  return { Composio: MockComposio };
});

import { registerSetup } from "../../src/commands/setup.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MINIMAL_CONFIG = `
port: 3000
defaults: {}
projects:
  my-app:
    name: my-app
    repo: owner/repo
    path: ~/code/my-app
`;

const CONFIG_WITH_OPENCLAW = `
port: 3000
defaults:
  notifiers:
    - openclaw
notifiers:
  openclaw:
    plugin: openclaw
    url: http://127.0.0.1:18789/hooks/agent
    token: "\${OPENCLAW_HOOKS_TOKEN}"
projects:
  my-app:
    name: my-app
`;

function createProgram(): Command {
  const program = new Command();
  program.exitOverride(); // throw instead of process.exit
  registerSetup(program);
  return program;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("setup composio command", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
    mockComposioConstructorOptions.length = 0;
    mockFindConfigFile.mockReturnValue("/tmp/agent-orchestrator.yaml");
    mockReadFileSync.mockReturnValue(MINIMAL_CONFIG);
    mockWriteFileSync.mockImplementation(() => {});
    mockAuthConfigsList.mockResolvedValue({
      items: [{ id: "auth_slack_123", toolkit: { slug: "slack" } }],
    });
    mockAuthConfigsCreate.mockResolvedValue({
      id: "auth_slack_created",
      toolkit: { slug: "slack" },
    });
    mockAuthConfigsRetrieve.mockResolvedValue({
      id: "auth_slack_123",
      toolkit: { slug: "slack" },
      toolAccessConfig: {},
    });
    mockConnectedAccountsList.mockResolvedValue({
      items: [
        {
          id: "ca_slack_123",
          status: "ACTIVE",
          toolkit: { slug: "slack" },
          isDisabled: false,
        },
      ],
    });
    mockConnectedAccountsGet.mockImplementation((id: string) =>
      Promise.resolve({
        id,
        status: "ACTIVE",
        toolkit: { slug: "slack" },
        isDisabled: false,
      }),
    );
    mockConnectedAccountsWaitForConnection.mockResolvedValue({
      id: "ca_waited",
      status: "ACTIVE",
      toolkit: { slug: "slack" },
      isDisabled: false,
    });
    mockConnectedAccountsLink.mockResolvedValue({
      id: "conn_req_123",
      redirectUrl: "https://composio.dev/connect/slack",
      waitForConnection: vi.fn().mockResolvedValue({
        id: "ca_authorized",
        status: "ACTIVE",
        toolkit: { slug: "slack" },
        isDisabled: false,
      }),
    });
    mockConnectedAccountsInitiate.mockResolvedValue({
      id: "ca_discord_123",
      status: "ACTIVE",
    });
    mockToolkitsAuthorize.mockResolvedValue({
      id: "conn_req_123",
      redirectUrl: "https://composio.dev/connect/slack",
      waitForConnection: vi.fn().mockResolvedValue({
        id: "ca_authorized",
        status: "ACTIVE",
        toolkit: { slug: "slack" },
        isDisabled: false,
      }),
    });
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: vi.fn().mockResolvedValue({ id: "1234567890", name: "general" }),
    });
    vi.stubGlobal("fetch", mockFetch);
    Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it("registers the composio setup command", () => {
    const program = createProgram();
    const setup = program.commands.find((command) => command.name() === "setup");
    expect(setup?.commands.some((command) => command.name() === "composio")).toBe(true);
    expect(setup?.commands.some((command) => command.name() === "composio-discord")).toBe(true);
    expect(setup?.commands.some((command) => command.name() === "composio-discord-bot")).toBe(true);
    expect(setup?.commands.some((command) => command.name() === "composio-mail")).toBe(true);
  });

  it("writes Composio config with a discovered Slack connected account", async () => {
    const program = createProgram();

    await program.parseAsync([
      "node",
      "test",
      "setup",
      "composio",
      "--api-key",
      "ak_test",
      "--user-id",
      "ao-user",
      "--channel",
      "iamasx",
      "--non-interactive",
    ]);

    expect(mockComposioConstructorOptions).toEqual([{ apiKey: "ak_test" }]);
    expect(mockConnectedAccountsList).toHaveBeenCalledWith({
      userIds: ["ao-user"],
      toolkitSlugs: ["slack"],
      statuses: ["ACTIVE"],
      limit: 25,
    });

    const writtenYaml = mockWriteFileSync.mock.calls[0][1] as string;
    const parsed = parseYaml(writtenYaml) as {
      defaults?: { notifiers?: string[] };
      notifiers?: Record<string, Record<string, unknown>>;
      notificationRouting?: Record<string, string[]>;
    };

    expect(parsed.notifiers?.["composio"]).toMatchObject({
      plugin: "composio",
      defaultApp: "slack",
      composioApiKey: "ak_test",
      userId: "ao-user",
      channelName: "iamasx",
      connectedAccountId: "ca_slack_123",
    });
    expect(parsed.defaults?.notifiers).toContain("composio");
    expect(parsed.notificationRouting?.["urgent"]).toContain("composio");
    expect(parsed.notificationRouting?.["action"]).toContain("composio");
    expect(parsed.notificationRouting?.["warning"]).toContain("composio");
    expect(parsed.notificationRouting?.["info"]).toContain("composio");
  });

  it("uses COMPOSIO_API_KEY and does not write the env value to config", async () => {
    process.env.COMPOSIO_API_KEY = "ak_env";
    const program = createProgram();

    await program.parseAsync([
      "node",
      "test",
      "setup",
      "composio",
      "--user-id",
      "ao-user",
      "--non-interactive",
    ]);

    expect(mockComposioConstructorOptions).toEqual([{ apiKey: "ak_env" }]);
    const writtenYaml = mockWriteFileSync.mock.calls[0][1] as string;
    expect(writtenYaml).not.toContain("ak_env");
  });

  it("verifies and stores an explicit connected account id", async () => {
    const program = createProgram();

    await program.parseAsync([
      "node",
      "test",
      "setup",
      "composio",
      "--api-key",
      "ak_test",
      "--connected-account-id",
      "ca_explicit",
      "--non-interactive",
    ]);

    expect(mockConnectedAccountsGet).toHaveBeenCalledWith("ca_explicit");
    const writtenYaml = mockWriteFileSync.mock.calls[0][1] as string;
    const parsed = parseYaml(writtenYaml) as {
      notifiers?: Record<string, Record<string, unknown>>;
    };
    expect(parsed.notifiers?.["composio"]?.["connectedAccountId"]).toBe("ca_explicit");
  });

  it("fails in non-interactive mode when multiple Slack accounts need selection", async () => {
    mockConnectedAccountsList.mockResolvedValue({
      items: [
        { id: "ca_one", status: "ACTIVE", toolkit: { slug: "slack" } },
        { id: "ca_two", status: "ACTIVE", toolkit: { slug: "slack" } },
      ],
    });
    const program = createProgram();
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });

    await expect(
      program.parseAsync([
        "node",
        "test",
        "setup",
        "composio",
        "--api-key",
        "ak_test",
        "--non-interactive",
      ]),
    ).rejects.toThrow("process.exit");

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it("creates a Slack connect request when no active account exists", async () => {
    mockConnectedAccountsList.mockResolvedValue({ items: [] });
    const program = createProgram();

    await program.parseAsync([
      "node",
      "test",
      "setup",
      "composio",
      "--api-key",
      "ak_test",
      "--user-id",
      "ao-user",
      "--wait-ms",
      "1",
      "--non-interactive",
    ]);

    expect(mockAuthConfigsList).toHaveBeenCalledWith({ toolkit: "slack" });
    expect(mockConnectedAccountsLink).toHaveBeenCalledWith("ao-user", "auth_slack_123", {
      allowMultiple: true,
    });
    expect(mockToolkitsAuthorize).not.toHaveBeenCalled();
    const writtenYaml = mockWriteFileSync.mock.calls[0][1] as string;
    expect(writtenYaml).toContain("connectedAccountId: ca_authorized");
  });

  it("creates a Slack auth config before linking when none exists", async () => {
    mockConnectedAccountsList.mockResolvedValue({ items: [] });
    mockAuthConfigsList.mockResolvedValue({ items: [] });
    const program = createProgram();

    await program.parseAsync([
      "node",
      "test",
      "setup",
      "composio",
      "--api-key",
      "ak_test",
      "--user-id",
      "ao-user",
      "--wait-ms",
      "1",
      "--non-interactive",
    ]);

    expect(mockAuthConfigsCreate).toHaveBeenCalledWith("slack", {
      type: "use_composio_managed_auth",
      name: "Slack Auth Config",
    });
    expect(mockConnectedAccountsLink).toHaveBeenCalledWith("ao-user", "auth_slack_created", {
      allowMultiple: true,
    });
  });

  it("shows status without writing config", async () => {
    const program = createProgram();

    await program.parseAsync([
      "node",
      "test",
      "setup",
      "composio",
      "--api-key",
      "ak_test",
      "--status",
    ]);

    expect(mockConnectedAccountsList).toHaveBeenCalled();
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it("fails on conflicting composio notifier config unless --force is set", async () => {
    mockReadFileSync.mockReturnValue(`
notifiers:
  composio:
    plugin: webhook
projects:
  my-app:
    name: my-app
`);
    const program = createProgram();
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });

    await expect(
      program.parseAsync([
        "node",
        "test",
        "setup",
        "composio",
        "--api-key",
        "ak_test",
        "--non-interactive",
      ]),
    ).rejects.toThrow("process.exit");

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it("writes Composio Discord webhook config and creates a bearer connected account", async () => {
    mockAuthConfigsCreate.mockResolvedValueOnce({
      id: "auth_discord_created",
      toolkit: { slug: "discordbot" },
    });
    const program = createProgram();

    await program.parseAsync([
      "node",
      "test",
      "setup",
      "composio-discord",
      "--api-key",
      "ak_test",
      "--webhook-url",
      "https://discord.com/api/webhooks/1234567890/webhook-token",
      "--non-interactive",
    ]);

    expect(mockAuthConfigsCreate).toHaveBeenCalledWith("discordbot", {
      type: "use_custom_auth",
      name: "Discord Webhook Auth Config",
      authScheme: "BEARER_TOKEN",
    });
    expect(mockConnectedAccountsInitiate).toHaveBeenCalledWith("ao-local", "auth_discord_created", {
      config: {
        authScheme: "BEARER_TOKEN",
        val: {
          status: "ACTIVE",
          token: "webhook-token",
        },
      },
    });

    const writtenYaml = mockWriteFileSync.mock.calls[0][1] as string;
    const parsed = parseYaml(writtenYaml) as {
      defaults?: { notifiers?: string[] };
      notifiers?: Record<string, Record<string, unknown>>;
      notificationRouting?: Record<string, string[]>;
    };

    expect(parsed.notifiers?.["composio-discord"]).toMatchObject({
      plugin: "composio",
      defaultApp: "discord",
      mode: "webhook",
      webhookUrl: "https://discord.com/api/webhooks/1234567890/webhook-token",
      userId: "ao-local",
      connectedAccountId: "ca_discord_123",
      toolVersion: "20260429_01",
      composioApiKey: "ak_test",
    });
    expect(parsed.defaults?.notifiers).toContain("composio-discord");
    expect(parsed.notificationRouting?.["urgent"]).toContain("composio-discord");
    expect(writtenYaml).not.toContain("botToken");
  });

  it("writes Composio Discord bot config and does not persist the bot token", async () => {
    mockAuthConfigsCreate.mockResolvedValueOnce({
      id: "auth_discord_created",
      toolkit: { slug: "discordbot" },
    });
    const program = createProgram();

    await program.parseAsync([
      "node",
      "test",
      "setup",
      "composio-discord-bot",
      "--api-key",
      "ak_test",
      "--channel-id",
      "1234567890",
      "--bot-token",
      "bot-token",
      "--non-interactive",
    ]);

    expect(mockFetch).toHaveBeenCalledWith("https://discord.com/api/v10/channels/1234567890", {
      headers: {
        Authorization: "Bot bot-token",
      },
    });
    expect(mockAuthConfigsCreate).toHaveBeenCalledWith("discordbot", {
      type: "use_custom_auth",
      name: "Discord Bot Auth Config",
      authScheme: "BEARER_TOKEN",
    });
    expect(mockConnectedAccountsInitiate).toHaveBeenCalledWith("ao-local", "auth_discord_created", {
      config: {
        authScheme: "BEARER_TOKEN",
        val: {
          status: "ACTIVE",
          token: "bot-token",
        },
      },
    });

    const writtenYaml = mockWriteFileSync.mock.calls[0][1] as string;
    const parsed = parseYaml(writtenYaml) as {
      defaults?: { notifiers?: string[] };
      notifiers?: Record<string, Record<string, unknown>>;
      notificationRouting?: Record<string, string[]>;
    };

    expect(parsed.notifiers?.["composio-discord-bot"]).toMatchObject({
      plugin: "composio",
      defaultApp: "discord",
      mode: "bot",
      channelId: "1234567890",
      userId: "ao-local",
      connectedAccountId: "ca_discord_123",
      toolVersion: "20260429_01",
      composioApiKey: "ak_test",
    });
    expect(parsed.defaults?.notifiers).toContain("composio-discord-bot");
    expect(parsed.notificationRouting?.["urgent"]).toContain("composio-discord-bot");
    expect(writtenYaml).not.toContain("bot-token");
  });

  it("fails Discord bot setup when the bot cannot access the channel", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      json: vi.fn().mockResolvedValue({ message: "Missing Access" }),
    });
    const program = createProgram();
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });

    await expect(
      program.parseAsync([
        "node",
        "test",
        "setup",
        "composio-discord-bot",
        "--api-key",
        "ak_test",
        "--channel-id",
        "1234567890",
        "--bot-token",
        "bot-token",
        "--non-interactive",
      ]),
    ).rejects.toThrow("process.exit");

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it("writes Discord bot config from an explicit connected account without a bot token", async () => {
    mockConnectedAccountsGet.mockResolvedValue({
      id: "ca_discord_explicit",
      status: "ACTIVE",
      toolkit: { slug: "discordbot" },
      isDisabled: false,
    });
    const program = createProgram();

    await program.parseAsync([
      "node",
      "test",
      "setup",
      "composio-discord-bot",
      "--api-key",
      "ak_test",
      "--channel-id",
      "1234567890",
      "--connected-account-id",
      "ca_discord_explicit",
      "--non-interactive",
    ]);

    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockConnectedAccountsInitiate).not.toHaveBeenCalled();
    const writtenYaml = mockWriteFileSync.mock.calls[0][1] as string;
    const parsed = parseYaml(writtenYaml) as {
      notifiers?: Record<string, Record<string, unknown>>;
    };
    expect(parsed.notifiers?.["composio-discord-bot"]?.["connectedAccountId"]).toBe(
      "ca_discord_explicit",
    );
  });

  it("writes Composio mail config with a discovered Gmail connected account", async () => {
    mockConnectedAccountsList.mockResolvedValue({
      items: [
        {
          id: "ca_gmail_123",
          status: "ACTIVE",
          toolkit: { slug: "gmail" },
          isDisabled: false,
        },
      ],
    });
    mockConnectedAccountsGet.mockResolvedValue({
      id: "ca_gmail_123",
      status: "ACTIVE",
      toolkit: { slug: "gmail" },
      isDisabled: false,
      data: {
        scope:
          "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.metadata",
      },
    });
    const program = createProgram();

    await program.parseAsync([
      "node",
      "test",
      "setup",
      "composio-mail",
      "--api-key",
      "ak_test",
      "--user-id",
      "ao-user",
      "--email-to",
      "admin@example.com",
      "--non-interactive",
    ]);

    expect(mockConnectedAccountsList).toHaveBeenCalledWith({
      userIds: ["ao-user"],
      toolkitSlugs: ["gmail"],
      statuses: ["ACTIVE"],
      limit: 25,
    });

    const writtenYaml = mockWriteFileSync.mock.calls[0][1] as string;
    const parsed = parseYaml(writtenYaml) as {
      defaults?: { notifiers?: string[] };
      notifiers?: Record<string, Record<string, unknown>>;
      notificationRouting?: Record<string, string[]>;
    };

    expect(parsed.notifiers?.["composio-mail"]).toMatchObject({
      plugin: "composio",
      defaultApp: "gmail",
      emailTo: "admin@example.com",
      userId: "ao-user",
      connectedAccountId: "ca_gmail_123",
      toolVersion: "20260506_01",
      composioApiKey: "ak_test",
    });
    expect(parsed.defaults?.notifiers).toContain("composio-mail");
    expect(parsed.notificationRouting?.["urgent"]).toContain("composio-mail");
  });

  it("uses a reusable Gmail send auth config when no active account exists", async () => {
    mockConnectedAccountsList.mockResolvedValue({ items: [] });
    mockAuthConfigsList.mockResolvedValueOnce({
      items: [
        {
          id: "auth_gmail_send",
          toolkit: { slug: "gmail" },
          toolAccessConfig: {
            toolsForConnectedAccountCreation: ["GMAIL_SEND_EMAIL"],
          },
        },
      ],
    });
    mockConnectedAccountsLink.mockResolvedValue({
      id: "conn_req_gmail",
      redirectUrl: "https://composio.dev/connect/gmail",
      waitForConnection: vi.fn().mockResolvedValue({
        id: "ca_gmail_authorized",
        status: "ACTIVE",
        toolkit: { slug: "gmail" },
        isDisabled: false,
        data: {
          scope:
            "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.metadata",
        },
      }),
    });
    const program = createProgram();

    await program.parseAsync([
      "node",
      "test",
      "setup",
      "composio-mail",
      "--api-key",
      "ak_test",
      "--email-to",
      "admin@example.com",
      "--wait-ms",
      "1",
      "--non-interactive",
    ]);

    expect(mockAuthConfigsList).toHaveBeenCalledWith({ toolkit: "gmail" });
    expect(mockAuthConfigsCreate).not.toHaveBeenCalledWith("gmail", expect.anything());
    expect(mockConnectedAccountsLink).toHaveBeenCalledWith("ao-local", "auth_gmail_send", {
      allowMultiple: true,
    });
    const writtenYaml = mockWriteFileSync.mock.calls[0][1] as string;
    expect(writtenYaml).toContain("connectedAccountId: ca_gmail_authorized");
  });

  it("creates a Gmail send auth config when no reusable send config exists", async () => {
    mockConnectedAccountsList.mockResolvedValue({ items: [] });
    mockAuthConfigsList.mockResolvedValueOnce({ items: [] });
    mockAuthConfigsCreate.mockResolvedValueOnce({ id: "auth_gmail_created" });
    mockConnectedAccountsLink.mockResolvedValue({
      id: "conn_req_gmail",
      redirectUrl: "https://composio.dev/connect/gmail",
      waitForConnection: vi.fn().mockResolvedValue(null),
    });
    const program = createProgram();

    await program.parseAsync([
      "node",
      "test",
      "setup",
      "composio-mail",
      "--api-key",
      "ak_test",
      "--email-to",
      "admin@example.com",
      "--wait-ms",
      "1",
      "--non-interactive",
    ]);

    expect(mockAuthConfigsCreate).toHaveBeenCalledWith("gmail", {
      type: "use_composio_managed_auth",
      name: "Gmail Auth Config",
      toolAccessConfig: {
        toolsForConnectedAccountCreation: ["GMAIL_SEND_EMAIL"],
      },
    });
    expect(mockConnectedAccountsLink).toHaveBeenCalledWith("ao-local", "auth_gmail_created", {
      allowMultiple: true,
    });
  });

  it("writes mail config from an explicit Gmail connected account", async () => {
    mockConnectedAccountsGet.mockResolvedValue({
      id: "ca_gmail_explicit",
      status: "ACTIVE",
      toolkit: { slug: "gmail" },
      isDisabled: false,
      data: {
        scope:
          "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.metadata",
      },
    });
    const program = createProgram();

    await program.parseAsync([
      "node",
      "test",
      "setup",
      "composio-mail",
      "--api-key",
      "ak_test",
      "--email-to",
      "admin@example.com",
      "--connected-account-id",
      "ca_gmail_explicit",
      "--non-interactive",
    ]);

    expect(mockConnectedAccountsGet).toHaveBeenCalledWith("ca_gmail_explicit");
    const writtenYaml = mockWriteFileSync.mock.calls[0][1] as string;
    const parsed = parseYaml(writtenYaml) as {
      notifiers?: Record<string, Record<string, unknown>>;
    };
    expect(parsed.notifiers?.["composio-mail"]?.["connectedAccountId"]).toBe("ca_gmail_explicit");
  });

  it("creates a fresh Gmail connect request when the existing Gmail account lacks send scopes", async () => {
    mockReadFileSync.mockReturnValue(`
notifiers:
  composio-mail:
    plugin: composio
    defaultApp: gmail
    composioApiKey: ak_existing
    emailTo: admin@example.com
    connectedAccountId: ca_gmail_old
projects:
  my-app:
    name: my-app
`);
    mockConnectedAccountsGet.mockResolvedValue({
      id: "ca_gmail_old",
      status: "ACTIVE",
      toolkit: { slug: "gmail" },
      isDisabled: false,
      data: {
        scope: "openid https://www.googleapis.com/auth/userinfo.email",
      },
    });
    mockConnectedAccountsList.mockResolvedValue({ items: [] });
    mockAuthConfigsList.mockResolvedValueOnce({ items: [] });
    mockAuthConfigsCreate.mockResolvedValueOnce({ id: "auth_gmail_send" });
    mockConnectedAccountsLink.mockResolvedValue({
      id: "conn_req_gmail",
      redirectUrl: "https://composio.dev/connect/gmail",
      waitForConnection: vi.fn().mockResolvedValue(null),
    });
    const program = createProgram();

    await program.parseAsync([
      "node",
      "test",
      "setup",
      "composio-mail",
      "--wait-ms",
      "1",
      "--non-interactive",
    ]);

    expect(mockAuthConfigsCreate).toHaveBeenCalledWith(
      "gmail",
      expect.objectContaining({
        toolAccessConfig: {
          toolsForConnectedAccountCreation: ["GMAIL_SEND_EMAIL"],
        },
      }),
    );
    const writtenYaml = mockWriteFileSync.mock.calls[0][1] as string;
    const parsed = parseYaml(writtenYaml) as {
      notifiers?: Record<string, Record<string, unknown>>;
    };
    expect(parsed.notifiers?.["composio-mail"]?.["connectedAccountId"]).toBeUndefined();
  });
});

describe("setup openclaw command", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    mockFindConfigFile.mockReturnValue("/tmp/agent-orchestrator.yaml");
    mockReadFileSync.mockReturnValue(MINIMAL_CONFIG);
    mockWriteFileSync.mockImplementation(() => {});
    mockExistsSync.mockReturnValue(false);
    mockMkdirSync.mockImplementation(() => undefined);
    mockValidateToken.mockResolvedValue({ valid: true });
    mockProbeGateway.mockResolvedValue({ reachable: false });

    // Force non-interactive (no TTY in test environment)
    Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("non-interactive mode", () => {
    it("writes config when --url and --token provided", async () => {
      const program = createProgram();

      await program.parseAsync([
        "node",
        "test",
        "setup",
        "openclaw",
        "--url",
        "http://127.0.0.1:18789/hooks/agent",
        "--token",
        "test-token",
        "--non-interactive",
      ]);

      // Code writes YAML config + shell profile export — at least one write
      expect(mockWriteFileSync).toHaveBeenCalled();
      const writtenYaml = mockWriteFileSync.mock.calls[0][1] as string;
      expect(writtenYaml).toContain("openclaw");
      expect(writtenYaml).toContain("plugin: openclaw");
      expect(writtenYaml).toContain("http://127.0.0.1:18789/hooks/agent");
    });

    it("reads token from OPENCLAW_HOOKS_TOKEN env var and skips validation", async () => {
      process.env["OPENCLAW_HOOKS_TOKEN"] = "env-token";
      const program = createProgram();

      await program.parseAsync([
        "node",
        "test",
        "setup",
        "openclaw",
        "--url",
        "http://127.0.0.1:18789/hooks/agent",
        "--non-interactive",
      ]);

      // Non-interactive mode skips pre-write validation
      expect(mockValidateToken).not.toHaveBeenCalled();
      expect(mockWriteFileSync).toHaveBeenCalled();
    });

    it("reads URL from OPENCLAW_GATEWAY_URL env var and skips validation", async () => {
      process.env["OPENCLAW_GATEWAY_URL"] = "http://remote:18789";
      const program = createProgram();

      await program.parseAsync([
        "node",
        "test",
        "setup",
        "openclaw",
        "--token",
        "tok",
        "--non-interactive",
      ]);

      // Non-interactive mode skips pre-write validation
      expect(mockValidateToken).not.toHaveBeenCalled();
      expect(mockWriteFileSync).toHaveBeenCalled();
    });

    it("normalizes OPENCLAW_GATEWAY_URL without double-appending hooks path", async () => {
      process.env["OPENCLAW_GATEWAY_URL"] = "http://remote:18789/hooks/agent";
      const program = createProgram();

      await program.parseAsync([
        "node",
        "test",
        "setup",
        "openclaw",
        "--token",
        "tok",
        "--non-interactive",
      ]);

      const writtenYaml = mockWriteFileSync.mock.calls[0][1] as string;
      expect(writtenYaml).toContain("url: http://remote:18789/hooks/agent");
      expect(writtenYaml).not.toContain("/hooks/agent/hooks/agent");
    });

    it("skips token validation and writes config in non-interactive mode", async () => {
      const program = createProgram();

      await program.parseAsync([
        "node",
        "test",
        "setup",
        "openclaw",
        "--url",
        "http://127.0.0.1:18789/hooks/agent",
        "--token",
        "good-token",
        "--non-interactive",
      ]);

      // Non-interactive setup skips pre-write validation (gateway may not have
      // the token yet on a fresh install — user restarts gateway after setup)
      expect(mockValidateToken).not.toHaveBeenCalled();
      expect(mockWriteFileSync).toHaveBeenCalled();
    });
  });

  describe("config writing", () => {
    it("adds openclaw to defaults.notifiers", async () => {
      const program = createProgram();

      await program.parseAsync([
        "node",
        "test",
        "setup",
        "openclaw",
        "--url",
        "http://127.0.0.1:18789/hooks/agent",
        "--token",
        "tok",
        "--non-interactive",
      ]);

      const writtenYaml = mockWriteFileSync.mock.calls[0][1] as string;
      expect(writtenYaml).toContain("openclaw");
      expect(writtenYaml).not.toContain("desktop");
    });

    it("does not stamp wrapped config schema onto the canonical global config", async () => {
      mockFindConfigFile.mockReturnValue(join(homedir(), ".agent-orchestrator", "config.yaml"));
      const program = createProgram();

      await program.parseAsync([
        "node",
        "test",
        "setup",
        "openclaw",
        "--url",
        "http://127.0.0.1:18789/hooks/agent",
        "--token",
        "tok",
        "--non-interactive",
      ]);

      const writtenYaml = mockWriteFileSync.mock.calls[0][1] as string;
      expect(writtenYaml).not.toContain("$schema:");
      expect(writtenYaml).toContain("openclaw");
    });

    it("does not add desktop to defaults.notifiers when initializing notifiers", async () => {
      // Config with no notifiers at all
      mockReadFileSync.mockReturnValue(`
port: 3000
defaults: {}
projects:
  my-app:
    name: my-app
`);
      const program = createProgram();

      await program.parseAsync([
        "node",
        "test",
        "setup",
        "openclaw",
        "--url",
        "http://127.0.0.1:18789/hooks/agent",
        "--token",
        "tok",
        "--non-interactive",
      ]);

      const writtenYaml = mockWriteFileSync.mock.calls[0][1] as string;
      const parsed = parseYaml(writtenYaml) as { defaults?: { notifiers?: string[] } };
      expect(parsed.defaults?.notifiers).not.toContain("desktop");
      expect(parsed.defaults?.notifiers).toContain("openclaw");
    });

    it("does not duplicate openclaw in defaults.notifiers", async () => {
      mockReadFileSync.mockReturnValue(CONFIG_WITH_OPENCLAW);
      const program = createProgram();

      await program.parseAsync([
        "node",
        "test",
        "setup",
        "openclaw",
        "--url",
        "http://127.0.0.1:18789/hooks/agent",
        "--token",
        "tok",
        "--non-interactive",
      ]);

      const writtenYaml = mockWriteFileSync.mock.calls[0][1] as string;
      const parsed = parseYaml(writtenYaml) as { defaults?: { notifiers?: string[] } };
      expect(parsed.defaults?.notifiers?.filter((name) => name === "openclaw")).toHaveLength(1);
    });

    it("writes correct notifier block structure", async () => {
      const program = createProgram();

      await program.parseAsync([
        "node",
        "test",
        "setup",
        "openclaw",
        "--url",
        "http://custom:9999/hooks/agent",
        "--token",
        "tok",
        "--non-interactive",
      ]);

      const writtenYaml = mockWriteFileSync.mock.calls[0][1] as string;
      expect(writtenYaml).toContain("plugin: openclaw");
      expect(writtenYaml).toContain("http://custom:9999/hooks/agent");
      expect(writtenYaml).toContain("${OPENCLAW_HOOKS_TOKEN}");
      expect(writtenYaml).toContain("retries: 3");
      expect(writtenYaml).toContain("retryDelayMs: 1000");
      expect(writtenYaml).toContain("wakeMode: now");
    });

    it("defaults OpenClaw routing to urgent + action only", async () => {
      const program = createProgram();

      await program.parseAsync([
        "node",
        "test",
        "setup",
        "openclaw",
        "--url",
        "http://127.0.0.1:18789/hooks/agent",
        "--token",
        "tok",
        "--non-interactive",
      ]);

      const writtenYaml = mockWriteFileSync.mock.calls[0][1] as string;
      const parsed = parseYaml(writtenYaml) as {
        notificationRouting?: Record<string, string[]>;
      };

      expect(parsed.notificationRouting?.["urgent"]).toContain("openclaw");
      expect(parsed.notificationRouting?.["action"]).toContain("openclaw");
      expect(parsed.notificationRouting?.["warning"]).not.toContain("openclaw");
      expect(parsed.notificationRouting?.["info"]).not.toContain("openclaw");
    });

    it("supports overriding the routing preset in non-interactive mode", async () => {
      const program = createProgram();

      await program.parseAsync([
        "node",
        "test",
        "setup",
        "openclaw",
        "--url",
        "http://127.0.0.1:18789/hooks/agent",
        "--token",
        "tok",
        "--routing-preset",
        "all",
        "--non-interactive",
      ]);

      const writtenYaml = mockWriteFileSync.mock.calls[0][1] as string;
      const parsed = parseYaml(writtenYaml) as {
        notificationRouting?: Record<string, string[]>;
      };

      expect(parsed.notificationRouting?.["urgent"]).toContain("openclaw");
      expect(parsed.notificationRouting?.["action"]).toContain("openclaw");
      expect(parsed.notificationRouting?.["warning"]).toContain("openclaw");
      expect(parsed.notificationRouting?.["info"]).toContain("openclaw");
    });

    it("merges existing allowedSessionKeyPrefixes in openclaw.json", async () => {
      const openclawConfigPath = join(homedir(), ".openclaw", "openclaw.json");

      mockExistsSync.mockImplementation((path: string) => path === openclawConfigPath);
      mockReadFileSync.mockImplementation((path: string) => {
        if (path === "/tmp/agent-orchestrator.yaml") {
          return MINIMAL_CONFIG;
        }
        if (path === openclawConfigPath) {
          return JSON.stringify({
            hooks: {
              enabled: false,
              token: "old-token",
              allowRequestSessionKey: false,
              allowedSessionKeyPrefixes: ["legacy:", "hook:"],
            },
            otherConfig: true,
          });
        }
        return "";
      });

      const program = createProgram();

      await program.parseAsync([
        "node",
        "test",
        "setup",
        "openclaw",
        "--url",
        "http://127.0.0.1:18789/hooks/agent",
        "--token",
        "new-token",
        "--non-interactive",
      ]);

      const openclawWrite = mockWriteFileSync.mock.calls.find(
        ([path]) => path === openclawConfigPath,
      );
      expect(openclawWrite).toBeDefined();

      const writtenJson = JSON.parse(openclawWrite![1] as string) as {
        hooks: {
          token: string;
          enabled: boolean;
          allowRequestSessionKey: boolean;
          allowedSessionKeyPrefixes: string[];
        };
        otherConfig: boolean;
      };

      expect(writtenJson.otherConfig).toBe(true);
      expect(writtenJson.hooks.token).toBe("new-token");
      expect(writtenJson.hooks.enabled).toBe(true);
      expect(writtenJson.hooks.allowRequestSessionKey).toBe(true);
      expect(writtenJson.hooks.allowedSessionKeyPrefixes).toEqual(["legacy:", "hook:"]);
    });

    it("preserves existing projects in config", async () => {
      const program = createProgram();

      await program.parseAsync([
        "node",
        "test",
        "setup",
        "openclaw",
        "--url",
        "http://127.0.0.1:18789/hooks/agent",
        "--token",
        "tok",
        "--non-interactive",
      ]);

      const writtenYaml = mockWriteFileSync.mock.calls[0][1] as string;
      expect(writtenYaml).toContain("my-app");
      expect(writtenYaml).toContain("owner/repo");
    });

    it("writes to the correct config path", async () => {
      mockFindConfigFile.mockReturnValue("/custom/path/agent-orchestrator.yaml");
      const program = createProgram();

      await program.parseAsync([
        "node",
        "test",
        "setup",
        "openclaw",
        "--url",
        "http://127.0.0.1:18789/hooks/agent",
        "--token",
        "tok",
        "--non-interactive",
      ]);

      expect(mockWriteFileSync.mock.calls[0][0]).toBe("/custom/path/agent-orchestrator.yaml");
    });
  });

  describe("error handling", () => {
    it("exits when no config file found", async () => {
      mockFindConfigFile.mockReturnValue(null);
      const program = createProgram();

      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("process.exit");
      });

      await expect(
        program.parseAsync([
          "node",
          "test",
          "setup",
          "openclaw",
          "--url",
          "http://127.0.0.1:18789/hooks/agent",
          "--token",
          "tok",
          "--non-interactive",
        ]),
      ).rejects.toThrow("process.exit");

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    it("skips validation and writes config even with bad token in non-interactive mode", async () => {
      mockValidateToken.mockResolvedValue({ valid: false, error: "Token rejected" });
      const program = createProgram();

      await program.parseAsync([
        "node",
        "test",
        "setup",
        "openclaw",
        "--url",
        "http://127.0.0.1:18789/hooks/agent",
        "--token",
        "bad-token",
        "--non-interactive",
      ]);

      // nonInteractiveSetup skips pre-write validation, so config should still be written
      expect(mockWriteFileSync).toHaveBeenCalled();
    });

    it("exits when --url missing and gateway unreachable in non-interactive mode", async () => {
      mockDetectOpenClawInstallation.mockResolvedValue({
        state: "missing",
        gatewayUrl: "http://127.0.0.1:18789",
        probe: { reachable: false, error: "ECONNREFUSED" },
      });
      const program = createProgram();

      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("process.exit");
      });

      await expect(
        program.parseAsync([
          "node",
          "test",
          "setup",
          "openclaw",
          "--token",
          "tok",
          "--non-interactive",
        ]),
      ).rejects.toThrow("process.exit");

      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("auto-generates token when --token missing in non-interactive mode", async () => {
      delete process.env["OPENCLAW_HOOKS_TOKEN"];
      const program = createProgram();

      await program.parseAsync([
        "node",
        "test",
        "setup",
        "openclaw",
        "--url",
        "http://127.0.0.1:18789/hooks/agent",
        "--non-interactive",
      ]);

      // nonInteractiveSetup auto-generates a token when none is provided
      expect(mockWriteFileSync).toHaveBeenCalled();
    });
  });
});

describe("setup desktop command", () => {
  const originalEnv = { ...process.env };
  const sourceApp = "/tmp/source/AO Notifier.app";
  const targetApp = "/tmp/home/Applications/AO Notifier.app";

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
    process.env["AO_DESKTOP_SETUP_PLATFORM"] = "darwin";
    process.env["AO_NOTIFIER_MACOS_APP_PATH"] = sourceApp;
    process.env["AO_DESKTOP_APP_INSTALL_PATH"] = targetApp;
    mockFindConfigFile.mockReturnValue("/tmp/agent-orchestrator.yaml");
    mockReadFileSync.mockReturnValue(MINIMAL_CONFIG);
    mockWriteFileSync.mockImplementation(() => {});
    mockMkdirSync.mockImplementation(() => undefined);
    mockCpSync.mockImplementation(() => undefined);
    mockRmSync.mockImplementation(() => undefined);
    mockExistsSync.mockImplementation((path: string) =>
      path.endsWith("AO Notifier.app/Contents/MacOS/ao-notifier"),
    );
    mockExecFileSync.mockImplementation((_cmd: string, args: string[]) => {
      if (args.includes("--permission-status-json")) {
        return '{"status":"authorized","bundleId":"com.aoagents.notifier"}';
      }
      if (args.includes("--version-json")) {
        return '{"name":"AO Notifier","version":"0.6.0","bundleId":"com.aoagents.notifier"}';
      }
      if (args.includes("--request-permission")) {
        return '{"status":"authorized","bundleId":"com.aoagents.notifier"}';
      }
      return "";
    });
    Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("registers the desktop setup command", () => {
    const program = createProgram();
    const setup = program.commands.find((command) => command.name() === "setup");
    expect(setup?.commands.some((command) => command.name() === "desktop")).toBe(true);
  });

  it("installs the bundled app and wires desktop routing to all priorities", async () => {
    const program = createProgram();

    await program.parseAsync(["node", "test", "setup", "desktop", "--non-interactive"]);

    expect(mockCpSync).toHaveBeenCalledWith(sourceApp, targetApp, { recursive: true });
    const writtenYaml = mockWriteFileSync.mock.calls[0][1] as string;
    const parsed = parseYaml(writtenYaml) as {
      notifiers?: Record<string, { plugin?: string; backend?: string; dashboardUrl?: string }>;
      notificationRouting?: Record<string, string[]>;
    };

    expect(parsed.notifiers?.["desktop"]).toMatchObject({
      plugin: "desktop",
      backend: "ao-app",
      dashboardUrl: "http://localhost:3000",
    });
    expect(parsed.notificationRouting?.["urgent"]).toContain("desktop");
    expect(parsed.notificationRouting?.["action"]).toContain("desktop");
    expect(parsed.notificationRouting?.["warning"]).toContain("desktop");
    expect(parsed.notificationRouting?.["info"]).toContain("desktop");
  });

  it("preserves existing routing entries while adding desktop", async () => {
    mockReadFileSync.mockReturnValue(`
port: 3001
defaults:
  notifiers:
    - slack
notifiers:
  slack:
    plugin: slack
notificationRouting:
  urgent:
    - slack
projects:
  my-app:
    name: my-app
`);
    const program = createProgram();

    await program.parseAsync(["node", "test", "setup", "desktop", "--non-interactive"]);

    const writtenYaml = mockWriteFileSync.mock.calls[0][1] as string;
    const parsed = parseYaml(writtenYaml) as {
      notificationRouting?: Record<string, string[]>;
      defaults?: { notifiers?: string[] };
    };
    expect(parsed.notificationRouting?.["urgent"]).toEqual(["slack", "desktop"]);
    expect(parsed.notificationRouting?.["action"]).toEqual(["slack", "desktop"]);
    expect(parsed.defaults?.notifiers).toEqual(["slack"]);
  });

  it("fails on conflicting desktop notifier config in non-interactive mode", async () => {
    mockReadFileSync.mockReturnValue(`
port: 3000
notifiers:
  desktop:
    plugin: webhook
projects:
  my-app:
    name: my-app
`);
    const program = createProgram();
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });

    await expect(
      program.parseAsync(["node", "test", "setup", "desktop", "--non-interactive"]),
    ).rejects.toThrow("process.exit");

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("allows replacing conflicting desktop notifier config with --force", async () => {
    mockReadFileSync.mockReturnValue(`
port: 3000
notifiers:
  desktop:
    plugin: webhook
    url: http://example.com
projects:
  my-app:
    name: my-app
`);
    const program = createProgram();

    await program.parseAsync(["node", "test", "setup", "desktop", "--force", "--non-interactive"]);

    const writtenYaml = mockWriteFileSync.mock.calls[0][1] as string;
    const parsed = parseYaml(writtenYaml) as {
      notifiers?: Record<string, { plugin?: string; backend?: string }>;
    };
    expect(parsed.notifiers?.["desktop"]).toMatchObject({ plugin: "desktop", backend: "ao-app" });
  });

  it("reports denied notification permission without writing config", async () => {
    mockExecFileSync.mockImplementation((_cmd: string, args: string[]) => {
      if (args.includes("--request-permission")) {
        const error = new Error("Command failed") as Error & { stdout: Buffer; stderr: Buffer };
        error.stdout = Buffer.from('{"status":"denied","bundleId":"com.aoagents.notifier"}\n');
        error.stderr = Buffer.alloc(0);
        throw error;
      }
      return "";
    });
    const program = createProgram();
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      program.parseAsync(["node", "test", "setup", "desktop", "--non-interactive"]),
    ).rejects.toThrow("process.exit");

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("System Settings"));
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it("shows status without installing or writing config", async () => {
    const program = createProgram();

    await program.parseAsync(["node", "test", "setup", "desktop", "--status"]);

    expect(mockCpSync).not.toHaveBeenCalled();
    expect(mockWriteFileSync).not.toHaveBeenCalled();
    expect(mockExecFileSync).toHaveBeenCalledWith(
      expect.stringContaining("ao-notifier"),
      ["--version-json"],
      expect.any(Object),
    );
  });

  it("uninstalls the app without changing config", async () => {
    const program = createProgram();

    await program.parseAsync(["node", "test", "setup", "desktop", "--uninstall"]);

    expect(mockRmSync).toHaveBeenCalledWith(targetApp, { recursive: true, force: true });
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it("exits on non-macOS install attempts", async () => {
    process.env["AO_DESKTOP_SETUP_PLATFORM"] = "linux";
    const program = createProgram();
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });

    await expect(
      program.parseAsync(["node", "test", "setup", "desktop", "--non-interactive"]),
    ).rejects.toThrow("process.exit");

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(mockCpSync).not.toHaveBeenCalled();
  });
});
