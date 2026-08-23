import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { handleDistributionChannelRequest, distributionChannelTestHelpers } from "../_functions_NOT_FOR_STATIC_UPLOAD/api/distribution-channels.js";

const request = (path="", options={}) => new Request(`https://bingodogwash.com/api/admin/distribution-channels${path}`, { headers: { Authorization:"Bearer admin-token", "Content-Type":"application/json", ...(options.headers||{}) }, ...options });
const env = (extra={}) => ({ ADMIN_API_TOKEN:"admin-token", ...extra });
const emailDb = (emails=["subscriber@example.com"], fail=false) => ({ prepare(sql) { return { async first(){if(fail)throw new Error("missing table");return {total:emails.length};}, async all(){if(sql.includes("distribution_channel_connections"))return {results:[]};if(fail)throw new Error("missing table");return {results:emails.map((email)=>({email}))};} }; } });
const readyEmailEnv = (extra={}) => env({ EMAIL:{async send(){}}, GIFT_CARD_DB:emailDb(), AI_EMAIL_SENDER_NAME:"Bingo Dog Wash", AI_EMAIL_SENDER_EMAIL:"campaigns@bingodogwash.com", AI_EMAIL_RECIPIENT_SOURCE:"newsletter_subscribers", AI_EMAIL_SENDING_ENABLED:"true", ...extra });

test("distribution channel status is admin protected", async () => {
  const response = await handleDistributionChannelRequest(new Request("https://bingodogwash.com/api/admin/distribution-channels"), env());
  assert.equal(response.status, 401);
});

test("missing production configuration reports real disconnected states", () => {
  const channels = distributionChannelTestHelpers.capabilities({});
  assert.equal(channels.email.label, "Draft only");
  assert.equal(channels.googleMerchant.label, "Configuration error");
  assert.equal(channels.ebay.label, "Draft only");
  assert.equal(channels.email.ready || channels.googleMerchant.ready || channels.ebay.ready, false);
});

test("Email reports missing sender configuration without exposing recipients", async () => {
  const state = await distributionChannelTestHelpers.emailCapability(env({EMAIL:{},GIFT_CARD_DB:emailDb(),AI_EMAIL_RECIPIENT_SOURCE:"newsletter_subscribers"}));
  assert.equal(state.status,"needs_configuration");assert.ok(state.missing.includes("AI_EMAIL_SENDER_NAME"));assert.equal("recipients" in state,false);
});

test("Email reports missing or unsupported recipient source", async () => {
  const missing = await distributionChannelTestHelpers.emailCapability(env({EMAIL:{},GIFT_CARD_DB:emailDb(),AI_EMAIL_SENDER_NAME:"Bingo",AI_EMAIL_SENDER_EMAIL:"campaigns@bingodogwash.com"}));
  assert.equal(missing.status,"needs_configuration");assert.ok(missing.missing.includes("AI_EMAIL_RECIPIENT_SOURCE"));
  const invalid = await distributionChannelTestHelpers.emailCapability(readyEmailEnv({AI_EMAIL_RECIPIENT_SOURCE:"generated_list"}));
  assert.equal(invalid.status,"configuration_error");
});

test("Email remains sending disabled while feature flag is false", async () => {
  const state = await distributionChannelTestHelpers.emailCapability(readyEmailEnv({AI_EMAIL_SENDING_ENABLED:"false"}));
  assert.equal(state.label,"Sending disabled");assert.equal(state.ready,false);assert.equal(state.recipientCount,1);
});

test("Email reports ready only with valid sender, opt-in source, binding and enabled flag", async () => {
  const state = await distributionChannelTestHelpers.emailCapability(readyEmailEnv());
  assert.equal(state.label,"Ready");assert.equal(state.ready,true);assert.equal(state.recipientSource,"newsletter_subscribers");assert.equal(state.recipientCount,1);
});

