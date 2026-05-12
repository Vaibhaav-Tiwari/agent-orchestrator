import { readFileSync, writeFileSync } from "node:fs";
import chalk from "chalk";
import { parseDocument } from "yaml";
import { CONFIG_SCHEMA_URL, findConfigFile, isCanonicalGlobalConfigPath } from "@aoagents/ao-core";

const PRIORITIES = ["urgent", "action", "warning", "info"] as const;
const SLACK_TOOLKIT = "slack";
const DISCORD_TOOLKIT = "discordbot";
const GMAIL_TOOLKIT = "gmail";
const DISCORD_TOOL_VERSION = "20260429_01";
const GMAIL_TOOL_VERSION = "20260506_01";
const COMPOSIO_DISCORD_WEBHOOK_NOTIFIER = "composio-discord";
const COMPOSIO_DISCORD_BOT_NOTIFIER = "composio-discord-bot";
const COMPOSIO_MAIL_NOTIFIER = "composio-mail";
const GMAIL_SEND_TOOL = "GMAIL_SEND_EMAIL";

export class ComposioSetupError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number = 1,
  ) {
    super(message);
    this.name = "ComposioSetupError";
  }
}

export interface ComposioSetupOptions {
  apiKey?: string;
  userId?: string;
  channel?: string;
  connectedAccountId?: string;
  nonInteractive?: boolean;
  status?: boolean;
  force?: boolean;
  waitMs?: string;
}

export interface ComposioDiscordWebhookSetupOptions {
  apiKey?: string;
  userId?: string;
  webhookUrl?: string;
  connectedAccountId?: string;
  nonInteractive?: boolean;
  status?: boolean;
  force?: boolean;
}

export interface ComposioDiscordBotSetupOptions {
  apiKey?: string;
  userId?: string;
  channelId?: string;
  botToken?: string;
  connectedAccountId?: string;
  nonInteractive?: boolean;
  status?: boolean;
  force?: boolean;
}

export interface ComposioMailSetupOptions {
  apiKey?: string;
  userId?: string;
  emailTo?: string;
  connectedAccountId?: string;
  nonInteractive?: boolean;
  status?: boolean;
  force?: boolean;
  waitMs?: string;
}

interface ConnectedAccount {
  id: string;
  status?: string;
  statusReason?: string | null;
  toolkit?: { slug?: string };
  authConfig?: { id?: string; name?: string };
  alias?: string | null;
  isDisabled?: boolean;
  scopes?: string[];
}

interface AuthConfigSummary {
  id: string;
  toolkit?: { slug?: string };
  toolAccessConfig?: {
    toolsAvailableForExecution?: string[];
    toolsForConnectedAccountCreation?: string[];
  };
  restrictToFollowingTools?: string[];
}

interface ConnectionRequest {
  id?: string;
  redirectUrl?: string;
  waitForConnection?: (timeout?: number) => Promise<unknown>;
}

interface ComposioSetupClient {
  connectedAccounts: {
    list: (query?: Record<string, unknown>) => Promise<unknown>;
    get?: (id: string) => Promise<unknown>;
    link?: (
      userId: string,
      authConfigId: string,
      options?: Record<string, unknown>,
    ) => Promise<unknown>;
    initiate?: (
      userId: string,
      authConfigId: string,
      options?: Record<string, unknown>,
    ) => Promise<unknown>;
    waitForConnection?: (id: string, timeout?: number) => Promise<unknown>;
  };
  authConfigs?: {
    list?: (query?: Record<string, unknown>) => Promise<unknown>;
    create?: (toolkit: string, options?: Record<string, unknown>) => Promise<unknown>;
    get?: (id: string) => Promise<unknown>;
    retrieve?: (id: string) => Promise<unknown>;
  };
  toolkits?: {
    authorize?: (userId: string, toolkitSlug: string, authConfigId?: string) => Promise<unknown>;
  };
}

interface ResolvedComposioSetup {
  apiKey: string;
  shouldWriteApiKey: boolean;
  userId: string;
  channel?: string;
  connectedAccountId?: string;
  connectionUrl?: string;
}

interface ResolvedDiscordSetup {
  apiKey: string;
  shouldWriteApiKey: boolean;
  userId: string;
  mode: "webhook" | "bot";
  targetName: string;
  webhookUrl?: string;
  channelId?: string;
  connectedAccountId?: string;
}

interface ResolvedMailSetup {
  apiKey: string;
  shouldWriteApiKey: boolean;
  userId: string;
  emailTo?: string;
  connectedAccountId?: string;
  connectionUrl?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value))
    return value.filter((entry): entry is string => typeof entry === "string");
  if (typeof value === "string") return [value];
  return [];
}

function scopeArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string");
  }
  if (typeof value === "string") {
    return value
      .split(/\s+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

function uniqueWithComposio(values: string[]): string[] {
  return uniqueWithTarget(values, "composio");
}

function uniqueWithTarget(values: string[], target: string): string[] {
  return [...new Set([...values.filter((value) => value !== target), target])];
}

function getExistingComposioConfig(rawConfig: Record<string, unknown>): Record<string, unknown> {
  return getExistingNotifierConfig(rawConfig, "composio");
}

function getExistingNotifierConfig(
  rawConfig: Record<string, unknown>,
  notifierName: string,
): Record<string, unknown> {
  const notifiers = isRecord(rawConfig["notifiers"]) ? rawConfig["notifiers"] : {};
  const existing = isRecord(notifiers[notifierName]) ? notifiers[notifierName] : {};
  return existing;
}

function resolveApiKey(
  opts: { apiKey?: string },
  existing: Record<string, unknown>,
): { apiKey?: string; shouldWriteApiKey: boolean } {
  const optionKey = stringValue(opts.apiKey);
  if (optionKey) return { apiKey: optionKey, shouldWriteApiKey: true };

  const envKey = stringValue(process.env.COMPOSIO_API_KEY);
  if (envKey) return { apiKey: envKey, shouldWriteApiKey: false };

  const existingKey = stringValue(existing["composioApiKey"]);
  if (existingKey && !existingKey.includes("${")) {
    return { apiKey: existingKey, shouldWriteApiKey: true };
  }

  return { apiKey: undefined, shouldWriteApiKey: false };
}

function resolveUserId(opts: { userId?: string }, existing: Record<string, unknown>): string {
  return (
    stringValue(opts.userId) ??
    stringValue(existing["userId"]) ??
    stringValue(existing["entityId"]) ??
    stringValue(process.env.COMPOSIO_USER_ID) ??
    stringValue(process.env.COMPOSIO_ENTITY_ID) ??
    "ao-local"
  );
}

function isComposioSetupClient(value: unknown): value is ComposioSetupClient {
  return (
    isRecord(value) &&
    isRecord(value["connectedAccounts"]) &&
    typeof value["connectedAccounts"]["list"] === "function"
  );
}

async function loadComposioClient(apiKey: string): Promise<ComposioSetupClient> {
  const mod = (await import("@composio/core")) as unknown as Record<string, unknown>;
  const ComposioClass = (mod.Composio ??
    (mod.default as Record<string, unknown> | undefined)?.Composio ??
    mod.default) as (new (opts: { apiKey: string }) => unknown) | undefined;

  if (typeof ComposioClass !== "function") {
    throw new ComposioSetupError("Could not find Composio class in @composio/core module.");
  }

  const client = new ComposioClass({ apiKey });
  if (!isComposioSetupClient(client)) {
    throw new ComposioSetupError("Composio SDK client does not expose connectedAccounts.list().");
  }

  return client;
}

function toConnectedAccount(value: unknown): ConnectedAccount | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value["id"]);
  if (!id) return null;
  const data = isRecord(value["data"]) ? value["data"] : {};
  const params = isRecord(value["params"]) ? value["params"] : {};
  const state = isRecord(value["state"]) ? value["state"] : {};
  const stateVal = isRecord(state["val"]) ? state["val"] : {};

  return {
    id,
    status: stringValue(value["status"]),
    statusReason: stringValue(value["statusReason"]) ?? stringValue(value["status_reason"]) ?? null,
    toolkit: isRecord(value["toolkit"])
      ? { slug: stringValue(value["toolkit"]["slug"]) }
      : undefined,
    authConfig: isRecord(value["authConfig"])
      ? {
          id: stringValue(value["authConfig"]["id"]),
          name: stringValue(value["authConfig"]["name"]),
        }
      : undefined,
    alias: stringValue(value["alias"]) ?? null,
    isDisabled: value["isDisabled"] === true || value["is_disabled"] === true,
    scopes: [
      ...scopeArray(data["scope"]),
      ...scopeArray(data["scopes"]),
      ...scopeArray(params["scope"]),
      ...scopeArray(params["scopes"]),
      ...scopeArray(stateVal["scope"]),
      ...scopeArray(stateVal["scopes"]),
    ],
  };
}

function toAuthConfigSummary(value: unknown): AuthConfigSummary | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value["id"]);
  if (!id) return null;
  const toolkit = isRecord(value["toolkit"]) ? value["toolkit"] : {};
  const toolAccessConfig = isRecord(value["toolAccessConfig"])
    ? value["toolAccessConfig"]
    : isRecord(value["tool_access_config"])
      ? value["tool_access_config"]
      : {};

  return {
    id,
    toolkit: isRecord(toolkit) ? { slug: stringValue(toolkit["slug"]) } : undefined,
    toolAccessConfig: {
      toolsAvailableForExecution: asStringArray(
        toolAccessConfig["toolsAvailableForExecution"] ??
          toolAccessConfig["tools_available_for_execution"],
      ),
      toolsForConnectedAccountCreation: asStringArray(
        toolAccessConfig["toolsForConnectedAccountCreation"] ??
          toolAccessConfig["tools_for_connected_account_creation"],
      ),
    },
    restrictToFollowingTools: asStringArray(
      value["restrictToFollowingTools"] ?? value["restrict_to_following_tools"],
    ),
  };
}

function accountsFromListResult(result: unknown): ConnectedAccount[] {
  if (Array.isArray(result))
    return result.map(toConnectedAccount).filter((a): a is ConnectedAccount => a !== null);
  if (isRecord(result) && Array.isArray(result["items"])) {
    return result["items"].map(toConnectedAccount).filter((a): a is ConnectedAccount => a !== null);
  }
  if (isRecord(result) && Array.isArray(result["data"])) {
    return result["data"].map(toConnectedAccount).filter((a): a is ConnectedAccount => a !== null);
  }
  return [];
}

function authConfigsFromListResult(result: unknown): AuthConfigSummary[] {
  if (Array.isArray(result))
    return result.map(toAuthConfigSummary).filter((a): a is AuthConfigSummary => a !== null);
  if (isRecord(result) && Array.isArray(result["items"])) {
    return result["items"]
      .map(toAuthConfigSummary)
      .filter((a): a is AuthConfigSummary => a !== null);
  }
  if (isRecord(result) && Array.isArray(result["data"])) {
    return result["data"]
      .map(toAuthConfigSummary)
      .filter((a): a is AuthConfigSummary => a !== null);
  }
  return [];
}

function isActive(account: ConnectedAccount): boolean {
  if (account.isDisabled) return false;
  return !account.status || account.status.toUpperCase() === "ACTIVE";
}

function isToolkit(account: ConnectedAccount, toolkit: string): boolean {
  return !account.toolkit?.slug || account.toolkit.slug.toLowerCase() === toolkit;
}

function hasGmailNotifyScopes(account: ConnectedAccount): boolean {
  const scopes = new Set(account.scopes ?? []);
  if (scopes.has("https://mail.google.com/")) return true;
  const canSend = scopes.has("https://www.googleapis.com/auth/gmail.send");
  const canReadProfile =
    scopes.has("https://www.googleapis.com/auth/gmail.metadata") ||
    scopes.has("https://www.googleapis.com/auth/gmail.readonly") ||
    scopes.has("https://www.googleapis.com/auth/gmail.modify");
  return canSend && canReadProfile;
}

function authConfigAllowsGmailSend(config: AuthConfigSummary): boolean {
  const tools = [
    ...(config.toolAccessConfig?.toolsForConnectedAccountCreation ?? []),
    ...(config.toolAccessConfig?.toolsAvailableForExecution ?? []),
    ...(config.restrictToFollowingTools ?? []),
  ];
  return tools.includes(GMAIL_SEND_TOOL);
}

async function withConnectedAccountDetails(
  client: ComposioSetupClient,
  account: ConnectedAccount,
): Promise<ConnectedAccount> {
  if (!client.connectedAccounts.get) return account;
  const detailed = toConnectedAccount(await client.connectedAccounts.get(account.id));
  return detailed ?? account;
}

async function listActiveSlackAccounts(
  client: ComposioSetupClient,
  userId: string,
): Promise<ConnectedAccount[]> {
  return listActiveToolkitAccounts(client, userId, SLACK_TOOLKIT);
}

