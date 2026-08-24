import assert from "node:assert/strict";
import test from "node:test";
import worker from "../_functions_NOT_FOR_STATIC_UPLOAD/api/worker.js";

test("the five-minute Avasam refresh cron is isolated before marketing, Etsy, prospecting, or social work", async () => {
  const reads = []; const env = new Proxy({}, { get(target, key) { reads.push(String(key)); return undefined; } }); const jobs = [];
  await worker.scheduled({ cron: "*/5 * * * *" }, env, { waitUntil(job) { jobs.push(job); } }); await Promise.all(jobs);
  assert.equal(jobs.length, 1); for (const forbidden of ["ETSY_FEATURE_ENABLED", "AI_PROSPECTING_ENABLED", "META_PAGE_ACCESS_TOKEN", "INSTAGRAM_ACCESS_TOKEN", "TIKTOK_CLIENT_KEY"]) assert.equal(reads.includes(forbidden), false);
});
