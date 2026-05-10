/**

 * Catálogo de modelos OpenCode para el selector webview (`config.providers()`).

 */

import * as vscode from "vscode";



import { normalizeOpencodeProviderModels } from "./normalizeOpencodeProviderModels";
import { classifyOpencodeModelTier } from "./opencodeModelTier";

import type {

  SuggestionModelDescriptor,

  SuggestionModelPolicy,

} from "./types";

import { getOpenCodeRuntime } from "../opencode/OpenCodeRuntime";



type OpencodeProvidersBundle = {

  providers?: Array<{

    id: string;

    name: string;

    models?: unknown;

  }>;

};



function readSdkData(result: unknown): unknown {

  if (result && typeof result === "object" && "data" in result) {

    return (result as { data: unknown }).data;

  }

  return undefined;

}



/**

 * Lista modelos instalados/configurados en OpenCode para el dropdown.

 * Vacío si el runtime no arranca o no hay CLI.

 * Con **`nonPremiumOnly`** se ocultan modelos clasificados como **premium** según metadatos del catálogo (p. ej. multiplicador distinto de `0x`).

 */

export async function listOpencodeSuggestionModels(

  policy: SuggestionModelPolicy,

): Promise<SuggestionModelDescriptor[]> {

  const excluded = new Set(

    vscode.workspace

      .getConfiguration("ghostPrompt")

      .get<string[]>("opencodeExcludedModelIds", [])

      .filter((id): id is string => typeof id === "string" && id.trim().length > 0),

  );



  const runtime = getOpenCodeRuntime();

  const started = await runtime.start();

  if (!started.ok) {

    return [];

  }



  const raw = runtime.getClient();

  if (!raw) {

    return [];

  }



  const client = raw as {

    config: { providers(): Promise<unknown> };

  };



  try {

    const envelope = await client.config.providers();

    const data = readSdkData(envelope) as OpencodeProvidersBundle | undefined;

    const providers = data?.providers ?? [];

    const descriptors: SuggestionModelDescriptor[] = [];



    for (const p of providers) {

      const seenComposite = new Set<string>();

      for (const model of normalizeOpencodeProviderModels(p.models)) {

        const id = `${p.id}/${model.id}`;

        if (seenComposite.has(id)) {

          continue;

        }

        seenComposite.add(id);

        if (excluded.has(id)) {

          continue;

        }

        const labelSource =

          typeof model.name === "string" ? model.name.trim() : model.id;

        const rawRecord = model as Record<string, unknown>;

        const { tier, pricing } = classifyOpencodeModelTier(

          p.id,

          model.id,

          labelSource,

          rawRecord,

        );

        if (policy === "nonPremiumOnly" && tier === "premium") {

          continue;

        }

        descriptors.push({

          id,

          label: labelSource || model.id,

          tier,

          ...(pricing ? { pricing } : {}),

          provider: p.name?.trim() || p.id,

          completionSource: "opencode",

        });

      }

    }



    descriptors.sort((a, b) =>

      a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),

    );

    return descriptors;

  } catch {

    return [];

  }

}


