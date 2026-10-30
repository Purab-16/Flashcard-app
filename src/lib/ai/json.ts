import type { z } from "zod";

/** Parse a model reply that should be JSON. Tolerates code fences and extra text. */
export function parseJsonReply<S extends z.ZodType>(text: string, schema: S): z.output<S> {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  let body = (fenced ? fenced[1] : text).trim();

  if (!body.startsWith("{") && !body.startsWith("[")) {
    const start = body.search(/[{[]/);
    const end = Math.max(body.lastIndexOf("}"), body.lastIndexOf("]"));
    if (start === -1 || end <= start) throw new Error("Model reply has no JSON");
    body = body.slice(start, end + 1);
  }

  return schema.parse(JSON.parse(body));
}
