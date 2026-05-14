import { beforeEach, describe, expect, it, vi } from "vitest";

const execMock = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ exec: execMock }));

const configGetMock = vi.hoisted(() => vi.fn());
vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: () => ({ get: configGetMock }),
  },
}));

import { ollamaStatusModule } from "../src/engines/ollama/ollamaStatus";

describe("ollamaStatusModule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna unavailable si ollama --version falla", async () => {
    execMock.mockImplementationOnce((_cmd: string, _opts: unknown, cb: Function) => {
      cb(new Error("not found"), "", "command not found");
    });

    const state = await ollamaStatusModule.check();
    expect(state.status).toBe("unavailable");
    expect(state.statusText).toBe("No instalado");
  });

  it("retorna running con modelos instalados", async () => {
    execMock
      .mockImplementationOnce((_cmd: string, _opts: unknown, cb: Function) => {
        cb(null, "ollama version 0.5.0", "");
      })
      .mockImplementationOnce((_cmd: string, _opts: unknown, cb: Function) => {
        cb(null, "NAME\tID\tSIZE\tMODIFIED\nmistral:latest\tabc123\t4.2GB\t2 days ago\nllama3:latest\tdef456\t6.1GB\t1 day ago\n", "");
      });

    const state = await ollamaStatusModule.check();
    expect(state.status).toBe("running");
    expect(state.statusText).toBe("2 modelos instalados");
    expect(state.actions).toContain("stop");
  });

  it("retorna stopped si no hay modelos instalados", async () => {
    execMock
      .mockImplementationOnce((_cmd: string, _opts: unknown, cb: Function) => {
        cb(null, "ollama version 0.5.0", "");
      })
      .mockImplementationOnce((_cmd: string, _opts: unknown, cb: Function) => {
        cb(null, "NAME\tID\tSIZE\tMODIFIED\n", "");
      });

    const state = await ollamaStatusModule.check();
    expect(state.status).toBe("stopped");
    expect(state.statusText).toContain("sin modelos");
  });
});
