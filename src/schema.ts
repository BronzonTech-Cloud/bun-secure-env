import { z } from "zod";
import type { ZodRawShape } from "zod";
import { SchemaError } from "./errors";

export { z };
export type { ZodRawShape };

/**
 * Validates environment variables against a Zod shape.
 * On validation failure, throws a SchemaError containing all issues.
 * @param shape The Zod raw shape definition
 * @param data The raw environment variables record
 * @returns The parsed and typed environment object with defaults applied
 * @throws SchemaError if validation fails
 */
export function validateSchema<T extends ZodRawShape>(
  shape: T,
  data: Record<string, string>
): z.infer<z.ZodObject<T>> {
  const schema = z.object(shape);
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new SchemaError(result.error.issues);
  }
  return result.data;
}
