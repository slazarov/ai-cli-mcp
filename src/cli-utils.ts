import { accessSync, constants } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import * as path from 'path';

const debugMode = process.env.MCP_CLAUDE_DEBUG === 'true';

export function debugLog(message?: any, ...optionalParams: any[]): void {
  if (debugMode) {
    console.error(message, ...optionalParams);
  }
}

export interface CliBinaryStatus {
  configuredCommand: string;
  resolvedPath: string | null;
  available: boolean;
  lookup: 'env' | 'local' | 'path';
  error?: string;
}

export type CliBinaryName = 'claude' | 'codex' | 'gemini' | 'forge' | 'opencode';

export interface CliPaths {
  claude: string;
  codex: string;
  gemini: string;
  forge: string;
  opencode: string;
}

export interface CliDoctorStatus {
  checks: {
    binaryAvailability: boolean;
    pathResolution: boolean;
    loginState: boolean;
    termsAcceptance: boolean;
  };
  claude: CliBinaryStatus;
  codex: CliBinaryStatus;
  gemini: CliBinaryStatus;
  forge: CliBinaryStatus;
  opencode: CliBinaryStatus;
}

function getPathDelimiter(): string {
  return process.platform === 'win32' ? ';' : ':';
}

function getPathExtensions(): string[] {
  if (process.platform !== 'win32') {
    return [''];
  }

  const rawPathext = process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM';
  return ['', ...rawPathext.split(';').filter(Boolean)];
}