test("Email send is disabled and provider is never called when not ready", async () => {
  let sends=0;
  const response = await handleDistributionChannelRequest(request("/email/distribute", { method:"POST", body:JSON.stringify({confirmed:true,subject:"Product",text:"Copy"}) }), env({ EMAIL:{ send(){sends+=1;} } }));
  assert.equal(response.status, 409);assert.equal(sends,0);
});

test("Email send requires admin authorization", async () => {
  let sends=0;const configured=readyEmailEnv({EMAIL:{async send(){sends+=1;}}});
  const response=await handleDistributionChannelRequest(new Request("https://bingodogwash.com/api/admin/distribution-channels/email/distribute",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({confirmed:true,subject:"Product",text:"Copy"})}),configured);
  assert.equal(response.status,401);assert.equal(sends,0);
});

test("Email recipients come only from opted-in D1 source", async () => {
  const sent=[];const configured=readyEmailEnv({EMAIL:{async send(message){sent.push(message);}}});
  const arbitrary=await handleDistributionChannelRequest(request("/email/distribute",{method:"POST",body:JSON.stringify({confirmed:true,subject:"Product",text:"Copy",recipients:["unsafe@example.com"]})}),configured);
  assert.equal(arbitrary.status,400);assert.equal(sent.length,0);
  const response=await handleDistributionChannelRequest(request("/email/distribute",{method:"POST",body:JSON.stringify({confirmed:true,subject:"Product",text:"Copy"})}),configured);
  assert.equal(response.status,200);assert.equal(sent[0].to,"subscriber@example.com");assert.equal(sent[0].from.email,"campaigns@bingodogwash.com");
});

test("Email provider failure is isolated as an Email result", async () => {
  const configured=readyEmailEnv({EMAIL:{async send(){throw new Error("provider failed");}}});
  const response=await handleDistributionChannelRequest(request("/email/distribute",{method:"POST",body:JSON.stringify({confirmed:true,subject:"Product",text:"Copy"})}),configured);
  assert.equal(response.status,502);assert.match((await response.json()).error,/provider rejected/);
});

test("Google Merchant sync is disabled when not ready", async () => {
  const response = await handleDistributionChannelRequest(request("/googleMerchant/distribute", { method:"POST", body:"{}" }), env());
  assert.equal(response.status,409);
});

test("eBay listing is disabled when seller OAuth and listing permission are absent", async () => {
  const response = await handleDistributionChannelRequest(request("/ebay/distribute", { method:"POST", body:"{}" }), env({ EBAY_BROWSE_CLIENT_ID:"browse", EBAY_BROWSE_CLIENT_SECRET:"browse-secret" }));
  assert.equal(response.status,409);assert.match((await response.json()).error,/Draft only/);
});

test("stored seller tokens can report connected without falsely reporting ready", () => {
  const channels = distributionChannelTestHelpers.capabilities(env({ GOOGLE_MERCHANT_CLIENT_ID:"id", GOOGLE_MERCHANT_CLIENT_SECRET:"secret", GOOGLE_MERCHANT_REDIRECT_URI:"https://bingodogwash.com/callback", GOOGLE_MERCHANT_ACCOUNT_ID:"1", GOOGLE_MERCHANT_DATA_SOURCE:"2", EBAY_SELL_CLIENT_ID:"id", EBAY_SELL_CLIENT_SECRET:"secret", EBAY_SELL_RUNAME:"runame", EBAY_SELL_MARKETPLACE_ID:"EBAY_GB", EBAY_SELL_LOCATION_KEY:"main" }), { googleMerchant:{refresh_token:"google-refresh"}, ebay:{refresh_token:"ebay-refresh"} });
  assert.equal(channels.googleMerchant.connected,true);assert.equal(channels.googleMerchant.label,"Connected");assert.equal(channels.googleMerchant.ready,false);
  assert.equal(channels.ebay.connected,true);assert.equal(channels.ebay.ready,false);
});

