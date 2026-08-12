import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { adminToken, authenticatedAdminRequest } from "../public/admin/admin-session.js";

function storage(values={}){const data=new Map(Object.entries(values));return {getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key),has:key=>data.has(key)};}

test("unlocked Product Centre authorizes Customer Finder refresh through the canonical session",async()=>{const session=storage({bingoAdminCoreToken:"admin-token"});let request;await authenticatedAdminRequest(async(url,options)=>{request={url,options};return new Response("{}")},session,"/api/admin/prospecting");assert.equal(adminToken(session),"admin-token");assert.equal(request.url,"/api/admin/prospecting");assert.equal(request.options.headers.Authorization,"Bearer admin-token");});

test("unlocked Product Centre manual run carries the same authorization",async()=>{const session=storage({bingoAdminGiftCardToken:"legacy-admin-token"});let request;await authenticatedAdminRequest(async(url,options)=>{request={url,options};return new Response("{}")},session,"/api/admin/prospecting/run",{method:"POST",body:"{}"});assert.equal(request.options.method,"POST");assert.equal(request.options.headers.Authorization,"Bearer legacy-admin-token");});

test("locked Product Centre never makes a prospecting status request",async()=>{const session=storage();let requests=0;let locked=false;await assert.rejects(()=>authenticatedAdminRequest(async()=>{requests+=1;return new Response("{}")},session,"/api/admin/prospecting",{},()=>{locked=true}),/locked/);assert.equal(requests,0);assert.equal(locked,true);});

test("expired or invalid token clears the canonical session and returns to safe locked state",async()=>{const session=storage({bingoAdminCoreToken:"expired",bingoAdminGiftCardToken:"fallback"});let locked=false;await assert.rejects(()=>authenticatedAdminRequest(async()=>new Response("{}",{status:401}),session,"/api/admin/prospecting",{},()=>{locked=true}),/expired/);assert.equal(adminToken(session),"");assert.equal(locked,true);});

test("Customer Finder refresh and manual run both use the canonical authenticated request",()=>{const source=readFileSync(new URL("../public/admin/ai-drafts.js",import.meta.url),"utf8");const refresh=source.slice(source.indexOf("async function loadProspecting"),source.indexOf("function renderProspecting"));const manual=source.slice(source.indexOf("async function runProspectingManually"),source.indexOf("function clearWorkspace"));assert.match(refresh,/adminRequest\(`\$\{prospectingApi\}\?\$\{params\}`\)/);assert.match(manual,/adminRequest\(`\$\{prospectingApi\}\/run`/);assert.doesNotMatch(refresh,/\bfetch\(/);assert.doesNotMatch(manual,/\bfetch\(/);});

test("Customer Finder surfaces sanitized Places reason, classification, and invalid field",()=>{const source=readFileSync(new URL("../public/admin/ai-drafts.js",import.meta.url),"utf8");const formatter=source.slice(source.indexOf("function prospectingFailureMessage"),source.indexOf("async function runProspectingManually"));assert.match(formatter,/providerErrors/);assert.match(formatter,/first\.reason/);assert.match(formatter,/first\.classification/);assert.match(formatter,/first\.invalidFields/);assert.doesNotMatch(formatter,/error_description|rawResponse|GOOGLE_PLACES_API_KEY/);});

test("unlock starts Customer Finder loading before nonessential renderers can fail",()=>{const source=readFileSync(new URL("../public/admin/ai-drafts.js",import.meta.url),"utf8");const unlock=source.slice(source.indexOf("async function unlock"),source.indexOf("const googleMerchantResult"));assert.ok(unlock.indexOf("loadProspecting()")<unlock.indexOf("renderContentCards"));assert.match(unlock,/Promise\.allSettled\(protectedLoads\)/);});