async function listActiveGmailAccounts(
  client: ComposioSetupClient,
  userId: string,
): Promise<ConnectedAccount[]> {
  return listActiveToolkitAccounts(client, userId, GMAIL_TOOLKIT);
}

async function listUsableGmailAccounts(
  client: ComposioSetupClient,
  userId: string,
): Promise<ConnectedAccount[]> {
  const accounts = await listActiveGmailAccounts(client, userId);
  const detailed = await Promise.all(
    accounts.map((account) => withConnectedAccountDetails(client, account)),
  );
  const usable: ConnectedAccount[] = [];
  for (const account of detailed) {
    if (await accountCanSendGmail(client, account)) {
      usable.push(account);
    }
  }
  return usable;
}

async function listActiveToolkitAccounts(
  client: ComposioSetupClient,
  userId: string,
  toolkit: string,
): Promise<ConnectedAccount[]> {
  const result = await client.connectedAccounts.list({
    userIds: [userId],
    toolkitSlugs: [toolkit],
    statuses: ["ACTIVE"],
    limit: 25,
  });
  return accountsFromListResult(result).filter(
    (account) => isActive(account) && isToolkit(account, toolkit),
  );
}

async function verifyConnectedAccount(
  client: ComposioSetupClient,
  userId: string,
  connectedAccountId: string,
): Promise<ConnectedAccount> {
  return verifyConnectedAccountForToolkit(
    client,
    userId,
    connectedAccountId,
    SLACK_TOOLKIT,
    "Slack",
    () => listActiveSlackAccounts(client, userId),
  );
}

async function verifyConnectedAccountForToolkit(
  client: ComposioSetupClient,
  userId: string,
  connectedAccountId: string,
  toolkit: string,
  label: string,
  fallbackList?: () => Promise<ConnectedAccount[]>,
): Promise<ConnectedAccount> {
  const account = client.connectedAccounts.get
    ? toConnectedAccount(await client.connectedAccounts.get(connectedAccountId))
    : ((await fallbackList?.())?.find((candidate) => candidate.id === connectedAccountId) ?? null);

  if (!account) {
    throw new ComposioSetupError(
      `Could not find Composio connected account ${connectedAccountId} for user ${userId}.`,
    );
  }
  if (!isToolkit(account, toolkit)) {
    throw new ComposioSetupError(
      `Connected account ${connectedAccountId} is not a ${label} account.`,
    );
  }
  if (!isActive(account)) {
    throw new ComposioSetupError(
      `Connected account ${connectedAccountId} is not ACTIVE (status: ${account.status ?? "unknown"}).`,
    );
  }
  return account;
}

async function getAuthConfig(
  client: ComposioSetupClient,
  authConfigId: string,
): Promise<AuthConfigSummary | null> {
  const result = client.authConfigs?.get
    ? await client.authConfigs.get(authConfigId)
    : client.authConfigs?.retrieve
      ? await client.authConfigs.retrieve(authConfigId)
      : null;
  return toAuthConfigSummary(result);
}

async function accountCanSendGmail(
  client: ComposioSetupClient,
  account: ConnectedAccount,
): Promise<boolean> {
  if (hasGmailNotifyScopes(account)) return true;
  const authConfigId = account.authConfig?.id;
  if (!authConfigId) return false;
  const authConfig = await getAuthConfig(client, authConfigId);
  return authConfig ? authConfigAllowsGmailSend(authConfig) : false;
}

async function chooseAccount(
  accounts: ConnectedAccount[],
  nonInteractive: boolean,
  label = "Slack",
): Promise<ConnectedAccount> {
  if (accounts.length === 1) return accounts[0]!;

  if (nonInteractive) {
    throw new ComposioSetupError(
      `Multiple active ${label} connected accounts found. Re-run with --connected-account-id.\n` +
        accounts.map((account) => `  - ${account.id}`).join("\n"),
    );
  }

  const clack = await import("@clack/prompts");
  const selected = await clack.select({
    message: `Select the ${label} connected account AO should use:`,
    options: accounts.map((account) => ({
      value: account.id,
      label: account.alias ? `${account.alias} (${account.id})` : account.id,
    })),
  });

  if (clack.isCancel(selected)) {
    throw new ComposioSetupError("Setup cancelled.", 0);
  }

  return accounts.find((account) => account.id === selected)!;
}

function toConnectionRequest(value: unknown): ConnectionRequest {
  if (!isRecord(value)) return {};
  return {
    id: stringValue(value["id"]),
    redirectUrl: stringValue(value["redirectUrl"]),
    waitForConnection:
      typeof value["waitForConnection"] === "function"
        ? (value["waitForConnection"] as (timeout?: number) => Promise<unknown>)
        : undefined,
  };
}

async function resolveManagedAuthConfigId(
  client: ComposioSetupClient,
  toolkit: string,
  label: string,
  name: string,
  options: {
    scopes?: readonly string[];
    toolsForConnectedAccountCreation?: string[];
    existingAuthConfigPredicate?: (config: AuthConfigSummary) => boolean;
    forceCreate?: boolean;
  } = {},
): Promise<string> {
  if (!options.forceCreate) {
    const existing = client.authConfigs?.list
      ? authConfigsFromListResult(await client.authConfigs.list({ toolkit })).find(
          (config) =>
            (!config.toolkit?.slug || config.toolkit.slug.toLowerCase() === toolkit) &&
            (!options.existingAuthConfigPredicate || options.existingAuthConfigPredicate(config)),
        )?.id
      : undefined;
    if (existing) return existing;
  }

  if (!client.authConfigs?.create) {
    throw new ComposioSetupError(
      `Composio SDK client does not expose authConfigs.create(); connect ${label} in Composio and pass --connected-account-id.`,
    );
  }

  const created = await client.authConfigs.create(toolkit, {
    type: "use_composio_managed_auth",
    name,
    ...(options.scopes ? { credentials: { scopes: [...options.scopes] } } : {}),
    ...(options.toolsForConnectedAccountCreation
      ? {
          toolAccessConfig: {
            toolsForConnectedAccountCreation: options.toolsForConnectedAccountCreation,
          },
        }
      : {}),
  });
  const createdId = isRecord(created) ? stringValue(created["id"]) : undefined;
  if (!createdId) {
    throw new ComposioSetupError(`Could not create a Composio ${label} auth config.`);
  }

  return createdId;
}

async function createConnectionRequest(
  client: ComposioSetupClient,
  userId: string,
  waitMs: number,
): Promise<{ account?: ConnectedAccount; url?: string }> {
  return createManagedOAuthConnectionRequest(
    client,
    userId,
    SLACK_TOOLKIT,
    "Slack",
    "Slack Auth Config",
    waitMs,
  );
}

