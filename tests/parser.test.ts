import { describe, it, expect } from "bun:test";
import { parseEnv } from "../src/parser";

describe("parser.ts", () => {
  it("parses KEY=value", () => {
    const input = "KEY=value\nOTHER_KEY=another_value";
    const parsed = parseEnv(input);
    expect(parsed).toEqual({
      KEY: "value",
      OTHER_KEY: "another_value",
    });
  });

  it("parses quoted values (double + single)", () => {
    const input = `
      DOUBLE_QUOTED="double value"
      SINGLE_QUOTED='single value'
      ESCAPED_DOUBLE="value with \\"quotes\\""
      ESCAPED_SINGLE='value with \\'quotes\\''
    `;
    const parsed = parseEnv(input);
    expect(parsed).toEqual({
      DOUBLE_QUOTED: "double value",
      SINGLE_QUOTED: "single value",
      ESCAPED_DOUBLE: 'value with "quotes"',
      ESCAPED_SINGLE: "value with 'quotes'",
    });
  });

  it("strips inline comments", () => {
    const input = `
      UNQUOTED=val # comment here
      DOUBLE="quoted val" # comment here
      SINGLE='quoted val' # comment here
      NO_SPACE=val#not-a-comment
    `;
    const parsed = parseEnv(input);
    expect(parsed).toEqual({
      UNQUOTED: "val",
      DOUBLE: "quoted val",
      SINGLE: "quoted val",
      NO_SPACE: "val#not-a-comment",
    });
  });

  it("skips blank lines and comment lines", () => {
    const input = `
      # This is a comment
      
      KEY=value
      
      # Another comment
    `;
    const parsed = parseEnv(input);
    expect(parsed).toEqual({
      KEY: "value",
    });
  });

  it("handles multiline with \\n", () => {
    const input = 'KEY="line1\\nline2\\nline3"';
    const parsed = parseEnv(input);
    expect(parsed).toEqual({
      KEY: "line1\nline2\nline3",
    });
  });
});
