import test from "node:test";
import assert from "node:assert/strict";

import {
  avasamTestHelpers
} from "../_functions_NOT_FOR_STATIC_UPLOAD/api/worker.js";

test("Avasam token is reused while valid", async () => {
  avasamTestHelpers.resetAvasamTokenState();

  const oldFetch = globalThis.fetch;
  let calls = 0;

  globalThis.fetch = async () => {
    calls += 1;
    return Response.json({
      access_token: "token-one",
      expires_in: 3600
    });
  };

  try {
    const first = await avasamTestHelpers.requestAvasamAccessToken("consumer", "secret");
    const second = await avasamTestHelpers.requestAvasamAccessToken("consumer", "secret");

    assert.equal(first, "token-one");
    assert.equal(second, "token-one");
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = oldFetch;
    avasamTestHelpers.resetAvasamTokenState();
  }
});

test("concurrent Avasam requests share one token refresh", async () => {
  avasamTestHelpers.resetAvasamTokenState();

  const oldFetch = globalThis.fetch;
  let calls = 0;

  globalThis.fetch = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 25));

    return Response.json({
      access_token: "shared-token",
      expires_in: 3600
    });
  };

  try {
    const results = await Promise.all([
      avasamTestHelpers.requestAvasamAccessToken("consumer", "secret"),
      avasamTestHelpers.requestAvasamAccessToken("consumer", "secret"),
      avasamTestHelpers.requestAvasamAccessToken("consumer", "secret"),
      avasamTestHelpers.requestAvasamAccessToken("consumer", "secret")
    ]);

    assert.deepEqual(results, [
      "shared-token",
      "shared-token",
      "shared-token",
      "shared-token"
    ]);

    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = oldFetch;
    avasamTestHelpers.resetAvasamTokenState();
  }
});

test("Avasam 429 creates cooldown and prevents immediate second auth call", async () => {
  avasamTestHelpers.resetAvasamTokenState();

  const oldFetch = globalThis.fetch;
  let calls = 0;

  globalThis.fetch = async () => {
    calls += 1;

    return Response.json(
      {},
      {
        status: 429,
        headers: {
          "Retry-After": "60"
        }
      }
    );
  };

  try {
    await assert.rejects(
      () => avasamTestHelpers.requestAvasamAccessToken("consumer", "secret"),
      /HTTP 429/
    );

    await assert.rejects(
      () => avasamTestHelpers.requestAvasamAccessToken("consumer", "secret"),
      /temporarily rate limited/
    );

    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = oldFetch;
    avasamTestHelpers.resetAvasamTokenState();
  }
});