test("channel failures are represented independently", () => {
  const channels = distributionChannelTestHelpers.capabilities(env({ EMAIL:{} }));
  assert.deepEqual(Object.keys(channels),["email","googleMerchant","ebay"]);
  assert.equal(channels.email.ready,false);
});

test("Product Centre status reads retain the canonical authenticated admin wrapper", () => {
  const source=readFileSync(new URL("../public/admin/ai-drafts.js",import.meta.url),"utf8");
  const body=source.slice(source.indexOf("async function loadChannels()"),source.indexOf("async function connectTikTok"));
  assert.match(body,/adminRequest\(marketingApi/);assert.match(body,/adminRequest\(`\$\{tiktokApi\}\/status`/);assert.match(body,/adminRequest\(distributionChannelsApi/);assert.doesNotMatch(body,/\bfetch\(/);
});

function isolatedStatusDb(failingChannel = "") {
  return { prepare(sql) { let channel=""; return {
    bind(value){channel=String(value||"");return this;},
    async first(){
      if(sql.includes("newsletter_subscribers")) return {total:1};
      if(channel===failingChannel) throw new Error(`${channel} unavailable`);
      if(channel==="googleMerchant") return {channel,refresh_token:"stored-google-reference"};
      return null;
    },
  }; } };
}

const isolatedStatusEnv = (failingChannel="") => readyEmailEnv({
  GIFT_CARD_DB: isolatedStatusDb(failingChannel),
  GOOGLE_MERCHANT_CLIENT_ID:"id", GOOGLE_MERCHANT_CLIENT_SECRET:"secret", GOOGLE_MERCHANT_REDIRECT_URI:"https://bingodogwash.com/callback",
  GOOGLE_MERCHANT_ACCOUNT_ID:"1", GOOGLE_MERCHANT_DATA_SOURCE:"2",
  EBAY_BROWSE_CLIENT_ID:"browse", EBAY_BROWSE_CLIENT_SECRET:"browse-secret",
});

test("Google status failure does not blank Email or eBay", async () => {
  const response=await handleDistributionChannelRequest(request(),isolatedStatusEnv("googleMerchant"));const channels=(await response.json()).channels;
  assert.equal(channels.email.label,"Ready");assert.equal(channels.googleMerchant.label,"Status unavailable");assert.equal(channels.ebay.label,"Draft only");
});

test("eBay status failure does not blank Email or Google", async () => {
  const response=await handleDistributionChannelRequest(request(),isolatedStatusEnv("ebay"));const channels=(await response.json()).channels;
  assert.equal(channels.email.label,"Ready");assert.equal(channels.googleMerchant.label,"Connected");assert.equal(channels.ebay.label,"Status unavailable");
});

test("Email configuration failure does not blank Google or eBay", async () => {
  const response=await handleDistributionChannelRequest(request(),{...isolatedStatusEnv(),AI_EMAIL_SENDER_NAME:""});const channels=(await response.json()).channels;
  assert.equal(channels.email.label,"Needs configuration");assert.equal(channels.googleMerchant.label,"Connected");assert.equal(channels.ebay.label,"Draft only");
});

test("shop products map to safe Google Merchant and eBay inventory payloads", () => {
  const product={id:"dog-bow",sku:"BOW-1",name:"Dog Bow",description:"A smart bow.",price:12.99,currency:"GBP",stock:4,url:"https://bingodogwash.com/products/dog-bow",image:"https://bingodogwash.com/bow.jpg"};
  const google=distributionChannelTestHelpers.mapGoogleProduct(product);const ebay=distributionChannelTestHelpers.mapEbayInventoryItem(product);
  assert.equal(google.offerId,"BOW-1");assert.equal(google.productAttributes.price.amountMicros,"12990000");assert.equal(google.productAttributes.link,product.url);
  assert.equal(ebay.sku,"BOW-1");assert.equal(ebay.availability.shipToLocationAvailability.quantity,4);assert.deepEqual(ebay.product.imageUrls,[product.image]);
});