async function createManagedOAuthConnectionRequest(
  client: ComposioSetupClient,
  userId: string,
  toolkit: string,
  label: string,
  authConfigName: string,
  waitMs: number,
  options: {
    scopes?: readonly string[];
    toolsForConnectedAccountCreation?: string[];
    existingAuthConfigPredicate?: (config: AuthConfigSummary) => boolean;
    forceCreateAuthConfig?: boolean;
  } = {},
): Promise<{ account?: ConnectedAccount; url?: string }> {
  let request: ConnectionRequest;

  if (client.connectedAccounts.link) {
    const authConfigId = await resolveManagedAuthConfigId(client, toolkit, label, authConfigName, {
      scopes: options.scopes,
      toolsForConnectedAccountCreation: options.toolsForConnectedAccountCreation,
      existingAuthConfigPredicate: options.existingAuthConfigPredicate,
      forceCreate: options.forceCreateAuthConfig,
    });
    request = toConnectionRequest(
      await client.connectedAccounts.link(userId, authConfigId, { allowMultiple: true }),
    );
  } else if (client.toolkits?.authorize) {
    request = toConnectionRequest(await client.toolkits.authorize(userId, toolkit));
  } else {
    throw new ComposioSetupError(
      `Composio SDK client does not expose connectedAccounts.link(); connect ${label} in Composio and pass --connected-account-id.`,
    );
  }

  if (request.redirectUrl) {
    console.log(chalk.cyan(`Open this Composio ${label} connect URL: ${request.redirectUrl}`));
  }

  if (!request.id && !request.waitForConnection) {
    return { url: request.redirectUrl };
  }

  try {
    const connected = request.waitForConnection
      ? await request.waitForConnection(waitMs)
      : await client.connectedAccounts.waitForConnection?.(request.id!, waitMs);
    const account = toConnectedAccount(connected);
    return account ? { account, url: request.redirectUrl } : { url: request.redirectUrl };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(chalk.yellow(`Connection did not complete yet: ${message}`));
    return { url: request.redirectUrl };
  }
}

function parseWaitMs(value: string | undefined): number {
  if (!value) return 60_000;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new ComposioSetupError("--wait-ms must be a non-negative number.");
  }
  return parsed;
}

function channelConfig(channel: string | undefined): Record<string, string> {
  const value = stringValue(channel);
  if (!value) return {};
  if (/^[CGD][A-Z0-9]{8,}$/.test(value)) {
    return { channelId: value };
  }
  return { channelName: value };
}

function parseDiscordWebhookUrl(webhookUrl: string): { webhookId: string; webhookToken: string } {
  let parsed: URL;
  try {
    parsed = new URL(webhookUrl);
  } catch {
    throw new ComposioSetupError(
      "Invalid Discord webhook URL. Expected https://discord.com/api/webhooks/WEBHOOK_ID/WEBHOOK_TOKEN.",
    );
  }

  const segments = parsed.pathname.split("/").filter(Boolean);
  const webhookIndex = segments.findIndex((segment) => segment === "webhooks");
  const webhookId = webhookIndex >= 0 ? segments[webhookIndex + 1] : undefined;
  const webhookToken = webhookIndex >= 0 ? segments[webhookIndex + 2] : undefined;
  if (!webhookId || !webhookToken) {
    throw new ComposioSetupError(
      "Invalid Discord webhook URL. Expected https://discord.com/api/webhooks/WEBHOOK_ID/WEBHOOK_TOKEN.",
    );
  }

  return {
    webhookId: decodeURIComponent(webhookId),
    webhookToken: decodeURIComponent(webhookToken),
  };
}

async function createDiscordBearerConnectedAccount(
  client: ComposioSetupClient,
  userId: string,
  token: string,
  name: string,
): Promise<string> {
  if (!client.authConfigs?.create) {
    throw new ComposioSetupError(
      "Composio SDK client does not expose authConfigs.create(); pass --connected-account-id.",
    );
  }
  if (!client.connectedAccounts.initiate) {
    throw new ComposioSetupError(
      "Composio SDK client does not expose connectedAccounts.initiate(); pass --connected-account-id.",
    );
  }

  const authConfig = await client.authConfigs.create(DISCORD_TOOLKIT, {
    type: "use_custom_auth",
    name,
    authScheme: "BEARER_TOKEN",
  });
  const authConfigId = isRecord(authConfig) ? stringValue(authConfig["id"]) : undefined;
  if (!authConfigId) {
    throw new ComposioSetupError("Could not create a Composio Discord auth config.");
  }

  const request = toConnectionRequest(
    await client.connectedAccounts.initiate(userId, authConfigId, {
      config: {
        authScheme: "BEARER_TOKEN",
        val: {
          status: "ACTIVE",
          token,
        },
      },
    }),
  );

  if (!request.id) {
    throw new ComposioSetupError("Could not create a Composio Discord connected account.");
  }

  return request.id;
}

async function validateDiscordBotChannelAccess(botToken: string, channelId: string): Promise<void> {
  const res = await fetch(`https://discord.com/api/v10/channels/${encodeURIComponent(channelId)}`, {
    headers: {
      Authorization: `Bot ${botToken}`,
    },
  });

  if (res.ok) return;

  let message = `${res.status} ${res.statusText}`.trim();
  try {
    const body = (await res.json()) as unknown;
    if (isRecord(body) && stringValue(body["message"])) {
      message = `${res.status} ${stringValue(body["message"])}`;
    }
  } catch {
    // Keep the HTTP status message.
  }

  if (res.status === 401) {
    throw new ComposioSetupError(`Discord bot token is invalid (${message}).`);
  }
  if (res.status === 403) {
    throw new ComposioSetupError(
      `Discord bot cannot access channel ${channelId} (${message}). Invite the bot to the server and grant View Channel + Send Messages.`,
    );
  }
  throw new ComposioSetupError(`Could not validate Discord channel ${channelId}: ${message}.`);
}

