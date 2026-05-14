import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/**
 * Contrato mínimo para poder testear `ProjectMemoryStore` sobre directorio temporal.
 */
export interface ProjectMemoryFsAdapter {
  mkdir(dir: string, options?: { recursive?: boolean }): Promise<void>;
  readFileUtf8(file: string): Promise<string | undefined>;
  writeFileUtf8(file: string, data: string): Promise<void>;
  rmDirRecursive(dir: string): Promise<void>;
}

export class NodeProjectMemoryFs implements ProjectMemoryFsAdapter {
  public async mkdir(dir: string, options?: { recursive?: boolean }): Promise<void> {
    await fs.mkdir(dir, options);
  }

  public async readFileUtf8(file: string): Promise<string | undefined> {
    try {
      return await fs.readFile(file, 'utf8');
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        return undefined;
      }
      throw e;
    }
  }

  public async writeFileUtf8(file: string, data: string): Promise<void> {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, data, 'utf8');
  }

  public async rmDirRecursive(dir: string): Promise<void> {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
