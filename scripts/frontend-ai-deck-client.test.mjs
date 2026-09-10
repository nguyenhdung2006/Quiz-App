import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync("frontend/js/ai-deck-client.js", "utf8");
const requests = [];
let nextResponse = null;
let nextFailure = null;
const context = vm.createContext({
  window: {
    quizApiOrigin: () => "https://api.example.test",
    async quizApiFetch(url, options) {
      requests.push({ url, options });
      if (nextFailure) throw nextFailure;
      return nextResponse;
    }
  }
});
vm.runInContext(source, context, { filename: "frontend/js/ai-deck-client.js" });

const client = context.window.WordArenaAiDeckClient;
assert.equal(typeof client.request, "function");

function jsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    },
    clone() {
      return jsonResponse(status, payload);
    }
  };
}

nextResponse = jsonResponse(200, { source: "openai", items: [{ english: "focus" }] });
const success = await client.request("A focused paragraph", { targetLevel: "B1", maxWords: 10 });
assert.equal(success.source, "openai");
assert.equal(requests[0].url, "https://api.example.test/api/ai/generate-deck");
assert.equal(requests[0].options.method, "POST");
assert.equal(requests[0].options.headers["Content-Type"], "application/json");
assert.deepEqual(JSON.parse(requests[0].options.body), {
  text: "A focused paragraph",
  targetLevel: "B1",
  maxWords: 10
});

nextFailure = new Error("offline");
await assert.rejects(
  client.request("Offline request"),
  { message: "AI deck generation failed. Please try again." }
);
nextFailure = null;

nextResponse = jsonResponse(429, { retryAfterSeconds: 45 });
await assert.rejects(
  client.request("Rate limited"),
  { message: "Daily AI limit reached. Please try again in 45s." }
);

nextResponse = jsonResponse(400, { message: "Text is required." });
await assert.rejects(client.request(""), { message: "Text is required." });

nextResponse = jsonResponse(503, { message: "Internal detail" });
await assert.rejects(
  client.request("Server failure"),
  { message: "AI deck generation failed. Please try again." }
);

nextResponse = {
  ok: true,
  status: 200,
  async json() {
    throw new SyntaxError("invalid json");
  }
};
await assert.rejects(
  client.request("Malformed success"),
  { message: "AI response could not be processed. Please try again." }
);

console.log("Frontend AI deck client tests passed.");
