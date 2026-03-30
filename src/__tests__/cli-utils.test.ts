import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { accessSync } from 'node:fs';
import { parseExtraBinaries, parseCcsProfiles, getExtraBinariesConfig } from '../cli-utils.js';

vi.mock('node:fs', () => ({
  accessSync: vi.fn(),
  constants: { X_OK: 1 },
}));

const mockAccessSync = vi.mocked(accessSync);

describe('cli-utils doctor status', () => {
  const originalEnv = process.env;
  const originalPlatform = process.platform;

  beforeEach(() => {
    vi.resetModules();
    mockAccessSync.mockReset();
    process.env = { ...originalEnv };
    delete process.env.CLAUDE_CLI_NAME;
    delete process.env.CODEX_CLI_NAME;
    delete process.env.GEMINI_CLI_NAME;
    delete process.env.FORGE_CLI_NAME;
    delete process.env.OPENCODE_CLI_NAME;
    process.env.PATH = '/mock/bin:/usr/bin';
  });

  afterEach(() => {
    process.env = originalEnv;
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('marks PATH binaries available when they are executable', async () => {
    mockAccessSync.mockImplementation((filePath) => {
      if (filePath === '/mock/bin/claude') {
        return undefined;
      }
      throw new Error('not executable');
    });

    const { getCliDoctorStatus } = await import('../cli-utils.js');
    const status = getCliDoctorStatus();

    expect(status.checks).toEqual({
      binaryAvailability: true,
      pathResolution: true,
      loginState: false,
      termsAcceptance: false,
    });
    expect(status.claude).toEqual({
      configuredCommand: 'claude',
      resolvedPath: '/mock/bin/claude',
      available: true,
      lookup: 'path',
    });
    expect(status.forge).toEqual({
      configuredCommand: 'forge',
      resolvedPath: null,
      available: false,
      lookup: 'path',
    });
    expect(status.opencode).toEqual({
      configuredCommand: 'opencode',
      resolvedPath: null,
      available: false,
      lookup: 'path',
    });
  });

  it('does not mark non-executable PATH entries as available', async () => {
    mockAccessSync.mockImplementation(() => {
      throw new Error('not executable');
    });

    const { getCliDoctorStatus } = await import('../cli-utils.js');
    const status = getCliDoctorStatus();

    expect(status.claude).toEqual({
      configuredCommand: 'claude',
      resolvedPath: null,
      available: false,
      lookup: 'path',
    });
    expect(status.forge).toEqual({
      configuredCommand: 'forge',
      resolvedPath: null,
      available: false,
      lookup: 'path',
    });
    expect(status.opencode).toEqual({
      configuredCommand: 'opencode',
      resolvedPath: null,
      available: false,
      lookup: 'path',
    });
  });

  it('reports invalid relative env paths as doctor errors', async () => {
    process.env.CLAUDE_CLI_NAME = './relative/claude';

    const { getCliDoctorStatus } = await import('../cli-utils.js');
    const status = getCliDoctorStatus();

    expect(status.claude.available).toBe(false);
    expect(status.claude.lookup).toBe('env');
    expect(status.claude.error).toContain('Invalid CLAUDE_CLI_NAME');
  });

  it('reports missing absolute env paths as unavailable', async () => {
    process.env.CLAUDE_CLI_NAME = '/missing/claude';
    mockAccessSync.mockImplementation(() => {
      throw new Error('missing');
    });

    const { getCliDoctorStatus } = await import('../cli-utils.js');
    const status = getCliDoctorStatus();

    expect(status.claude).toEqual({
      configuredCommand: '/missing/claude',
      resolvedPath: '/missing/claude',
      available: false,
      lookup: 'env',
    });
  });

  it('falls back cleanly when PATH is empty', async () => {
    process.env.PATH = '';
    mockAccessSync.mockImplementation(() => {
      throw new Error('missing');
    });

    const { getCliDoctorStatus } = await import('../cli-utils.js');
    const status = getCliDoctorStatus();

    expect(status.codex).toEqual({
      configuredCommand: 'codex',
      resolvedPath: null,
      available: false,
      lookup: 'path',
    });
  });

  it('supports Windows commands that already include an executable suffix', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    process.env.PATHEXT = '.EXE;.CMD';
    process.env.CLAUDE_CLI_NAME = 'claude.cmd';
    process.env.PATH = '/mock/bin';
    mockAccessSync.mockImplementation((filePath) => {
      if (filePath === '/mock/bin/claude.cmd') {
        return undefined;
      }
      throw new Error('not executable');
    });

    const { getCliDoctorStatus } = await import('../cli-utils.js');
    const status = getCliDoctorStatus();

    expect(status.claude).toEqual({
      configuredCommand: 'claude.cmd',
      resolvedPath: '/mock/bin/claude.cmd',
      available: true,
      lookup: 'env',
    });
  });

  it('supports forge lookup via FORGE_CLI_NAME', async () => {
    process.env.FORGE_CLI_NAME = 'forge-custom';
    mockAccessSync.mockImplementation((filePath) => {
      if (filePath === '/mock/bin/forge-custom') {
        return undefined;
      }
      throw new Error('not executable');
    });

    const { getCliDoctorStatus, findForgeCli } = await import('../cli-utils.js');
    const status = getCliDoctorStatus();

    expect(status.forge).toEqual({
      configuredCommand: 'forge-custom',
      resolvedPath: '/mock/bin/forge-custom',
      available: true,
      lookup: 'env',
    });
    expect(findForgeCli()).toBe('forge-custom');
  });

  it('supports OpenCode lookup via OPENCODE_CLI_NAME', async () => {
    process.env.OPENCODE_CLI_NAME = 'opencode-custom';
    mockAccessSync.mockImplementation((filePath) => {
      if (filePath === '/mock/bin/opencode-custom') {
        return undefined;
      }
      throw new Error('not executable');
    });

    const { getCliDoctorStatus, findOpencodeCli } = await import('../cli-utils.js');
    const status = getCliDoctorStatus();

    expect(status.opencode).toEqual({
      configuredCommand: 'opencode-custom',
      resolvedPath: '/mock/bin/opencode-custom',
      available: true,
      lookup: 'env',
    });
    expect(findOpencodeCli()).toBe('opencode-custom');
  });
});

describe('parseExtraBinaries', () => {
  it('parses valid name:path pairs', () => {
    const result = parseExtraBinaries(
      'claude-zhipu:/usr/local/bin/claude-zhipu,claude-deepseek:/usr/local/bin/claude-deepseek',
      'claude'
    );
    expect(result).toEqual([
      { name: 'claude-zhipu', path: '/usr/local/bin/claude-zhipu', agent: 'claude' },
      { name: 'claude-deepseek', path: '/usr/local/bin/claude-deepseek', agent: 'claude' },
    ]);
  });

  it('returns empty array for undefined/empty input', () => {
    expect(parseExtraBinaries(undefined, 'claude')).toEqual([]);
    expect(parseExtraBinaries('', 'claude')).toEqual([]);
    expect(parseExtraBinaries('  ', 'claude')).toEqual([]);
  });

  it('skips malformed entries without colon', () => {
    const result = parseExtraBinaries('nocolon', 'claude');
    expect(result).toEqual([]);
  });

  it('skips entries with empty name', () => {
    const result = parseExtraBinaries(':/usr/bin/foo', 'claude');
    expect(result).toEqual([]);
  });

  it('skips entries with empty path', () => {
    const result = parseExtraBinaries('foo:', 'claude');
    expect(result).toEqual([]);
  });

  it('rejects built-in name collisions', () => {
    const result = parseExtraBinaries('claude:/usr/bin/my-claude', 'claude');
    expect(result).toEqual([]);
  });

  it('rejects relative paths', () => {
    const result = parseExtraBinaries('my-cli:./relative/path', 'claude');
    expect(result).toEqual([]);
  });

  it('accepts simple names for PATH lookup', () => {
    const result = parseExtraBinaries('claude-zhipu:claude-zhipu', 'claude');
    expect(result).toEqual([
      { name: 'claude-zhipu', path: 'claude-zhipu', agent: 'claude' },
    ]);
  });

  it('trims whitespace around names and paths', () => {
    const result = parseExtraBinaries(' claude-zhipu : /usr/bin/zhipu ', 'codex');
    expect(result).toEqual([
      { name: 'claude-zhipu', path: '/usr/bin/zhipu', agent: 'codex' },
    ]);
  });

  it('handles multiple entries with some invalid', () => {
    const result = parseExtraBinaries(
      'good:/usr/bin/good,bad,claude:/collision,also-good:/usr/bin/also',
      'gemini'
    );
    expect(result).toEqual([
      { name: 'good', path: '/usr/bin/good', agent: 'gemini' },
      { name: 'also-good', path: '/usr/bin/also', agent: 'gemini' },
    ]);
  });
});

describe('parseCcsProfiles', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.CCS_PROFILES;
    delete process.env.CCS_CLI_NAME;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns empty array when CCS_PROFILES not set', () => {
    const result = parseCcsProfiles();
    expect(result).toEqual([]);
  });

  it('returns empty array when CCS_PROFILES is empty', () => {
    process.env.CCS_PROFILES = '  ';
    const result = parseCcsProfiles();
    expect(result).toEqual([]);
  });

  it('parses single profile with explicit ccs path', () => {
    process.env.CCS_PROFILES = 'glm';
    const result = parseCcsProfiles('/usr/bin/ccs');
    expect(result).toEqual([
      { name: 'glm', path: '/usr/bin/ccs', agent: 'claude', prefixArgs: ['glm'] },
    ]);
  });

  it('parses multiple profiles', () => {
    process.env.CCS_PROFILES = 'glm,qwen,mm';
    const result = parseCcsProfiles('/usr/bin/ccs');
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ name: 'glm', path: '/usr/bin/ccs', agent: 'claude', prefixArgs: ['glm'] });
    expect(result[1]).toEqual({ name: 'qwen', path: '/usr/bin/ccs', agent: 'claude', prefixArgs: ['qwen'] });
    expect(result[2]).toEqual({ name: 'mm', path: '/usr/bin/ccs', agent: 'claude', prefixArgs: ['mm'] });
  });

  it('trims whitespace in profile names', () => {
    process.env.CCS_PROFILES = ' glm , qwen ';
    const result = parseCcsProfiles('/usr/bin/ccs');
    expect(result).toHaveLength(2);
    expect(result[0]!.name).toBe('glm');
    expect(result[1]!.name).toBe('qwen');
  });

  it('skips empty entries from extra commas', () => {
    process.env.CCS_PROFILES = 'glm,,qwen,';
    const result = parseCcsProfiles('/usr/bin/ccs');
    expect(result).toHaveLength(2);
  });

  it('skips profiles that conflict with built-in names', () => {
    process.env.CCS_PROFILES = 'claude,glm,codex';
    const result = parseCcsProfiles('/usr/bin/ccs');
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('glm');
  });

  it('returns empty when ccs binary not found and no explicit path', () => {
    process.env.CCS_PROFILES = 'glm';
    // Pass null to simulate ccs not found
    const result = parseCcsProfiles(null);
    expect(result).toEqual([]);
  });

  it('uses custom CCS_CLI_NAME path when provided', () => {
    process.env.CCS_PROFILES = 'glm';
    const result = parseCcsProfiles('/custom/path/ccs');
    expect(result).toEqual([
      { name: 'glm', path: '/custom/path/ccs', agent: 'claude', prefixArgs: ['glm'] },
    ]);
  });

  it('skips profile names with invalid characters', () => {
    process.env.CCS_PROFILES = '--help,glm,my profile';
    const result = parseCcsProfiles('/usr/bin/ccs');
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('glm');
  });
});

