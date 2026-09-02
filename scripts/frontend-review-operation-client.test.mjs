import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import vm from "node:vm";

const source = readFileSync("frontend/js/review-operation-client.js", "utf8");
let passed = 0;
function harness() {
  const requests = [], handlers = [], listeners = {};
  let account = "A", revision = 0, local = 0, accepted = 0;
  const window = {
    crypto: { randomUUID }, getCurrentAccountId: () => account,
    quizApiOrigin: () => "https://example.test",
    addEventListener: (name, handler) => { listeners[name] = handler; },
    quizCloud: { isReady: () => true, state: () => ({ lastKnownRevision: revision }),
      rememberResponseRevision: response => { revision = Math.max(revision, Number(response.headers.get("X-Sync-Revision"))); } },
    async quizApiFetch(url, options) {
      requests.push({ url, body: options?.body });
      const handler = handlers.shift();
      if (handler instanceof Error) throw handler;
      return typeof handler === "function" ? handler(options?.body && JSON.parse(options.body)) : handler;
    }
  };
  vm.runInNewContext(source, { window });
  const client = window.WordArenaReviewOperationClient;
  const command = (action = "review", overrides = {}) => client.run({ wordId: 1, action, correct: true,
    local: () => { local++; }, accept: () => { accepted++; }, ...overrides });
  return { client, window, requests, handlers, listeners, command,
    state: () => ({ local, accepted, revision }), account: value => { account = value; },
    revision: value => { revision = value; } };
}
function response(status, body, revision = 1) {
  return { ok: status === 200, status, headers: { get: () => String(revision) }, json: async () => body };
}
function success(payload, revision = 1) {
  return response(200, { outcome: { operationId: payload.operationId, wordId: payload.wordId,
    action: payload.mode || "known", resultingRevision: 1 }, replayed: true,
    word: { id: payload.wordId }, inWrongBank: false, revision }, revision);
}
async function test(name, run) { await run(); passed++; console.log(`PASS ${name}`); }

await test("network loss retries exact serialized body and applies fallback once", async () => {
  const h = harness(); h.handlers.push(new Error("lost"), success);
  assert.equal((await h.command()).ok, true);
  assert.equal(h.requests[0].body, h.requests[1].body);
  assert.deepEqual(h.state(), { local: 1, accepted: 1, revision: 1 });
});
await test("manual retry and changed click cannot replace pending identity or callbacks", async () => {
  const h = harness(); h.handlers.push(new Error("lost"), response(503, {}));
  assert.equal((await h.command("known")).pending, true);
  h.handlers.push(success);
  assert.equal((await h.command("mark-hard")).reused, true);
  assert.equal(new Set(h.requests.map(request => request.body)).size, 1);
  assert.deepEqual(h.state(), { local: 1, accepted: 1, revision: 1 });
  h.handlers.push(success); await h.command("known");
  assert.notEqual(h.requests[0].body, h.requests[3].body);
});
await test("stale review conflict never applies local fallback, only reconciles read model", async () => {
  const h = harness(); h.handlers.push(response(409, { error: "REVIEW_NOT_DUE" }),
    response(200, { revision: 2, vocab: [{ id: 1 }], wrongWords: [] }, 2));
  assert.equal((await h.command()).rejected, true);
  assert.equal(h.state().local, 0); assert.equal(h.state().accepted, 1);
  assert.equal(h.client.pendingCount(), 0);
});
await test("failed conflict reconciliation retries GET, never another mutation", async () => {
  const h = harness(); h.handlers.push(response(409, {}), new Error("offline"));
  await h.command();
  h.handlers.push(response(200, { revision: 1, vocab: [], wrongWords: [] }));
  await h.client.retryPending();
  assert.equal(h.requests.filter(request => request.body).length, 1);
  assert.equal(h.client.pendingCount(), 0);
});
await test("account switch during response parsing ignores body, revision and fallback", async () => {
  const h = harness();
  h.handlers.push(payload => ({ ...success(payload), json: async () => {
    h.account("B"); return (await success(payload).json());
  } }));
  assert.equal((await h.command()).cancelled, true);
  assert.deepEqual(h.state(), { local: 0, accepted: 0, revision: 0 });
});
await test("reset while in flight and A-B-A lifecycle cannot resurrect old operation", async () => {
  const h = harness(); let resolve;
  h.handlers.push(payload => new Promise(done => { resolve = () => done(success(payload)); }));
  const pending = h.command();
  h.client.reset(); resolve();
  assert.equal((await pending).cancelled, true);
  assert.equal(h.state().accepted, 0);
});
await test("malformed successful body retains exact identity and recovers", async () => {
  const h = harness(); h.handlers.push(response(200, {}), success);
  assert.equal((await h.command()).ok, true);
  assert.equal(h.requests[0].body, h.requests[1].body);
  assert.equal(h.state().local, 1);
});
await test("older current revision cannot replace newer learning state", async () => {
  const h = harness(); h.revision(10); h.handlers.push(success, payload => success(payload, 10));
  assert.equal((await h.command()).ok, true);
  assert.equal(h.state().revision, 10); assert.equal(h.state().accepted, 1);
});
await test("offline command is local-only and not retroactively retried", async () => {
  const h = harness(); await h.command("known", { online: false }); await h.client.retryPending();
  assert.equal(h.requests.length, 0); assert.equal(h.state().local, 1);
});
await test("no crypto identity fails closed for cloud", async () => {
  const h = harness(); h.window.crypto = null; await h.command();
  assert.equal(h.requests.length, 0); assert.equal(h.state().local, 1);
});
await test("rejected unsynced local word is not treated as an authoritative deletion", async () => {
  const h = harness(); h.handlers.push(response(400, {}), response(200, { revision: 1, vocab: [], wrongWords: [] }));
  assert.equal((await h.command("known")).rejected, true);
  assert.equal(h.state().local, 1); assert.equal(h.state().accepted, 0);
  assert.equal(h.client.pendingCount(), 0);
});
await test("simultaneous click shares in-flight operation without duplicate learning", async () => {
  const h = harness(); let resolve;
  h.handlers.push(payload => new Promise(done => { resolve = () => done(success(payload)); }));
  const first = h.command("known"), second = h.command("known"); resolve();
  assert.equal((await first).ok, true); assert.equal((await second).reused, true);
  assert.equal(h.requests.length, 1); assert.equal(h.state().local, 1);
});
console.log(`Review operation helper: ${passed}/${passed} passed.`);
