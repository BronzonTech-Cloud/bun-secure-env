import { describe, it, expect } from "bun:test";
import { validateSchema, z } from "../src/schema";
import { SchemaError } from "../src/errors";

describe("schema.ts", () => {
  it("valid input returns typed object", () => {
    const shape = {
      PORT: z.string(),
      DEBUG: z.string(),
    };
    const data = {
      PORT: "3000",
      DEBUG: "true",
    };
    const result = validateSchema(shape, data);
    expect(result).toEqual({
      PORT: "3000",
      DEBUG: "true",
    });
  });

  it("missing required field throws SchemaError with field name in message", () => {
    const shape = {
      API_KEY: z.string(),
      PORT: z.string(),
    };
    const data = {
      PORT: "3000",
    };

    expect(() => validateSchema(shape, data)).toThrow(SchemaError);

    try {
      validateSchema(shape, data);
    } catch (err) {
      const error = err as SchemaError;
      expect(error.message).toContain('Field "API_KEY"');
      expect(error.issues.length).toBe(1);
      expect(error.issues[0]?.path).toEqual(["API_KEY"]);
    }
  });

  it("wrong type throws SchemaError", () => {
    const shape = {
      // In typical env parser, we might use z.coerce.number()
      // Let's test that validation fails if we require a type like a transformed field
      PORT: z.preprocess((val) => Number(val), z.number().min(1000)),
    };
    const data = {
      PORT: "500", // Will fail the minimum of 1000
    };

    expect(() => validateSchema(shape, data)).toThrow(SchemaError);
  });

  it("default values are applied", () => {
    const shape = {
      HOST: z.string().default("localhost"),
      PORT: z.string(),
    };
    const data = {
      PORT: "3000",
    };
    const result = validateSchema(shape, data);
    expect(result).toEqual({
      HOST: "localhost",
      PORT: "3000",
    });
  });
});