function writeComposioConfig(configPath: string, resolved: ResolvedComposioSetup): void {
  const rawYaml = readFileSync(configPath, "utf-8");
  const doc = parseDocument(rawYaml);
  const rawConfig = (doc.toJS() as Record<string, unknown>) ?? {};
  const notifiers = isRecord(rawConfig["notifiers"]) ? rawConfig["notifiers"] : {};
  const existing = isRecord(notifiers["composio"]) ? notifiers["composio"] : {};

  const composioConfig: Record<string, unknown> = {
    ...existing,
    plugin: "composio",
    defaultApp: "slack",
    userId: resolved.userId,
    ...channelConfig(resolved.channel),
  };

  if (resolved.connectedAccountId) {
    composioConfig["connectedAccountId"] = resolved.connectedAccountId;
  } else {
    delete composioConfig["connectedAccountId"];
  }

  if (resolved.shouldWriteApiKey) {
    composioConfig["composioApiKey"] = resolved.apiKey;
  }

  delete composioConfig["entityId"];
  notifiers["composio"] = composioConfig;
  rawConfig["notifiers"] = notifiers;

  const defaults = isRecord(rawConfig["defaults"]) ? rawConfig["defaults"] : {};
  defaults["notifiers"] = uniqueWithComposio(asStringArray(defaults["notifiers"]));
  rawConfig["defaults"] = defaults;

  const notificationRouting = isRecord(rawConfig["notificationRouting"])
    ? rawConfig["notificationRouting"]
    : {};
  for (const priority of PRIORITIES) {
    const current = asStringArray(notificationRouting[priority]);
    const base = current.length > 0 ? current : asStringArray(defaults["notifiers"]);
    notificationRouting[priority] = uniqueWithComposio(base);
  }
  rawConfig["notificationRouting"] = notificationRouting;

  if (!isCanonicalGlobalConfigPath(configPath)) {
    const currentSchema = doc.get("$schema");
    if (!(typeof currentSchema === "string" && currentSchema.trim().length > 0)) {
      doc.set("$schema", CONFIG_SCHEMA_URL);
    }
  }

  doc.setIn(["notifiers"], rawConfig["notifiers"]);
  doc.setIn(["defaults"], rawConfig["defaults"]);
  doc.setIn(["notificationRouting"], rawConfig["notificationRouting"]);

  writeFileSync(configPath, doc.toString({ indent: 2 }));
}

function writeComposioDiscordConfig(configPath: string, resolved: ResolvedDiscordSetup): void {
  const rawYaml = readFileSync(configPath, "utf-8");
  const doc = parseDocument(rawYaml);
  const rawConfig = (doc.toJS() as Record<string, unknown>) ?? {};
  const notifiers = isRecord(rawConfig["notifiers"]) ? rawConfig["notifiers"] : {};
  const existingRaw = notifiers[resolved.targetName];
  const existing = isRecord(existingRaw) ? existingRaw : {};

  const composioConfig: Record<string, unknown> = {
    ...existing,
    plugin: "composio",
    defaultApp: "discord",
    mode: resolved.mode,
    userId: resolved.userId,
    toolVersion: DISCORD_TOOL_VERSION,
  };

  if (resolved.mode === "webhook") {
    composioConfig["webhookUrl"] = resolved.webhookUrl;
    delete composioConfig["channelId"];
    delete composioConfig["channelName"];
  } else {
    composioConfig["channelId"] = resolved.channelId;
    delete composioConfig["webhookUrl"];
  }

  if (resolved.connectedAccountId) {
    composioConfig["connectedAccountId"] = resolved.connectedAccountId;
  } else {
    delete composioConfig["connectedAccountId"];
  }

  if (resolved.shouldWriteApiKey) {
    composioConfig["composioApiKey"] = resolved.apiKey;
  }

  delete composioConfig["entityId"];
  delete composioConfig["botToken"];
  notifiers[resolved.targetName] = composioConfig;
  rawConfig["notifiers"] = notifiers;

  const defaults = isRecord(rawConfig["defaults"]) ? rawConfig["defaults"] : {};
  defaults["notifiers"] = uniqueWithTarget(
    asStringArray(defaults["notifiers"]),
    resolved.targetName,
  );
  rawConfig["defaults"] = defaults;

  const notificationRouting = isRecord(rawConfig["notificationRouting"])
    ? rawConfig["notificationRouting"]
    : {};
  for (const priority of PRIORITIES) {
    const current = asStringArray(notificationRouting[priority]);
    const base = current.length > 0 ? current : asStringArray(defaults["notifiers"]);
    notificationRouting[priority] = uniqueWithTarget(base, resolved.targetName);
  }
  rawConfig["notificationRouting"] = notificationRouting;

  if (!isCanonicalGlobalConfigPath(configPath)) {
    const currentSchema = doc.get("$schema");
    if (!(typeof currentSchema === "string" && currentSchema.trim().length > 0)) {
      doc.set("$schema", CONFIG_SCHEMA_URL);
    }
  }

  doc.setIn(["notifiers"], rawConfig["notifiers"]);
  doc.setIn(["defaults"], rawConfig["defaults"]);
  doc.setIn(["notificationRouting"], rawConfig["notificationRouting"]);

  writeFileSync(configPath, doc.toString({ indent: 2 }));
}

function writeComposioMailConfig(configPath: string, resolved: ResolvedMailSetup): void {
  const rawYaml = readFileSync(configPath, "utf-8");
  const doc = parseDocument(rawYaml);
  const rawConfig = (doc.toJS() as Record<string, unknown>) ?? {};
  const notifiers = isRecord(rawConfig["notifiers"]) ? rawConfig["notifiers"] : {};
  const existingRaw = notifiers[COMPOSIO_MAIL_NOTIFIER];
  const existing = isRecord(existingRaw) ? existingRaw : {};

  const composioConfig: Record<string, unknown> = {
    ...existing,
    plugin: "composio",
    defaultApp: "gmail",
    userId: resolved.userId,
    emailTo: resolved.emailTo,
    toolVersion: GMAIL_TOOL_VERSION,
  };

  if (resolved.connectedAccountId) {
    composioConfig["connectedAccountId"] = resolved.connectedAccountId;
  } else {
    delete composioConfig["connectedAccountId"];
  }

  if (resolved.shouldWriteApiKey) {
    composioConfig["composioApiKey"] = resolved.apiKey;
  }

  delete composioConfig["entityId"];
  delete composioConfig["channelId"];
  delete composioConfig["channelName"];
  delete composioConfig["webhookUrl"];
  delete composioConfig["mode"];
  notifiers[COMPOSIO_MAIL_NOTIFIER] = composioConfig;
  rawConfig["notifiers"] = notifiers;

  const defaults = isRecord(rawConfig["defaults"]) ? rawConfig["defaults"] : {};
  defaults["notifiers"] = uniqueWithTarget(
    asStringArray(defaults["notifiers"]),
    COMPOSIO_MAIL_NOTIFIER,
  );
  rawConfig["defaults"] = defaults;

  const notificationRouting = isRecord(rawConfig["notificationRouting"])
    ? rawConfig["notificationRouting"]
    : {};
  for (const priority of PRIORITIES) {
    const current = asStringArray(notificationRouting[priority]);
    const base = current.length > 0 ? current : asStringArray(defaults["notifiers"]);
    notificationRouting[priority] = uniqueWithTarget(base, COMPOSIO_MAIL_NOTIFIER);
  }
  rawConfig["notificationRouting"] = notificationRouting;

  if (!isCanonicalGlobalConfigPath(configPath)) {
    const currentSchema = doc.get("$schema");
    if (!(typeof currentSchema === "string" && currentSchema.trim().length > 0)) {
      doc.set("$schema", CONFIG_SCHEMA_URL);
    }
  }

  doc.setIn(["notifiers"], rawConfig["notifiers"]);
  doc.setIn(["defaults"], rawConfig["defaults"]);
  doc.setIn(["notificationRouting"], rawConfig["notificationRouting"]);

  writeFileSync(configPath, doc.toString({ indent: 2 }));
}

