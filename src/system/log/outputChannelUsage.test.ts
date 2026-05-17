/**
 * @file Tests de uso del output channel de logging.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import * as vitest from 'vitest';

const repoRoot = join(import.meta.dirname, '../../..');

/**
 * Recursively collects source file paths under a directory.
 * @param {string} directory - The starting directory to scan for source files.
 * @returns {string[]} A list of matching source file paths.
 */
function collectSourceFiles(directory: string): string[] {
  const files: string[] = [];

  for (const dirent of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, dirent.name);

    if (dirent.isDirectory()) {
      if (dirent.name === 'node_modules') {
        continue;
      }
      files.push(...collectSourceFiles(entryPath));
    } else if (dirent.isFile() && /\.[jt]sx?$/u.test(dirent.name)) {
      files.push(entryPath);
    }
  }

  return files;
}

vitest.describe('GhostPrompt log output channel usage', () => {
  vitest.it('only creates the canonical GhostPrompt log output channel through the log manager', () => {
    const sourceFiles = collectSourceFiles(join(repoRoot, 'src'));
    const bannedPatterns = [
      /vscode\.window\.createOutputChannel\(\s*GHOSTPROMPT_LOG_CHANNEL_NAME\s*\)/u,
      /vscode\.window\.createOutputChannel\(\s*["']GhostPrompt Log["']\s*\)/u,
      /createOutputChannel\(\s*GHOSTPROMPT_LOG_CHANNEL_NAME\s*\)/u,
      /createOutputChannel\(\s*["']GhostPrompt Log["']\s*\)/u,
    ];

    const violations = sourceFiles.flatMap((filePath) => {
      const normalized = filePath.replaceAll('\\', '/');
      if (normalized.endsWith('/src/system/log/transports/outputChannel.ts')) {
        return [];
      }

      const content = readFileSync(filePath, 'utf8');
      return bannedPatterns.some((pattern) => pattern.test(content)) ? [filePath] : [];
    });

    vitest.expect(violations).toEqual([]);
  });
});
