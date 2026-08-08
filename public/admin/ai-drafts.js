const apiOrigin = location.hostname === "admin.bingodogwash.com" ? "https://bingodogwash.com" : "";
const aiDraftApi = `${apiOrigin}/api/admin/ai-drafts`;
const distributionApi = `${apiOrigin}/api/admin/ai-distribution`;
const productsApi = `${apiOrigin}/api/admin/etsy/products`;
const marketingApi = `${apiOrigin}/api/admin/marketing`;
const draftStorageKey = "bingoAiProductDraftsV1";
const historyStorageKey = "bingoAiDistributionHistoryV1";

const contentFields = [
  ["productDescription", "Product Description", 500, 6], ["shortDescription", "Short Product Description", 240, 3],
  ["socialCaption", "Social Media Caption", 700, 5], ["facebookCaption", "Facebook Caption", 900, 6],
  ["instagramCaption", "Instagram Caption", 1200, 7], ["tiktokCaption", "TikTok Caption", 220, 3],
  ["marketplaceTitle", "Marketplace Title", 140, 2], ["marketplaceDescription", "Marketplace Description", 1200, 7],
  ["seoTitle", "SEO Title", 60, 2], ["seoDescription", "SEO Meta Description", 160, 3],
  ["emailSubject", "Email Subject", 70, 2], ["emailPreview", "Email Preview / Promotional Email", 600, 5],
];
const channelDefinitions = [
  ["website", "Bingo Dog Wash Website", "draft"], ["facebook", "Facebook", "needs"], ["instagram", "Instagram", "needs"],
  ["tiktok", "TikTok", "needs"], ["tiktokShop", "TikTok Shop", "needs"], ["email", "Email", "draft"],
  ["googleMerchant", "Google Merchant", "needs"], ["ebay", "eBay", "draft"], ["amazon", "Amazon Affiliate", "draft"],
  ["etsy", "Etsy", "draft"], ["shopline", "Shopline", "needs"], ["shopwired", "ShopWired", "needs"],
  ["bigcommerce", "BigCommerce", "needs"], ["wish", "Wish", "needs"], ["woocommerce", "WooCommerce", "needs"],
  ["other", "Other product feeds", "unavailable"],
];
const state = { products: [], filteredProducts: [], channels: {}, facebookPageIds: [], busy: false, currentDraftId: "" };