function findExecutableOnPath(commandName: string): string | null {
  const rawPath = process.env.PATH || '';
  if (!rawPath) {
    return null;
  }

  const pathEntries = rawPath.split(getPathDelimiter()).filter(Boolean);
  const extensions = getPathExtensions();

  for (const entry of pathEntries) {
    for (const extension of extensions) {
      const candidate = join(entry, `${commandName}${extension}`);
      if (isExecutableFile(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

function validateCustomCliName(envVarName: string, customCliName: string): string | null {
  if (path.isAbsolute(customCliName)) {
    return null;
  }

  if (
    customCliName.startsWith('./') ||
    customCliName.startsWith('../') ||
    customCliName.includes('/')
  ) {
    return `Invalid ${envVarName}: Relative paths are not allowed. Use either a simple name (e.g., '${customCliName.split('/').pop() || 'cli'}') or an absolute path (e.g., '/tmp/${customCliName.split('/').pop() || 'cli'}-test')`;
  }

  return null;
}

function inspectCliBinary(options: {
  envVarName: string;
  customCliName: string | undefined;
  defaultCliName: string;
  localInstallPath?: string;
}): CliBinaryStatus {
  const configuredCommand = options.customCliName || options.defaultCliName;

  if (options.customCliName) {
    const validationError = validateCustomCliName(options.envVarName, options.customCliName);
    if (validationError) {
      return {
        configuredCommand,
        resolvedPath: null,
        available: false,
        lookup: 'env',
        error: validationError,
      };
    }

    if (path.isAbsolute(options.customCliName)) {
      return {
        configuredCommand,
        resolvedPath: options.customCliName,
        available: isExecutableFile(options.customCliName),
        lookup: 'env',
      };
    }

    const resolvedPath = findExecutableOnPath(configuredCommand);
    return {
      configuredCommand,
      resolvedPath,
      available: resolvedPath !== null,
      lookup: 'env',
    };
  }

  if (options.localInstallPath && isExecutableFile(options.localInstallPath)) {
    return {
      configuredCommand,
      resolvedPath: options.localInstallPath,
      available: true,
      lookup: 'local',
    };
  }

  const resolvedPath = findExecutableOnPath(configuredCommand);
  return {
    configuredCommand,
    resolvedPath,
    available: resolvedPath !== null,
    lookup: 'path',
  };
}

function getCliCommandOrThrow(status: CliBinaryStatus): string {
  if (status.error) {
    throw new Error(status.error);
  }

  if (status.lookup === 'env' && !path.isAbsolute(status.configuredCommand)) {
    return status.configuredCommand;
  }

  return status.resolvedPath || status.configuredCommand;
}

function isExecutableFile(filePath: string): boolean {
  try {
    accessSync(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}


export type ExtraBinaryAgent = 'claude' | 'codex' | 'gemini';

export interface ExtraBinaryEntry {
  name: string;
  path: string;
  agent: ExtraBinaryAgent;
  prefixArgs?: string[];
}

const BUILT_IN_NAMES = new Set<string>(['claude', 'codex', 'gemini', 'forge', 'opencode']);

export function parseExtraBinaries(
  envValue: string | undefined,
  agentType: ExtraBinaryAgent,
): ExtraBinaryEntry[] {
  if (!envValue || !envValue.trim()) {
    return [];
  }

  const entries: ExtraBinaryEntry[] = [];

  for (const pair of envValue.split(',')) {
    const trimmed = pair.trim();
    if (!trimmed) continue;

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) {
      console.error(`[Warning] Malformed extra binary entry (missing ':'): "${trimmed}" — skipping`);
      continue;
    }

    const name = trimmed.slice(0, colonIdx).trim();
    const binaryPath = trimmed.slice(colonIdx + 1).trim();

    if (!name) {
      console.error(`[Warning] Empty name in extra binary entry: "${trimmed}" — skipping`);
      continue;
    }

    if (BUILT_IN_NAMES.has(name)) {
      console.error(`[Warning] Extra binary name "${name}" conflicts with built-in — skipping`);
      continue;
    }

    if (!binaryPath) {
      console.error(`[Warning] Empty path for extra binary "${name}" — skipping`);
      continue;
    }

    const validationError = validateCustomCliName(`EXTRA_${agentType.toUpperCase()}_BINARIES[${name}]`, binaryPath);
    if (validationError) {
      console.error(`[Warning] ${validationError} — skipping`);
      continue;
    }

    entries.push({ name, path: binaryPath, agent: agentType });
  }

  return entries;
}

export function findCcsCli(): string | null {
  const customName = process.env.CCS_CLI_NAME;
  if (customName) {
    const validationError = validateCustomCliName('CCS_CLI_NAME', customName);
    if (validationError) {
      console.error(`[Warning] ${validationError} — ignoring`);
      return null;
    }
    if (path.isAbsolute(customName)) {
      return isExecutableFile(customName) ? customName : null;
    }
    return findExecutableOnPath(customName);
  }
  return findExecutableOnPath('ccs');
}

export function parseCcsProfiles(ccsPath?: string | null): ExtraBinaryEntry[] {
  const envValue = process.env.CCS_PROFILES;
  if (!envValue?.trim()) return [];

  const resolvedCcsPath = ccsPath === undefined ? findCcsCli() : ccsPath;
  if (!resolvedCcsPath) {
    console.error('[Warning] CCS_PROFILES set but ccs binary not found on PATH — skipping');
    return [];
  }

  const entries: ExtraBinaryEntry[] = [];
  for (const raw of envValue.split(',')) {
    const name = raw.trim();
    if (!name) continue;
    if (BUILT_IN_NAMES.has(name)) {
      console.error(`[Warning] CCS profile name "${name}" conflicts with built-in — skipping`);
      continue;
    }
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name)) {
      console.error(`[Warning] CCS profile name "${name}" contains invalid characters — skipping`);
      continue;
    }
    entries.push({ name, path: resolvedCcsPath, agent: 'claude', prefixArgs: [name] });
  }
  return entries;
}

export function getExtraBinariesConfig(): Map<string, ExtraBinaryEntry> {
  const result = new Map<string, ExtraBinaryEntry>();
  const envVars: Array<{ env: string; agent: ExtraBinaryAgent }> = [
    { env: 'EXTRA_CLAUDE_BINARIES', agent: 'claude' },
    { env: 'EXTRA_CODEX_BINARIES', agent: 'codex' },
    { env: 'EXTRA_GEMINI_BINARIES', agent: 'gemini' },
  ];

  for (const { env, agent } of envVars) {
    const entries = parseExtraBinaries(process.env[env], agent);
    for (const entry of entries) {
      if (result.has(entry.name)) {
        console.error(`[Warning] Duplicate extra binary name "${entry.name}" — skipping`);
        continue;
      }
      result.set(entry.name, entry);
    }
  }

  const ccsEntries = parseCcsProfiles();
  for (const entry of ccsEntries) {
    if (result.has(entry.name)) {
      debugLog(`[Debug] CCS profile "${entry.name}" skipped — name already registered as extra binary`);
      continue;
    }
    result.set(entry.name, entry);
  }

  return result;
}


function getCliBinaryConfig(name: CliBinaryName): {
  envVarName: string;
  customCliName: string | undefined;
  defaultCliName: string;
  localInstallPath?: string;
} {
  if (name === 'claude') {
    return {
      envVarName: 'CLAUDE_CLI_NAME',
      customCliName: process.env.CLAUDE_CLI_NAME,
      defaultCliName: 'claude',
      localInstallPath: join(homedir(), '.claude', 'local', 'claude'),
    };
  }

  if (name === 'codex') {
    return {
      envVarName: 'CODEX_CLI_NAME',
      customCliName: process.env.CODEX_CLI_NAME,
      defaultCliName: 'codex',
      localInstallPath: join(homedir(), '.codex', 'local', 'codex'),
    };
  }

  if (name === 'forge') {
    return {
      envVarName: 'FORGE_CLI_NAME',
      customCliName: process.env.FORGE_CLI_NAME,
      defaultCliName: 'forge',
      localInstallPath: join(homedir(), '.forge', 'local', 'forge'),
    };
  }

  if (name === 'opencode') {
    return {
      envVarName: 'OPENCODE_CLI_NAME',
      customCliName: process.env.OPENCODE_CLI_NAME,
      defaultCliName: 'opencode',
    };
  }

  return {
    envVarName: 'GEMINI_CLI_NAME',
    customCliName: process.env.GEMINI_CLI_NAME,
    defaultCliName: 'gemini',
    localInstallPath: join(homedir(), '.gemini', 'local', 'gemini'),
  };
}

function getCliBinaryStatus(name: CliBinaryName): CliBinaryStatus {
  return inspectCliBinary(getCliBinaryConfig(name));
}

export function getCliDoctorStatus(): CliDoctorStatus {
  return {
    checks: {
      binaryAvailability: true,
      pathResolution: true,
      loginState: false,
      termsAcceptance: false,
    },
    claude: getCliBinaryStatus('claude'),
    codex: getCliBinaryStatus('codex'),
    gemini: getCliBinaryStatus('gemini'),
    forge: getCliBinaryStatus('forge'),
    opencode: getCliBinaryStatus('opencode'),
  };
}

export function findGeminiCli(): string {
  debugLog('[Debug] Attempting to find Gemini CLI...');
  const status = getCliBinaryStatus('gemini');
  return getCliCommandOrThrow(status);
}

export function findCodexCli(): string {
  debugLog('[Debug] Attempting to find Codex CLI...');
  const status = getCliBinaryStatus('codex');
  return getCliCommandOrThrow(status);
}

export function findForgeCli(): string {
  debugLog('[Debug] Attempting to find Forge CLI...');
  const status = getCliBinaryStatus('forge');
  return getCliCommandOrThrow(status);
}

export function findOpencodeCli(): string {
  debugLog('[Debug] Attempting to find OpenCode CLI...');
  const status = getCliBinaryStatus('opencode');
  return getCliCommandOrThrow(status);
}

export function findClaudeCli(): string {
  debugLog('[Debug] Attempting to find Claude CLI...');
  const status = getCliBinaryStatus('claude');
  return getCliCommandOrThrow(status);
}