describe('getExtraBinariesConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.EXTRA_CLAUDE_BINARIES;
    delete process.env.EXTRA_CODEX_BINARIES;
    delete process.env.EXTRA_GEMINI_BINARIES;
    delete process.env.CCS_PROFILES;
    delete process.env.CCS_CLI_NAME;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns empty map when no env vars set', () => {
    const result = getExtraBinariesConfig();
    expect(result.size).toBe(0);
  });

  it('reads from all three env vars', () => {
    process.env.EXTRA_CLAUDE_BINARIES = 'claude-zhipu:/usr/bin/zhipu';
    process.env.EXTRA_CODEX_BINARIES = 'codex-alt:/usr/bin/codex-alt';
    process.env.EXTRA_GEMINI_BINARIES = 'gemini-alt:/usr/bin/gemini-alt';

    const result = getExtraBinariesConfig();
    expect(result.size).toBe(3);
    expect(result.get('claude-zhipu')?.agent).toBe('claude');
    expect(result.get('codex-alt')?.agent).toBe('codex');
    expect(result.get('gemini-alt')?.agent).toBe('gemini');
  });

  it('skips duplicate names across env vars', () => {
    process.env.EXTRA_CLAUDE_BINARIES = 'dupe:/usr/bin/a';
    process.env.EXTRA_CODEX_BINARIES = 'dupe:/usr/bin/b';

    const result = getExtraBinariesConfig();
    expect(result.size).toBe(1);
    expect(result.get('dupe')?.agent).toBe('claude');
  });

  it('extra binaries take precedence over CCS profiles with same name', () => {
    process.env.EXTRA_CLAUDE_BINARIES = 'glm:/usr/bin/glm-custom';
    process.env.CCS_PROFILES = 'glm';

    const result = getExtraBinariesConfig();
    expect(result.size).toBe(1);
    expect(result.get('glm')?.path).toBe('/usr/bin/glm-custom');
    expect(result.get('glm')?.prefixArgs).toBeUndefined();
  });
});