function printStatus(
  resolved: Pick<ResolvedComposioSetup, "apiKey" | "userId" | "connectedAccountId">,
  accounts: ConnectedAccount[],
): void {
  console.log(chalk.bold("AO Composio notifier"));
  console.log("  api key: configured");
  console.log(`  userId: ${resolved.userId}`);
  console.log(`  connectedAccountId: ${resolved.connectedAccountId ?? "not configured"}`);
  console.log(`  active Slack accounts: ${accounts.length}`);
  for (const account of accounts) {
    console.log(`    - ${account.id}${account.alias ? ` (${account.alias})` : ""}`);
  }
}

function printDiscordStatus(
  resolved: Pick<ResolvedDiscordSetup, "userId" | "connectedAccountId" | "targetName" | "mode">,
): void {
  console.log(chalk.bold(`AO Composio Discord notifier (${resolved.targetName})`));
  console.log("  api key: configured");
  console.log(`  mode: ${resolved.mode}`);
  console.log(`  userId: ${resolved.userId}`);
  console.log(`  connectedAccountId: ${resolved.connectedAccountId ?? "not configured"}`);
}

function printMailStatus(
  resolved: Pick<ResolvedMailSetup, "userId" | "connectedAccountId" | "emailTo">,
  accounts: ConnectedAccount[],
): void {
  console.log(chalk.bold(`AO Composio mail notifier (${COMPOSIO_MAIL_NOTIFIER})`));
  console.log("  api key: configured");
  console.log(`  userId: ${resolved.userId}`);
  console.log(`  emailTo: ${resolved.emailTo ?? "not configured"}`);
  console.log(`  connectedAccountId: ${resolved.connectedAccountId ?? "not configured"}`);
  console.log(`  active Gmail accounts: ${accounts.length}`);
  for (const account of accounts) {
    console.log(`    - ${account.id}${account.alias ? ` (${account.alias})` : ""}`);
  }
}

async function resolveSetup(
  opts: ComposioSetupOptions,
  rawConfig: Record<string, unknown>,
  nonInteractive: boolean,
): Promise<ResolvedComposioSetup> {
  const existing = getExistingComposioConfig(rawConfig);
  const { apiKey, shouldWriteApiKey } = resolveApiKey(opts, existing);
  if (!apiKey) {
    throw new ComposioSetupError(
      "No Composio API key found. Pass --api-key or set COMPOSIO_API_KEY.",
    );
  }

  const userId = resolveUserId(opts, existing);
  const client = await loadComposioClient(apiKey);
  const explicitConnectedAccountId =
    stringValue(opts.connectedAccountId) ?? stringValue(existing["connectedAccountId"]);

  if (opts.status) {
    const accounts = await listActiveSlackAccounts(client, userId);
    printStatus({ apiKey, userId, connectedAccountId: explicitConnectedAccountId }, accounts);
    return {
      apiKey,
      shouldWriteApiKey,
      userId,
      channel: stringValue(opts.channel),
      connectedAccountId: explicitConnectedAccountId,
    };
  }

  if (explicitConnectedAccountId) {
    const account = await verifyConnectedAccount(client, userId, explicitConnectedAccountId);
    return {
      apiKey,
      shouldWriteApiKey,
      userId,
      channel: stringValue(opts.channel),
      connectedAccountId: account.id,
    };
  }

  const accounts = await listActiveSlackAccounts(client, userId);
  if (accounts.length > 0) {
    const account = await chooseAccount(accounts, nonInteractive);
    return {
      apiKey,
      shouldWriteApiKey,
      userId,
      channel: stringValue(opts.channel),
      connectedAccountId: account.id,
    };
  }

  const connection = await createConnectionRequest(client, userId, parseWaitMs(opts.waitMs));
  return {
    apiKey,
    shouldWriteApiKey,
    userId,
    channel: stringValue(opts.channel),
    connectedAccountId: connection.account?.id,
    connectionUrl: connection.url,
  };
}

export async function runComposioSetupAction(opts: ComposioSetupOptions): Promise<void> {
  const nonInteractive = opts.nonInteractive || !process.stdin.isTTY;

  let configPath: string | undefined;
  try {
    configPath = findConfigFile() ?? undefined;
  } catch {
    configPath = undefined;
  }

  if (!configPath) {
    throw new ComposioSetupError(
      "No agent-orchestrator.yaml found. Run 'ao start' first to create one.",
    );
  }

  const rawYaml = readFileSync(configPath, "utf-8");
  const doc = parseDocument(rawYaml);
  const rawConfig = (doc.toJS() as Record<string, unknown>) ?? {};
  const existing = getExistingComposioConfig(rawConfig);
  const existingPlugin = stringValue(existing["plugin"]);

  if (existingPlugin && existingPlugin !== "composio" && !opts.force) {
    throw new ComposioSetupError(
      `notifiers.composio already uses plugin "${existingPlugin}". Re-run with --force to replace it.`,
    );
  }

  const resolved = await resolveSetup(opts, rawConfig, nonInteractive);
  if (opts.status) return;

  writeComposioConfig(configPath, resolved);
  console.log(chalk.green(`✓ Config written to ${configPath}`));

  if (resolved.connectedAccountId) {
    console.log(chalk.green(`✓ Slack connected account: ${resolved.connectedAccountId}`));
  } else if (resolved.connectionUrl) {
    console.log(
      chalk.yellow(
        "Composio config was written, but Slack is not connected yet. Open the connect URL above, then rerun `ao setup composio`.",
      ),
    );
  }

  console.log(chalk.dim("Test it with: ao notify test --to composio --template ci-failing"));
}

