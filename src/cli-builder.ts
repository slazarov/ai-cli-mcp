import { existsSync, readFileSync } from 'node:fs';
import { resolve as pathResolve, isAbsolute } from 'node:path';
import type { CliPaths } from './cli-utils.js';
import { MODEL_ALIASES } from './model-catalog.js';
import type { ExtraBinaryEntry } from './cli-utils.js';

export const ALLOWED_REASONING_EFFORTS = new Set(['low', 'medium', 'high', 'xhigh', 'max']);
const CLAUDE_REASONING_EFFORTS = new Set(['low', 'medium', 'high', 'xhigh', 'max']);
const CODEX_REASONING_EFFORTS = new Set(['low', 'medium', 'high', 'xhigh']);
const OPENCODE_MODEL_ERROR = 'Invalid OpenCode model. Expected exact syntax oc-<provider/model>.';

type Agent = 'codex' | 'claude' | 'gemini' | 'forge' | 'opencode';

interface ModelSelection {
  agent: Agent;
  resolvedModel: string;
  openCodeModel: string | null;
}

function getStandardAgentForModel(model: string): Exclude<Agent, 'opencode'> {
  if (model === 'forge') {
    return 'forge';
  }
  if (model === 'codex') {
    return 'codex';
  }
  if (model.startsWith('gpt-')) {
    return 'codex';
  }
  if (model.startsWith('gemini')) {
    return 'gemini';
  }
  return 'claude';
}

function isPotentialOpenCodeExplicitModel(rawModel: string): boolean {
  return rawModel.startsWith('oc-') || rawModel.trim().startsWith('oc-');
}

function extractOpenCodeModel(rawModel: string): string {
  if (rawModel !== rawModel.trim()) {
    throw new Error(OPENCODE_MODEL_ERROR);
  }

  if (!rawModel.startsWith('oc-')) {
    throw new Error(OPENCODE_MODEL_ERROR);
  }

  const remainder = rawModel.slice(3);
  const slashIndex = remainder.indexOf('/');
  if (slashIndex === -1) {
    throw new Error(OPENCODE_MODEL_ERROR);
  }

  const provider = remainder.slice(0, slashIndex);
  const model = remainder.slice(slashIndex + 1);
  if (!provider || !model) {
    throw new Error(OPENCODE_MODEL_ERROR);
  }

  return remainder;
}

function resolveModelSelection(rawModel: string): ModelSelection {
  if (rawModel === 'opencode') {
    return {
      agent: 'opencode',
      resolvedModel: rawModel,
      openCodeModel: null,
    };
  }

  if (isPotentialOpenCodeExplicitModel(rawModel)) {
    return {
      agent: 'opencode',
      resolvedModel: rawModel,
      openCodeModel: extractOpenCodeModel(rawModel),
    };
  }

  const resolvedModel = resolveModelAlias(rawModel);
  return {
    agent: getStandardAgentForModel(resolvedModel),
    resolvedModel,
    openCodeModel: null,
  };
}

export function resolveModelAlias(model: string): string {
  return MODEL_ALIASES[model] || model;
}

export function getReasoningEffort(model: string, rawValue: unknown, agentOverride?: 'claude' | 'codex' | 'gemini'): string {
  if (typeof rawValue !== 'string') {
    return '';
  }
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return '';
  }

  if (model === 'opencode' || model.startsWith('oc-')) {
    throw new Error('reasoning_effort is not supported for opencode.');
  }

  const normalized = trimmed.toLowerCase();
  if (!ALLOWED_REASONING_EFFORTS.has(normalized)) {
    throw new Error(
      `Invalid reasoning_effort: ${rawValue}. Allowed values: low, medium, high, xhigh, max.`
    );
  }
  const agent = agentOverride ?? getStandardAgentForModel(model);
  if (agent === 'forge') {
    throw new Error('reasoning_effort is not supported for forge.');
  }
  if (agent === 'gemini') {
    throw new Error(
      'reasoning_effort is only supported for Claude and Codex models.'
    );
  }
  if (agent === 'claude' && !CLAUDE_REASONING_EFFORTS.has(normalized)) {
    throw new Error(
      'Claude reasoning_effort supports only low, medium, high, xhigh, max.'
    );
  }
  if (agent === 'codex' && !CODEX_REASONING_EFFORTS.has(normalized)) {
    throw new Error(
      'Codex reasoning_effort supports only low, medium, high, xhigh.'
    );
  }
  return normalized;
}

export interface CliCommand {
  cliPath: string;
  args: string[];
  cwd: string;
  agent: Agent;
  prompt: string;
  resolvedModel: string;
}

export interface BuildCliCommandOptions {
  prompt?: string;
  prompt_file?: string;
  workFolder: string;
  model?: string;
  session_id?: string;
  reasoning_effort?: string;
  cliPaths: CliPaths;
  binary?: string;
  extraBinaries?: Map<string, ExtraBinaryEntry>;
}

