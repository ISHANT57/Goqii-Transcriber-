/**
 * Google Gemini client + forced-function-call helper for the two-call
 * note-generation architecture (PRD §6.3.5).
 *
 * Replaces the previous Anthropic client. The shared tool definitions
 * (SOAP_TOOL etc.) are JSON Schemas written for Anthropic's `tool_use`; Gemini
 * function declarations use a slightly different schema dialect, so
 * `toGeminiSchema` translates them at call time (chiefly: JSON-Schema nullable
 * unions `["string","null"]` → Gemini's `{ type: "STRING", nullable: true }`,
 * and dropping `additionalProperties`, which Gemini rejects).
 */
import { GoogleGenAI } from "@google/genai";
import type { LLMToolDef } from "@gooqi/shared";
import { NoteFailedError } from "./toolCall.js";

/**
 * Model used for all two-call note generation. gemini-2.5-flash supports forced
 * function calling (`mode: "ANY"`), which the flow relies on. Change in one
 * place to roll the model forward.
 */
export const NOTE_MODEL = "gemini-2.5-flash";

let client: GoogleGenAI | null = null;

/**
 * Lazily construct the Gemini client. Deferred (not at import time) so the
 * worker can still boot and run transcription jobs when GEMINI_API_KEY is
 * absent — note-generation jobs then fail cleanly into `note_failed` instead of
 * crashing the whole process at startup.
 */
export function getGemini(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

/**
 * Recursively translate an Anthropic/JSON-Schema node into a Gemini Schema.
 * Handles nullable unions (`type: ["string","null"]`), upper-cases the type
 * keyword, and drops fields Gemini does not accept (`additionalProperties`).
 */
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
  /** Parsed function-call arguments, or null if the model called no function. */
  args: unknown | null;
  /** True when the response was cut off at maxOutputTokens. */
  truncated: boolean;
}

/**
 * Call Gemini forcing a single function call to `tool`. Returns the parsed
 * arguments (`args`) — the Gemini analogue of Anthropic's `tool_use.input`.
 *
 * `thinkingBudget: 0` disables 2.5-flash "thinking" so the whole output budget
 * goes to the function call (thinking tokens can otherwise starve the call and
 * trip MAX_TOKENS on a structured-extraction task like this).
 */
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

/**
 * Classify an error thrown by `generateContent`. Returns a NoteFailedError for
 * NON-RETRYABLE cases (HTTP 5xx, context-length), or null when the error is
 * transient/unexpected and should be re-thrown so BullMQ can retry the job.
 */
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
