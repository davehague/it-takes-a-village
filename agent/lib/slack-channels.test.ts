import test from "node:test";
import assert from "node:assert/strict";

import { CHANNEL_ID_RE, normalizeChannelName, pickChannel } from "./slack-channels.ts";

const channels = [
  { id: "C1", name: "village-exa-researcher" },
  { id: "C2", name: "village-copywriter" },
  { id: "C3", name: "general" },
  { id: "C4", name: "villager-management" },
];

test("CHANNEL_ID_RE accepts Slack channel ids and rejects names", () => {
  assert.ok(CHANNEL_ID_RE.test("C0C1GK8SGKT"));
  assert.ok(CHANNEL_ID_RE.test("G0ABCDEFGH"));
  assert.ok(!CHANNEL_ID_RE.test("#village-copywriter"));
  assert.ok(!CHANNEL_ID_RE.test("c0c1gk8sgkt"));
});

test("normalizeChannelName strips # and whitespace and lowercases", () => {
  assert.equal(normalizeChannelName("  #Village-Copywriter "), "village-copywriter");
  assert.equal(normalizeChannelName("general"), "general");
});

test("pickChannel finds an exact (normalized) match with no suggestions", () => {
  const { match, suggestions } = pickChannel(channels, "#Village-Copywriter");
  assert.equal(match?.id, "C2");
  assert.deepEqual(suggestions, []);
});

test("pickChannel suggests up to three near names when nothing matches", () => {
  const { match, suggestions } = pickChannel(channels, "#village-copy");
  assert.equal(match, null);
  assert.deepEqual(suggestions, ["village-exa-researcher", "village-copywriter", "villager-management"]);
});

test("pickChannel returns no suggestions for a totally unrelated name", () => {
  assert.deepEqual(pickChannel(channels, "zzz").suggestions, []);
});
