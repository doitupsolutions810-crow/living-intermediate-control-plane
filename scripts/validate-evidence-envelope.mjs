import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = process.cwd();
const schemaPath = path.join(root, "schemas/cross-repository-evidence-envelope-v1.schema.json");
const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);

const cases = [
  ["schemas/fixtures/valid-real-execution.json", true],
  ["schemas/fixtures/invalid-simulation-claims-pass.json", false],
  ["schemas/fixtures/invalid-real-missing-receipt.json", false],
  ["schemas/fixtures/invalid-artifact-digest.json", false],
];

let failures = 0;
for (const [relativePath, expectedValid] of cases) {
  const fixture = JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
  const valid = validate(fixture);
  const expected = expectedValid ? "valid" : "invalid";
  if (valid !== expectedValid) {
    failures += 1;
    console.error(`FAIL ${relativePath}: expected ${expected}, got ${valid ? "valid" : "invalid"}`);
    if (validate.errors) console.error(JSON.stringify(validate.errors, null, 2));
  } else {
    console.log(`PASS ${relativePath}: correctly classified as ${expected}`);
  }
}

// Temporal consistency is semantic policy, not merely structural JSON Schema validation.
const validFixture = JSON.parse(fs.readFileSync(path.join(root, cases[0][0]), "utf8"));
if (!(Date.parse(validFixture.expires_at) > Date.parse(validFixture.issued_at))) {
  failures += 1;
  console.error("FAIL valid fixture: expires_at must be later than issued_at");
} else {
  console.log("PASS valid fixture: expiry follows issue time");
}

if (failures > 0) {
  console.error(`Evidence envelope conformance failed: ${failures} case(s)`);
  process.exitCode = 1;
} else {
  console.log("Evidence envelope structural conformance fixtures passed.");
  console.log("Note: this does not verify signatures, issuer trust, replay state, or subject binding against a real artifact.");
}
