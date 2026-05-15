import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');

function collectSourceFiles(directory: string): string[] {
  const files: string[] = [];

  for (const dirent of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, dirent.name);

    if (dirent.isDirectory()) {
      if (dirent.name === 'node_modules') {
        continue;
      }
      files.push(...collectSourceFiles(path));
    } else if (dirent.isFile() && /\.[jt]sx?$/.test(dirent.name)) {
      files.push(path);
    }
  }

  return files;
}

describe('GhostPrompt log output channel usage', () => {
  it('only creates the canonical GhostPrompt log output channel through the log manager', () => {
    const sourceFiles = collectSourceFiles(join(repoRoot, 'src'));
    const bannedPatterns = [
      /vscode\.window\.createOutputChannel\(\s*GHOSTPROMPT_LOG_CHANNEL_NAME\s*\)/,
      /vscode\.window\.createOutputChannel\(\s*['\"]GhostPrompt Log['\"]\s*\)/,
      /createOutputChannel\(\s*GHOSTPROMPT_LOG_CHANNEL_NAME\s*\)/,
      /createOutputChannel\(\s*['\"]GhostPrompt Log['\"]\s*\)/,
    ];

    const violations = sourceFiles.flatMap((filePath) => {
      const normalized = filePath.replace(/\\/g, '/');
      if (normalized.endsWith('/src/system/log/transports/outputChannel.ts')) {
        return [];
      }

      const content = readFileSync(filePath, 'utf8');
      return bannedPatterns.some((pattern) => pattern.test(content)) ? [filePath] : [];
    });

    expect(violations).toEqual([]);
  });
});
