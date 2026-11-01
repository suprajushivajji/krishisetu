/**
 * Basic tests for voice agent functionality (general assistant stack).
 * Uses the repo's test infrastructure: node:assert + tsx (no jest).
 * All provider behaviour is MOCKED/free — no live API keys required and no
 * real registrations are created.
 *
 * Run: npx tsx tests/agent.test.ts
 */

import assert from "node:assert/strict";

import { OpenRouterService } from "../src/server/services/openrouter";
import { GnaniService } from "../src/server/services/gnani";
import { ConversationManager } from "../src/server/services/agent/conversationManager";
import { WorkflowHandler } from "../src/server/services/agent/workflowHandler";
import { config } from "../src/server/config";

let passed = 0;
async function ok(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`  ✅ ${name}`);
}

// Private helpers accessed for unit coverage (same style as before, typed).
const isConfirmation = (WorkflowHandler as unknown as { isConfirmation(t: string, l: string): boolean }).isConfirmation;
const isCancellation = (WorkflowHandler as unknown as { isCancellation(t: string, l: string): boolean }).isCancellation;
const validateDate = (WorkflowHandler as unknown as { validateDate(d: string): { valid: boolean } }).validateDate;
const validateTime = (WorkflowHandler as unknown as { validateTime(t: string): { valid: boolean } }).validateTime;

console.log("🧪 [Agent Test Suite] Running...\n");

async function main() {
  await ok("OpenRouter throws when API key not configured", async () => {
    const originalKey = config.OPENROUTER_API_KEY;
    (config as { OPENROUTER_API_KEY: string }).OPENROUTER_API_KEY = "";
    await assert.rejects(
      () => OpenRouterService.chat([{ role: "user", content: "test" }]),
      /OPENROUTER_API_KEY is not configured/,
    );
    (config as { OPENROUTER_API_KEY: string }).OPENROUTER_API_KEY = originalKey;
  });

  await ok("OpenRouter tool-call JSON shape is parseable", () => {
    const mockResponse = 'Here is the data: {"tool_name": "crop_price", "arguments": {"crop": "tomato"}}';
    const match = mockResponse.match(/\{[\s\S]*\}/);
    assert.ok(match, "expected an embedded JSON object");
    const parsed = JSON.parse(match[0]) as { tool_name: string; arguments: { crop: string } };
    assert.equal(parsed.tool_name, "crop_price");
    assert.equal(parsed.arguments.crop, "tomato");
  });

  await ok("Conversation manager creates context with language", () => {
    const manager = new ConversationManager({ language: "kn-IN" });
    assert.equal(manager.getContext().language, "kn-IN");
  });

  await ok("Conversation manager adds messages to history", () => {
    const manager = new ConversationManager({ language: "en-IN" });
    manager.addMessage("user", "Hello");
    manager.addMessage("assistant", "Hi there");
    const history = manager.getHistory();
    assert.equal(history.length, 2);
    assert.equal(history[0].role, "user");
    assert.equal(history[1].role, "assistant");
  });

  await ok("Conversation manager tracks workflow state", () => {
    const manager = new ConversationManager({ language: "en-IN" });
    manager.startWorkflow("business_registration", ["businessName", "phone"]);
    const workflow = manager.getWorkflow();
    assert.equal(workflow.type, "business_registration");
    assert.ok(workflow.missingFields.includes("businessName"));
    manager.updateWorkflowField("businessName", "Test Business");
    const after = manager.getWorkflow();
    assert.equal(after.collectedFields.businessName, "Test Business");
    assert.ok(!after.missingFields.includes("businessName"));
  });

  await ok("Gnani TTS throws when API key not configured", async () => {
    const originalKey = config.GNANI_API_KEY;
    (config as { GNANI_API_KEY: string }).GNANI_API_KEY = "";
    await assert.rejects(
      () => GnaniService.synthesize({ text: "test", languageCode: "kn-IN" }),
      /not configured/i,
    );
    (config as { GNANI_API_KEY: string }).GNANI_API_KEY = originalKey;
  });

  await ok("Workflow handler detects confirmation and cancellation", () => {
    assert.equal(isConfirmation("yes", "en-IN"), true);
    assert.equal(isConfirmation("no", "en-IN"), false);
    assert.equal(isCancellation("cancel", "en-IN"), true);
    assert.equal(isCancellation("continue", "en-IN"), false);
  });

  await ok("Workflow handler validates dates (future-only)", () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    assert.equal(validateDate(future).valid, true);
    assert.equal(validateDate("2020-01-01").valid, false);
    assert.equal(validateDate("invalid").valid, false);
  });

  await ok("Workflow handler validates HH:MM times", () => {
    assert.equal(validateTime("14:30").valid, true);
    assert.equal(validateTime("25:00").valid, false);
    assert.equal(validateTime("invalid").valid, false);
  });

  console.log(`\n🎉 ${passed} agent scenarios passed.\n`);
}

main().catch((err) => {
  console.error("❌ TEST FAILURE:", err?.message || err);
  process.exit(1);
});