const qs = (selector, root = document) => root.querySelector(selector);
const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];
const token = () => sessionStorage.getItem("bingoAdminCoreToken") || sessionStorage.getItem("bingoAdminGiftCardToken") || "";
const authHeaders = () => ({ Authorization: `Bearer ${token()}`, "Content-Type": "application/json", Accept: "application/json" });
const readStore = (key) => { try { const value = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(value) ? value : []; } catch { return []; } };
const writeStore = (key, value) => localStorage.setItem(key, JSON.stringify(value.slice(0, 50)));
const safeUrl = (value) => { try { const url = new URL(value, location.origin); return /^https?:$/.test(url.protocol) ? url.toString() : ""; } catch { return ""; } };
const decodeEntities = (value) => String(value || "").replace(/&(#(?:x[0-9a-f]+|\d+)|amp|quot|apos|lt|gt|nbsp);/gi, (entity, name) => { const key = name.toLowerCase(); const named = { amp:"&",quot:'"',apos:"'",lt:"<",gt:">",nbsp:" " }; if (Object.hasOwn(named,key)) return named[key]; const point = Number.parseInt(key.startsWith("#x") ? key.slice(2) : key.slice(1), key.startsWith("#x") ? 16 : 10); try { return Number.isInteger(point) && point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity; } catch { return entity; } });

function setMessage(message) { const target = qs("[data-ai-message]"); if (target) target.textContent = message; }
function setBusy(busy, message = "") { state.busy = busy; qs("[data-ai-workspace]")?.classList.toggle("is-loading", busy); qsa("button").forEach((button) => { if (button.matches("[data-confirm-distribution],.ai-generate,[data-distribute]")) button.disabled = busy; }); if (message) { const status = qs("[data-ai-result-status]"); if (status) status.textContent = message; } }

function renderContentCards() {
  const host = qs("[data-content-cards]");
  host.replaceChildren(...contentFields.map(([name, label, max, rows]) => {
    const card = document.createElement("article"); card.className = "content-card";
    const header = document.createElement("div"); header.className = "content-card-header";
    const title = document.createElement("h3"); title.textContent = label; header.append(title);
    const field = document.createElement("textarea"); field.dataset.aiOutput = name; field.rows = rows; field.maxLength = max; field.setAttribute("aria-label", label);
    const actions = document.createElement("div"); actions.className = "card-actions";
    const count = document.createElement("span"); count.className = "char-count"; count.textContent = `0 / ${max}`;
    const buttons = document.createElement("span");
    for (const [action, text] of [["copy","Copy"],["regenerate","Regenerate"]]) { const button = document.createElement("button"); button.type="button"; button.dataset[action]=name; button.textContent=text; buttons.append(button); }
    actions.append(count, buttons); field.addEventListener("input", () => { count.textContent = `${field.value.length} / ${max}`; syncPreviews(); });
    card.append(header, field, actions); return card;
  }));
}

function renderChannels() {
  const host = qs("[data-channel-grid]");
  host.replaceChildren(...channelDefinitions.map(([id, label, fallback]) => {
    const info = state.channels[id] || { status:fallback, label:fallback === "draft" ? "Draft only" : fallback === "unavailable" ? "Unavailable" : "Needs connection" };
    const item = document.createElement("label"); item.className="channel-card";
    const input = document.createElement("input"); input.type="checkbox"; input.value=id; input.dataset.channel=id; input.disabled=info.status === "unavailable" || info.status === "needs";
    input.addEventListener("change", () => { renderPreviews(); qs("[data-facebook-pages]").hidden = !(id === "facebook" && input.checked && state.facebookPageIds.length > 1); });
    const strong=document.createElement("strong"); strong.textContent=label; const status=document.createElement("span"); status.className=`channel-status ${info.status}`; status.textContent=info.label;
    item.append(input,strong,status); return item;
  }));
  renderFacebookPages();
}

function renderFacebookPages() {
  const host=qs("[data-facebook-page-options]"); host.replaceChildren(...state.facebookPageIds.map((id) => { const label=document.createElement("label"); const input=document.createElement("input"); input.type="checkbox"; input.value=id; input.dataset.facebookPage=id; input.checked=true; label.append(input,document.createTextNode(` Page ${id}`)); return label; }));
}

function selectedChannels() { return qsa("[data-channel]:checked").map((input) => input.value); }
function selectedFacebookPages() { return qsa("[data-facebook-page]:checked").map((input) => input.value); }
function output(name) { return qs(`[data-ai-output="${name}"]`)?.value || ""; }
function productData() { const form=qs("[data-ai-draft-form]"); return Object.fromEntries([...new FormData(form)].map(([name,value]) => [name,decodeEntities(value)])); }
function channelContent(channel) { if (channel === "facebook") return output("facebookCaption") || output("socialCaption"); if (channel === "instagram") return output("instagramCaption") || output("socialCaption"); if (channel === "tiktok" || channel === "tiktokShop") return output("tiktokCaption"); if (channel === "email") return `${output("emailSubject")}\n\n${output("emailPreview")}`.trim(); if (["ebay","etsy","googleMerchant","shopline","shopwired","bigcommerce","wish","woocommerce","amazon"].includes(channel)) return `${output("marketplaceTitle")}\n\n${output("marketplaceDescription")}`.trim(); return output("productDescription"); }

function renderPreviews() {
  const host=qs("[data-channel-previews]"); const channels=selectedChannels();
  host.replaceChildren(...channels.map((channel) => { const label=channelDefinitions.find(([id]) => id===channel)?.[1] || channel; const card=document.createElement("article"); card.className="channel-preview"; const title=document.createElement("h3"); title.textContent=`${label} Preview`; const field=document.createElement("textarea"); field.dataset.channelContent=channel; field.value=channelContent(channel); field.setAttribute("aria-label",`${label} distribution content`); card.append(title,field); return card; }));
}
function syncPreviews() { qsa("[data-channel-content]").forEach((field) => { if (document.activeElement !== field) field.value=channelContent(field.dataset.channelContent); }); }

async function loadProducts() {
  const status=qs("[data-product-status]");
  try { const response=await fetch(productsApi,{headers:authHeaders()}); const data=await response.json(); if (!response.ok || !data.ok) throw new Error(data.error || "Products unavailable."); state.products=(data.products || []).map(normalizeProduct); state.filteredProducts=state.products; renderProductOptions(); status.textContent=`${state.products.length} existing shop product${state.products.length===1?"":"s"} available. Loading one here does not duplicate it.`; }
  catch(error) { status.textContent=`Existing products could not be loaded: ${error.message}`; }
}
function normalizeProduct(item) { return { id:String(item.id || item.external_listing_id || ""), source:String(item.source || "etsy"), name:decodeEntities(item.display_title || item.title || item.name), category:decodeEntities(item.category), sku:String(item.sku || item.external_listing_id || ""), price:item.price ? `${item.currency || "GBP"} ${item.price}` : "", description:decodeEntities(item.display_description || item.description), audience:"Dog owners and dog lovers", url:safeUrl(item.listing_url || item.url || item.externalUrl), image:safeUrl(item.primary_image || item.image || item.imageUrl) }; }
function renderProductOptions() { const select=qs("[data-product-select]"); const current=select.value; select.replaceChildren(new Option("Manual product",""),...state.filteredProducts.map((product) => new Option(product.name || product.id,product.id))); if (state.filteredProducts.some((product)=>product.id===current)) select.value=current; }
function fillProduct(product) { const form=qs("[data-ai-draft-form]"); for (const [name,value] of Object.entries(product)) { const field=form.elements.namedItem(name); if (field && "value" in field) field.value=value || ""; } updateProductImage(product.image); qs("[data-product-status]").textContent=`Loaded ${product.name}. No duplicate product was created.`; }
function updateProductImage(value) { const image=qs("[data-product-image]"); image.src=safeUrl(value) || "/images/bingo-dog-wash-logo.optimized.png"; }

async function loadChannels() {
  try { const response=await fetch(marketingApi,{headers:authHeaders()}); const data=await response.json(); if (!response.ok || !data.ok) throw new Error(data.error || "Status unavailable."); const fb=data.platformStatus?.facebook; const ig=data.platformStatus?.instagram; state.channels.facebook={status:fb?.ok?"connected":"needs",label:fb?.ok?"Connected":"Needs connection"}; state.channels.instagram={status:ig?.ok?"connected":"needs",label:ig?.ok?"Connected":"Needs connection"}; state.facebookPageIds=fb?.accessiblePageIds || []; }
  catch { state.channels.facebook={status:"needs",label:"Needs connection"}; state.channels.instagram={status:"needs",label:"Needs connection"}; state.facebookPageIds=[]; }
  renderChannels();
}

async function generate(fields = []) {
  if (state.busy) return; const form=qs("[data-ai-draft-form]"); if (!form.reportValidity()) return; setBusy(true,"Bingo AI is preparing your product content…");
  try { const response=await fetch(aiDraftApi,{method:"POST",headers:authHeaders(),body:JSON.stringify({...productData(),requestedFields:fields})}); const data=await response.json().catch(()=>({})); if (!response.ok || !data.ok) throw new Error(data.error || "AI drafting is unavailable."); const wanted=fields.length?new Set(fields):null; for (const [name,value] of Object.entries(data.draft || {})) { if (wanted && !wanted.has(name)) continue; const field=qs(`[data-ai-output="${name}"]`); if (field) { field.value=decodeEntities(value); field.dispatchEvent(new Event("input")); } } qs("[data-ai-result-status]").textContent="Editable content generated. Nothing has been saved or published."; }
  catch(error) { qs("[data-ai-result-status]").textContent=error.message; } finally { setBusy(false); }
}

function draftSnapshot(status="Draft") { const now=new Date().toISOString(); return { id:state.currentDraftId || crypto.randomUUID(), product:productData(), content:Object.fromEntries(contentFields.map(([name])=>[name,output(name)])), channelContent:Object.fromEntries(qsa("[data-channel-content]").map((field)=>[field.dataset.channelContent,field.value])), channels:selectedChannels(), status, createdAt:now, updatedAt:now }; }
function saveDraft() { const drafts=readStore(draftStorageKey); const draft=draftSnapshot(selectedChannels().length?"Ready":"Draft"); const existing=drafts.find((item)=>item.id===draft.id); if (existing) draft.createdAt=existing.createdAt; writeStore(draftStorageKey,[draft,...drafts.filter((item)=>item.id!==draft.id)]); state.currentDraftId=draft.id; setMessage("Draft saved locally. Nothing was published."); renderHistories(); return draft; }
function loadDraft(draft) { state.currentDraftId=draft.id; fillProduct(draft.product); for (const [name,value] of Object.entries(draft.content || {})) { const field=qs(`[data-ai-output="${name}"]`); if (field) { field.value=value; field.dispatchEvent(new Event("input")); } } qsa("[data-channel]").forEach((input)=>{ input.checked=(draft.channels || []).includes(input.value) && !input.disabled; }); renderPreviews(); for (const [channel,value] of Object.entries(draft.channelContent || {})) { const field=qs(`[data-channel-content="${channel}"]`); if (field) field.value=value; } window.scrollTo({top:0,behavior:"smooth"}); }

function renderHistories() {
  const drafts=readStore(draftStorageKey); const draftHost=qs("[data-draft-history]"); draftHost.replaceChildren(...(drafts.length?drafts.map((draft)=>historyRow(draft,true)):[emptyRow("No saved drafts yet.")]));
  const history=readStore(historyStorageKey); const historyHost=qs("[data-distribution-history]"); historyHost.replaceChildren(...(history.length?history.map((item)=>historyRow(item,false)):[emptyRow("No distribution attempts yet.")]));
}
function emptyRow(text) { const row=document.createElement("p"); row.className="small-note"; row.textContent=text; return row; }
function historyRow(item,isDraft) { const row=document.createElement("article"); row.className="history-row"; const info=document.createElement("div"); const title=document.createElement("strong"); title.textContent=item.product?.name || "Untitled product"; const meta=document.createElement("small"); meta.textContent=`${new Date(item.updatedAt || item.createdAt).toLocaleString()} · ${item.status || "Draft"} · ${(item.channels || []).join(", ") || "No channels"}`; info.append(title,document.createElement("br"),meta); row.append(info); if (isDraft) { const actions=document.createElement("div"); actions.className="history-row-actions"; for (const [label,action] of [["Edit",()=>loadDraft(item)],["Duplicate",()=>{const copy={...item,id:crypto.randomUUID(),status:"Draft",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};writeStore(draftStorageKey,[copy,...readStore(draftStorageKey)]);renderHistories();}],["Delete",()=>{writeStore(draftStorageKey,readStore(draftStorageKey).filter((draft)=>draft.id!==item.id));renderHistories();}]]) { const button=document.createElement("button"); button.type="button"; button.textContent=label; button.addEventListener("click",action); actions.append(button); } row.append(actions); } return row; }

function showConfirmation() { if (state.busy) return; const channels=selectedChannels(); if (!channels.length) { setMessage("Choose at least one channel first."); return; } const product=productData(); if (!product.name) { setMessage("Choose or enter a product first."); return; } const summary=qs("[data-confirm-summary]"); summary.textContent=`${product.name} will be prepared for: ${channels.map((id)=>channelDefinitions.find(([key])=>key===id)?.[1]).join(", ")}. Only connected Facebook/Instagram selections can publish; other channels remain drafts.`; const preview=qs("[data-confirm-previews]"); preview.replaceChildren(...qsa("[data-channel-content]").map((field)=>{const card=document.createElement("article");card.className="channel-preview";const title=document.createElement("h3");title.textContent=channelDefinitions.find(([id])=>id===field.dataset.channelContent)?.[1] || field.dataset.channelContent;const text=document.createElement("p");text.textContent=field.value;card.append(title,text);return card;})); qs("[data-distribution-dialog]").showModal(); }

async function confirmDistribution() {
  if (state.busy) return; const channels=selectedChannels(); const publishable=channels.filter((channel)=>channel==="facebook"||channel==="instagram"); setBusy(true); qs("[data-distribution-status]").textContent="Distributing product…";
  let apiResults={}; let overall="Distributed";
  try { if (publishable.length) { const content=Object.fromEntries(qsa("[data-channel-content]").map((field)=>[field.dataset.channelContent,field.value])); const response=await fetch(distributionApi,{method:"POST",headers:authHeaders(),body:JSON.stringify({confirmed:true,product:productData(),channels:publishable,facebookPageIds:selectedFacebookPages(),content})}); const data=await response.json().catch(()=>({})); apiResults=data.results || {}; if (!response.ok && !Object.values(apiResults).some((result)=>result.ok)) throw new Error(data.error || "Distribution failed."); if (data.status==="partial") overall="Partially Distributed"; }
    const allResults={}; for (const channel of channels) { if (apiResults[channel]) allResults[channel]=apiResults[channel]; else { const fallback=channelDefinitions.find(([id])=>id===channel)?.[2]; const status=state.channels[channel]?.status || fallback; allResults[channel]=status==="draft"?{ok:true,draftOnly:true,message:"Draft prepared; no publishing connector is enabled."}:{ok:false,error:"Connection required before publishing."}; if (!allResults[channel].ok) overall=overall==="Distributed"?"Partially Distributed":overall; } }
    showResults(allResults); const record={...draftSnapshot(overall),results:allResults}; writeStore(historyStorageKey,[record,...readStore(historyStorageKey)]); saveDraft(); qs("[data-distribution-dialog]").close(); qs("[data-distribution-status]").textContent="";
  } catch(error) { qs("[data-distribution-status]").textContent=error.message; overall="Failed"; } finally { setBusy(false); renderHistories(); }
}
function showResults(results) { const panel=qs("[data-distribution-results]"); const host=qs("[data-result-list]"); host.replaceChildren(...Object.entries(results).map(([channel,result])=>{const row=document.createElement("div");row.className=`result-row ${result.ok?"success":"failed"}`;const name=document.createElement("strong");name.textContent=channelDefinitions.find(([id])=>id===channel)?.[1] || channel;const detail=document.createElement("span");detail.textContent=result.ok?(result.draftOnly?result.message:`Published${result.id?` · ID ${result.id}`:""}`):(result.error || "Failed");row.append(name,detail);return row;})); panel.hidden=false; panel.scrollIntoView({behavior:"smooth",block:"start"}); }

function clearWorkspace() { const form=qs("[data-ai-draft-form]"); form.reset(); state.currentDraftId=""; qsa("[data-ai-output]").forEach((field)=>{field.value="";field.dispatchEvent(new Event("input"));}); qsa("[data-channel]").forEach((field)=>{field.checked=false;}); renderPreviews(); updateProductImage(""); setMessage("Workspace cleared. Saved drafts were not deleted."); }

qs("[data-ai-token-form]")?.addEventListener("submit",async(event)=>{event.preventDefault();const entered=event.currentTarget.elements.token.value.trim();if(!entered)return;sessionStorage.setItem("bingoAdminCoreToken",entered);event.currentTarget.elements.token.value="";await unlock();});
qs("[data-ai-draft-form]")?.addEventListener("submit",(event)=>{event.preventDefault();generate();});
qs("[data-content-cards]")?.addEventListener("click",async(event)=>{const copy=event.target.closest("[data-copy]");const regenerate=event.target.closest("[data-regenerate]");if(copy){const value=output(copy.dataset.copy);if(value){await navigator.clipboard.writeText(value);const previous=copy.textContent;copy.textContent="Copied";setTimeout(()=>{copy.textContent=previous;},1200);}}if(regenerate)generate([regenerate.dataset.regenerate]);});
qsa("[data-save-draft]").forEach((button)=>button.addEventListener("click",saveDraft));
qs("[data-product-search]")?.addEventListener("input",(event)=>{const query=event.target.value.trim().toLowerCase();state.filteredProducts=state.products.filter((product)=>[product.name,product.category,product.source,product.sku].some((value)=>String(value||"").toLowerCase().includes(query)));renderProductOptions();});
qs("[data-product-select]")?.addEventListener("change",(event)=>{const product=state.products.find((item)=>item.id===event.target.value);if(product)fillProduct(product);});
qs("[data-product-url-search]")?.addEventListener("change",(event)=>{const value=safeUrl(event.target.value);const product=state.products.find((item)=>item.url===value);if(product){qs("[data-product-select]").value=product.id;fillProduct(product);}else{qs('[name="url"]').value=value;qs("[data-product-status]").textContent="URL added to a manual product. Remote pages are not scraped for security.";}});
qs("[data-image-url]")?.addEventListener("input",(event)=>updateProductImage(event.target.value));
qs("[data-image-upload]")?.addEventListener("change",(event)=>{const file=event.target.files?.[0];if(!file)return;const reader=new FileReader();reader.addEventListener("load",()=>{qs("[data-product-image]").src=reader.result;});reader.readAsDataURL(file);});
qs("[data-refresh-channels]")?.addEventListener("click",loadChannels); qs("[data-ai-clear]")?.addEventListener("click",clearWorkspace);
qs("[data-preview-distribution]")?.addEventListener("click",showConfirmation); qs("[data-distribute]")?.addEventListener("click",showConfirmation); qs("[data-confirm-distribution]")?.addEventListener("click",confirmDistribution);

async function unlock() { if(!token())return;qs("[data-ai-workspace]").hidden=false;setMessage("Product centre unlocked for this browser session.");renderContentCards();renderChannels();renderHistories();await Promise.all([loadProducts(),loadChannels()]); }
if(token()) unlock(); else { renderContentCards(); renderChannels(); renderHistories(); }
