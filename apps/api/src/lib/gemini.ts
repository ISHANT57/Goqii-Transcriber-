/**
 * Google Gemini client + forced-function-call helper (inline API copy).
 * Copied from apps/worker/src/lib/gemini.ts — same logic, runs inside the API
 * process instead of a separate worker so we don't need Redis on free tier.
 */
import { GoogleGenAI } from "@google/genai";
import type { LLMToolDef } from "@gooqi/shared";
import { NoteFailedError } from "./toolCall.js";

export const NOTE_MODEL = "gemini-2.5-flash";

let client: GoogleGenAI | null = null;

export function getGemini(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

/** Translate an Anthropic/JSON-Schema node into a Gemini-compatible Schema. */
export function toGeminiSchema(node: unknown): Record<string, unknown> {
  if (!node || typeof node !== "object") return node as Record<string, unknown>;
  const n = node as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  let type = n.type as string | string[] | undefined;
  let nullable = false;
  if (Array.isArray(type)) {
    nullable = type.includes("null");
    type = type.find((t) => t !== "null");
  }
  if (typeof type === "string") out.type = type.toUpperCase();
  if (nullable) out.nullable = true;
  if (typeof n.description === "string") out.description = n.description;
  if (Array.isArray(n.enum)) out.enum = n.enum;
  if (Array.isArray(n.required)) out.required = n.required;

  if (n.properties && typeof n.properties === "object") {
    const props: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(n.properties as Record<string, unknown>)) {
      props[k] = toGeminiSchema(v);
    }
    out.properties = props;
  }
  if (n.items) out.items = toGeminiSchema(n.items);

  return out;
}

export interface GeminiToolResult {
  args: unknown | null;
  truncated: boolean;
}

export async function callGeminiTool(opts: {
  system: string;
  tool: LLMToolDef;
  prompt: string;
}): Promise<GeminiToolResult> {
  const { system, tool, prompt } = opts;
  const response = await getGemini().models.generateContent({
    model: NOTE_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      systemInstruction: system,
      maxOutputTokens: 4096,
      thinkingConfig: { thinkingBudget: 0 },
      tools: [
        {
          functionDeclarations: [
            {
              name: tool.name,
              description: tool.description,
              parameters: toGeminiSchema(tool.input_schema) as never,
            },
          ],
        },
      ],
      toolConfig: {
        functionCallingConfig: {
          mode: "ANY" as never,
          allowedFunctionNames: [tool.name],
        },
      },
    },
  });

  const finishReason = response.candidates?.[0]?.finishReason;
  const truncated = finishReason === "MAX_TOKENS";
  const calls = response.functionCalls ?? [];
  const args = calls.length > 0 ? (calls[0]!.args ?? null) : null;

  return { args, truncated };
}

/** Returns a NoteFailedError for non-retryable Gemini errors, null otherwise. */
export function classifyGeminiError(err: unknown): NoteFailedError | null {
  const anyErr = err as { status?: number; code?: number; message?: string } | undefined;
  const status = anyErr?.status ?? anyErr?.code;
  const message = String(anyErr?.message ?? "");

  if (typeof status === "number" && status >= 500) {
    return new NoteFailedError(`gemini_http_${status}`);
  }
  if (
    (status === 400 || status === 413) &&
    /context|token count|too long|exceeds the maximum|max.*token/i.test(message)
  ) {
    return new NoteFailedError("context_length_exceeded");
  }
  return null;
}
