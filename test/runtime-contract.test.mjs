import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const rootPackage = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const platformPackage = JSON.parse(readFileSync(new URL("../platform/package.json", import.meta.url), "utf8"));

function minimumNodeMajor(range, label) {
  assert.equal(typeof range, "string", label + " must declare a Node engine range");
  const match = /^>=\s*(\d+)(?:\.\d+\.\d+)?$/.exec(range.trim());
  assert.ok(match, label + " must use an explicit >= major version range");
  return Number(match[1]);
}

test("root runtime floor covers every required platform test runtime", () => {
  const rootMajor = minimumNodeMajor(rootPackage.engines?.node, "root package.json");
  const platformMajor = minimumNodeMajor(platformPackage.engines?.node, "platform/package.json");
  assert.ok(
    rootMajor >= platformMajor,
    `root Node floor >=${rootMajor} is below platform floor >=${platformMajor}`
  );
});

test("canonical root test command includes the platform suite", () => {
  const rootTest = rootPackage.scripts?.test;
  assert.equal(typeof rootTest, "string");
  assert.match(rootTest, /npm --prefix platform test/);
  assert.match(platformPackage.scripts?.test || "", /node --test/);
});
