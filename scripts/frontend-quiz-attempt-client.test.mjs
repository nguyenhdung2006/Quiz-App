import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync("frontend/js/quiz-attempt-client.js", "utf8");
const requests = [];
const responses = [];
const notices = [];
const window = {
  quizApiOrigin: () => "https://api.example.test",
  quizCloud: { isReady: () => true },
  WordArenaSyncStatus: { render: (message, tone) => notices.push({ message, tone }) },
  async quizApiFetch(url, options) {
    requests.push({ url, options });
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return next;
  }
};
const context = vm.createContext({ window });
vm.runInContext(source, context, { filename: "frontend/js/quiz-attempt-client.js" });

const client = window.WordArenaQuizAttemptClient;
assert.deepEqual(Object.keys(client), ["issue", "submit", "retryActiveSubmission", "reset", "state"]);

function jsonResponse(status, payload, revision = null) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: name => name === "X-Sync-Revision" && revision != null ? String(revision) : null },
    async json() { return payload; }
  };
}

const plan = {
  quizMode: "quiz",
  challengeSeconds: null,
  items: [
    { wordId: 11, questionMode: "eng", expectedPrompt: "focus" },
    { wordId: 12, questionMode: "vie", expectedPrompt: "binh tinh" }
  ]
};
const issuedPayload = {
  attemptId: "10000000-0000-4000-8000-000000000001",
  items: [
    { ordinal: 0, wordId: 11, wordUid: "20000000-0000-4000-8000-000000000011", questionMode: "eng", prompt: "focus" },
    { ordinal: 1, wordId: 12, wordUid: "20000000-0000-4000-8000-000000000012", questionMode: "vie", prompt: "binh tinh" }
  ]
};
responses.push(jsonResponse(200, issuedPayload));
const issued = await client.issue(plan);
assert.equal(issued.online, true);
assert.equal(requests[0].url, "https://api.example.test/api/quiz/attempts");
assert.deepEqual(JSON.parse(requests[0].options.body), {
  quizMode: "quiz",
  challengeSeconds: null,
  items: [
    { wordId: 11, questionMode: "eng" },
    { wordId: 12, questionMode: "vie" }
  ]
});

const outcome = {
  totalQuestions: 2,
  correctAnswers: 1,
  wrongAnswers: 1,
  score: 5,
  maxCombo: 1,
  awardedQuizXp: 19,
  awardedAchievementXp: 20,
  resultingSyncRevision: 4
};
responses.push(
  new Error("response lost"),
  jsonResponse(200, {
    attemptId: issuedPayload.attemptId,
    replayed: true,
    outcome,
    snapshot: { revision: 4 }
  }, 4)
);
const submitted = await client.submit(["tap trung", "wrong"]);
assert.equal(submitted.ok, true);
assert.equal(submitted.body.replayed, true);
assert.equal(requests[1].url, requests[2].url);
assert.equal(requests[1].options.body, requests[2].options.body);
assert.deepEqual(JSON.parse(requests[1].options.body), {
  answers: [
    { ordinal: 0, selectedAnswer: "tap trung" },
    { ordinal: 1, selectedAnswer: "wrong" }
  ]
});
assert.equal(client.state().status, "consumed");

client.reset();
const requestCountBeforeInvalid = requests.length;
const localOnly = await client.issue({
  quizMode: "quiz",
  items: [{ wordId: null, questionMode: "eng", expectedPrompt: "local" }]
});
assert.equal(localOnly.online, false);
assert.equal(requests.length, requestCountBeforeInvalid);
assert.equal(client.state(), null);
assert.match(notices.at(-1).message, /local-only/i);

responses.push(jsonResponse(200, issuedPayload));
await client.issue(plan);
responses.push(jsonResponse(503, {}), jsonResponse(503, {}), jsonResponse(200, {
  attemptId: issuedPayload.attemptId,
  replayed: true,
  outcome,
  snapshot: { revision: 4 }
}, 4));
const pending = await client.submit(["tap trung", "wrong"]);
assert.equal(pending.ok, false);
assert.equal(client.state().status, "pending");
const pendingBody = client.state().submissionBody;
const recovered = await client.retryActiveSubmission();
assert.equal(recovered.ok, true);
assert.equal(client.state().submissionBody, pendingBody);
assert.equal(client.state().status, "consumed");

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const delayedIssue = deferred();
responses.push(delayedIssue.promise);
const issuing = client.issue(plan);
client.reset();
delayedIssue.resolve(jsonResponse(200, issuedPayload));
assert.equal((await issuing).cancelled, true);
assert.equal(client.state(), null);

const nextPayload = { ...issuedPayload, attemptId: "10000000-0000-4000-8000-000000000002" };
for (const responseLost of [false, true]) {
  responses.push(jsonResponse(200, issuedPayload));
  await client.issue(plan);
  const delayedSubmit = deferred();
  responses.push(delayedSubmit.promise);
  const submitting = client.submit(["tap trung", "wrong"]);
  client.reset();
  responses.push(jsonResponse(200, nextPayload));
  await client.issue(plan);
  const requestCount = requests.length;
  if (responseLost) delayedSubmit.reject(new Error("old response lost"));
  else delayedSubmit.resolve(jsonResponse(200, { attemptId: issuedPayload.attemptId, outcome }));
  assert.equal((await submitting).cancelled, true);
  assert.equal(client.state().attemptId, nextPayload.attemptId);
  assert.equal(client.state().status, "issued");
  assert.equal(client.state().submissionBody, null);
  assert.equal(requests.length, requestCount, "cancelled attempts must not retry against a replacement");
}

const delayedBody = deferred();
responses.push({ ok: true, json: () => delayedBody.promise });
const parsing = client.submit(["tap trung", "wrong"]);
await Promise.resolve();
client.reset();
delayedBody.resolve({ attemptId: nextPayload.attemptId, outcome });
assert.equal((await parsing).cancelled, true);
assert.equal(client.state(), null);

responses.push(jsonResponse(200, issuedPayload));
await client.issue(plan);
responses.push(jsonResponse(503, {}), jsonResponse(503, {}));
await client.submit(["tap trung", "wrong"]);
const delayedRetry = deferred();
responses.push(delayedRetry.promise);
const retrying = client.retryActiveSubmission();
client.reset();
delayedRetry.resolve(jsonResponse(200, { attemptId: issuedPayload.attemptId, outcome }));
assert.equal((await retrying).cancelled, true);
assert.equal(client.state(), null);

responses.push(jsonResponse(200, nextPayload));
await client.issue(plan);
responses.push(
  jsonResponse(200, { attemptId: issuedPayload.attemptId, outcome }),
  jsonResponse(200, { attemptId: nextPayload.attemptId, outcome })
);
assert.equal((await client.submit(["tap trung", "wrong"])).ok, true);
assert.equal(requests.at(-1).url, requests.at(-2).url);
assert.equal(requests.at(-1).options.body, requests.at(-2).options.body);
assert.equal(client.state().lastResponse.attemptId, nextPayload.attemptId);

console.log("Frontend quiz attempt client tests passed.");
