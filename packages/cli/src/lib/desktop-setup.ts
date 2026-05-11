import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { homedir, platform } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import chalk from "chalk";
import { parseDocument } from "yaml";
import { CONFIG_SCHEMA_URL, findConfigFile, isCanonicalGlobalConfigPath } from "@aoagents/ao-core";

const APP_NAME = "AO Notifier.app";
const EXECUTABLE_NAME = "ao-notifier";
const PRIORITIES = ["urgent", "action", "warning", "info"] as const;

export class DesktopSetupError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number = 1,
  ) {
    super(message);
    this.name = "DesktopSetupError";
  }
}

export interface DesktopSetupOptions {
  nonInteractive?: boolean;
  force?: boolean;
  status?: boolean;
  uninstall?: boolean;
}

interface JsonRecord {
  [key: string]: unknown;
}

function currentPlatform(): NodeJS.Platform | string {
  return process.env["AO_DESKTOP_SETUP_PLATFORM"] ?? platform();
}

function packageDirFromImport(): string | null {
  try {
    const require = createRequire(import.meta.url);
    return dirname(require.resolve("@aoagents/ao-notifier-macos/package.json"));
  } catch {
    return null;
  }
}

export function getBundledNotifierAppPath(): string | null {
  const override = process.env["AO_NOTIFIER_MACOS_APP_PATH"];
  if (override) return override;

  const packageDir = packageDirFromImport();
  if (packageDir) {
    return resolve(packageDir, "dist", APP_NAME);
  }

  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..", "..", "..", "notifier-macos", "dist", APP_NAME);
}

export function getInstalledNotifierAppPath(): string {
  return process.env["AO_DESKTOP_APP_INSTALL_PATH"] ?? join(homedir(), "Applications", APP_NAME);
}

export function getNotifierExecutablePath(appPath: string): string {
  return join(appPath, "Contents", "MacOS", EXECUTABLE_NAME);
}

function isAppInstalled(appPath = getInstalledNotifierAppPath()): boolean {
  return existsSync(getNotifierExecutablePath(appPath));
}