export function buildCliCommand(options: BuildCliCommandOptions): CliCommand {
  if (!options.workFolder || typeof options.workFolder !== 'string') {
    throw new Error('Missing or invalid required parameter: workFolder');
  }

  const hasPrompt = !!options.prompt && typeof options.prompt === 'string' && options.prompt.trim() !== '';
  const hasPromptFile = !!options.prompt_file && typeof options.prompt_file === 'string' && options.prompt_file.trim() !== '';

  if (!hasPrompt && !hasPromptFile) {
    throw new Error('Either prompt or prompt_file must be provided');
  }

  if (hasPrompt && hasPromptFile) {
    throw new Error('Cannot specify both prompt and prompt_file. Please use only one.');
  }

  let prompt: string;
  if (hasPrompt) {
    prompt = options.prompt!;
  } else {
    const promptFilePath = isAbsolute(options.prompt_file!)
      ? options.prompt_file!
      : pathResolve(options.workFolder, options.prompt_file!);

    if (!existsSync(promptFilePath)) {
      throw new Error(`Prompt file does not exist: ${promptFilePath}`);
    }

    try {
      prompt = readFileSync(promptFilePath, 'utf-8');
    } catch (error: any) {
      throw new Error(`Failed to read prompt file: ${error.message}`);
    }
  }

  const cwd = pathResolve(options.workFolder);
  if (!existsSync(cwd)) {
    throw new Error(`Working folder does not exist: ${options.workFolder}`);
  }

  let binaryOverridePath: string | undefined;
  let binaryAgent: 'claude' | 'codex' | 'gemini' | undefined;

  if (options.binary) {
    const coreBuiltIns = new Set<string>(['claude', 'codex', 'gemini']);
    if (coreBuiltIns.has(options.binary)) {
      binaryAgent = options.binary as 'claude' | 'codex' | 'gemini';
      binaryOverridePath = options.cliPaths[binaryAgent];
    } else if (options.extraBinaries?.has(options.binary)) {
      const entry = options.extraBinaries.get(options.binary)!;
      binaryOverridePath = entry.path;
      binaryAgent = entry.agent;
    } else {
      const available = ['claude', 'codex', 'gemini', 'forge', 'opencode'];
      if (options.extraBinaries) {
        for (const name of options.extraBinaries.keys()) {
          available.push(name);
        }
      }
      throw new Error(`Unknown binary "${options.binary}". Available: ${available.join(', ')}`);
    }
  }

  const rawModel = options.model || '';
  const { agent: modelAgent, resolvedModel, openCodeModel } = resolveModelSelection(rawModel);
  const agent = binaryAgent ?? modelAgent;

  let reasoningEffortArg: string | undefined = options.reasoning_effort;
  if (!reasoningEffortArg) {
    if (rawModel === 'codex-ultra') {
      reasoningEffortArg = 'xhigh';
    } else if (rawModel === 'claude-ultra') {
      reasoningEffortArg = 'max';
    }
  }

  const reasoningTargetModel = rawModel === 'opencode' || rawModel.startsWith('oc-')
    ? rawModel
    : (resolvedModel || rawModel);
  const reasoningEffort = getReasoningEffort(reasoningTargetModel, reasoningEffortArg, binaryAgent);

  let cliPath: string;
  let args: string[];

  if (agent === 'codex') {
    cliPath = binaryOverridePath || options.cliPaths.codex;

    if (options.session_id && typeof options.session_id === 'string') {
      args = ['exec', 'resume', options.session_id];
    } else {
      args = ['exec'];
    }

    if (reasoningEffort) {
      args.push('-c', `model_reasoning_effort=${reasoningEffort}`);
    }
    if (resolvedModel && resolvedModel !== 'codex') {
      args.push('--model', resolvedModel);
    }

    args.push('--skip-git-repo-check', '--dangerously-bypass-approvals-and-sandbox', '--json', prompt);
  } else if (agent === 'gemini') {
    cliPath = binaryOverridePath || options.cliPaths.gemini;
    args = ['-y', '--output-format', 'stream-json'];

    if (options.session_id && typeof options.session_id === 'string') {
      args.push('-r', options.session_id);
    }

    if (resolvedModel) {
      args.push('--model', resolvedModel);
    }

    args.push(prompt);
  } else if (agent === 'forge') {
    cliPath = options.cliPaths.forge;
    args = ['-C', cwd];

    if (options.session_id && typeof options.session_id === 'string') {
      args.push('--conversation-id', options.session_id);
    }

    args.push('-p', prompt);
  } else if (agent === 'opencode') {
    cliPath = options.cliPaths.opencode;
    args = ['run', '--format', 'json', '--dir', cwd];

    if (options.session_id && typeof options.session_id === 'string') {
      args.push('--session', options.session_id);
    }

    if (openCodeModel) {
      args.push('--model', openCodeModel);
    }

    args.push(prompt);
  } else {
    cliPath = binaryOverridePath || options.cliPaths.claude;
    args = ['--dangerously-skip-permissions', '--output-format', 'stream-json', '--verbose'];

    if (options.session_id && typeof options.session_id === 'string') {
      args.push('-r', options.session_id, '--fork-session');
    }

    if (reasoningEffort) {
      args.push('--effort', reasoningEffort);
    }

    args.push('-p', prompt);
    if (resolvedModel) {
      args.push('--model', resolvedModel);
    }
  }

  return { cliPath, args, cwd, agent, prompt, resolvedModel };
}