async function resolveDiscordWebhookSetup(
  opts: ComposioDiscordWebhookSetupOptions,
  rawConfig: Record<string, unknown>,
): Promise<ResolvedDiscordSetup> {
  const targetName = COMPOSIO_DISCORD_WEBHOOK_NOTIFIER;
  const existing = getExistingNotifierConfig(rawConfig, targetName);
  const { apiKey, shouldWriteApiKey } = resolveApiKey(opts, existing);
  if (!apiKey) {
    throw new ComposioSetupError(
      "No Composio API key found. Pass --api-key or set COMPOSIO_API_KEY.",
    );
  }

  const userId = resolveUserId(opts, existing);
  const client = await loadComposioClient(apiKey);
  const connectedAccountId =
    stringValue(opts.connectedAccountId) ?? stringValue(existing["connectedAccountId"]);
  const webhookUrl =
    stringValue(opts.webhookUrl) ??
    stringValue(process.env.DISCORD_WEBHOOK_URL) ??
    stringValue(existing["webhookUrl"]);

  if (opts.status) {
    printDiscordStatus({ targetName, mode: "webhook", userId, connectedAccountId });
    return {
      apiKey,
      shouldWriteApiKey,
      userId,
      mode: "webhook",
      targetName,
      webhookUrl,
      connectedAccountId,
    };
  }

  if (!webhookUrl) {
    throw new ComposioSetupError(
      "No Discord webhook URL found. Pass --webhook-url or set DISCORD_WEBHOOK_URL.",
    );
  }
  const parsedWebhook = parseDiscordWebhookUrl(webhookUrl);

  if (connectedAccountId) {
    const account = await verifyConnectedAccountForToolkit(
      client,
      userId,
      connectedAccountId,
      DISCORD_TOOLKIT,
      "Discord Bot",
    );
    return {
      apiKey,
      shouldWriteApiKey,
      userId,
      mode: "webhook",
      targetName,
      webhookUrl,
      connectedAccountId: account.id,
    };
  }

  return {
    apiKey,
    shouldWriteApiKey,
    userId,
    mode: "webhook",
    targetName,
    webhookUrl,
    connectedAccountId: await createDiscordBearerConnectedAccount(
      client,
      userId,
      parsedWebhook.webhookToken,
      "Discord Webhook Auth Config",
    ),
  };
}

async function resolveDiscordBotSetup(
  opts: ComposioDiscordBotSetupOptions,
  rawConfig: Record<string, unknown>,
): Promise<ResolvedDiscordSetup> {
  const targetName = COMPOSIO_DISCORD_BOT_NOTIFIER;
  const existing = getExistingNotifierConfig(rawConfig, targetName);
  const { apiKey, shouldWriteApiKey } = resolveApiKey(opts, existing);
  if (!apiKey) {
    throw new ComposioSetupError(
      "No Composio API key found. Pass --api-key or set COMPOSIO_API_KEY.",
    );
  }

  const userId = resolveUserId(opts, existing);
  const client = await loadComposioClient(apiKey);
  const connectedAccountId =
    stringValue(opts.connectedAccountId) ?? stringValue(existing["connectedAccountId"]);
  const channelId = stringValue(opts.channelId) ?? stringValue(existing["channelId"]);
  const botToken = stringValue(opts.botToken) ?? stringValue(process.env.DISCORD_BOT_TOKEN);

  if (opts.status) {
    printDiscordStatus({ targetName, mode: "bot", userId, connectedAccountId });
    return {
      apiKey,
      shouldWriteApiKey,
      userId,
      mode: "bot",
      targetName,
      channelId,
      connectedAccountId,
    };
  }

  if (!channelId) {
    throw new ComposioSetupError("No Discord channel id found. Pass --channel-id.");
  }

  if (connectedAccountId) {
    const account = await verifyConnectedAccountForToolkit(
      client,
      userId,
      connectedAccountId,
      DISCORD_TOOLKIT,
      "Discord Bot",
    );
    return {
      apiKey,
      shouldWriteApiKey,
      userId,
      mode: "bot",
      targetName,
      channelId,
      connectedAccountId: account.id,
    };
  }

  if (!botToken) {
    throw new ComposioSetupError(
      "No Discord bot token found. Pass --bot-token or set DISCORD_BOT_TOKEN.",
    );
  }

  await validateDiscordBotChannelAccess(botToken, channelId);

  return {
    apiKey,
    shouldWriteApiKey,
    userId,
    mode: "bot",
    targetName,
    channelId,
    connectedAccountId: await createDiscordBearerConnectedAccount(
      client,
      userId,
      botToken,
      "Discord Bot Auth Config",
    ),
  };
}

async function resolveMailSetup(
  opts: ComposioMailSetupOptions,
  rawConfig: Record<string, unknown>,
  nonInteractive: boolean,
): Promise<ResolvedMailSetup> {
  const existing = getExistingNotifierConfig(rawConfig, COMPOSIO_MAIL_NOTIFIER);
  const { apiKey, shouldWriteApiKey } = resolveApiKey(opts, existing);
  if (!apiKey) {
    throw new ComposioSetupError(
      "No Composio API key found. Pass --api-key or set COMPOSIO_API_KEY.",
    );
  }

  const userId = resolveUserId(opts, existing);
  const client = await loadComposioClient(apiKey);
  const emailTo = stringValue(opts.emailTo) ?? stringValue(existing["emailTo"]);
  const optionConnectedAccountId = stringValue(opts.connectedAccountId);
  const existingConnectedAccountId = stringValue(existing["connectedAccountId"]);
  const connectedAccountId = optionConnectedAccountId ?? existingConnectedAccountId;

  if (opts.status) {
    const accounts = await listActiveGmailAccounts(client, userId);
    printMailStatus({ userId, emailTo, connectedAccountId }, accounts);
    return {
      apiKey,
      shouldWriteApiKey,
      userId,
      emailTo,
      connectedAccountId,
    };
  }

  if (!emailTo) {
    throw new ComposioSetupError("No recipient email found. Pass --email-to.");
  }

  if (connectedAccountId) {
    const account = await withConnectedAccountDetails(
      client,
      await verifyConnectedAccountForToolkit(
        client,
        userId,
        connectedAccountId,
        GMAIL_TOOLKIT,
        "Gmail",
        () => listActiveGmailAccounts(client, userId),
      ),
    );
    if (await accountCanSendGmail(client, account)) {
      return {
        apiKey,
        shouldWriteApiKey,
        userId,
        emailTo,
        connectedAccountId: account.id,
      };
    }
    if (optionConnectedAccountId) {
      throw new ComposioSetupError(
        `Connected account ${connectedAccountId} is missing Gmail send/profile scopes. Reconnect Gmail with \`ao setup composio-mail --email-to ${emailTo}\` and do not pass --connected-account-id.`,
      );
    }
    console.log(
      chalk.yellow(
        `Existing Gmail connected account ${connectedAccountId} is missing Gmail send/profile scopes. Creating a fresh Composio Gmail connect request.`,
      ),
    );
  }

  const accounts = await listUsableGmailAccounts(client, userId);
  if (accounts.length > 0) {
    const account = await chooseAccount(accounts, nonInteractive, "Gmail");
    return {
      apiKey,
      shouldWriteApiKey,
      userId,
      emailTo,
      connectedAccountId: account.id,
    };
  }

  const connection = await createManagedOAuthConnectionRequest(
    client,
    userId,
    GMAIL_TOOLKIT,
    "Gmail",
    "Gmail Auth Config",
    parseWaitMs(opts.waitMs),
    {
      toolsForConnectedAccountCreation: [GMAIL_SEND_TOOL],
      existingAuthConfigPredicate: authConfigAllowsGmailSend,
    },
  );
  return {
    apiKey,
    shouldWriteApiKey,
    userId,
    emailTo,
    connectedAccountId: connection.account?.id,
    connectionUrl: connection.url,
  };
}

