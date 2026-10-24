import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
test("the new evaluation has 100 unique independent bilingual pairs and covers all requested categories", () => {
  const rows = readFileSync("tests/fixtures/assistant-bilingual-v2.tsv", "utf8")
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.split("\t"));
  assert.equal(rows.length, 100);
  assert.equal(new Set(rows.map((r) => r[0])).size, 100);
  assert.equal(new Set(rows.map((r) => r[2])).size, 100);
  assert.equal(new Set(rows.map((r) => r[3])).size, 100);
  for (const row of rows) {
    assert.equal(row.length, 5);
    assert.ok(row.every(Boolean));
  }
  for (const category of [
    "conversation",
    "create",
    "update",
    "delete",
    "search",
    "availability",
    "context",
    "safety",
  ])
    assert.ok(rows.some((r) => r[1] === category));
});
