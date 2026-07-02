import { expect, test } from "bun:test";
import { parseTime } from "src/parsing/time-parser";

test("can parse good input", () => {
    expect(parseTime("1:11:30")).toBe(60 * 60 + 60 * 11 + 30);
    expect(parseTime("01:01:30")).toBe(60 * 60 + 60 * 1 + 30);
});

test("can handle negative time", () => {
    expect(parseTime("-1:30")).toBe(null);
});