export async function runComposioDiscordWebhookSetupAction(
  opts: ComposioDiscordWebhookSetupOptions,
): Promise<void> {
  let configPath: string | undefined;
  try {
    configPath = findConfigFile() ?? undefined;
  } catch {
    configPath = undefined;
  }

  if (!configPath) {
    throw new ComposioSetupError(
      "No agent-orchestrator.yaml found. Run 'ao start' first to create one.",
    );
  }

  const rawYaml = readFileSync(configPath, "utf-8");
  const rawConfig = (parseDocument(rawYaml).toJS() as Record<string, unknown>) ?? {};
  const existing = getExistingNotifierConfig(rawConfig, COMPOSIO_DISCORD_WEBHOOK_NOTIFIER);
  const existingPlugin = stringValue(existing["plugin"]);

  if (existingPlugin && existingPlugin !== "composio" && !opts.force) {
    throw new ComposioSetupError(
      `notifiers.${COMPOSIO_DISCORD_WEBHOOK_NOTIFIER} already uses plugin "${existingPlugin}". Re-run with --force to replace it.`,
    );
  }

  const resolved = await resolveDiscordWebhookSetup(opts, rawConfig);
  if (opts.status) return;

  writeComposioDiscordConfig(configPath, resolved);
  console.log(chalk.green(`✓ Config written to ${configPath}`));
  console.log(chalk.green(`✓ Discord webhook connected account: ${resolved.connectedAccountId}`));
  console.log(
    chalk.dim(
      `Test it with: ao notify test --to ${COMPOSIO_DISCORD_WEBHOOK_NOTIFIER} --template basic`,
    ),
  );
}

export async function runComposioDiscordBotSetupAction(
  opts: ComposioDiscordBotSetupOptions,
): Promise<void> {
  let configPath: string | undefined;
  try {
    configPath = findConfigFile() ?? undefined;
  } catch {
    configPath = undefined;
  }

  if (!configPath) {
    throw new ComposioSetupError(
      "No agent-orchestrator.yaml found. Run 'ao start' first to create one.",
    );
  }

  const rawYaml = readFileSync(configPath, "utf-8");
  const rawConfig = (parseDocument(rawYaml).toJS() as Record<string, unknown>) ?? {};
  const existing = getExistingNotifierConfig(rawConfig, COMPOSIO_DISCORD_BOT_NOTIFIER);
  const existingPlugin = stringValue(existing["plugin"]);

  if (existingPlugin && existingPlugin !== "composio" && !opts.force) {
    throw new ComposioSetupError(
      `notifiers.${COMPOSIO_DISCORD_BOT_NOTIFIER} already uses plugin "${existingPlugin}". Re-run with --force to replace it.`,
    );
  }

  const resolved = await resolveDiscordBotSetup(opts, rawConfig);
  if (opts.status) return;

  writeComposioDiscordConfig(configPath, resolved);
  console.log(chalk.green(`✓ Config written to ${configPath}`));
  console.log(chalk.green(`✓ Discord bot connected account: ${resolved.connectedAccountId}`));
  console.log(
    chalk.dim(
      `Test it with: ao notify test --to ${COMPOSIO_DISCORD_BOT_NOTIFIER} --template basic`,
    ),
  );
}

export async function runComposioMailSetupAction(opts: ComposioMailSetupOptions): Promise<void> {
  const nonInteractive = opts.nonInteractive || !process.stdin.isTTY;

  let configPath: string | undefined;
  try {
    configPath = findConfigFile() ?? undefined;
  } catch {
    configPath = undefined;
  }

  if (!configPath) {
    throw new ComposioSetupError(
      "No agent-orchestrator.yaml found. Run 'ao start' first to create one.",
    );
  }

  const rawYaml = readFileSync(configPath, "utf-8");
  const rawConfig = (parseDocument(rawYaml).toJS() as Record<string, unknown>) ?? {};
  const existing = getExistingNotifierConfig(rawConfig, COMPOSIO_MAIL_NOTIFIER);
  const existingPlugin = stringValue(existing["plugin"]);

  if (existingPlugin && existingPlugin !== "composio" && !opts.force) {
    throw new ComposioSetupError(
      `notifiers.${COMPOSIO_MAIL_NOTIFIER} already uses plugin "${existingPlugin}". Re-run with --force to replace it.`,
    );
  }

  const resolved = await resolveMailSetup(opts, rawConfig, nonInteractive);
  if (opts.status) return;

  writeComposioMailConfig(configPath, resolved);
  console.log(chalk.green(`✓ Config written to ${configPath}`));

  if (resolved.connectedAccountId) {
    console.log(chalk.green(`✓ Gmail connected account: ${resolved.connectedAccountId}`));
  } else if (resolved.connectionUrl) {
    console.log(
      chalk.yellow(
        "Composio mail config was written, but Gmail is not connected yet. Open the connect URL above, then rerun `ao setup composio-mail`.",
      ),
    );
  }

  console.log(
    chalk.dim(`Test it with: ao notify test --to ${COMPOSIO_MAIL_NOTIFIER} --template basic`),
  );
}
