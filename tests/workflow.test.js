import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildNotification, normalizeSubmission, processSubmission, validateSubmission } from "../workflow.js";

const valid = { fullName: " Maya Chen ", email: "MAYA@EXAMPLE.COM", requestType: "Urgent support", notes: "Help" };

test("rejects missing required fields and malformed email", () => {
  const result = validateSubmission({ fullName: "", email: "bad", requestType: "" });
  assert.equal(result.valid, false);
  assert.deepEqual(result.errors, { fullName: "Required", requestType: "Required", email: "Enter a valid email" });
});

test("normalizes a valid form response for Google Sheets", () => {
  const row = normalizeSubmission(valid, new Date("2026-09-04T04:30:00.000Z"));
  assert.equal(row.fullName, "Maya Chen");
  assert.equal(row.email, "maya@example.com");
  assert.equal(row.priority, "High");
  assert.equal(row.status, "Received");
});

test("builds a priority-aware Gmail notification", () => {
  const row = normalizeSubmission(valid, new Date("2026-09-04T04:30:00.000Z"));
  const message = buildNotification(row);
  assert.match(message.subject, /^\[High\]/);
  assert.match(message.body, /maya@example.com/);
});

test("captures a retryable Sheets failure without producing a notification", () => {
  const result = processSubmission(valid, { simulateFailure: true });
  assert.equal(result.ok, false);
  assert.equal(result.retryable, true);
  assert.equal(result.notification, undefined);
});

test("ships an importable n8n workflow covering the requested integrations and validation", () => {
  const artifact = JSON.parse(readFileSync(new URL("../n8n-workflow.json", import.meta.url), "utf8"));
  const nodeNames = artifact.nodes.map((node) => node.name);
  const validation = artifact.nodes.find((node) => node.name === "Validate Required Fields");

  assert.deepEqual(nodeNames, [
    "Google Forms Webhook",
    "Validate Required Fields",
    "Normalize and Route",
    "Add Google Sheet Row",
    "Send Gmail Notification",
    "Validation Error"
  ]);
  assert.equal(validation.parameters.conditions.conditions.length, 3);
  assert.equal(artifact.settings.saveDataErrorExecution, "all");
});
