import test from "node:test";
import assert from "node:assert/strict";

import { avasamTestHelpers } from "../_functions_NOT_FOR_STATIC_UPLOAD/api/worker.js";

const product = {
  SKU: "S0671070991",
  Title: "£42 Avasam product",
  Price: 42,
  StockQuantity: 4
};

function reset() {
  avasamTestHelpers.resetAvasamCatalogueState();
}

test("primary Avasam format resolves canonical product fields and caches only its successful response", async () => {
  reset();
  const oldFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (_url, init) => {
    calls += 1;
    assert.equal(init.headers.Authorization, "trusted-token");
    return Response.json({ products: [product] });
  };
  try {
    const first = await avasamTestHelpers.requestAvasamProducts("trusted-token", 1, 100);
    const second = await avasamTestHelpers.requestAvasamProducts("trusted-token", 1, 100);
    assert.equal(calls, 1);
    assert.deepEqual(first, second);
    assert.deepEqual(first[0] && {
      id: first[0].id, sku: first[0].sku, price: first[0].price, status: first[0].status
    }, {
      id: "avasam-S0671070991", sku: "S0671070991", price: 42, status: "Available through Avasam"
    });
  } finally { globalThis.fetch = oldFetch; reset(); }
});

test("catalogue cache expires after its short TTL", async () => {
  reset();
  const oldFetch = globalThis.fetch;
  const oldNow = Date.now;
  let now = 1_000_000;
  let calls = 0;
  Date.now = () => now;
  globalThis.fetch = async () => { calls += 1; return Response.json([product]); };
  try {
    await avasamTestHelpers.requestAvasamProducts("token", 1, 100);
    await avasamTestHelpers.requestAvasamProducts("token", 1, 100);
    now += 30_001;
    await avasamTestHelpers.requestAvasamProducts("token", 1, 100);
    assert.equal(calls, 2);
  } finally { Date.now = oldNow; globalThis.fetch = oldFetch; reset(); }
});

for (const status of [429, 500]) {
  test(`HTTP ${status} does not try legacy authorization formats`, async () => {
    reset();
    const oldFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => { calls += 1; return Response.json({ message: "upstream failure" }, { status }); };
    try {
      await assert.rejects(() => avasamTestHelpers.requestAvasamProducts("token", 2, 100));
      assert.equal(calls, 1);
    } finally { globalThis.fetch = oldFetch; reset(); }
  });
}

test("401 alone permits the next legacy authorization format", async () => {
  reset();
  const oldFetch = globalThis.fetch;
  const headers = [];
  globalThis.fetch = async (_url, init) => {
    headers.push(init.headers.Authorization);
    return headers.length === 1
      ? Response.json({}, { status: 401 })
      : Response.json({ items: [product] });
  };
  try {
    const result = await avasamTestHelpers.requestAvasamProducts("token", 3, 100);
    assert.equal(headers.length, 2);
    assert.deepEqual(headers, ["token", "Bearer token"]);
    assert.equal(result[0].price, 42);
  } finally { globalThis.fetch = oldFetch; reset(); }
});

test("the overall product budget stops serial compatibility attempts", async () => {
  reset();
  const oldFetch = globalThis.fetch;
  const oldNow = Date.now;
  let now = 0;
  let calls = 0;
  Date.now = () => now;
  globalThis.fetch = async () => {
    calls += 1;
    now += calls === 1 ? 5000 : 3000;
    return Response.json({}, { status: 401 });
  };
  try {
    await assert.rejects(() => avasamTestHelpers.requestAvasamProducts("token", 6, 100), /timed out/);
    assert.equal(calls, 2);
  } finally { Date.now = oldNow; globalThis.fetch = oldFetch; reset(); }
});

test("a product timeout is bounded and does not try another authorization format", async () => {
  reset();
  const oldFetch = globalThis.fetch;
  const oldSetTimeout = globalThis.setTimeout;
  let calls = 0;
  globalThis.setTimeout = (callback) => { callback(); return 0; };
  globalThis.fetch = async (_url, init) => {
    calls += 1;
    assert.equal(init.signal.aborted, true);
    throw new Error("aborted");
  };
  try {
    await assert.rejects(() => avasamTestHelpers.requestAvasamProducts("token", 4, 100), /timed out/);
    assert.equal(calls, 1);
  } finally { globalThis.setTimeout = oldSetTimeout; globalThis.fetch = oldFetch; reset(); }
});

test("a token timeout is bounded before product resolution starts", async () => {
  avasamTestHelpers.resetAvasamTokenState();
  const oldFetch = globalThis.fetch;
  const oldSetTimeout = globalThis.setTimeout;
  let calls = 0;
  globalThis.setTimeout = (callback) => { callback(); return 0; };
  globalThis.fetch = async (_url, init) => {
    calls += 1;
    assert.equal(init.signal.aborted, true);
    throw new Error("aborted");
  };
  try {
    await assert.rejects(
      () => avasamTestHelpers.requestAvasamAccessToken("consumer", "secret"),
      /could not reach Avasam/
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.setTimeout = oldSetTimeout;
    globalThis.fetch = oldFetch;
    avasamTestHelpers.resetAvasamTokenState();
  }
});

test("catalogue logs contain bounded stage metadata but no token", async () => {
  reset();
  const oldFetch = globalThis.fetch;
  const oldLog = console.log;
  const logs = [];
  console.log = (entry) => logs.push(String(entry));
  globalThis.fetch = async () => Response.json({}, { status: 503 });
  try {
    await assert.rejects(() => avasamTestHelpers.requestAvasamProducts("secret-token", 5, 100));
    assert.match(logs[0], /"event":"avasam_stage"/);
    assert.match(logs[0], /"httpStatus":503/);
    assert.doesNotMatch(logs.join("\n"), /secret-token/);
  } finally { console.log = oldLog; globalThis.fetch = oldFetch; reset(); }
});
