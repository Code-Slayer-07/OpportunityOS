// Validation for Gemini's match output. Owner: Dev C.
import { z } from "zod";

export const matchOutputSchema = z.object({
  score: z.number().transform((n) => Math.round(Math.min(100, Math.max(0, n)))),
  reason: z.string().trim().min(1),
  evidenceMap: z
    .array(z.object({ requirement: z.string(), profileField: z.string(), quote: z.string() }))
    .default([]),
  gaps: z.array(z.string()).default([]),
  eligibilityUncertain: z.boolean(),
});

export type MatchOutput = z.infer<typeof matchOutputSchema>;

// Same shape as above, in Gemini's responseSchema dialect (JSON response mode).
export const GEMINI_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    score: { type: "INTEGER" },
    reason: { type: "STRING" },
    evidenceMap: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          requirement: { type: "STRING" },
          profileField: { type: "STRING" },
          quote: { type: "STRING" },
        },
        required: ["requirement", "profileField", "quote"],
      },
    },
    gaps: { type: "ARRAY", items: { type: "STRING" } },
    eligibilityUncertain: { type: "BOOLEAN" },
  },
  required: ["score", "reason", "evidenceMap", "gaps", "eligibilityUncertain"],
};

// Batch scoring: one call scores several opportunities, one result per opportunity (matched by `id`).
export const batchOutputSchema = z.object({
  results: z.array(matchOutputSchema.extend({ id: z.number().int() })),
});
export type BatchOutput = z.infer<typeof batchOutputSchema>;

export const BATCH_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    results: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { id: { type: "INTEGER" }, ...GEMINI_RESPONSE_SCHEMA.properties },
        required: ["id", ...GEMINI_RESPONSE_SCHEMA.required],
      },
    },
  },
  required: ["results"],
};