function execNotifierJson(appPath: string, args: string[]): JsonRecord | null {
  try {
    const output = execFileSync(getNotifierExecutablePath(appPath), args, {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return JSON.parse(output) as JsonRecord;
  } catch {
    return null;
  }
}

function parseJsonOutput(output: unknown): JsonRecord | null {
  try {
    const text = Buffer.isBuffer(output) ? output.toString("utf-8") : String(output ?? "");
    if (!text.trim()) return null;
    return JSON.parse(text) as JsonRecord;
  } catch {
    return null;
  }
}

function formatExecError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}

function permissionDeniedMessage(): string {
  return (
    "macOS notification permission is denied for AO Notifier.app.\n" +
    "  Open System Settings > Notifications > AO Notifier and enable Allow Notifications.\n" +
    "  Then rerun: ao setup desktop --force"
  );
}

function printStatus(): void {
  const os = currentPlatform();
  const appPath = getInstalledNotifierAppPath();
  const installed = isAppInstalled(appPath);
  const version = installed ? execNotifierJson(appPath, ["--version-json"]) : null;
  const permission = installed ? execNotifierJson(appPath, ["--permission-status-json"]) : null;

  console.log(chalk.bold("AO desktop notifier"));
  console.log(`  platform: ${os}`);
  console.log(`  installed: ${installed ? "yes" : "no"}`);
  console.log(`  app: ${appPath}`);
  if (version?.["version"]) {
    console.log(`  version: ${String(version["version"])}`);
  }
  if (permission?.["status"]) {
    console.log(`  permissions: ${String(permission["status"])}`);
  }
}

function copyBundledApp(): string {
  if (currentPlatform() !== "darwin") {
    throw new DesktopSetupError("ao setup desktop is currently only supported on macOS.");
  }

  const sourceAppPath = getBundledNotifierAppPath();
  if (!sourceAppPath || !existsSync(getNotifierExecutablePath(sourceAppPath))) {
    throw new DesktopSetupError(
      "AO Notifier.app is not built. Run: pnpm --filter @aoagents/ao-notifier-macos build",
    );
  }

  const targetAppPath = getInstalledNotifierAppPath();
  mkdirSync(dirname(targetAppPath), { recursive: true });
  rmSync(targetAppPath, { recursive: true, force: true });
  cpSync(sourceAppPath, targetAppPath, { recursive: true });

  if (!existsSync(getNotifierExecutablePath(targetAppPath))) {
    throw new DesktopSetupError(`AO Notifier.app install failed at ${targetAppPath}`);
  }

  return targetAppPath;
}

function requestPermission(appPath: string): void {
  let result: JsonRecord | null = null;

  try {
    const output = execFileSync(getNotifierExecutablePath(appPath), ["--request-permission"], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    result = parseJsonOutput(output);
  } catch (error) {
    const failure = error as { stdout?: unknown; stderr?: unknown };
    result = parseJsonOutput(failure.stdout);
    if (result?.["status"] === "denied") {
      throw new DesktopSetupError(permissionDeniedMessage());
    }

    const stderr = Buffer.isBuffer(failure.stderr)
      ? failure.stderr.toString("utf-8").trim()
      : String(failure.stderr ?? "").trim();
    throw new DesktopSetupError(
      `Could not request macOS notification permission: ${stderr || formatExecError(error)}`,
    );
  }

  if (result?.["status"] === "denied") {
    throw new DesktopSetupError(permissionDeniedMessage());
  }
}

function sendSetupNotification(appPath: string): void {
  const payload = {
    title: "AO Notifier",
    body: "Desktop notifications are ready.",
    sound: false,
    defaultOpenUrl: "http://localhost:3000",
    event: {
      id: `desktop-setup-${Date.now()}`,
      type: "setup.desktop",
      priority: "info",
      sessionId: "setup",
      projectId: "ao",
      timestamp: new Date().toISOString(),
    },
    actions: [{ label: "Open Dashboard", url: "http://localhost:3000" }],
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64");
  try {
    execFileSync(getNotifierExecutablePath(appPath), ["--notify-base64", encoded], {
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const failure = error as { stderr?: unknown };
    const stderr = Buffer.isBuffer(failure.stderr)
      ? failure.stderr.toString("utf-8").trim()
      : String(failure.stderr ?? "").trim();
    throw new DesktopSetupError(
      `Could not send desktop setup test notification: ${stderr || formatExecError(error)}`,
    );
  }
}

function findOptionalConfigPath(): string | undefined {
  try {
    return findConfigFile() ?? undefined;
  } catch {
    return undefined;
  }
}

function arrayOfStrings(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === "string");
  if (typeof value === "string") return [value];
  return [];
}

function uniqueWithDesktop(values: string[]): string[] {
  return [...new Set([...values.filter((value) => value !== "desktop"), "desktop"])];
}

async function shouldReplaceConflictingDesktop(
  existingPlugin: unknown,
  force: boolean,
  nonInteractive: boolean,
): Promise<boolean> {
  if (existingPlugin === undefined || existingPlugin === "desktop" || force) return true;
  if (nonInteractive) {
    throw new DesktopSetupError(
      `notifiers.desktop already uses plugin "${String(existingPlugin)}". Re-run with --force to replace it.`,
    );
  }

  const clack = await import("@clack/prompts");
  const replace = await clack.confirm({
    message: `notifiers.desktop already uses plugin "${String(existingPlugin)}". Replace it?`,
    initialValue: false,
  });

  if (clack.isCancel(replace) || !replace) {
    console.log(chalk.dim("Keeping existing desktop notifier config."));
    return false;
  }

  return true;
}

function dashboardUrlFromConfig(rawConfig: Record<string, unknown>): string | undefined {
  const port = rawConfig["port"];
  if (typeof port === "number") return `http://localhost:${port}`;
  if (typeof port === "string" && port.trim().length > 0) return `http://localhost:${port.trim()}`;
  return undefined;
}

async function wireDesktopConfig(
  configPath: string | undefined,
  force: boolean,
  nonInteractive: boolean,
  conflictAlreadyChecked = false,
): Promise<boolean> {
  if (!configPath) {
    console.log(chalk.dim("No agent-orchestrator.yaml found; skipping config wiring."));
    return false;
  }

  const rawYaml = readFileSync(configPath, "utf-8");
  const doc = parseDocument(rawYaml);
  const rawConfig = (doc.toJS() as Record<string, unknown>) ?? {};
  const notifiers = (rawConfig["notifiers"] as Record<string, unknown> | undefined) ?? {};
  const existingDesktop = (notifiers["desktop"] as Record<string, unknown> | undefined) ?? {};

  if (
    !conflictAlreadyChecked &&
    !(await shouldReplaceConflictingDesktop(
      existingDesktop["plugin"],
      force,
      nonInteractive,
    ))
  ) {
    return false;
  }

  const desktopConfig: Record<string, unknown> = {
    ...existingDesktop,
    plugin: "desktop",
    backend: "ao-app",
  };
  const dashboardUrl = dashboardUrlFromConfig(rawConfig);
  if (dashboardUrl) desktopConfig["dashboardUrl"] = dashboardUrl;

  notifiers["desktop"] = desktopConfig;
  rawConfig["notifiers"] = notifiers;

  const defaults = (rawConfig["defaults"] as Record<string, unknown> | undefined) ?? {};
  const defaultNotifiers = arrayOfStrings(defaults["notifiers"]);
  rawConfig["defaults"] = defaults;

  const notificationRouting =
    (rawConfig["notificationRouting"] as Record<string, unknown> | undefined) ?? {};
  for (const priority of PRIORITIES) {
    const current = arrayOfStrings(notificationRouting[priority]);
    const base = current.length > 0 ? current : defaultNotifiers;
    notificationRouting[priority] = uniqueWithDesktop(base);
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
  console.log(chalk.green(`✓ Config written to ${configPath}`));
  return true;
}

async function canWireDesktopConfig(
  configPath: string | undefined,
  force: boolean,
  nonInteractive: boolean,
): Promise<boolean> {
  if (!configPath) return false;
  const rawYaml = readFileSync(configPath, "utf-8");
  const doc = parseDocument(rawYaml);
  const rawConfig = (doc.toJS() as Record<string, unknown>) ?? {};
  const notifiers = (rawConfig["notifiers"] as Record<string, unknown> | undefined) ?? {};
  const existingDesktop = (notifiers["desktop"] as Record<string, unknown> | undefined) ?? {};
  return shouldReplaceConflictingDesktop(existingDesktop["plugin"], force, nonInteractive);
}

function uninstallDesktopApp(): void {
  const appPath = getInstalledNotifierAppPath();
  rmSync(appPath, { recursive: true, force: true });
  console.log(chalk.green(`✓ Removed ${appPath}`));
  console.log(chalk.dim("AO config was not changed."));
}

export async function runDesktopSetupAction(opts: DesktopSetupOptions): Promise<void> {
  const nonInteractive = opts.nonInteractive || !process.stdin.isTTY;
  const force = Boolean(opts.force);

  if (opts.status) {
    printStatus();
    return;
  }

  if (opts.uninstall) {
    uninstallDesktopApp();
    return;
  }

  const configPath = findOptionalConfigPath();
  const shouldWireConfig = await canWireDesktopConfig(configPath, force, nonInteractive);

  const appPath = copyBundledApp();
  console.log(chalk.green(`✓ Installed ${APP_NAME} to ${appPath}`));

  requestPermission(appPath);
  console.log(chalk.green("✓ Notification permission checked"));

  sendSetupNotification(appPath);
  console.log(chalk.green("✓ Sent desktop setup test notification"));

  if (shouldWireConfig) {
    await wireDesktopConfig(configPath, force, nonInteractive, true);
  } else if (!configPath) {
    console.log(chalk.dim("No agent-orchestrator.yaml found; skipping config wiring."));
  } else {
    console.log(chalk.dim("Skipped config wiring."));
  }

  if (!nonInteractive) {
    const clack = await import("@clack/prompts");
    clack.outro(
      `${chalk.green("Desktop setup complete!")} AO will use AO Notifier.app for desktop notifications.\n` +
        chalk.dim("  Test it with: ao notify test --to desktop --template basic"),
    );
  } else {
    console.log(chalk.green("\n✓ Desktop setup complete."));
    console.log(chalk.dim("Test it with: ao notify test --to desktop --template basic"));
  }
}
