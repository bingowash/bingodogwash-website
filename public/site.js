const categories = [
  "Dog Shampoo", "Conditioner", "Paw Care", "Ear Cleaner", "Dental Care",
  "Grooming Brushes", "Combs", "Drying Towels", "Cologne Spray", "Dog Wipes",
  "Flea & Tick Products", "Supplements", "Vitamins", "Joint Care", "Treats",
  "Toys", "Leads", "Collars", "Harnesses", "Bedding", "Accessories", "Grocery", "Kitchenware", "Hair Care", "Dog Wash Service", "Dog Wash Equipment"
];

const stripeDogWashPaymentLink = "https://pay.bingodogwash.com/b/fZubJ39gH7qUdzxgGzgrS00";

document.querySelectorAll(".nav-links").forEach((nav) => {
  if (!nav.querySelector('a[href*="top-dog-competition"]') && !location.hostname.startsWith("admin.")) {
    const link = document.createElement("a");
    link.href = "/top-dog-competition.html";
    link.textContent = "🏆 Top Dog Competition";
    const account = [...nav.querySelectorAll("a")].find((item) => /account/i.test(item.textContent));
    nav.insertBefore(link, account || null);
  }
});
const stripeProductOrderPaymentLink = "https://buy.stripe.com/fZubJ3fF54eI2UT61VgrS03";
const productCheckoutWorkerUrl = "https://bingo-checkout.bingowash.workers.dev/";
const bingoBookingsKey = "bingoWashBookings";
const bookingApiBase = location.protocol === "file:" ? "" : "";
const adminBookingsApiBase = window.location.hostname === "admin.bingodogwash.com"
  ? "https://bingodogwash.com/api/admin/bookings"
  : "/api/admin/bookings";
const gbpFormatter = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
const shopApiBase = window.location.hostname === "admin.bingodogwash.com"
  ? "https://bingodogwash.com"
  : "";
const adminGiftCardApiBase = window.location.hostname === "admin.bingodogwash.com"
  ? "https://bingodogwash.com/api/admin/gift-cards"
  : "/api/admin/gift-cards";
const adminEtsyApiBase = window.location.hostname === "admin.bingodogwash.com"
  ? "https://bingodogwash.com/api/admin/etsy"
  : "/api/admin/etsy";
const adminPagesApiBase = window.location.hostname === "admin.bingodogwash.com"
  ? "https://bingodogwash.com/api/admin/pages"
  : "/api/admin/pages";
const adminNewsletterApiBase = window.location.hostname === "admin.bingodogwash.com"
  ? "https://bingodogwash.com/api/admin/newsletter"
  : "/api/admin/newsletter";
const etsyConnectApiUrl = window.location.hostname === "admin.bingodogwash.com"
  ? "https://bingodogwash.com/api/etsy/connect"
  : "/api/etsy/connect";
const giftCardDesigns = Object.freeze({
  "10": "/images/gift-cards/gift-card-10.png",
  "20": "/images/gift-cards/gift-card-20.png",
  "30": "/images/gift-cards/gift-card-30.png",
  "50": "/images/gift-cards/gift-card-50.png",
  custom: "/images/gift-cards/gift-card-custom.png"
});

const products = [
  { id: "self-service-dog-wash", name: "Self-Service Dog Wash", category: "Dog Wash Service", price: 10, priceLabel: "£10.00", icon: "£10", image: "hero.jpg", supplier: "Bingo Dog Wash", paymentProvider: "Stripe", commission: "Owned payment", status: "Stripe checkout", externalUrl: stripeDogWashPaymentLink, description: "Self-service dog wash session at Bingo Dog Wash." },
  { id: "amazon-affiliate-pick", name: "DDTEAN Sentimental Keychain Gift for Dad", category: "Apparel", price: null, priceLabel: "Price on Amazon", icon: "AM", image: "keychain.jpg", supplier: "Amazon UK", commission: "6.00%", status: "External checkout", externalUrl: "https://amzn.to/4vlBkEK", storeId: "bingodogwash3-21", trackingId: "bingodogwash3-21", description: "Father's Day, birthday, Christmas and Thanksgiving gift keychain for dad from daughter, son or kids." },
  { id: "amazon-eu-affiliate-pick-2", name: "Pedigree Tasty Minis Cheesy Nibbles", category: "Pet Products", price: null, priceLabel: "Price on Amazon", icon: "TM", image: "pedigree.jpg", supplier: "Amazon EU", commission: "Affiliate", status: "External checkout", externalUrl: "https://amzn.eu/d/04qv9fJO", storeId: "bingodogwash3-21", trackingId: "bingodogwash3-21", description: "Cheese-flavoured bite-sized dog treats, ideal as a reward or training treat." },
  { id: "amazon-affiliate-pick-2", name: "Pet Munchies Venison & Beef Liver Dog Training Treats 50g", category: "Pet Products", price: null, priceLabel: "Price on Amazon", icon: "TR", image: "treats.jpg", supplier: "Amazon UK", commission: "3.00%", status: "External checkout", externalUrl: "https://amzn.to/4etoD3f", storeId: "bingodogwash3-21", trackingId: "bingodogwash3-21", description: "Grain free tasty training bites with natural real meat, low in fat." },
  { id: "amazon-stove-wizard-fireback", name: "Stove Wizard Back to Black Fireback Paint 250ml", category: "Stove Care", price: null, priceLabel: "Price on Amazon", icon: "SW", image: "assets/stove-wizard-fireback.png", supplier: "Amazon UK", commission: "Affiliate", status: "External checkout", externalUrl: "https://www.amazon.co.uk/Stove-Wizard-Fireback-250ml-Temperature/dp/B0FMKCWCQC?linkCode=ll2&tag=bingodogwash3-21&linkId=fd98eb16bbe37b1db18929f46577777e&ref_=as_li_ss_tl", storeId: "bingodogwash3-21", trackingId: "bingodogwash3-21", description: "High-temperature black fireback paint for gas fires and multi-fuel stoves in a 250ml tin." },
  { id: "amazon-b09y4qq33s", name: "Tropical Sun Caribbean Curry Paste", category: "Grocery", price: null, priceLabel: "Price on Amazon", icon: "CP", image: "assets/amazon-product-5.jpg?v=20260721-amazon-five", supplier: "Amazon UK", commission: "Affiliate", status: "External checkout", externalUrl: "https://www.amazon.co.uk/gp/product/B09Y4QQ33S?smid=A20NLW877SSV5U&psc=1&linkCode=ll2&tag=bingodogwash3-21&linkId=d43739d10eb3366700d68f8e31ba96d5&ref_=as_li_ss_tl", storeId: "bingodogwash3-21", trackingId: "bingodogwash3-21", description: "Caribbean curry paste from Tropical Sun for adding rich Jamaican-inspired flavour to home cooking." },
  { id: "amazon-b006mybsao", name: "Dunn's River All Purpose Seasoning 700g", category: "Grocery", price: null, priceLabel: "Price on Amazon", icon: "AP", image: "assets/amazon-product-4.jpg?v=20260721-amazon-five", supplier: "Amazon UK", commission: "Affiliate", status: "External checkout", externalUrl: "https://www.amazon.co.uk/gp/product/B006MYBSAO?smid=AWJV3WH2WNVEW&psc=1&linkCode=ll2&tag=bingodogwash3-21&linkId=ffa28646645d8c1a1a9dab69681d9326&ref_=as_li_ss_tl", storeId: "bingodogwash3-21", trackingId: "bingodogwash3-21", description: "A versatile 700g Caribbean-style seasoning blend for meat, poultry, fish and vegetables." },
  { id: "amazon-b005eg4bza", name: "Just For Men Original Formula H-60 Jet Black", category: "Hair Care", price: null, priceLabel: "Price on Amazon", icon: "HC", image: "assets/amazon-product-1.jpg?v=20260721-amazon-five", supplier: "Amazon UK", commission: "Affiliate", status: "External checkout", externalUrl: "https://www.amazon.co.uk/gp/product/B005EG4BZA?smid=A3P5ROKL5A1OLE&th=1&linkCode=ll2&tag=bingodogwash3-21&linkId=c9dd663768ecdabc7b2bed668b82b0b4&ref_=as_li_ss_tl", storeId: "bingodogwash3-21", trackingId: "bingodogwash3-21", description: "Five-minute shampoo-in men's hair colour in H-60 Jet Black for a natural-looking result." },
  { id: "amazon-b09xtqyy66", name: "30cm Plastic Salad Serving Bowls", category: "Kitchenware", price: null, priceLabel: "Price on Amazon", icon: "SB", image: "assets/amazon-product-2.jpg?v=20260721-amazon-five", supplier: "Amazon UK", commission: "Affiliate", status: "External checkout", externalUrl: "https://www.amazon.co.uk/gp/product/B09XTQYY66?smid=A2SXRVC3WNZJYC&th=1&linkCode=ll2&tag=bingodogwash3-21&linkId=c4c0ee39ce91482c9763e997f938296c&ref_=as_li_ss_tl", storeId: "bingodogwash3-21", trackingId: "bingodogwash3-21", description: "Large 30cm plastic serving bowls suitable for salads, parties, buffets and everyday kitchen use." },
  { id: "amazon-b006mybsja", name: "Dunn's River Chicken Seasoning 600g", category: "Grocery", price: null, priceLabel: "Price on Amazon", icon: "CS", image: "assets/amazon-product-3.jpg?v=20260721-amazon-five", supplier: "Amazon UK", commission: "Affiliate", status: "External checkout", externalUrl: "https://www.amazon.co.uk/gp/product/B006MYBSJA?smid=A15YGXWULYZH8U&psc=1&linkCode=ll2&tag=bingodogwash3-21&linkId=b05d27f2ad9cd1adfcab12401c97bb24&ref_=as_li_ss_tl", storeId: "bingodogwash3-21", trackingId: "bingodogwash3-21", description: "A 600g Caribbean-style seasoning blend made for chicken dishes, marinades and home cooking." },
  { id: "oat-shampoo", name: "BUGALUGS Baby Fresh Dog Shampoo 625ml", category: "Dog Shampoo", price: 12.99, icon: "SH", image: "shampoo.jpg", supplier: "Amazon EU", commission: "Affiliate", status: "External checkout", externalUrl: "https://amzn.eu/d/03DQN0Te", storeId: "bingodogwash3-21", trackingId: "bingodogwash3-21", description: "Grooming shampoo for smelly dogs with a baby powder scent. Vegan professional pet shampoo and suitable as a puppy shampoo." },
  { id: "commercial-pet-bathing-machine", name: "Commercial Pet Bathing Machine", category: "Dog Wash Equipment", price: null, priceLabel: "Enquire for price", icon: "PM", image: "machine.jpg", supplier: "Third-party supplier", commission: "Supplier quote", status: "External enquiry", externalUrl: "https://amzn.eu/d/08x4MjpY", storeId: "bingodogwash3-21", trackingId: "bingodogwash3-21", description: "Professional stainless steel pet bathing machine for sterilising pet washing. Custom colour options, suitable for dogs, cats and other animals. Minimum order quantity: 1 piece." },
  { id: "coat-conditioner", name: "Silky Coat Conditioner", category: "Conditioner", price: 13.5, icon: "CO", supplier: "Dropship partner", commission: "9%", status: "Dropshipping ready", description: "Adds softness and shine after every self-service wash." },
  { id: "paw-balm", name: "Weatherproof Paw Balm", category: "Paw Care", price: 9.95, icon: "PW", supplier: "Future Bingo branded", commission: "Owned margin", status: "Coming soon", description: "Protective balm for pavement, cold weather and active paws." },
  { id: "ear-cleaner", name: "Fresh Ear Cleaner", category: "Ear Cleaner", price: 8.99, icon: "EA", supplier: "Affiliate supplier", commission: "10%", status: "External checkout", description: "A gentle cleaner for routine ear care between grooming sessions." },
  { id: "dental-kit", name: "Dog Dental Care Kit", category: "Dental Care", price: 16.99, icon: "DN", supplier: "Dropship partner", commission: "8%", status: "Supplier fulfilment", description: "Toothbrush, paste and simple dental care guidance." },
  { id: "slicker-brush", name: "Premium Grooming Brush", category: "Grooming Brushes", price: 14.99, icon: "BR", supplier: "Future Bingo branded", commission: "Owned margin", status: "Stock planned", description: "A comfortable brush for removing loose hair after drying." },
  { id: "micro-towel", name: "Fast-Dry Microfibre Towel", category: "Drying Towels", price: 18.0, icon: "TW", supplier: "Dropship partner", commission: "11%", status: "Dropshipping ready", description: "Absorbent towel for quick drying after a wash station visit." },
  { id: "cologne-spray", name: "Clean Coat Cologne Spray", category: "Cologne Spray", price: 10.99, icon: "CL", supplier: "Affiliate supplier", commission: "14%", status: "Affiliate checkout", description: "A light fresh finish for dogs who like to leave smelling brilliant." },
  { id: "joint-care", name: "Senior Joint Support", category: "Joint Care", price: 24.99, icon: "JT", supplier: "Dropship partner", commission: "7%", status: "Dropship ready", description: "Monthly joint support supplement for older dogs." }
];

// Avasam's catalogue endpoint slows down significantly for large pages.
// Keep the initial storefront request small enough to load reliably.
const avasamFeedUrl = `${shopApiBase}/api/avasam/products?limit=30`;
const avasamFallbackFeedUrl = "api/avasam-products.json";
const avasamRefreshMs = 15 * 60 * 1000;
let avasamProducts = [];
const avasamState = {
  loading: true,
  error: false,
  live: false,
  liveConfigured: false,
  lastRefresh: "",
  count: 0,
  message: ""
};

const ebayProductsUrl = `${shopApiBase}/api/ebay/products`;
const ebayAffiliateSearchBase = "https://www.ebay.co.uk/sch/i.html";
const ebayRefreshMs = 15 * 60 * 1000;
let ebayProducts = [];
let ebaySearchTimer = null;
const ebayState = {
  loading: true,
  error: false
};

const ebayAffiliateParams = {
  mkcid: "1",
  mkrid: "710-53481-19255-0",
  siteid: "3",
  campid: "5339164469",
  customid: "",
  toolid: "10001",
  mkevt: "1"
};

const ebayLiveGroups = [
  { name: "Grooming & Bathing", query: "dog grooming" },
  { name: "Collars, Harnesses & Leads", query: "dog collar harness lead" },
  { name: "Treats & Food", query: "dog treats food" },
  { name: "Toys", query: "dog toys" },
  { name: "Clothing & Accessories", query: "dog coat clothing accessories" }
];
const ebayProductsPerGroup = 10;

const ebayStarterProducts = [
  { id: "dog-shampoo", name: "Dog shampoo on eBay UK", query: "dog shampoo", category: "Dog Shampoo", image: "shampoo.jpg" },
  { id: "dog-treats", name: "Dog treats on eBay UK", query: "dog treats", category: "Treats", image: "treats.jpg" },
  { id: "dog-toys", name: "Dog toys on eBay UK", query: "dog toys", category: "Toys", image: "retail.jpg" },
  { id: "dog-collar", name: "Dog collars on eBay UK", query: "dog collar", category: "Collars", image: "retail.jpg" },
  { id: "dog-harness", name: "Dog harnesses on eBay UK", query: "dog harness", category: "Harnesses", image: "retail.jpg" },
  { id: "dog-grooming-brush", name: "Dog grooming brushes on eBay UK", query: "dog grooming brush", category: "Grooming Brushes", image: "retail.jpg" }
];


const etsyFeedUrl = `${shopApiBase}/api/etsy/products`;
const etsyRefreshMs = 15 * 60 * 1000;
let etsyProducts = [];
const etsyState = {
  loading: true,
  error: false
};

const avasamStarterProducts = [
  {
    id: "collar-adjustable-blue",
    name: "Adjustable Blue Dog Collar",
    category: "Collars",
    price: 7.99,
    stock: 36,
    supplier: "Avasam",
    description: "Comfortable adjustable collar for everyday walks and dog care."
  },
  {
    id: "lead-nylon-walking",
    name: "Nylon Dog Walking Lead",
    category: "Leads",
    price: 9.49,
    stock: 28,
    supplier: "Avasam",
    description: "Lightweight walking lead for daily walks, training and travel."
  },
  {
    id: "harness-padded-comfort",
    name: "Padded Comfort Dog Harness",
    category: "Harnesses",
    price: 16.99,
    stock: 19,
    supplier: "Avasam",
    description: "Padded dog harness for secure, comfortable walking."
  },
  {
    id: "bed-washable-soft",
    name: "Washable Soft Dog Bed",
    category: "Bedding",
    price: 29.99,
    stock: 12,
    supplier: "Avasam",
    description: "Soft washable dog bed for home comfort after a fresh wash."
  },
  {
    id: "toy-rope-tug",
    name: "Rope Tug Dog Toy",
    category: "Toys",
    price: 5.99,
    stock: 44,
    supplier: "Avasam",
    description: "Durable rope toy for tug, play and enrichment."
  },
  {
    id: "wipes-fresh-coat",
    name: "Fresh Coat Dog Wipes",
    category: "Dog Wipes",
    price: 4.99,
    stock: 52,
    supplier: "Avasam",
    description: "Handy dog wipes for paws, coats and quick clean-ups between washes."
  }
];

function serverRenderedAvasamProducts() {
  const target = document.querySelector("[data-ssr-avasam-products]");
  if (!target) return [];
  try {
    const serialized = (target.textContent || "[]").replace(/<!--[\s\S]*?-->/g, "").trim() || "[]";
    const records = JSON.parse(serialized);
    return Array.isArray(records) ? records.map(normalizeAvasamProduct).filter((product) => product.name).filter(bingoAvasamCatalogueProduct) : [];
  } catch { return []; }
}

const hydratedAvasamProducts = serverRenderedAvasamProducts();
const hasServerRenderedShopProducts = Boolean(document.querySelector("[data-products] [data-ssr-product]"));
const hasServerRenderedProductDetail = Boolean(document.querySelector("[data-product-detail] [data-ssr-product]"));
avasamProducts = groupAvasamProductVariants(
  hydratedAvasamProducts.length
    ? hydratedAvasamProducts
    : avasamStarterProducts.map(normalizeAvasamProduct).filter((product) => product.name).filter(bingoAvasamCatalogueProduct)
);
avasamState.loading = false;
avasamState.live = Boolean(hydratedAvasamProducts.length);
avasamState.liveConfigured = Boolean(hydratedAvasamProducts.length);
avasamState.count = avasamProducts.length;
avasamState.message = hydratedAvasamProducts.length ? "" : "Showing available products while the live Avasam catalogue refreshes.";

function activateHydratedAvasamControls() {
  document.querySelectorAll("button[data-awaiting-hydration]").forEach((button) => {
    const id = button.dataset.add || button.dataset.buyNow || button.dataset.avasamBuy;
    const product = avasamProducts.find((item) => item.id === id);
    if (!product || /out of stock|unavailable/i.test(String(product.status || ""))) return;
    button.disabled = false;
    button.removeAttribute("aria-disabled");
    button.removeAttribute("data-awaiting-hydration");
  });
}

const shopFilters = {
  search: "",
  category: ""
};

const avasamFilters = {
  search: "",
  category: ""
};

function allProducts() {
  return products.concat(avasamProducts, etsyProducts);
}

function amazonAffiliateProducts() {
  return products
    .filter((product) => product.externalUrl && product.paymentProvider !== "Stripe");
}

function initNav() {
  const toggle = document.querySelector(".menu-toggle");
  const links = document.querySelector(".nav-links");
  document.querySelectorAll('.nav-links a[href="dog-walker-club.html"]').forEach((link) => {
    link.textContent = "Dog Walker Directory";
  });
  if (toggle && links) {
    if (!links.id) links.id = "primary-navigation";
    toggle.setAttribute("aria-controls", links.id);
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Toggle navigation");
    const closeMenu = () => {
      links.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    };
    toggle.addEventListener("click", () => {
      const isOpen = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });
    links.addEventListener("click", (event) => {
      if (event.target.closest("a")) closeMenu();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && links.classList.contains("open")) {
        closeMenu();
        toggle.focus();
      }
    });
  }
  const path = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-links a").forEach((link) => {
    if (link.getAttribute("href") === path) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }
  });
}

function selectedGiftCardAmount(form) {
  const preset = form.querySelector("input[name='amountPreset']:checked")?.value || "10";
  if (preset === "custom") {
    return Number(form.elements.customAmount?.value);
  }

  return Number(preset);
}

function selectedGiftCardQuantity(form) {
  const quantity = Number.parseInt(form.elements.quantity?.value || "1", 10);
  return Number.isFinite(quantity) ? quantity : 1;
}

function giftCardDesignLabel(amount) {
  return amount === "custom" ? "Custom gift card" : `£${amount} gift card`;
}

function giftCardImageMarkup(amount, className = "") {
  const src = giftCardDesigns[amount];
  if (!src) return "";
  return `<img class="${className}" src="${src}" alt="${giftCardDesignLabel(amount)}" decoding="async" onerror="this.hidden=true">`;
}

function updateGiftCardPreview(form) {
  const preset = form.querySelector("input[name='amountPreset']:checked")?.value || "10";
  const preview = document.querySelector("[data-gift-card-preview]");
  if (!preview || !giftCardDesigns[preset]) return;
  preview.innerHTML = giftCardImageMarkup(preset, "gift-card-preview-image");
}

function updateGiftCardTotal(form) {
  const customWrap = form.querySelector("[data-custom-gift-amount]");
  const customInput = form.elements.customAmount;
  const totalTarget = form.querySelector("[data-gift-card-total]");
  const isCustom = form.querySelector("input[name='amountPreset']:checked")?.value === "custom";

  if (customWrap) customWrap.hidden = !isCustom;
  if (customInput) customInput.required = isCustom;

  const amount = selectedGiftCardAmount(form);
  const quantity = selectedGiftCardQuantity(form);
  const total = amount * quantity;

  if (totalTarget) {
    totalTarget.textContent =
      Number.isFinite(total) && total > 0
        ? gbpFormatter.format(total)
        : "Choose an amount";
  }
  updateGiftCardPreview(form);
}

function giftCardTotalPence(form) {
  const amount = selectedGiftCardAmount(form);
  const quantity = selectedGiftCardQuantity(form);
  if (!Number.isFinite(amount) || !Number.isInteger(quantity)) return 0;
  return Math.round(amount * 100) * quantity;
}

function showGiftCardMessage(form, message) {
  const target = form.querySelector("[data-gift-card-message]");
  if (!target) return;
  target.hidden = false;
  target.textContent = message;
}

function initGiftCardForm() {
  const form = document.querySelector("[data-gift-card-form]");
  if (!form) return;

  form.querySelectorAll("input[name='amountPreset']").forEach((input) => {
    const option = input.nextElementSibling;
    if (option && giftCardDesigns[input.value]) {
      option.insertAdjacentHTML("afterbegin", giftCardImageMarkup(input.value, "gift-card-option-image"));
    }
  });
  form.addEventListener("input", () => updateGiftCardTotal(form));
  form.addEventListener("change", () => updateGiftCardTotal(form));
  updateGiftCardTotal(form);
}

async function submitGiftCardCheckout(form) {
  const submit = form.querySelector("[data-gift-card-submit]");
  const originalText = submit?.textContent || "Buy Gift Card";
  if (form.dataset.giftCardSubmitting === "true") return;
  if (!form.checkValidity()) {
    showGiftCardMessage(form, "Please complete the required gift card details before checkout.");
    form.reportValidity();
    return;
  }
  if (form.dataset.giftCardStatus === "coming-soon") {
    showGiftCardMessage(form, "Gift card checkout is coming soon. No payment has been started.");
    return;
  }

  const amount = selectedGiftCardAmount(form);
  const quantity = selectedGiftCardQuantity(form);

  if (!Number.isFinite(amount) || amount < 5 || amount > 200) {
    showGiftCardMessage(form, "Choose a gift card amount between £5 and £200.");
    form.elements.customAmount?.focus();
    return;
  }

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    showGiftCardMessage(form, "Choose a quantity between 1 and 10.");
    form.elements.quantity?.focus();
    return;
  }

  const payload = {
    amount,
    quantity,
    recipientName: form.elements.recipientName?.value || "",
    recipientEmail: form.elements.recipientEmail?.value || "",
    buyerName: form.elements.buyerName?.value || "",
    buyerEmail: form.elements.buyerEmail?.value || "",
    message: form.elements.message?.value || "",
    deliveryDate: form.elements.deliveryDate?.value || "",
    total: giftCardTotalPence(form)
  };

  try {
    form.dataset.giftCardSubmitting = "true";
    if (submit) {
      submit.disabled = true;
      submit.textContent = "Opening Stripe checkout...";
    }

    const response = await fetch("/api/gift-cards/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    const checkoutUrl = result.paymentUrl || result.url || result.checkoutUrl;

    if (!response.ok || !result.ok || !checkoutUrl) {
      throw new Error(result.error || "Gift card checkout could not open.");
    }

    showGiftCardMessage(form, "Stripe checkout is opening now...");
    window.location.assign(checkoutUrl);
  } catch (error) {
    showGiftCardMessage(form, error.message || "Gift card checkout could not open. Please try again.");
    delete form.dataset.giftCardSubmitting;
    if (submit) {
      submit.disabled = false;
      submit.textContent = originalText;
    }
  } finally {
    if (form.dataset.giftCardSubmitting !== "true" && submit) {
      submit.disabled = false;
      submit.textContent = originalText;
    }
  }
}

function renderAdminGiftCardDesigns() {
  const target = document.querySelector("[data-admin-gift-card-designs]");
  if (!target) return;
  const publicGiftCardsUrl = window.location.hostname === "admin.bingodogwash.com"
    ? "https://bingodogwash.com/gift-cards"
    : "gift-cards.html";
  target.innerHTML = Object.keys(giftCardDesigns).map((amount) => `
    <article class="admin-gift-card-design">
      ${giftCardImageMarkup(amount, "admin-gift-card-design-image")}
      <strong>${giftCardDesignLabel(amount)}</strong>
      <a class="btn btn-light" href="${publicGiftCardsUrl}" target="_blank" rel="noopener">View public</a>
    </article>
  `).join("");
}

function initGiftCardBalanceForm() {
  const form = document.querySelector("[data-gift-card-balance-form]");
  const resultTarget = document.querySelector("[data-gift-card-balance-result]");
  if (!form || !resultTarget) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    resultTarget.innerHTML = "<h2>Checking balance</h2><p>Please wait...</p>";

    try {
      const response = await fetch("/api/gift-cards/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.elements.code?.value || "",
          recipientEmail: form.elements.recipientEmail?.value || ""
        })
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Gift card balance could not be checked.");
      }

      resultTarget.innerHTML = `
        <h2>Balance result</h2>
        <div class="mini-row"><strong>Original value</strong><span>${escapeSvg(result.originalAmountDisplay || "")}</span></div>
        <div class="mini-row"><strong>Remaining balance</strong><span>${escapeSvg(result.remainingBalanceDisplay || "")}</span></div>
        <div class="mini-row"><strong>Status</strong><span>${escapeSvg(result.status || "")}</span></div>
        <div class="mini-row"><strong>Expiry date</strong><span>${escapeSvg(result.expiryDate || "No expiry date")}</span></div>
      `;
    } catch (error) {
      resultTarget.innerHTML = `<h2>Balance result</h2><p>${escapeSvg(error.message || "Gift card balance could not be checked.")}</p>`;
    }
  });
}

function adminGiftCardToken() {
  return sessionStorage.getItem("bingoAdminGiftCardToken") || "";
}

function adminGiftCardHeaders() {
  return {
    Authorization: `Bearer ${adminGiftCardToken()}`,
    "Content-Type": "application/json",
    "X-Admin-Actor": "Bingo Dog Wash admin"
  };
}

function adminCoreToken() {
  return sessionStorage.getItem("bingoAdminCoreToken") || adminGiftCardToken();
}

function adminCoreHeaders() {
  return {
    Authorization: `Bearer ${adminCoreToken()}`,
    "Content-Type": "application/json",
    "X-Admin-Actor": "Bingo Dog Wash admin"
  };
}

function initAdminCoreControls() {
  const form = document.querySelector("[data-admin-core-token-form]");
  const message = document.querySelector("[data-admin-core-token-message]");
  if (!form) return;

  if (adminCoreToken()) {
    form.elements.token.value = adminCoreToken();
    loadAdminEtsy();
    loadAdminPages();
    renderAdminBookings();
    loadAdminGiveawayEntries();
    loadAdminNewsletter();
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    sessionStorage.setItem("bingoAdminCoreToken", form.elements.token.value.trim());
    if (message) message.textContent = "Controls unlocked for this browser session.";
    loadAdminEtsy();
    loadAdminPages();
    renderAdminBookings();
    loadAdminGiveawayEntries();
    loadAdminNewsletter();
  });
}

async function adminCoreJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...adminCoreHeaders(),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `Request failed with ${response.status}.`);
  }
  return data;
}

function initAdminGiftCards() {
  const tokenForm = document.querySelector("[data-admin-gift-card-token-form]");
  const panel = document.querySelector("[data-admin-gift-card-panel]");
  const filterForm = document.querySelector("[data-admin-gift-card-filter]");
  if (!tokenForm || !panel || !filterForm) return;

  const savedToken = adminGiftCardToken();
  if (savedToken) {
    tokenForm.elements.token.value = savedToken;
    panel.hidden = false;
    loadAdminGiftCards();
  }

  tokenForm.addEventListener("submit", (event) => {
    event.preventDefault();
    sessionStorage.setItem("bingoAdminGiftCardToken", tokenForm.elements.token.value.trim());
    panel.hidden = false;
    loadAdminGiftCards();
  });

  filterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    loadAdminGiftCards();
  });
}

async function loadAdminGiftCards() {
  const target = document.querySelector("[data-admin-gift-cards]");
  const filterForm = document.querySelector("[data-admin-gift-card-filter]");
  if (!target || !filterForm) return;

  target.innerHTML = "<div class=\"mini-row\"><strong>Loading</strong><span>Checking gift card records...</span></div>";

  const params = new URLSearchParams();
  const q = filterForm.elements.q?.value.trim();
  const status = filterForm.elements.status?.value.trim();
  if (q) params.set("q", q);
  if (status) params.set("status", status);

  try {
    const response = await fetch(`${adminGiftCardApiBase}?${params.toString()}`, {
      headers: adminGiftCardHeaders()
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Gift cards could not be loaded.");
    }

    const cards = result.giftCards || [];
    target.innerHTML = cards.length
      ? cards.map(adminGiftCardMarkup).join("")
      : "<div class=\"mini-row\"><strong>No gift cards</strong><span>No matching records found.</span></div>";
  } catch (error) {
    target.innerHTML = `<div class="mini-row"><strong>Gift cards unavailable</strong><span>${escapeSvg(error.message || "Could not load gift cards.")}</span></div>`;
  }
}

function adminGiftCardMarkup(card) {
  return `
    <article class="admin-gift-card-row" data-admin-gift-card="${escapeSvg(card.code)}">
      <div>
        <h3>${escapeSvg(card.code)}</h3>
        <span class="tag">${escapeSvg(card.status)}</span>
        <div class="grid grid-2">
          <div class="mini-row"><strong>Value</strong><span>${escapeSvg(card.originalAmountDisplay)}</span></div>
          <div class="mini-row"><strong>Remaining</strong><span>${escapeSvg(card.remainingBalanceDisplay)}</span></div>
          <div class="mini-row"><strong>Buyer</strong><span>${escapeSvg(card.buyerName)}<br>${escapeSvg(card.buyerEmail)}</span></div>
          <div class="mini-row"><strong>Recipient</strong><span>${escapeSvg(card.recipientName)}<br>${escapeSvg(card.recipientEmail)}</span></div>
          <div class="mini-row"><strong>Purchased</strong><span>${escapeSvg(formatAdminDate(card.purchaseDate))}</span></div>
          <div class="mini-row"><strong>Delivery</strong><span>${escapeSvg(card.deliveryDate || "Immediate")}</span></div>
          <div class="mini-row"><strong>Stripe</strong><span>${escapeSvg(card.stripeCheckoutSessionId || "Not saved")}</span></div>
          <div class="mini-row"><strong>Payment</strong><span>${escapeSvg(card.stripePaymentIntentId || "Not saved")}</span></div>
        </div>
      </div>
      <div class="admin-gift-card-actions">
        <button class="btn btn-light" type="button" data-copy-gift-card="${escapeSvg(card.code)}">Copy code</button>
        <button class="btn btn-secondary" type="button" data-redeem-gift-card="${escapeSvg(card.code)}">Redeem amount</button>
        <button class="btn btn-light" type="button" data-resend-gift-card="${escapeSvg(card.code)}">Resend email</button>
        ${card.status === "Cancelled"
          ? `<button class="btn btn-primary" type="button" data-reactivate-gift-card="${escapeSvg(card.code)}">Reactivate</button>`
          : `<button class="btn btn-light" type="button" data-cancel-gift-card="${escapeSvg(card.code)}">Cancel</button>`}
      </div>
    </article>
  `;
}

function formatAdminDate(value) {
  if (!value) return "Not saved";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-GB");
}

async function adminGiftCardAction(code, action, body = {}) {
  const response = await fetch(`${adminGiftCardApiBase}/${encodeURIComponent(code)}/${action}`, {
    method: "POST",
    headers: adminGiftCardHeaders(),
    body: JSON.stringify(body)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) {
    throw new Error(result.error || "Admin action failed.");
  }
  return result;
}

function readBasketProductCache() {
  try {
    const cache = JSON.parse(
      localStorage.getItem("bingoBasketProducts") || "{}"
    );

    return cache &&
      typeof cache === "object" &&
      !Array.isArray(cache)
      ? cache
      : {};
  } catch {
    return {};
  }
}

function writeBasketProductCache(cache) {
  localStorage.setItem(
    "bingoBasketProducts",
    JSON.stringify(cache)
  );
}

function cachedBasketProduct(id) {
  return readBasketProductCache()[id] || null;
}

function cacheBasketProduct(product) {
  if (!product || !product.id) return;

  const cache = readBasketProductCache();

  cache[product.id] = {
    ...product,
    cachedAt: new Date().toISOString()
  };

  writeBasketProductCache(cache);
}

function removeCachedBasketProduct(id) {
  const cache = readBasketProductCache();

  if (!cache[id]) return;

  delete cache[id];
  writeBasketProductCache(cache);
}

function basketProductById(id) {
  return (
    allProducts().find((product) => product.id === id) ||
    cachedBasketProduct(id)
  );
}
function basketCount() {
  const basket = cleanBasket();
  document.querySelectorAll("[data-basket-count]").forEach((el) => el.textContent = basket.length);
}

function cleanBasket() {
  let basket;

  try {
    basket = JSON.parse(
      localStorage.getItem("bingoBasket") || "[]"
    );
  } catch {
    basket = [];
  }

  if (!Array.isArray(basket)) {
    basket = [];
  }

  if (avasamState.loading) {
    return basket;
  }

  const liveIds = new Set(
    allProducts().map((product) => product.id)
  );

  const cachedProducts = readBasketProductCache();

  const cleaned = basket.filter(
    (id) =>
      !String(id || "").startsWith("etsy-") &&
      (liveIds.has(id) ||
      Boolean(cachedProducts[id]))
  );

  if (cleaned.length !== basket.length) {
    localStorage.setItem(
      "bingoBasket",
      JSON.stringify(cleaned)
    );
  }

  return cleaned;
}

function addToBasket(id) {
  const product = allProducts().find(
    (item) => item.id === id
  );

  if (!product) {
    console.error(
      "Product could not be added to the cart:",
      id
    );

    return false;
  }

  const basket = cleanBasket();

  basket.push(id);

  localStorage.setItem(
    "bingoBasket",
    JSON.stringify(basket)
  );

  cacheBasketProduct(product);
  basketCount();

  return true;
}

function escapeSvg(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(text) {
  return escapeSvg(text).replace(/'/g, "&#039;");
}

function productVisualSvg(product) {
  const title = escapeSvg(product.name);
  const category = escapeSvg(product.category);
  const code = escapeSvg(product.icon || "BD");
  const blue = "#0957b5";
  const green = "#20a83a";
  const dark = "#07346f";
  const productType = `${product.category || ""} ${product.name || ""}`.toLowerCase();
  let object = "";

  if (productType.includes("gate") || productType.includes("fence") || productType.includes("pen") || productType.includes("protector")) {
    object = `<rect x="168" y="174" width="564" height="330" rx="28" fill="#fff" stroke="${dark}" stroke-width="12"/><g stroke="${blue}" stroke-width="16" stroke-linecap="round">${Array.from({length: 7}, (_, i) => `<line x1="${232 + i * 72}" y1="198" x2="${232 + i * 72}" y2="482"/>`).join("")}</g><rect x="182" y="302" width="536" height="34" rx="17" fill="${green}"/><circle cx="644" cy="350" r="24" fill="${dark}"/><text x="450" y="574" text-anchor="middle" font-size="44" font-weight="900" fill="${blue}">DOG GATE</text>`;
  } else if (productType.includes("bowl") || productType.includes("feeding") || productType.includes("feeder")) {
    object = `<ellipse cx="450" cy="410" rx="250" ry="86" fill="#fff" stroke="${dark}" stroke-width="12"/><path d="M224 382 C252 526 648 526 676 382" fill="#eaf3ff" stroke="${dark}" stroke-width="12"/><ellipse cx="450" cy="360" rx="186" ry="54" fill="${green}" opacity=".18"/><circle cx="362" cy="310" r="32" fill="${green}"/><circle cx="450" cy="292" r="34" fill="${blue}"/><circle cx="536" cy="310" r="32" fill="${green}"/><text x="450" y="584" text-anchor="middle" font-size="44" font-weight="900" fill="${blue}">FEEDING</text>`;
  } else if (productType.includes("bag") || productType.includes("backpack") || productType.includes("carrier")) {
    object = `<rect x="274" y="150" width="352" height="392" rx="54" fill="#fff" stroke="${dark}" stroke-width="12"/><path d="M344 154 C360 74 540 74 556 154" fill="none" stroke="${green}" stroke-width="18" stroke-linecap="round"/><rect x="332" y="226" width="236" height="150" rx="34" fill="#eaf3ff" stroke="${blue}" stroke-width="10"/><circle cx="390" cy="306" r="22" fill="${green}"/><circle cx="510" cy="306" r="22" fill="${green}"/><path d="M380 418 H520" stroke="${dark}" stroke-width="14" stroke-linecap="round"/><text x="450" y="584" text-anchor="middle" font-size="44" font-weight="900" fill="${blue}">DOG BAG</text>`;
  } else if (productType.includes("shampoo") || productType.includes("conditioner") || productType.includes("cleaner") || productType.includes("cologne")) {
    object = `<rect x="332" y="112" width="236" height="420" rx="38" fill="#fff" stroke="${dark}" stroke-width="10"/><rect x="372" y="58" width="156" height="80" rx="22" fill="${green}"/><rect x="360" y="226" width="180" height="180" rx="24" fill="#eaf3ff"/><text x="450" y="330" text-anchor="middle" font-size="58" font-weight="900" fill="${blue}">${code}</text>`;
  } else if (productType.includes("paw")) {
    object = `<ellipse cx="450" cy="346" rx="210" ry="132" fill="#fff" stroke="${dark}" stroke-width="10"/><rect x="298" y="218" width="304" height="132" rx="36" fill="${green}"/><text x="450" y="304" text-anchor="middle" font-size="56" font-weight="900" fill="#fff">${code}</text>`;
  } else if (productType.includes("dental")) {
    object = `<rect x="264" y="358" width="370" height="58" rx="29" fill="${blue}"/><rect x="548" y="252" width="72" height="170" rx="26" fill="#fff" stroke="${dark}" stroke-width="8"/><circle cx="350" cy="246" r="88" fill="#fff" stroke="${green}" stroke-width="12"/><text x="350" y="264" text-anchor="middle" font-size="54" font-weight="900" fill="${blue}">${code}</text>`;
  } else if (productType.includes("brush")) {
    object = `<rect x="276" y="180" width="260" height="166" rx="42" fill="#fff" stroke="${dark}" stroke-width="10"/><rect x="492" y="302" width="78" height="218" rx="35" fill="${green}"/><g stroke="${blue}" stroke-width="8">${Array.from({length: 7}, (_, i) => `<line x1="${310 + i * 32}" y1="210" x2="${310 + i * 32}" y2="318"/>`).join("")}</g><text x="406" y="282" text-anchor="middle" font-size="46" font-weight="900" fill="${green}">${code}</text>`;
  } else if (productType.includes("towel")) {
    object = `<rect x="236" y="184" width="428" height="296" rx="36" fill="#fff" stroke="${dark}" stroke-width="10"/><path d="M276 244 H624 M276 310 H624 M276 376 H624" stroke="${green}" stroke-width="18" stroke-linecap="round"/><text x="450" y="456" text-anchor="middle" font-size="56" font-weight="900" fill="${blue}">${code}</text>`;
  } else if (productType.includes("joint") || productType.includes("supplement") || productType.includes("vitamin")) {
    object = `<rect x="316" y="154" width="268" height="360" rx="54" fill="#fff" stroke="${dark}" stroke-width="10"/><rect x="342" y="108" width="216" height="80" rx="24" fill="${blue}"/><circle cx="450" cy="330" r="90" fill="#eef8f2" stroke="${green}" stroke-width="12"/><text x="450" y="350" text-anchor="middle" font-size="58" font-weight="900" fill="${green}">${code}</text>`;
  } else if (productType.includes("apparel")) {
    object = `<circle cx="450" cy="178" r="72" fill="#fff" stroke="${dark}" stroke-width="10"/><rect x="326" y="238" width="248" height="264" rx="42" fill="#fff" stroke="${dark}" stroke-width="10"/><circle cx="450" cy="178" r="30" fill="#eaf3ff"/><text x="450" y="386" text-anchor="middle" font-size="62" font-weight="900" fill="${green}">${code}</text>`;
  } else {
    object = `<rect x="284" y="156" width="332" height="336" rx="44" fill="#fff" stroke="${dark}" stroke-width="10"/><path d="M284 266 H616 V492 H284 Z" fill="#eaf3ff"/><text x="450" y="360" text-anchor="middle" font-size="70" font-weight="900" fill="${blue}">${code}</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 680" role="img" aria-label="${title}">
    <rect width="900" height="680" rx="36" fill="#f7fbff"/>
    <path d="M0 486 C144 420 284 548 442 492 C584 442 696 350 900 416 L900 680 L0 680 Z" fill="#eef8f2"/>
    <circle cx="740" cy="118" r="66" fill="#eaf3ff"/>
    <circle cx="160" cy="132" r="42" fill="#dff4e5"/>
    ${object}
    <rect x="118" y="548" width="664" height="72" rx="36" fill="${dark}"/>
    <text x="450" y="593" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="900" fill="#fff">${category}</text>
  </svg>`;
}

function productImageMarkup(product) {
  const fallback = productFallbackImage(product);
  const src = product.image || fallback;
  return `<img src="${escapeAttr(src)}" alt="${escapeAttr(product.name)}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${escapeAttr(fallback)}'">`;
}

function productFallbackImage(product) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(productVisualSvg(product))}`;
}


function productPriceText(product) {
  if (product.priceLabel) return product.priceLabel;
  const price = Number(product.price);
  return Number.isFinite(price) ? gbpFormatter.format(price) : "Price unavailable";
}

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== "");
}

function productHandle(value, fallback) {
  return String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || fallback;
}

function mediaUrl(value) {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      const url = mediaUrl(item);
      if (url) return url;
    }
    return "";
  }
  if (typeof value !== "object") return "";
  return mediaUrl(firstValue(
    value.url, value.src, value.imageUrl, value.image_url, value.href,
    value.original, value.large, value.medium, value.thumbnail,
    value.secure_url, value.downloadUrl
  ));
}

function firstImage(raw) {
  const variant = Array.isArray(raw.variants) ? raw.variants[0] || {} : {};
  return mediaUrl(firstValue(
    raw.primaryImage, raw.primary_image, raw.image, raw.imageUrl, raw.image_url,
    raw.thumbnail, raw.thumbnailUrl, raw.main_image, raw.mainImage,
    raw.images, raw.galleryImages, raw.media, raw.pictures,
    variant.primaryImage, variant.image, variant.imageUrl, variant.images
  ));
}

function stockStatus(raw) {
  if (raw.stockStatus || raw.availability) return raw.stockStatus || raw.availability;
  if (raw.inStock === true) return "In stock";
  if (raw.inStock === false) return "Out of stock";
  const quantity = Number(firstValue(raw.quantity, raw.stock, raw.inventory));
  if (Number.isFinite(quantity)) return quantity > 0 ? `In stock: ${quantity}` : "Out of stock";
  return "Live supplier stock";
}

function bingoAvasamCatalogueProduct(product) {
  if (!product || !product.name) return false;

  const name = String(product.name || "").toLowerCase();
  const description = String(product.description || "").toLowerCase();

  // Confirmed non-pet catalogue item.
  if (
    name.includes("women girls initial letter necklace") ||
    name.includes("letters charm necklaces pendants")
  ) {
    return false;
  }

  // Confirmed vidaXL children's plush toys, not dog toys.
  if (
    name.includes("vidaxl dog cuddly toy plush") &&
    (
      description.includes("suitable for children aged") ||
      description.includes("age recommendation")
    )
  ) {
    return false;
  }

  return true;
}

function bingoAvasamCategory(product) {
  const text = [
    product?.name,
    product?.category,
    product?.description
  ].filter(Boolean).join(" ").toLowerCase();

  if (/\b(bed|sofa|cot|cushion|mattress)\b/.test(text)) {
    return "Beds & Comfort";
  }

  if (/\b(carrier|travel|car boot|car seat|crate|pen|playpen|enclosure)\b/.test(text)) {
    return "Carriers & Travel";
  }

  if (/\b(groom|brush|comb|dematting|slicker|shampoo|wash|towel)\b/.test(text)) {
    return "Grooming & Bathing";
  }

  if (/\b(collar|leash|lead|harness)\b/.test(text)) {
    return "Collars, Leads & Harnesses";
  }

  if (/\b(coat|rainwear|jacket|dog clothes|pet clothes|t-shirt)\b/.test(text)) {
    return "Clothing & Coats";
  }

  if (/\b(toy|kong|chew)\b/.test(text)) {
    return "Toys";
  }

  if (/\b(feeder|feeding|bowl|water bowl|food bowl)\b/.test(text)) {
    return "Feeding";
  }

  return "Other Dog Essentials";
}
function normalizeAvasamProduct(raw, index) {
  const variant = Array.isArray(raw.variants) ? raw.variants[0] || {} : {};
  const name = firstValue(raw.name, raw.title, raw.productName, variant.name, `Avasam product ${index + 1}`);
  const price = Number(firstValue(raw.price, raw.retailPrice, raw.salePrice, raw.sellPrice, raw.rrp, variant.price));
  const sourceId = productHandle(firstValue(raw.id, raw.sku, raw.productId, variant.sku, name), `product-${index + 1}`);
  const mappedPublicId = firstValue(
    raw.bingoPublicSlug, raw.bingo_public_slug, raw.publicSlug, raw.public_slug,
    raw.bingoPublicId, raw.bingo_public_id, raw.publicId, raw.public_id,
    raw.productSlug, raw.product_slug, raw.slug,
    variant.bingoPublicSlug, variant.publicSlug, variant.publicId, variant.slug
  );
  const listingUrl = firstValue(
    raw.externalUrl, raw.productUrl, raw.product_url, raw.listingUrl,
    raw.webUrl, raw.checkoutUrl, raw.url, raw.link, raw.href,
    variant.productUrl, variant.url
  );
  return {
    id: sourceId.startsWith("avasam-") ? sourceId : `avasam-${sourceId}`,
    publicId: mappedPublicId ? productHandle(mappedPublicId, "") : productHandle(name, ""),
    sku: firstValue(raw.sku, raw.SKU, variant.sku, ""),
    name,
    category: bingoAvasamCategory({ name, category: firstValue(raw.category, raw.categoryName, raw.type, raw.collection, ""), description: firstValue(raw.description, raw.shortDescription, raw.summary, "") }),
    price: Number.isFinite(price) ? price : null,
    priceLabel: Number.isFinite(price) ? "" : "Price unavailable",
    icon: "AV",
    image: firstImage(raw) || productFallbackImage({ name, category: firstValue(raw.category, raw.categoryName, raw.type, raw.collection, "Avasam Pet Products"), supplier: firstValue(raw.supplier, raw.supplierName, raw.vendor, "Avasam") }),
    supplier: firstValue(raw.supplier, raw.supplierName, raw.vendor, "Avasam"),
    commission: firstValue(raw.margin, raw.commission, "Direct margin"),
    status: stockStatus(raw),
    delivery: firstValue(raw.delivery, raw.deliveryText, raw.delivery_text, raw.deliveryInfo, raw.delivery_info, raw.shippingText, raw.shipping_text, raw.shippingInfo, raw.shipping_info, raw.shipping?.text, raw.shipping?.message, variant.delivery, variant.deliveryText, variant.shippingText, ""),
    listingUrl: typeof listingUrl === "string" ? listingUrl.trim() : "",
    description: firstValue(raw.description, raw.shortDescription, raw.summary, "Live Avasam pet product ready for Bingo Dog Wash checkout.")
  };
}

function groupAvasamProductVariants(productList) {
  const groups = new Map();
  for (const product of productList) {
    const normalizedName = String(product.name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    if (!normalizedName) continue;

    // Generic supplier titles can represent materially different products.
    // Keep those records separate by SKU/ID rather than collapsing them.
    const separateGenericProduct = new Set(["pet carrier", "pet bed"]).has(normalizedName);
    const productIdentity = String(product.sku || product.id || "").trim();
    const key = separateGenericProduct && productIdentity
      ? `${normalizedName}::${productIdentity}`
      : normalizedName;
    const current = groups.get(key) || [];
    current.push(product);
    groups.set(key, current);
  }

  return Array.from(groups.values()).map((variants) => {
    const priced = variants
      .filter((variant) => Number.isFinite(Number(variant.price)))
      .sort((a, b) => Number(a.price) - Number(b.price));
    const representative = { ...(priced[0] || variants[0]) };
    const uniquePrices = [...new Set(priced.map((variant) => Number(variant.price)))];
    representative.variants = variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      price: variant.price,
      status: variant.status
    }));
    if (uniquePrices.length > 1) {
      representative.priceLabel = `From ${gbpFormatter.format(Number(representative.price))}`;
      representative.status = `${variants.length} options available`;
    }
    return representative;
  });
}


function normalizeEtsyProduct(raw, index) {
  const verificationStatus = String(raw.affiliateVerificationStatus || raw.affiliate_verification_status || "").toLowerCase();
  const reviewStatus = String(raw.affiliateReviewStatus || raw.affiliate_review_status || "").toLowerCase();
  const externalUrl = firstValue(raw.externalUrl);
  if (verificationStatus !== "match" || reviewStatus !== "approved" || !externalUrl) return null;
  const name = decodeEtsyDisplayText(firstValue(raw.name, raw.title, raw.productName, `Etsy product ${index + 1}`));
  const rawCategory = firstValue(raw.category, raw.categoryName, raw.type, "Etsy Dog Products");
  const category = /^\d+$/.test(String(rawCategory).trim()) ? "Etsy Dog Products" : rawCategory;
  const price = Number(firstValue(raw.price, raw.retailPrice, raw.salePrice, raw.amount));
  return {
    id: `etsy-${productHandle(firstValue(raw.sourceProductId, raw.listingId, raw.id, raw.sku, name), `product-${index + 1}`).replace(/^etsy-/, "")}`,
    name,
    category,
    price: Number.isFinite(price) ? price : null,
    priceLabel: Number.isFinite(price) ? "" : firstValue(raw.priceLabel, "Price on Etsy"),
    icon: "ET",
    image: firstImage(raw) || productFallbackImage({ name, category: firstValue(raw.category, raw.categoryName, raw.type, "Etsy Pet Products"), supplier: "Etsy" }),
    supplier: firstValue(raw.supplier, raw.shopName, raw.vendor, "Etsy"),
    commission: firstValue(raw.margin, raw.commission, "Affiliate"),
    status: firstValue(raw.status, "External checkout"),
    externalUrl,
    description: firstValue(raw.description, raw.shortDescription, raw.summary, "Verified Etsy affiliate product ready for external checkout."),
    paymentProvider: "Etsy",
    affiliateReviewStatus: reviewStatus,
    affiliateVerificationStatus: verificationStatus
  };
}

async function readProductFeed(primaryUrl, fallbackUrl, starterProducts, normalizeProduct) {
  const urls = location.protocol === "file:" ? [fallbackUrl] : [primaryUrl, fallbackUrl];
  for (const url of urls) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`${url} returned ${response.status}`);
      const data = await response.json();
      const records = Array.isArray(data) ? data : data.products || data.items || data.data || [];
      const normalized = records.map(normalizeProduct).filter((product) => product?.name);
      if (normalized.length) return normalized;
    } catch (error) {
      console.warn("Product feed unavailable", url, error);
    }
  }
  return starterProducts.map(normalizeProduct).filter((product) => product.name);
}

async function readLiveProductFeed(url, normalizeProduct) {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    const detail = data.error || data.note || `${url} returned ${response.status}`;
    const error = new Error(detail);
    error.feedStatus = data;
    throw error;
  }

  const records = Array.isArray(data) ? data : data.products || data.items || data.data || [];
  const normalized = records.map(normalizeProduct).filter((product) => product.name);
  return {
    products: normalized,
    status: data
  };
}

async function readPaginatedEtsyFeed(url, normalizeProduct) {
  const productsById = new Map();
  let nextCursor = "";
  let status = {};
  for (let page = 0; page < 100; page += 1) {
    const pageUrl = new URL(url, location.href);
    pageUrl.searchParams.set("limit", "50");
    if (nextCursor) pageUrl.searchParams.set("cursor", nextCursor);
    const result = await readLiveProductFeed(pageUrl.toString(), normalizeProduct);
    status = result.status;
    for (const product of result.products) productsById.set(product.id, product);
    if (!status.hasMore || !status.nextCursor || status.nextCursor === nextCursor) {
      return { products: [...productsById.values()], status };
    }
    nextCursor = status.nextCursor;
  }
  throw new Error("Etsy catalogue pagination did not terminate safely.");
}

function decodeEtsyDisplayText(value) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = String(value || "");
  return textarea.value;
}

async function loadAvasamProducts({ silent = false } = {}) {
  const target = document.querySelector("[data-home-bingo-products], [data-avasam-products], [data-products], [data-cart], [data-product-detail], [data-admin-product-feed], [data-account-orders]");
  if (!target) return;

  avasamState.loading = !silent;
  avasamState.error = false;
  if (!silent) {
    renderAvasamCategories();
    renderAvasamProducts();
  }

  try {
    const result = await readLiveProductFeed(avasamFeedUrl, normalizeAvasamProduct);
    avasamProducts = groupAvasamProductVariants(result.products.filter(bingoAvasamCatalogueProduct));
    avasamState.error = !avasamProducts.length;
    avasamState.live = Boolean(result.status.live);
    avasamState.liveConfigured = Boolean(result.status.liveConfigured);
    avasamState.lastRefresh = result.status.refreshedAt || (avasamProducts.length ? new Date().toISOString() : "");
    avasamState.count = avasamProducts.length;
    avasamState.message = avasamProducts.length ? "" : "Avasam temporarily unavailable";
  } catch (error) {
    const fallbackProducts = avasamStarterProducts
      .map(normalizeAvasamProduct)
      .filter((product) => product.name);
    avasamProducts = groupAvasamProductVariants(fallbackProducts);
    avasamState.error = !avasamProducts.length;
    avasamState.live = false;
    avasamState.liveConfigured = Boolean(error.feedStatus?.liveConfigured);
    avasamState.lastRefresh = avasamProducts.length ? new Date().toISOString() : "";
    avasamState.count = avasamProducts.length;
    avasamState.message = avasamProducts.length
      ? "Showing the backup Avasam catalogue while the live feed reconnects."
      : error.message || "Avasam temporarily unavailable";
  } finally {
    avasamState.loading = false;
    renderAvasamCategories();
    renderAvasamProducts();
    renderHomeAvasamProducts();
    renderProducts();
    renderAdminProducts();
    renderAccount();
    renderProductDetail();
    renderCart();
  }
}

function normalizeEbayProduct(raw, index, feedGroup = "") {
  const priceValue = Number(raw.price?.value);
  const safeFeedGroup = typeof feedGroup === "string" ? feedGroup.trim() : "";

  return {
    id: `ebay-${productHandle(`${safeFeedGroup}-${firstValue(raw.itemUrl, raw.title)}`, `product-${index + 1}`)}`,
    name: firstValue(raw.title, "eBay pet product"),
    category: safeFeedGroup || "eBay UK Pet Products",
    feedGroup: safeFeedGroup,
    price: Number.isFinite(priceValue) ? priceValue : null,
    priceLabel: firstValue(raw.price?.display, "Price on eBay"),
    icon: "EB",
    image: firstValue(raw.image, "retail.jpg"),
    supplier: firstValue(raw.seller, "eBay seller"),
    commission: "eBay Browse API",
    status: "Live eBay UK listing",
    externalUrl: raw.itemUrl,
    description: `Live UK eBay listing from ${firstValue(raw.seller, "an eBay seller")}.`
  };
}

function isRelevantEbayProduct(raw) {
  const title = typeof raw?.title === "string" ? raw.title.toLowerCase() : "";
  return ["dog", "dogs", "puppy", "puppies", "pet", "canine"]
    .some((keyword) => title.includes(keyword));
}

function ebayAffiliateSearchUrl(query) {
  const url = new URL(ebayAffiliateSearchBase);
  url.searchParams.set("_nkw", query);
  url.searchParams.set("_sacat", "0");
  url.searchParams.set("_from", "R40");

  Object.entries(ebayAffiliateParams).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return url.toString();
}

function fallbackEbayProducts(query = "") {
  const search = query.trim().toLowerCase();
  const picks = search
    ? ebayStarterProducts.filter((product) =>
        [product.name, product.query, product.category].join(" ").toLowerCase().includes(search)
      )
    : ebayStarterProducts;
  const productsToShow = picks.length
    ? picks
    : [{
        id: productHandle(query, "dog-products"),
        name: `${query} for dogs on eBay UK`,
        query: `dog ${query}`,
        category: "eBay UK Pet Products",
        image: ""
      }];

  return productsToShow.map((product) => ({
    id: `ebay-search-${product.id}`,
    name: product.name,
    category: product.category,
    price: null,
    priceLabel: "Price on eBay",
    icon: "EB",
    image: product.image,
    supplier: "eBay UK",
    commission: "eBay Partner Network",
    status: "External eBay search",
    externalUrl: ebayAffiliateSearchUrl(product.query || query || "dog product"),
    description: `Browse ${product.query || query || "dog products"} on eBay UK.`
  }));
}

async function loadEbayProducts({ silent = false } = {}) {
  const target = document.querySelector("[data-products], [data-admin-source-summary]");
  if (!target) return;

  ebayState.loading = !silent;
  ebayState.error = false;
  renderProducts();

  try {
    if (location.protocol === "file:") {
      ebayProducts = fallbackEbayProducts(normalizedProductSearchQuery(shopFilters.search));
      ebayState.error = false;
      return;
    }

    const normalizedQuery = normalizedProductSearchQuery(shopFilters.search);
    const searchQuery = /\b(dog|dogs|puppy|puppies|pet|canine)\b/i.test(normalizedQuery)
      ? normalizedQuery
      : `dog ${normalizedQuery}`;
    if (searchQuery) {
      const response = await fetch(`${ebayProductsUrl}?q=${encodeURIComponent(searchQuery)}&limit=24`, { cache: "no-store" });
      if (!response.ok) throw new Error("eBay products unavailable.");
      const data = await response.json();
      const records = Array.isArray(data.products) ? data.products : [];
      ebayProducts = records
        .filter(isRelevantEbayProduct)
        .map((record, index) => normalizeEbayProduct(record, index))
        .filter((product) => product.name && product.externalUrl);
    } else {
      const groupResults = await Promise.all(ebayLiveGroups.map(async (group) => {
        const response = await fetch(`${ebayProductsUrl}?q=${encodeURIComponent(group.query)}&limit=${ebayProductsPerGroup}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`eBay ${group.name} products unavailable.`);
        const data = await response.json();
        const records = Array.isArray(data.products) ? data.products : [];
        return records
          .filter(isRelevantEbayProduct)
          .slice(0, ebayProductsPerGroup)
          .map((record, index) => normalizeEbayProduct(record, index, group.name))
          .filter((product) => product.name && product.externalUrl);
      }));
      ebayProducts = groupResults.flat();
    }
    if (!ebayProducts.length) {
      ebayProducts = fallbackEbayProducts(normalizedProductSearchQuery(shopFilters.search));
    }
    ebayState.error = false;
  } catch (error) {
    ebayProducts = fallbackEbayProducts(normalizedProductSearchQuery(shopFilters.search));
    ebayState.error = false;
  } finally {
    ebayState.loading = false;
    renderProducts();
    renderAdminProducts();
  }
}

function scheduleEbayProducts() {
  if (!document.querySelector("[data-products], [data-admin-source-summary]")) return;
  window.clearTimeout(ebaySearchTimer);
  ebaySearchTimer = window.setTimeout(() => loadEbayProducts({ silent: true }), 350);
}


async function loadEtsyProducts({ silent = false } = {}) {
  const target = document.querySelector("[data-products], [data-cart], [data-product-detail], [data-admin-product-feed], [data-account-orders]");
  if (!target) return;

  etsyState.loading = !silent;
  etsyState.error = false;

  try {
    const result = await readPaginatedEtsyFeed(etsyFeedUrl, normalizeEtsyProduct);
    etsyProducts = result.status?.enabled === false ? [] : result.products;
    etsyState.error = false;
  } catch (error) {
    etsyProducts = [];
    etsyState.error = true;
  } finally {
    etsyState.loading = false;
    renderProducts();
    renderAdminProducts();
    renderAccount();
    renderProductDetail();
    renderCart();
  }
}
function supplierSummaryMarkup(product) {
  if (product.paymentProvider === "Stripe") {
    return `
      <div class="supplier meta">
        <span>Supplier: ${product.supplier}</span>
        <span>Payment: Stripe checkout</span>
        <span>Fulfilment: ${product.status}</span>
      </div>
    `;
  }

  if (product.externalUrl) {
    return `
      <div class="supplier meta">
        <span>Supplier: ${product.supplier}</span>
        <span>Commission: ${product.commission}</span>
        <span>Tracking ID: ${product.trackingId || "Configured"}</span>
        <span>Fulfilment: ${product.status}</span>
      </div>
    `;
  }

  return `
    <div class="supplier meta">
      <span>Supplier: Bingo Dog Wash partner range</span>
      <span>Commission: ${product.commission}</span>
      <span>Fulfilment: ${product.status}</span>
    </div>
  `;
}

function productDetailInfoMarkup(product) {
  if (product.paymentProvider === "Stripe") {
    return `
      <div class="supplier">
        <strong>Service information</strong>
        <span>Provider: ${product.supplier}</span>
        <span>Payment: Stripe secure checkout</span>
        <span>Checkout: Pay online</span>
      </div>
    `;
  }

  if (product.externalUrl) {
    return `
      <div class="supplier">
        <strong>Product information</strong>
        <span>Supplier: ${product.supplier}</span>
        <span>Commission: ${product.commission}</span>
        <span>Store ID: ${product.storeId || "Configured"}</span>
        <span>Tracking ID: ${product.trackingId || "Configured"}</span>
        <span>Checkout: External Amazon checkout</span>
      </div>
    `;
  }

  return `
    <div class="supplier">
      <strong>Product information</strong>
      <span>Supplier: Bingo Dog Wash partner range</span>
      <span>Commission: ${product.commission}</span>
      <span>Fulfilment: ${product.status}</span>
      <span>Checkout: Available through Bingo Dog Wash</span>
    </div>
  `;
}

function renderCategories() {
  const target = document.querySelector("[data-categories]");
  const select = document.querySelector("[data-category-select]");
  if (!target) return;
  const publicProducts = products.filter((product) => product.paymentProvider === "Stripe" || (product.externalUrl && product.paymentProvider !== "Stripe"));
  const usedCategories = [...new Set(categories.concat(publicProducts.map((product) => product.category)))].filter((category) => publicProducts.some((product) => product.category === category));
  target.innerHTML = [`<button class="chip ${shopFilters.category === "" ? "is-active" : ""}" type="button" data-category-button="">All</button>`]
    .concat(usedCategories.map((category) => `<button class="chip ${shopFilters.category === category ? "is-active" : ""}" type="button" data-category-button="${category}">${category}</button>`))
    .join("");
  if (select) {
    select.innerHTML = `<option value="">All categories</option>` + usedCategories.map((category) => `<option value="${category}">${category}</option>`).join("");
    select.value = shopFilters.category;
  }
}

const productSearchAliases = {
  shmpoo: "shampoo",
  shamppo: "shampoo",
  shampo: "shampoo",
  shampoo: "shampoo",
  colar: "collar",
  harnes: "harness",
  treets: "treats"
};

function normalizedProductSearch(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => productSearchAliases[term] || term);
}

function normalizedProductSearchQuery(value) {
  return normalizedProductSearch(value).join(" ");
}

function filteredProducts() {
  const terms = normalizedProductSearch(shopFilters.search);
  return publicShopProducts().filter((product) => {
    const searchable = [product.name, product.category, product.description, product.supplier, productSource(product)].join(" ").toLowerCase();
    return !terms.length || terms.every((term) => searchable.includes(term));
  });
}

function publicShopProducts() {
  return shopProducts().concat(ebayProducts);
}

function shopProducts() {
  const stripeProducts = products.filter((product) => product.paymentProvider === "Stripe");
  const amazonProducts = amazonAffiliateProducts();
  return stripeProducts.concat(amazonProducts, etsyProducts, avasamProducts);
}

function productSource(product) {
  if (product.paymentProvider === "Stripe") return "Stripe Payment";
  if (product.id?.startsWith("ebay-")) return "eBay UK";
  if (product.id?.startsWith("etsy-")) return "Etsy Affiliate";
  if (/etsy/i.test(product.supplier || "")) return "Etsy Affiliate";
  if (product.id?.startsWith("avasam-")) return "Avasam";
  if (product.externalUrl) return "Amazon Affiliate";
  return product.supplier || "Bingo Dog Wash";
}

function isExternalSupplierProduct(product) {
  return Boolean(product.externalUrl && product.paymentProvider !== "Stripe");
}

function isDirectCheckoutProduct(product) {
  return !isExternalSupplierProduct(product);
}

function productShopChannel(product) {
  if (productSource(product) === "Etsy Affiliate") return "Concordia Mercatura";
  return isExternalSupplierProduct(product) ? "External supplier link" : "Bingo direct checkout";
}

function productActionLabel(product) {
  if (product.paymentProvider === "Stripe") return "Pay £10 with Stripe";
  if (product.id?.startsWith("ebay-")) return "View on eBay";
  if (product.paymentProvider === "Etsy" || product.id?.startsWith("etsy-")) return "Buy on Etsy";
  if (product.externalUrl && productSource(product) === "Amazon Affiliate") return "View on Amazon";
  if (product.externalUrl) return `Buy on ${productSource(product).replace(" Affiliate", "")}`;
  return "Buy";
}

function productExternalRel(product) {
  return productSource(product) === "Amazon Affiliate"
    ? "nofollow sponsored noopener noreferrer"
    : "noopener";
}

function renderSourceStatus() {
  const shopCount = document.querySelector("[data-live-shop-count]");
  const ebayCount = document.querySelector("[data-live-ebay-count]");
  const avasamCount = document.querySelector("[data-live-avasam-count]");
  if (shopCount) shopCount.textContent = String(publicShopProducts().length);
  if (ebayCount) ebayCount.textContent = String(ebayProducts.length);
  if (avasamCount) avasamCount.textContent = String(avasamProducts.length);

  const target = document.querySelector("[data-source-status]");
  if (!target) return;
  const messages = [];
  if (etsyState.loading) messages.push("Loading Etsy affiliate products...");
  if (avasamState.loading) messages.push("Loading Avasam products...");
  if (ebayState.loading) messages.push("Loading eBay UK pet products...");
  if (avasamState.error) messages.push("Avasam products are temporarily unavailable. Please try again later.");
  if (etsyState.error) messages.push("Etsy affiliate products are temporarily unavailable. Please try again later.");
  if (ebayState.error) messages.push("eBay UK pet products are temporarily unavailable. Please try again later.");
  target.hidden = !messages.length;
  target.innerHTML = messages.map((message) => `<span>${message}</span>`).join("");
}

function productCardMarkup(product) {
  const buyControl = product.id?.startsWith("avasam-")
    ? `<button class="btn btn-primary" type="button" data-avasam-buy="${escapeAttr(product.id)}">Buy</button>`
    : (product.externalUrl
      ? `<a class="btn btn-primary" href="${product.externalUrl}" target="_blank" rel="${productExternalRel(product)}">${productActionLabel(product)}</a>`
      : `<button class="btn btn-primary" type="button" data-buy-now="${product.id}">${productActionLabel(product)}</button>`);
  return `
    <article class="card product-card ${isDirectCheckoutProduct(product) ? "product-card-direct" : "product-card-external"}">
      <div class="product-image">${productImageMarkup(product)}</div>
      <div class="product-tags">
        <p class="tag">${productShopChannel(product)}</p>
        <p class="tag tag-muted">${productSource(product)}</p>
      </div>
      <h3>${escapeSvg(product.name)}</h3>
      <p>${escapeSvg(typeof product.category === "string" ? product.category : "")}</p>
      <p class="price">${productPriceText(product)}</p>
      <div class="commerce-bar">
        ${buyControl}
      </div>
    </article>
  `;
}

function ebayProductGroup(product) {
  if (typeof product.feedGroup === "string" && product.feedGroup.trim()) return product.feedGroup.trim();
  const text = `${product.name || ""} ${product.category || ""}`.toLowerCase();
  const groups = [
    ["Grooming & Bathing", ["groom", "brush", "comb", "shampoo", "conditioner", "bath", "dryer", "clipper", "deshed", "demat"]],
    ["Collars, Harnesses & Leads", ["collar", "harness", "lead", "leash"]],
    ["Treats & Food", ["treat", "food", "chew", "biscuit", "snack"]],
    ["Toys", ["toy", "ball", "rope", "squeak"]],
    ["Clothing & Accessories", ["coat", "jacket", "jumper", "clothing", "accessory", "bandana", "bed"]]
  ];
  return groups.find(([, keywords]) => keywords.some((keyword) => text.includes(keyword)))?.[0] || "Other Dog Products";
}

function supplierProductGroup(product, source) {
  if (source === "eBay UK") return ebayProductGroup(product);
  const category = String(product.category || "").trim();
  return category && !/^avasam pet products$/i.test(category) ? category : "Other Dog Products";
}

function supplierProductGroupsMarkup(productList, source) {
  if (!productList.length) return "";
  const groups = new Map();
  if (source === "Avasam") {
    groups.set("Featured products", productList.slice(0, 10));
  } else {
    productList.forEach((product) => {
      const group = supplierProductGroup(product, source);
      const productsInGroup = groups.get(group) || [];
      if (productsInGroup.length < 10) groups.set(group, [...productsInGroup, product]);
    });
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "en-GB"))
    .map(([group, groupProducts]) => `
      <section class="supplier-product-group" data-supplier-group="${escapeAttr(group)}">
        <div class="section-head section-head-compact">
          <div>
            <span class="eyebrow">${source} · ${groupProducts.length} products</span>
            <h4>${escapeSvg(group)}</h4>
          </div>
        </div>
        <div class="grid grid-3">${groupProducts.map(productCardMarkup).join("")}</div>
      </section>
    `).join("");
}

function shopProductSectionMarkup(title, detail, productList, emptyText, className) {
  const groupedSource = className === "shop-product-section-direct" ? "Avasam" : "eBay UK";
  const groupedProducts = productList.filter((product) => productSource(product) === groupedSource);
  const standardProducts = productList.filter((product) => productSource(product) !== groupedSource);
  return `
    <section class="shop-product-section ${className}">
      <div class="section-head section-head-compact">
        <div>
          <span class="eyebrow">${productList.length} products</span>
          <h3>${title}</h3>
          <p>${detail}</p>
        </div>
      </div>
      ${productList.length ? `
        ${standardProducts.length ? `<div class="grid grid-3">${standardProducts.map(productCardMarkup).join("")}</div>` : ""}
        ${supplierProductGroupsMarkup(groupedProducts, groupedSource)}
      ` : `<article class="card product-card supplier-message"><h3>${emptyText}</h3><p>Try a different search.</p></article>`}
    </section>
  `;
}

function renderProducts(productList = filteredProducts()) {
  const target = document.querySelector("[data-products]");
  if (!target) return;
  renderSourceStatus();
  if (!productList.length) {
    target.innerHTML = `<article class="card product-card supplier-message"><h3>No products found</h3><p>Try a different search.</p></article>`;
    updateUniversalNoResults();
    return;
  }
  if (shopFilters.search.trim()) {
    const query = normalizedProductSearchQuery(shopFilters.search);
    target.innerHTML = `
      <section class="shop-product-section shop-product-section-search">
        <div class="section-head section-head-compact">
          <div>
            <span class="eyebrow">${productList.length} matching products · all sellers</span>
            <h3>Results for “${escapeSvg(query)}”</h3>
            <p>Bingo, Avasam, Amazon, eBay and Etsy matches are listed together. Use the seller label on each product to see where it is sold.</p>
          </div>
        </div>
        <div class="grid grid-3">${productList.map(productCardMarkup).join("")}</div>
      </section>`;
    updateUniversalNoResults();
    return;
  }
  const directProducts = productList.filter(isDirectCheckoutProduct);
  const externalProducts = productList.filter(isExternalSupplierProduct);
  target.innerHTML = [
    shopProductSectionMarkup(
      "Bingo-Owned and Direct Checkout",
      "Products paid for through Bingo Dog Wash checkout or direct Bingo payment flows.",
      directProducts,
      "No Bingo direct products found",
      "shop-product-section-direct"
    ),
    shopProductSectionMarkup(
      "External Supplier Links",
      "Affiliate and partner links open the supplier website for payment.",
      externalProducts,
      "No external supplier products found",
      "shop-product-section-external"
    )
  ].join("");
  updateUniversalNoResults();
}

function renderAvasamProducts() {
  const target = document.querySelector("[data-avasam-products]");
  if (!target) return;
  const productList = filteredAvasamProducts();
  const section = document.querySelector("[data-avasam-section]");
  if (section) section.hidden = Boolean(avasamFilters.search.trim()) && !productList.length && !avasamState.loading && !avasamState.error;
  if (avasamState.loading) {
    target.innerHTML = `<article class="card product-card avasam-card supplier-message"><h3>Loading Avasam products</h3><p>Checking the live catalogue for the latest products, prices and stock.</p></article>`;
    updateUniversalNoResults();
    return;
  }
  if (avasamState.error) {
    target.innerHTML = `<article class="card product-card avasam-card supplier-message"><h3>Products are temporarily unavailable.</h3><p>Please try again later.</p></article>`;
    updateUniversalNoResults();
    return;
  }
  if (!productList.length) {
    target.innerHTML = `<article class="card product-card avasam-card"><h3>No Avasam products found</h3><p>Try a different search or clear the filters.</p></article>`;
    updateUniversalNoResults();
    return;
  }
  target.innerHTML = productList.map((product) => `
    <article class="card product-card avasam-card">
      <div class="product-image">${productImageMarkup(product)}</div>
      <p class="tag">${product.category}</p>
      <h3>${product.name}</h3>
      <p>${product.description}</p>
      <p class="price">${productPriceText(product)}</p>
      <div class="supplier meta">
        <span>Supplier: ${product.supplier}</span>
        <span>Status: ${product.status}</span>
      </div>
      <div class="commerce-bar">
        <button class="btn btn-primary" type="button" data-avasam-buy="${escapeAttr(product.id)}">Buy</button>
      </div>
    </article>
  `).join("");
  updateUniversalNoResults();
}

function homeAvasamProductMarkup(product) {
  const productId = escapeAttr(product.id);
  const productLink = `product.html?id=${encodeURIComponent(product.publicId || productHandle(product.name, ""))}`;
  const available = !/out of stock|unavailable/i.test(String(product.status || ""));
  const delivery = String(product.delivery || "").trim();
  return `
    <article class="home-product-card" data-product-key="${productId}">
      <a class="home-product-image" href="${escapeAttr(productLink)}">${productImageMarkup(product)}</a>
      <div class="home-product-content">
        <span>Avasam</span>
        <h3><a href="${escapeAttr(productLink)}">${escapeSvg(product.name)}</a></h3>
        <p class="home-product-price">${escapeSvg(productPriceText(product))}</p>
        <p class="home-product-availability">${escapeSvg(product.status || "Availability unavailable")}</p>
        ${delivery ? `<p class="home-product-delivery">${escapeSvg(delivery)}</p>` : ""}
        <div class="home-product-actions">
          <a class="product-link" href="${escapeAttr(productLink)}">View product</a>
          ${available ? `<button class="btn btn-primary" type="button" data-avasam-buy="${productId}">Add to basket</button>` : `<button class="btn btn-primary" type="button" disabled aria-disabled="true">Unavailable</button>`}
        </div>
      </div>
    </article>
  `;
}

function renderHomeAvasamProducts() {
  const target = document.querySelector("[data-home-bingo-products]");
  if (!target) return;
  const products = avasamState.live
    ? avasamProducts.filter((product) => product.image && !String(product.image).startsWith("data:image/svg+xml")).slice(0, 6)
    : [];
  target.innerHTML = products.length
    ? products.map(homeAvasamProductMarkup).join("")
    : `<p class="home-products-status">Current shop essentials will appear here when the live catalogue is available.</p>`;
}

function avasamCategories() {
  return [...new Set(avasamProducts.map((product) => product.category))];
}

function filteredAvasamProducts() {
  const terms = normalizedProductSearch(avasamFilters.search);
  return avasamProducts.filter((product) => {
    const matchesCategory = terms.length ? true : !avasamFilters.category || product.category === avasamFilters.category;
    const searchable = [product.name, product.category, product.description, product.supplier, product.status, "dog pet"].join(" ").toLowerCase();
    const matchesSearch = !terms.length || terms.every((term) => searchable.includes(term));
    return matchesCategory && matchesSearch;
  });
}

function updateUniversalNoResults() {
  const target = document.querySelector("[data-universal-no-results]");
  if (!target) return;
  const hasSearch = Boolean(shopFilters.search.trim());
  target.hidden = !hasSearch || Boolean(filteredProducts().length);
}

function renderAvasamCategories() {
  const select = document.querySelector("[data-avasam-category]");
  const list = document.querySelector("[data-avasam-categories]");
  const categories = avasamCategories();
  if (select) {
    select.innerHTML = `<option value="">All Avasam categories</option>` + categories.map((category) => `<option value="${category}">${category}</option>`).join("");
    select.value = avasamFilters.category;
  }
  if (list) {
    list.innerHTML = [`<button class="chip ${avasamFilters.category === "" ? "is-active" : ""}" type="button" data-avasam-category-button="">All</button>`]
      .concat(categories.map((category) => `<button class="chip ${avasamFilters.category === category ? "is-active" : ""}" type="button" data-avasam-category-button="${category}">${category}</button>`))
      .join("");
  }
}

function initShopFilters() {
  const select = document.querySelector("[data-category-select]");
  const clear = document.querySelector("[data-clear-filters]");
  if (!select) return;

  select?.addEventListener("change", () => {
    shopFilters.category = select.value;
    renderCategories();
    renderProducts();
  });

  document.querySelector("[data-categories]")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category-button]");
    if (!button) return;
    shopFilters.category = button.dataset.categoryButton || "";
    renderCategories();
    renderProducts();
  });

  clear?.addEventListener("click", () => {
    shopFilters.category = "";
    renderCategories();
    renderProducts();
  });
}

function initAvasamFilters() {
  const select = document.querySelector("[data-avasam-category]");
  const clear = document.querySelector("[data-clear-avasam-filters]");
  const categoryList = document.querySelector("[data-avasam-categories]");
  if (!select && !categoryList) return;

  select?.addEventListener("change", () => {
    avasamFilters.category = select.value;
    renderAvasamCategories();
    renderAvasamProducts();
  });

  categoryList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-avasam-category-button]");
    if (!button) return;
    avasamFilters.category = button.dataset.avasamCategoryButton || "";
    renderAvasamCategories();
    renderAvasamProducts();
  });

  clear?.addEventListener("click", () => {
    avasamFilters.category = "";
    renderAvasamCategories();
    renderAvasamProducts();
  });
}

function initUniversalProductSearch() {
  const search = document.querySelector("[data-universal-product-search]");
  const clear = document.querySelector("[data-clear-universal-search]");
  if (!search) return;

  const applySearch = () => {
    shopFilters.search = search.value;
    avasamFilters.search = search.value;
    renderProducts();
    scheduleEbayProducts();
  };

  search.addEventListener("input", applySearch);

  clear?.addEventListener("click", () => {
    search.value = "";
    shopFilters.search = "";
    avasamFilters.search = "";
    renderProducts();
    scheduleEbayProducts();
  });
}

function renderProductDetail() {
  const target = document.querySelector("[data-product-detail]");
  if (!target) return;
  const id = new URLSearchParams(location.search).get("id") || products[0].id;
  const product = allProducts().find((item) => publicProductId(item) === id) || products[0];
  target.innerHTML = `
    <div class="card">
      <div class="product-image product-image-large">${productImageMarkup(product)}</div>
    </div>
    <div class="card">
      <p class="tag">${product.category}</p>
      <h1>${product.name}</h1>
      <p class="lead">${product.description}</p>
      <p class="price">${productPriceText(product)}</p>
      ${productDetailInfoMarkup(product)}
      <div class="button-row">
        <button class="btn btn-primary" type="button" data-add="${product.id}">Add to Cart</button>
        ${product.externalUrl ? `<a class="btn btn-secondary" href="${product.externalUrl}" target="_blank" rel="${productExternalRel(product)}">${product.paymentProvider === "Stripe" ? "Pay with Stripe" : productActionLabel(product)}</a>` : `<button class="btn btn-secondary" type="button" data-buy-now="${product.id}">Buy Now</button>`}
      </div>
    </div>
  `;
}

function cartProductRows(items) {
  const counts = items.reduce((map, item) => {
    map[item.id] = (map[item.id] || 0) + 1;
    return map;
  }, {});

  return [...new Set(items.map((item) => item.id))]
    .map((id) => ({ product: items.find((item) => item.id === id), quantity: counts[id] }))
    .filter((row) => row.product);
}

function cartLineTotal(product, quantity) {
  return product.price ? product.price * quantity : 0;
}

function cartOrderSummary(rows) {
  return rows.map(({ product, quantity }) => {
    const lineTotal = cartLineTotal(product, quantity);
    return `${quantity} x ${product.name} | ${productSource(product)} | ${productPriceText(product)}${lineTotal ? ` | Line total: ${gbpFormatter.format(lineTotal)}` : ""}`;
  }).join("\n");
}

function directCheckoutRows() {
  const basket = cleanBasket();
  const items = basket
    .map((id) => basketProductById(id))
    .filter(Boolean);
  return cartProductRows(items).filter(({ product }) => !product.externalUrl);
}

async function submitProductCheckout(form) {
  const message = form.querySelector("[data-checkout-message]");
  const submit = form.querySelector("button[type='submit']");
  const originalText = submit?.dataset.checkoutButtonLabel || submit?.textContent || "Pay with Stripe";
  const rows = directCheckoutRows();
  const showCheckoutMessage = (text) => {
    if (!message) return;
    message.hidden = false;
    message.textContent = text;
  };

  if (!rows.length) {
    showCheckoutMessage("Your basket has no products ready for Stripe checkout.");
    return;
  }

  if (submit) {
    submit.disabled = true;
    submit.textContent = "Opening secure Stripe checkout...";
  }
  showCheckoutMessage("Checking your basket and opening Stripe...");

  const data = Object.fromEntries(new FormData(form).entries());
  const payload = {
    name: data.name,
    email: data.email,
    telephone: data.telephone,
    delivery_address: data.delivery_address,
    message: data.message,
    items: rows.map(({ product, quantity }) => ({ id: product.id, quantity }))
  };
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(productCheckoutWorkerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const result = await response.json().catch(() => ({}));
    const checkoutUrl = result.paymentUrl || result.url || result.checkoutUrl || result.session?.url;
    if (!response.ok || !result.ok || !checkoutUrl) {
      throw new Error(result.error || "Stripe checkout could not open yet.");
    }
    showCheckoutMessage("Stripe checkout is opening now...");
    window.location.assign(checkoutUrl);
  } catch (error) {
    const detail = error.name === "AbortError"
      ? "Stripe checkout took too long to answer."
      : error.message;
    showCheckoutMessage(`${detail} Please check the Cloudflare checkout Worker and Stripe secret key, then try again.`);
    if (submit) {
      submit.disabled = false;
      submit.textContent = originalText;
    }
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function cartRowsMarkup(rows) {
  return rows.map(({ product, quantity }) => `
    <div class="row cart-row">
      <div class="cart-product">
        <div class="cart-product-image">${productImageMarkup(product)}</div>
        <div>
          <strong>${product.name}</strong>
          <span>${product.category}</span>
        </div>
      </div>
      <span>Qty ${quantity}</span>
      <span>${productPriceText(product)}</span>
      <span class="tag">${product.paymentProvider === "Stripe" ? "Stripe checkout" : (product.externalUrl ? "External checkout" : (product.status || "Order request"))}</span>
      <div class="admin-row-actions">
        ${product.externalUrl ? `<a class="btn btn-secondary" href="${product.externalUrl}" target="_blank" rel="${productExternalRel(product)}">${product.paymentProvider === "Stripe" ? "Pay with Stripe" : productActionLabel(product)}</a>` : `<a class="btn btn-light" href="product.html?id=${encodeURIComponent(product.id)}">View product</a>`}
        <button class="btn btn-light" type="button" data-remove-cart="${product.id}">Remove</button>
      </div>
    </div>
  `).join("");
}

function renderCart() {
  const target = document.querySelector("[data-cart]");
  if (!target) return;

  const basket = cleanBasket();
  const items = basket
    .map((id) => basketProductById(id))
    .filter(Boolean);
  const rows = cartProductRows(items);
  const stripeRows = rows.filter(({ product }) => product.paymentProvider === "Stripe");
  const partnerRows = rows.filter(({ product }) => product.externalUrl && product.paymentProvider !== "Stripe");
  const directRows = rows.filter(({ product }) => !product.externalUrl);
  const directTotal = directRows.reduce((sum, row) => sum + cartLineTotal(row.product, row.quantity), 0);
  const allSummary = cartOrderSummary(rows);
  const directSummary = cartOrderSummary(directRows);

  if (!items.length) {
    target.innerHTML = `<div class="checkout-placeholder"><div><h3>Your cart is empty.</h3><p>Add products from the shop to review checkout options.</p><a class="btn btn-primary" href="shop.html">Go to Shop</a></div></div>`;
    return;
  }

  target.innerHTML = `
    <section class="checkout-grid">
      <div class="dashboard-list">
        ${stripeRows.length ? `
          <article class="card checkout-section">
            <p class="tag">Stripe payment</p>
            <h2>Dog wash payment</h2>
            <p>Pay online securely with Stripe. Stripe may show the payment link as paused until your business verification is complete.</p>
            <div class="dashboard-list">${cartRowsMarkup(stripeRows)}</div>
          </article>
        ` : ""}
        ${directRows.length ? `
          <article class="card checkout-section">
            <p class="tag">Bingo checkout</p>
            <h2>Direct order items</h2>
            <p>These items can be paid for securely with Stripe. Bingo Dog Wash also gets the order details by email.</p>
            <div class="dashboard-list">${cartRowsMarkup(directRows)}</div>
          </article>
        ` : ""}
        ${partnerRows.length ? `
          <article class="card checkout-section">
            <p class="tag">Affiliate checkout</p>
            <h2>Partner checkout items</h2>
            <p>These products are paid for on the partner website. Your affiliate tracking links stay separate from Bingo Dog Wash direct checkout.</p>
            <div class="dashboard-list">${cartRowsMarkup(partnerRows)}</div>
          </article>
        ` : ""}
      </div>
      <aside class="card checkout-summary">
        <p class="tag">Order review</p>
        <h2>Checkout summary</h2>
        <div class="mini-row"><strong>Basket items</strong><span>${items.length}</span></div>
        <div class="mini-row"><strong>Direct total</strong><span>${gbpFormatter.format(directTotal)}</span></div>
        <div class="mini-row"><strong>Payment status</strong><span>${directRows.length ? "Stripe product payment available" : (stripeRows.length ? "Stripe payment link connected" : "No direct payment needed")}</span></div>
        ${directRows.length ? `
          <form class="form checkout-form" data-product-checkout>
            <input type="hidden" name="direct_total" value="${gbpFormatter.format(directTotal)}">
            <textarea class="hidden-field" name="order_summary">${directSummary}</textarea>
            <p class="hidden-field"><label>Do not fill this in<input name="bot-field"></label></p>
            <label>Name<input name="name" autocomplete="name" required></label>
            <label>Email<input name="email" type="email" autocomplete="email" required></label>
            <label>Telephone<input name="telephone" type="tel" autocomplete="tel"></label>
            <label>Delivery address<textarea name="delivery_address" required></textarea></label>
            <label>Notes<textarea name="message" placeholder="Any delivery notes or product questions"></textarea></label>
            <button class="btn btn-primary" type="submit" data-checkout-button-label="Pay ${gbpFormatter.format(directTotal)} with Stripe">Pay ${gbpFormatter.format(directTotal)} with Stripe</button>
            <p class="small-note">This opens secure Stripe checkout for the basket total and sends Bingo Dog Wash the order details.</p>
            <p class="small-note checkout-message" data-checkout-message hidden></p>
          </form>
        ` : `
          <p>There are no direct checkout items in your basket. Use the partner buttons to buy affiliate products.</p>
        `}
        <div class="button-row">
          <a class="btn btn-secondary" href="shop.html">Continue Shopping</a>
          <button class="btn btn-light" type="button" data-clear-cart>Clear Cart</button>
        </div>
        <details class="order-summary-copy">
          <summary>View order summary</summary>
          <pre>${allSummary}</pre>
        </details>
      </aside>
    </section>
  `;
}

function storedJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch (error) {
    return fallback;
  }
}

function setAccountMessage(message) {
  const target = document.querySelector("[data-account-message]");
  if (!target) return;
  target.textContent = message;
  target.hidden = false;
}

function productLineMarkup(product) {
  return `
    <div class="mini-row account-product-row">
      <strong>${product?.name || "Product unavailable"}</strong>
      <span>${product ? `${productSource(product)} · ${productPriceText(product)}` : "Please check the shop"}</span>
    </div>
  `;
}

function renderAccount() {
  const summaryTarget = document.querySelector("[data-account-summary]");
  if (!summaryTarget) return;

  const account = storedJson("bingoAccount", {});
  const address = storedJson("bingoAddress", {});
  const storedOrders = storedJson("bingoOrders", []);
  const storedWishlist = storedJson("bingoWishlist", []);
  const orders = Array.isArray(storedOrders) ? storedOrders : [];
  const wishlist = Array.isArray(storedWishlist) ? storedWishlist : [];
  const basket = cleanBasket();

  const greeting = document.querySelector("[data-account-greeting]");
  const state = document.querySelector("[data-account-state]");
  if (greeting) greeting.textContent = account.name ? `Welcome back, ${account.name}` : "Save your details";
  if (state) state.textContent = account.email ? "Account saved" : "Customer profile";

  summaryTarget.innerHTML = `
    <div class="mini-row"><strong>Name</strong><span>${escapeSvg(account.name || "Not saved yet")}</span></div>
    <div class="mini-row"><strong>Email</strong><span>${escapeSvg(account.email || "Not saved yet")}</span></div>
    <div class="mini-row"><strong>Telephone</strong><span>${escapeSvg(account.phone || "Not saved yet")}</span></div>
    <div class="mini-row"><strong>Address</strong><span>${escapeSvg(address.address ? `${address.address}, ${address.city || ""} ${address.postcode || ""}` : "Not saved yet")}</span></div>
    <div class="mini-row"><strong>Preferred location</strong><span>${escapeSvg(address.location || "Not saved yet")}</span></div>
  `;

  const orderTarget = document.querySelector("[data-account-orders]");
  if (orderTarget) {
    const orderMarkup = orders.length ? orders.map((order) => {
      const itemIds = Array.isArray(order?.items) ? order.items : [];
      const productsForOrder = itemIds.map((id) => allProducts().find((product) => product.id === id) || cachedBasketProduct(id)).filter(Boolean);
      const total = productsForOrder.reduce((sum, product) => sum + (product.price || 0), 0);
      return `<div class="mini-row"><strong>${order.date}</strong><span>${productsForOrder.length} items · ${gbpFormatter.format(total)}</span></div>`;
    }).join("") : `<div class="mini-row"><strong>No saved orders yet</strong><span>${basket.length ? "Use Save Basket as Order to store this basket here." : "Add products to your basket first."}</span></div>`;
    orderTarget.innerHTML = orderMarkup;
  }

  const wishlistTarget = document.querySelector("[data-account-wishlist]");
  if (wishlistTarget) {
    const wishlistProducts = wishlist.map((id) => allProducts().find((product) => product.id === id)).filter(Boolean);
    wishlistTarget.innerHTML = wishlistProducts.length
      ? wishlistProducts.map(productLineMarkup).join("")
      : `<div class="mini-row"><strong>No saved products yet</strong><span>Add products to basket, then save them to your wishlist.</span></div>`;
  }

  const subscriptionTarget = document.querySelector("[data-account-subscriptions]");
  if (subscriptionTarget) {
    subscriptionTarget.innerHTML = `
      <div class="mini-row"><strong>Dog care membership</strong><span>Not active yet</span></div>
      <div class="mini-row"><strong>Subscription boxes</strong><span>Ask Bingo Dog Wash to set one up</span></div>
    `;
  }
}

function initAccount() {
  const profileForm = document.querySelector("[data-account-profile-form]");
  const addressForm = document.querySelector("[data-account-address-form]");
  if (!profileForm && !addressForm) return;

  const account = storedJson("bingoAccount", {});
  const address = storedJson("bingoAddress", {});
  Object.entries(account).forEach(([key, value]) => {
    if (profileForm?.elements[key]) profileForm.elements[key].value = value;
  });
  Object.entries(address).forEach(([key, value]) => {
    if (addressForm?.elements[key]) addressForm.elements[key].value = value;
  });

  profileForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(profileForm).entries());
    localStorage.setItem("bingoAccount", JSON.stringify(data));
    setAccountMessage("Account details saved on this device.");
    renderAccount();
  });

  addressForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(addressForm).entries());
    localStorage.setItem("bingoAddress", JSON.stringify(data));
    setAccountMessage("Delivery details saved on this device.");
    renderAccount();
  });

  document.querySelector("[data-account-signout]")?.addEventListener("click", () => {
    localStorage.removeItem("bingoAccount");
    localStorage.removeItem("bingoAddress");
    profileForm?.reset();
    addressForm?.reset();
    setAccountMessage("Account details cleared from this device.");
    renderAccount();
  });

  document.querySelector("[data-save-basket-order]")?.addEventListener("click", () => {
    const basket = cleanBasket();
    if (!basket.length) {
      setAccountMessage("Your basket is empty. Add products before saving an order.");
      return;
    }
    const orders = storedJson("bingoOrders", []);
    orders.unshift({ date: new Date().toLocaleDateString("en-GB"), items: basket });
    localStorage.setItem("bingoOrders", JSON.stringify(orders.slice(0, 8)));
    setAccountMessage("Basket saved to order history.");
    renderAccount();
  });

  document.querySelector("[data-save-basket-wishlist]")?.addEventListener("click", () => {
    const basket = cleanBasket();
    if (!basket.length) {
      setAccountMessage("Your basket is empty. Add products before saving a wishlist.");
      return;
    }
    const wishlist = [...new Set(storedJson("bingoWishlist", []).concat(basket))];
    localStorage.setItem("bingoWishlist", JSON.stringify(wishlist));
    setAccountMessage("Basket products saved to wishlist.");
    renderAccount();
  });

  document.querySelector("[data-clear-wishlist]")?.addEventListener("click", () => {
    localStorage.removeItem("bingoWishlist");
    setAccountMessage("Wishlist cleared.");
    renderAccount();
  });
}

function sourceStatusText(state, loadedCount) {
  if (state.loading) return "Loading";
  if (state.error) return "Temporarily unavailable";
  if (state.live) return "Live feed connected";
  return loadedCount ? "Connected" : "No products";
}

function initShopGreeting() {
  const target = document.querySelector("[data-shop-greeting]");
  if (!target) return;

  const account = storedJson("bingoAccount", {});
  const firstName = String(account.name || "").trim().split(/\s+/)[0].slice(0, 40);
  if (!firstName) return;

  target.textContent = `Hello, ${firstName}! Welcome back.`;
  target.hidden = false;
}

function adminPublicBasePath() {
  const path = location.pathname.replace(/\\/g, "/").toLowerCase();
  return path.includes("/admin/") ? "../" : "";
}

function adminPublicUrl(page) {
  return `${adminPublicBasePath()}${page}`;
}

function publicProductId(product) {
  if (!product || typeof product !== "object") return "";
  const identifier = product.id?.startsWith("avasam-")
    ? product.publicId
    : firstValue(product.publicId, product.publicSlug, product.slug, product.id);
  return productHandle(identifier, "");
}

function adminViewPublicControl(product) {
  const identifier = publicProductId(product);
  if (!identifier) {
    return `<button class="btn btn-light" type="button" disabled>Public page unavailable</button>`;
  }
  return `<a class="btn btn-light" href="${adminPublicUrl(`product?id=${encodeURIComponent(identifier)}`)}">View public</a>`;
}

function wireAdminPublicLinks() {
  document.querySelectorAll("[data-public-page]").forEach((link) => {
    link.href = adminPublicUrl(link.dataset.publicPage);
  });
}

function renderAdminProducts() {
  const sourceTarget = document.querySelector("[data-admin-source-summary]");
  const productTarget = document.querySelector("[data-admin-product-feed]");
  if (!sourceTarget && !productTarget) return;

  const amazonProducts = amazonAffiliateProducts();
  const stripeProducts = products.filter((product) => product.paymentProvider === "Stripe");
  const directProducts = publicShopProducts().filter(isDirectCheckoutProduct);
  const externalProducts = publicShopProducts().filter(isExternalSupplierProduct);
  const sources = [
    {
      name: "Stripe payments",
      count: stripeProducts.length,
      channel: "Bingo direct checkout",
      status: "Cart Worker connected",
      detail: "Product checkout uses bingo-checkout.bingowash.workers.dev. Dog wash keeps the live Stripe payment link.",
      page: "product.html?id=self-service-dog-wash"
    },
    {
      name: "Amazon affiliate",
      count: amazonProducts.length,
      channel: "External supplier link",
      status: "Tracking active",
      detail: "External checkout links use bingodogwash3-21.",
      page: "shop.html"
    },
    {
      name: "eBay UK",
      count: ebayProducts.length,
      channel: "External supplier link",
      status: sourceStatusText(ebayState, ebayProducts.length),
      detail: "Live eBay Browse API products use campaign 5339164469 and open external eBay checkout.",
      page: "shop.html"
    },
    {
      name: "Etsy affiliate",
      count: etsyProducts.length,
      channel: "External supplier link",
      status: sourceStatusText(etsyState, etsyProducts.length),
      detail: `${etsyFeedUrl} feeds external Etsy listings into the Shop page.`,
      page: "shop.html"
    },
    {
      name: "Avasam",
      count: avasamProducts.length,
      channel: "Bingo direct checkout",
      status: sourceStatusText(avasamState, avasamProducts.length),
      detail: `${avasamFeedUrl} feeds supplier fulfilled products into Bingo checkout.`,
      page: "shop.html"
    }
  ];

  if (sourceTarget) {
    sourceTarget.innerHTML = sources.map((source) => `
      <article class="card admin-source-card ${source.channel === "Bingo direct checkout" ? "admin-source-direct" : "admin-source-external"}">
        <div class="product-tags">
          <p class="tag">${source.channel}</p>
          <p class="tag tag-muted">${source.status}</p>
        </div>
        <h3>${source.name}</h3>
        <strong>${source.count} products</strong>
        <p>${source.detail}</p>
        <a class="btn btn-light" href="${adminPublicUrl(source.page)}">View in public shop</a>
      </article>
    `).join("");
  }

  if (productTarget) {
    const adminProductRows = (productList) => productList.map((product) => `
      <div class="row admin-row admin-product-row">
        <strong>${product.name}</strong>
        <span data-view>${product.category}</span>
        <input data-edit value="${escapeAttr(product.category || "")}" aria-label="${escapeAttr(product.name)} category">
        <span data-view>${productPriceText(product)}</span>
        <input data-edit value="${escapeAttr(productPriceText(product))}" aria-label="${escapeAttr(product.name)} price">
        <span data-view>${productSource(product)}</span>
        <input data-edit value="${escapeAttr(productSource(product))}" aria-label="${escapeAttr(product.name)} source">
        <span class="tag" data-view>${productShopChannel(product)}</span>
        <select data-edit aria-label="${escapeAttr(product.name)} channel">
          <option${productShopChannel(product) === "Bingo direct checkout" ? " selected" : ""}>Bingo direct checkout</option>
          <option${productShopChannel(product) === "External supplier link" ? " selected" : ""}>External supplier link</option>
        </select>
        <span class="tag tag-muted" data-view>${product.status || (product.externalUrl ? "External checkout" : "Basket product")}</span>
        <input data-edit value="${escapeAttr(product.status || (product.externalUrl ? "External checkout" : "Basket product"))}" aria-label="${escapeAttr(product.name)} status">
        <div class="admin-row-actions">
          ${adminViewPublicControl(product)}
          ${product.externalUrl ? `<a class="btn btn-secondary" href="${product.externalUrl}" target="_blank" rel="${productExternalRel(product)}">${product.paymentProvider === "Stripe" ? "Payment link" : productActionLabel(product)}</a>` : `<a class="btn btn-secondary" href="${adminPublicUrl("shop.html")}">Shop grid</a>`}
        </div>
      </div>
    `).join("");

    productTarget.innerHTML = `
      <div class="admin-product-group">
        <h3>Bingo-Owned and Direct Checkout</h3>
        <p>${directProducts.length} products stay in Bingo checkout or direct Bingo payment flows.</p>
        ${adminProductRows(directProducts)}
      </div>
      <div class="admin-product-group admin-product-group-external">
        <h3>External Supplier Links</h3>
        <p>${externalProducts.length} products send customers to partner or affiliate checkout pages.</p>
        ${adminProductRows(externalProducts)}
      </div>
    `;
  }
}

function initAdminEditMode() {
  const toggle = document.querySelector("[data-admin-edit-toggle]");
  if (!toggle) return;

  const status = document.querySelector("[data-admin-status]");
  const save = document.querySelector("[data-admin-save]");
  const cancel = document.querySelector("[data-admin-cancel]");
  const rows = Array.from(document.querySelectorAll(".admin-row"));
  const originalValues = rows.map((row) =>
    Array.from(row.querySelectorAll("[data-edit]")).map((field) => field.value)
  );

  const setMode = (editing) => {
    document.body.classList.toggle("admin-editing", editing);
    toggle.textContent = editing ? "Exit Edit Mode" : "Edit Mode";
    if (status) status.textContent = editing ? "Edit mode active" : "View mode";
  };

  toggle.addEventListener("click", () => {
    setMode(!document.body.classList.contains("admin-editing"));
  });

  save?.addEventListener("click", () => {
    rows.forEach((row) => {
      const views = row.querySelectorAll("[data-view]");
      const fields = row.querySelectorAll("[data-edit]");
      fields.forEach((field, index) => {
        if (views[index]) views[index].textContent = field.value;
      });
    });
    setMode(false);
  });

  cancel?.addEventListener("click", () => {
    rows.forEach((row, rowIndex) => {
      row.querySelectorAll("[data-edit]").forEach((field, fieldIndex) => {
        field.value = originalValues[rowIndex][fieldIndex];
      });
    });
    setMode(false);
  });
}

function washBookingRows() {
  return storedJson(bingoBookingsKey, []);
}

function saveWashBooking(booking) {
  const bookings = washBookingRows();
  bookings.unshift(booking);
  localStorage.setItem(bingoBookingsKey, JSON.stringify(bookings.slice(0, 20)));
}

function stripeBookingUrl(baseUrl, booking) {
  try {
    const url = new URL(baseUrl);
    if (booking.id) url.searchParams.set("client_reference_id", booking.id);
    if (booking.email) url.searchParams.set("prefilled_email", booking.email);
    return url.toString();
  } catch (error) {
    return baseUrl;
  }
}

async function createPendingWashBooking(booking) {
  const response = await fetch(`${bookingApiBase}/api/bookings/pending`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(booking)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) {
    throw new Error(result.error || "Booking backend is not ready.");
  }
  return result;
}

async function createWashBookingCheckout(booking) {
  const response = await fetch(`${bookingApiBase}/api/bookings/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: booking.name,
      email: booking.email,
      telephone: booking.telephone,
      dogName: booking.dogName || booking.dog_name,
      notes: booking.notes,
      bookingReference: booking.bookingReference
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok || !result.paymentUrl) {
    throw new Error(result.error || "Stripe Checkout could not be opened.");
  }
  return result;
}

function initWashBooking() {
  const form = document.querySelector("[data-wash-booking-form]");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = form.querySelector("button[type='submit']");
    const originalText = submit?.textContent;
    const data = Object.fromEntries(new FormData(form).entries());
    const message = document.querySelector("[data-wash-booking-message]");

    if (submit) {
      submit.disabled = true;
      submit.textContent = "Opening secure Stripe payment...";
    }

    try {
      const result = await createPendingWashBooking(data);
      const checkout = await createWashBookingCheckout(result.booking);
      window.location.href = checkout.paymentUrl;
    } catch (error) {
      window.location.href = stripeBookingUrl(stripeDogWashPaymentLink, { email: data.email });
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent = originalText;
      }
    }
  });
}

function bookingCreatedText(booking) {
  const rawDate = booking.createdAt || booking.created;
  if (!rawDate) return "Date not saved";
  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return rawDate;
  return date.toLocaleString("en-GB");
}

function bookingRowMarkup(booking) {
  const name = escapeSvg(booking.name || "Customer");
  const dogName = escapeSvg(booking.dog_name || booking.dogName || "Dog wash");
  const status = escapeSvg(booking.status || "Pending");
  const preferredTime = escapeSvg(booking.preferred_time || booking.preferredTime || booking.time || "Time not saved");
  const price = escapeSvg(booking.price || "£10.00");
  return `
    <div class="admin-booking-row">
      <div>
        <strong>${name} - ${dogName}</strong>
        <span>${escapeSvg(bookingCreatedText(booking))} · ${preferredTime}</span>
      </div>
      <div>
        <span class="tag">${status}</span>
        <span>${price}</span>
      </div>
    </div>
  `;
}

async function loadBackendBookings() {
  const response = await fetch(`${adminBookingsApiBase}?limit=50`, {
    headers: { ...adminCoreHeaders(), Accept: "application/json" }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) {
    throw new Error(result.error || "Booking backend is not ready.");
  }
  return result.bookings || [];
}

async function renderAdminBookings() {
  const target = document.querySelector("[data-admin-bookings]");
  if (!target) return;

  target.innerHTML = `
    <div class="mini-row">
      <strong>Loading bookings</strong>
      <span>Checking Stripe booking storage...</span>
    </div>
  `;

  let backendMessage = "";
  let bookings = [];
  try {
    bookings = await loadBackendBookings();
  } catch (error) {
    backendMessage = error.message;
    bookings = [];
  }

  if (!bookings.length) {
    target.innerHTML = `
      <div class="mini-row">
        <strong>${backendMessage ? "Live bookings unavailable" : "No wash bookings yet"}</strong>
        <span>${backendMessage ? escapeSvg(backendMessage) : "Use the public Wash page to create a booking."}</span>
      </div>
      <div class="mini-row">
        <strong>Stripe webhook</strong>
        <span>${backendMessage ? "Unlock admin controls, then reload the live monitor." : "Connected and ready for paid bookings."}</span>
      </div>
    `;
    return;
  }

  target.innerHTML = `
    ${bookings.map(bookingRowMarkup).join("")}
  `;
}

async function handleAdminEtsyAction(action) {
  try {
    if (action === "connect") {
      const data = await adminCoreJson(etsyConnectApiUrl);
      window.open(data.connectUrl, "_blank", "noopener");
      return;
    }

    const endpointByAction = {
      test: `${adminEtsyApiBase}/test`,
      sync: `${adminEtsyApiBase}/sync`,
      retry: `${adminEtsyApiBase}/retry`,
      "enable-auto": `${adminEtsyApiBase}/automatic-sync`,
      "pause-auto": `${adminEtsyApiBase}/automatic-sync`,
      disconnect: `${adminEtsyApiBase}/disconnect`
    };
    if (action === "disconnect" && !window.confirm("Disconnect Etsy? Imported products will remain but tokens are removed.")) return;
    const body = action === "enable-auto" ? { enabled: true } : action === "pause-auto" ? { enabled: false } : {};
    await adminCoreJson(endpointByAction[action], { method: "POST", body: JSON.stringify(body) });
    await loadAdminEtsy();
  } catch (error) {
    window.alert(error.message || "Etsy action failed.");
  }
}

async function handleAdminEtsyProductAction(action) {
  const actionButton = document.querySelector(`[data-admin-etsy-product-action="${action}"]`);
  const selectedInputs = Array.from(document.querySelectorAll("[data-admin-etsy-product-id]:checked"));
  const ids = selectedInputs
    .map((input) => input.dataset.adminEtsyProductId || input.dataset.adminEtsyExternalListingId)
    .filter(Boolean);
  const isBingoAssign = action === "bingo-assign";
  const isBingoReplace = action === "bingo-replace";
  if (isBingoAssign || isBingoReplace) {
    const collection = document.querySelector("[data-admin-etsy-collection]")?.value || "";
    if (!collection) {
      window.alert("Choose a Bingo Dog Edit collection.");
      return;
    }
    if (isBingoAssign && !ids.length) {
      window.alert("Select at least one Etsy product to move.");
      return;
    }
    if (isBingoReplace && ids.length !== 2) {
      window.alert("Select exactly two Etsy products: first the published product to replace, then its replacement.");
      return;
    }
    const message = isBingoAssign
      ? `Move ${ids.length} selected Etsy product${ids.length === 1 ? "" : "s"} to ${collection}?`
      : `Replace the first selected Etsy product with the second in ${collection}?`;
    if (!window.confirm(message)) return;
    const originalLabel = actionButton?.textContent || "";
    try {
      if (actionButton) { actionButton.disabled = true; actionButton.textContent = isBingoAssign ? "Moving…" : "Replacing…"; }
      const body = isBingoAssign
        ? { ids, collection }
        : { removeId: ids[0], addId: ids[1], collection };
      const result = await adminCoreJson(`${adminEtsyApiBase}/products/${encodeURIComponent(action)}`, {
        method: "POST",
        body: JSON.stringify(body)
      });
      const status = document.querySelector("[data-admin-etsy-search-status]");
      if (status) status.textContent = isBingoAssign
        ? `${result.assigned || ids.length} Etsy product${ids.length === 1 ? "" : "s"} moved to ${collection}.`
        : `Published Etsy product replaced in ${collection}.`;
      await loadAdminEtsy();
    } catch (error) {
      window.alert(error.message || "Bingo Dog Edit update failed.");
    } finally {
      if (actionButton) { actionButton.disabled = false; actionButton.textContent = originalLabel; }
    }
    return;
  }
  if (action === "affiliate-verify-selected") {
    if (!ids.length) {
      window.alert("Select at least one Etsy product to verify.");
      return;
    }

    const originalLabel = actionButton?.textContent || "";
    let verified = 0;
    let failed = 0;

    try {
      if (actionButton) {
        actionButton.disabled = true;
        actionButton.textContent = "Verifying selected...";
      }

      for (const id of ids) {
        try {
          const result = await adminCoreJson(`${adminEtsyApiBase}/products/affiliate-verify`, {
            method: "POST",
            body: JSON.stringify({ id })
          });

          if (result.verificationStatus === "match") verified += 1;
          else failed += 1;
        } catch {
          failed += 1;
        }
      }

      window.alert(`${verified} verified / ${failed} not verified`);
      await loadAdminEtsy();
    } finally {
      if (actionButton) {
        actionButton.disabled = false;
        actionButton.textContent = originalLabel;
      }
    }
    return;
  }
  if (action === "affiliate-approve-selected") {
    if (!ids.length) {
      window.alert("Select at least one verified Etsy product to approve.");
      return;
    }

    if (!window.confirm("Approve the selected verified Etsy affiliate link(s)? This does not publish the products.")) {
      return;
    }

    const originalLabel = actionButton?.textContent || "";
    let approved = 0;
    let failed = 0;

    try {
      if (actionButton) {
        actionButton.disabled = true;
        actionButton.textContent = "Approving selected...";
      }

      for (const id of ids) {
        try {
          const result = await adminCoreJson(`${adminEtsyApiBase}/products/affiliate-approve`, {
            method: "POST",
            body: JSON.stringify({ id })
          });

          if (result.affiliateReviewStatus === "approved") approved += 1;
          else failed += 1;
        } catch {
          failed += 1;
        }
      }

      window.alert(`${approved} approved / ${failed} not approved`);
      await loadAdminEtsy();
    } finally {
      if (actionButton) {
        actionButton.disabled = false;
        actionButton.textContent = originalLabel;
      }
    }
    return;
  }
  const bulkAllAction = action === "affiliate-generate-verify" || action === "affiliate-approve-verified" || action === "publish-verified";
  if (!ids.length && !bulkAllAction) {
    window.alert("Select at least one Etsy product.");
    return;
  }
  if (action === "hide" && selectedInputs.every((input) => input.dataset.adminEtsyProductStatus === "hidden")) {
    const status = document.querySelector("[data-admin-etsy-search-status]");
    if (status) status.textContent = "Selected Etsy products are already hidden.";
    return;
  }

  if (action === "affiliate-approve-verified" && !window.confirm("Approve all Etsy affiliate products whose resolved destination listing ID exactly matches their original listing ID? Mismatches and unverified products will remain blocked.")) return;
  if ((action === "publish" || action === "publish-verified") && !window.confirm(action === "publish-verified" ? "Publish every currently verified and approved Etsy product? Unverified products will remain hidden." : "Publish selected Etsy products to the public shop?")) return;
  const originalLabel = actionButton?.textContent || "";
  try {
    if (actionButton) { actionButton.disabled = true; actionButton.textContent = action === "affiliate-generate-verify" ? "Generating and verifying…" : (action === "affiliate-approve-verified" ? "Approving verified matches…" : "Publishing verified products…"); }
    let afterId = "";
    const totals = { processed: 0, verified: 0, needsReview: 0, approved: 0, failed: 0, skipped: 0, published: 0, blocked: 0, mismatch: 0, missingDestination: 0, invalidAffiliate: 0 };
    let result;
    do {
      result = await adminCoreJson(`${adminEtsyApiBase}/products/${encodeURIComponent(action)}`, {
        method: "POST",
        body: JSON.stringify({ ids, afterId })
      });
      Object.keys(totals).forEach((key) => { totals[key] += Number(result[key] || 0); });
      afterId = result.nextAfterId || "";
      if (actionButton && !ids.length && result.hasMore) actionButton.textContent = `Processed ${totals.processed || totals.published + totals.blocked}…`;
    } while (!ids.length && result.hasMore && afterId);
    if (bulkAllAction) window.alert(action === "affiliate-generate-verify"
      ? `${totals.verified} verified / ${totals.needsReview} need review / ${totals.failed} failed`
      : (action === "affiliate-approve-verified"
        ? `${totals.approved} exact matches approved / ${totals.blocked} blocked\nProcessed: ${totals.processed} / mismatch: ${totals.mismatch} / missing destination: ${totals.missingDestination} / invalid affiliate: ${totals.invalidAffiliate} / failed: ${totals.failed}`
        : `${totals.published} verified Etsy products published / ${totals.blocked} blocked`));
    await loadAdminEtsy();
    if (action === "hide") {
      const status = document.querySelector("[data-admin-etsy-search-status]");
      if (status) status.textContent = `${ids.length} Etsy product${ids.length === 1 ? "" : "s"} hidden`;
    }
    await loadEtsyProducts({ silent: true });
  } catch (error) {
    window.alert(error.message || "Etsy product action failed.");
  } finally {
    if (actionButton) { actionButton.disabled = false; actionButton.textContent = originalLabel; }
  }
}

async function handleAdminPageAction(pageId, action) {
  if (action === "pause" && !window.confirm("Pause this page? It will be removed from public navigation, but not deleted.")) return;
  const body = action === "pause" ? { confirm: true } : {};
  try {
    await adminCoreJson(`${adminPagesApiBase}/${encodeURIComponent(pageId)}/${encodeURIComponent(action)}`, {
      method: "POST",
      body: JSON.stringify(body)
    });
    await loadAdminPages();
  } catch (error) {
    window.alert(error.message || "Page action failed.");
  }
}

document.addEventListener("click", (event) => {
  const avasamBuy = event.target.closest("[data-avasam-buy]");
  if (avasamBuy) {
    const id = avasamBuy.dataset.avasamBuy;
    const product = avasamProducts.find((item) => item.id === id);
    if (!product) return;
    let basket = [];
    try {
      const savedBasket = JSON.parse(localStorage.getItem("bingoBasket") || "[]");
      if (Array.isArray(savedBasket)) basket = savedBasket;
    } catch {}
    basket.push(id);
    localStorage.setItem("bingoBasket", JSON.stringify(basket));
    cacheBasketProduct(product);
    location.href = "cart.html";
    return;
  }

  const copyGiftCard = event.target.closest("[data-copy-gift-card]");
  if (copyGiftCard) {
    navigator.clipboard?.writeText(copyGiftCard.dataset.copyGiftCard);
    copyGiftCard.textContent = "Copied";
    return;
  }

  const redeemGiftCard = event.target.closest("[data-redeem-gift-card]");
  if (redeemGiftCard) {
    const amount = window.prompt("Redeem amount in pounds, for example 10.00");
    if (!amount) return;
    const reference = window.prompt("Reference or note for this redemption", "Admin redemption") || "";
    adminGiftCardAction(redeemGiftCard.dataset.redeemGiftCard, "redeem", { amount, reference })
      .then(loadAdminGiftCards)
      .catch((error) => window.alert(error.message));
    return;
  }

  const cancelGiftCard = event.target.closest("[data-cancel-gift-card]");
  if (cancelGiftCard) {
    if (!window.confirm("Cancel this gift card?")) return;
    adminGiftCardAction(cancelGiftCard.dataset.cancelGiftCard, "cancel")
      .then(loadAdminGiftCards)
      .catch((error) => window.alert(error.message));
    return;
  }

  const reactivateGiftCard = event.target.closest("[data-reactivate-gift-card]");
  if (reactivateGiftCard) {
    if (!window.confirm("Reactivate this gift card?")) return;
    adminGiftCardAction(reactivateGiftCard.dataset.reactivateGiftCard, "reactivate")
      .then(loadAdminGiftCards)
      .catch((error) => window.alert(error.message));
    return;
  }

  const resendGiftCard = event.target.closest("[data-resend-gift-card]");
  if (resendGiftCard) {
    if (!window.confirm("Resend the gift card email?")) return;
    adminGiftCardAction(resendGiftCard.dataset.resendGiftCard, "resend")
      .then(() => window.alert("Gift card email resend requested."))
      .catch((error) => window.alert(error.message));
    return;
  }

  const etsyAction = event.target.closest("[data-admin-etsy-action]");
  if (etsyAction) {
    handleAdminEtsyAction(etsyAction.dataset.adminEtsyAction);
    return;
  }

  const etsyProductAction = event.target.closest("[data-admin-etsy-product-action]");
  if (etsyProductAction) {
    handleAdminEtsyProductAction(etsyProductAction.dataset.adminEtsyProductAction);
    return;
  }

  const importEtsyListing = event.target.closest("[data-admin-etsy-import]");
  if (importEtsyListing) {
    importAdminEtsyListing();
    return;
  }

  const clearEtsySearch = event.target.closest("[data-admin-etsy-search-clear]");
  if (clearEtsySearch) {
    const input = document.querySelector("[data-admin-etsy-search] [name='query']");
    if (input) input.value = "";
    searchAdminEtsyProducts();
    return;
  }

  const pageAction = event.target.closest("[data-admin-page-action]");
  if (pageAction) {
    handleAdminPageAction(pageAction.dataset.adminPageId, pageAction.dataset.adminPageAction);
    return;
  }

  const checkoutSubmit = event.target.closest("[data-product-checkout] button[type='submit']");
  if (checkoutSubmit) {
    const form = checkoutSubmit.closest("[data-product-checkout]");
    const message = form?.querySelector("[data-checkout-message]");
    if (form && !form.checkValidity()) {
      if (message) {
        message.hidden = false;
        message.textContent = "Please fill in your name, email and delivery address before opening Stripe.";
      }
      form.reportValidity();
    }
  }
  const buyNow = event.target.closest("[data-buy-now]");
  if (buyNow) {
    if (addToBasket(buyNow.dataset.buyNow)) {
      location.href = "cart.html";
    }
    return;
  }
  const button = event.target.closest("[data-add]");
  if (button) {
    addToBasket(button.dataset.add);
    if (button.textContent.trim().toLowerCase().includes("buy")) {
      location.href = "cart.html";
    }
  }
  const removeCart = event.target.closest("[data-remove-cart]");
  if (removeCart) {
    const basket = cleanBasket();
    const index = basket.indexOf(removeCart.dataset.removeCart);
    if (index > -1) basket.splice(index, 1);
    localStorage.setItem("bingoBasket", JSON.stringify(basket));
    basketCount();
    renderCart();
  }
  const clearCart = event.target.closest("[data-clear-cart]");
  if (clearCart) {
    localStorage.removeItem("bingoBasket");
    basketCount();
    renderCart();
  }
});

document.addEventListener("submit", (event) => {
  const giftCardForm = event.target.closest("[data-gift-card-form]");
  if (giftCardForm) {
    event.preventDefault();
    submitGiftCardCheckout(giftCardForm);
    return;
  }

  const dogWalkerApplication = event.target.closest("[data-dog-walker-application]");
  if (dogWalkerApplication) {
    event.preventDefault();
    submitDogWalkerApplication(dogWalkerApplication);
    return;
  }

  const directoryFilter = event.target.closest("[data-professional-directory-filter]");
  if (directoryFilter) {
    event.preventDefault();
    loadProfessionalDirectory(new FormData(directoryFilter));
    return;
  }

  const professionalEnquiry = event.target.closest("[data-professional-enquiry]");
  if (professionalEnquiry) {
    event.preventDefault();
    submitProfessionalEnquiry(professionalEnquiry);
    return;
  }

  const adminProfessionalToken = event.target.closest("[data-admin-professional-token-form]");
  if (adminProfessionalToken) {
    event.preventDefault();
    saveAdminProfessionalToken(adminProfessionalToken);
    return;
  }

  const adminProfessionalFilter = event.target.closest("[data-admin-professional-filter]");
  if (adminProfessionalFilter) {
    event.preventDefault();
    loadAdminProfessionalApplications(new FormData(adminProfessionalFilter));
    return;
  }

  const productCheckout = event.target.closest("[data-product-checkout]");
  if (!productCheckout) return;

  event.preventDefault();
  submitProductCheckout(productCheckout);
});

const professionalApiBase = "/api/professionals";
const adminProfessionalApiBase = window.location.hostname === "admin.bingodogwash.com"
  ? "https://bingodogwash.com/api/admin/professionals"
  : "/api/admin/professionals";
const adminProfessionalTokenKey = "bingoAdminProfessionalToken";

function adminProfessionalToken() {
  const sessionToken = (sessionStorage.getItem(adminProfessionalTokenKey) || "").trim();
  if (sessionToken) return sessionToken;

  const legacyToken = (localStorage.getItem(adminProfessionalTokenKey) || "").trim();
  if (legacyToken) {
    sessionStorage.setItem(adminProfessionalTokenKey, legacyToken);
    localStorage.removeItem(adminProfessionalTokenKey);
  }
  return legacyToken;
}

async function professionalFetch(path, options = {}) {
  const response = await fetch(`${professionalApiBase}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({ ok: false, error: "Invalid server response." }));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || "Request failed.");
  }
  return data;
}

async function adminProfessionalFetch(path, options = {}) {
  const token = adminProfessionalToken();
  const response = await fetch(`${adminProfessionalApiBase}${path}`, {
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "X-Admin-Actor": "Bingo admin",
      ...(options.headers || {})
    },
    ...options
  });
  const data = await response.json().catch(() => ({ ok: false, error: "Invalid server response." }));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || "Request failed.");
  }
  return data;
}

async function loadFoundingCount() {
  const target = document.querySelector("[data-founding-count]");
  if (!target) return;
  try {
    const data = await professionalFetch("/stats");
    target.textContent = `${data.foundingApproved} of ${data.foundingLimit} Founding Member places claimed`;
  } catch {
    target.textContent = "Founding Member places are updated after admin approval.";
  }
}

async function loadAdminEtsy() {
  const summaryTarget = document.querySelector("[data-admin-etsy-summary]");
  const productTarget = document.querySelector("[data-admin-etsy-products]");
  const logsTarget = document.querySelector("[data-admin-etsy-logs]");
  if (!summaryTarget && !productTarget && !logsTarget) return;
  if (!adminCoreToken()) {
    if (summaryTarget) summaryTarget.innerHTML = `<div class="mini-row"><strong>Locked</strong><span>Enter the admin token to manage Etsy.</span></div>`;
    return;
  }

  try {
    const searchQuery = document.querySelector("[data-admin-etsy-search] [name='query']")?.value.trim() || "";
    const productUrl = new URL(`${adminEtsyApiBase}/products`, location.href);
    if (searchQuery) productUrl.searchParams.set("q", searchQuery);
    const [dashboard, products, logs] = await Promise.all([
      adminCoreJson(adminEtsyApiBase),
      adminCoreJson(productUrl.toString()),
      adminCoreJson(`${adminEtsyApiBase}/logs`)
    ]);
    renderAdminEtsySummary(dashboard.connection, dashboard);
    renderAdminEtsyProducts(products.products || []);
    renderAdminEtsyLogs(logs.logs || []);
  } catch (error) {
    if (summaryTarget) summaryTarget.innerHTML = `<div class="mini-row"><strong>Etsy unavailable</strong><span>${escapeSvg(error.message)}</span></div>`;
  }
}

async function importAdminEtsyListing() {
  const form = document.querySelector("[data-admin-etsy-search]");
  const status = document.querySelector("[data-admin-etsy-search-status]");
  const button = document.querySelector("[data-admin-etsy-import]");
  if (!form) return;
  const reference = form.elements.query.value.trim();
  if (!reference) {
    if (status) status.textContent = "Paste an Etsy listing URL or listing ID first.";
    return;
  }

  if (button) button.disabled = true;
  if (status) status.textContent = "Importing exact Etsy listing...";
  try {
    const data = await adminCoreJson(`${adminEtsyApiBase}/products/import-listing`, {
      method: "POST",
      body: JSON.stringify({
        listingId: reference,
        listingUrl: reference
      })
    });
    if (status) status.textContent = data.message || "Etsy listing imported for review. Nothing was published.";
    await loadAdminEtsy();
  } catch (error) {
    if (status) status.textContent = error.message || "Etsy listing import failed.";
  } finally {
    if (button) button.disabled = false;
  }
}
async function searchAdminEtsyProducts() {
  const form = document.querySelector("[data-admin-etsy-search]");
  const target = document.querySelector("[data-admin-etsy-products]");
  const status = document.querySelector("[data-admin-etsy-search-status]");
  if (!form || !target) return;
  const query = form.elements.query.value.trim();
  const url = new URL(`${adminEtsyApiBase}/products`, location.href);
  if (query) url.searchParams.set("q", query);
  if (status) status.textContent = query ? "Searching the full Etsy catalogueâ€¦" : "Loading Etsy productsâ€¦";
  try {
    const data = await adminCoreJson(url.toString());
    const productList = data.products || [];
    renderAdminEtsyProducts(productList);
    if (status) status.textContent = query ? `${productList.length} matching product${productList.length === 1 ? "" : "s"}.` : "Showing the latest Etsy products.";
  } catch (error) {
    if (status) status.textContent = error.message || "Etsy search failed.";
  }
}

function renderAdminEtsySummary(connection, dashboard) {
  const target = document.querySelector("[data-admin-etsy-summary]");
  if (!target) return;
  target.innerHTML = `
    <div class="grid grid-4">
      <article class="card admin-source-card"><p class="tag">${dashboard.featureEnabled ? "Public feed enabled" : "Feature disabled"}</p><h3>Connection</h3><strong>${escapeSvg(connection.status)}</strong><p>${escapeSvg(connection.shopName || "Configured Etsy shop")}</p></article>
      <article class="card admin-source-card"><p class="tag">${dashboard.syncEnabled ? "Admin sync enabled" : "Sync disabled"}</p><h3>Sync</h3><strong>Configured Etsy shop</strong><p>Last success: ${escapeSvg(connection.lastSuccessfulSync || "Never")}</p><p>Last attempt: ${escapeSvg(connection.lastAttemptedSync || "Never")}</p></article>
      <article class="card admin-source-card"><p class="tag">Review queue</p><h3>Products</h3><strong>${connection.importedProducts}</strong><p>${connection.awaitingReview} awaiting review, ${connection.approved} approved, ${connection.published} published, ${connection.hidden} hidden.</p><p>${connection.publishedMissingAffiliateUrl || 0} published missing affiliate URL.</p></article>
      <article class="card admin-source-card"><p class="tag">Errors</p><h3>Sync errors</h3><strong>${connection.syncErrors}</strong><p>${escapeSvg(connection.lastError || "No current sync error.")}</p></article>
    </div>
  `;
}

function renderAdminEtsyProducts(productList) {
  const target = document.querySelector("[data-admin-etsy-products]");
  if (!target) return;
  if (!productList.length) {
    target.innerHTML = `<div class="mini-row"><strong>No Bingo Dog Edit products yet</strong><span>Import an exact Etsy listing above, then assign its collection and verify its affiliate link before publishing.</span></div>`;
    return;
  }

  target.innerHTML = productList.map((product) => `
    <div class="row admin-row admin-product-row">
      <label class="check-row"><input type="checkbox" data-admin-etsy-product-id="${escapeAttr(product.id || product.externalListingId)}" data-admin-etsy-external-listing-id="${escapeAttr(product.externalListingId || "")}" data-admin-etsy-product-status="${escapeAttr(String(product.status || "").toLowerCase())}"><span><strong>${escapeSvg(product.title)}</strong><small>Listing ID: ${escapeSvg(product.externalListingId || "Unknown")}</small></span></label>
      <span>${escapeSvg(product.category || "Etsy Products")}</span>
      <span>${escapeSvg(product.priceLabel || "Price on Etsy")}</span>
      <span>${escapeSvg(product.availability || "")}</span>
      <span class="tag">Collection: ${escapeSvg(product.bingoCollection || "Unassigned")}</span>
      <span class="tag tag-muted">Source: ${escapeSvg(product.shopSectionName || product.feedProvenance || "Unknown")}</span>
      <span class="tag">Status: ${escapeSvg(adminEtsyStatusLabel(product.status))}</span>
      <span class="tag tag-muted">Public visibility: ${product.publicVisibility ? "Public" : "Hidden"}</span>
      <span class="tag tag-muted">Review: ${escapeSvg(product.affiliateReviewStatus || "draft")}</span>
      <span class="tag tag-muted">Verification: ${escapeSvg(product.affiliateGenerationStatus || product.affiliateVerificationStatus || "unverified")}</span>
      <span class="tag">${escapeSvg(product.publicBlockedReason || "VERIFIED MATCH")}</span>
      <dl class="admin-etsy-verification">
        <div><dt>Original Etsy listing URL</dt><dd><a href="${escapeAttr(product.originalListingUrl)}" target="_blank" rel="noopener noreferrer">${escapeSvg(product.originalListingUrl || "Missing")}</a></dd></div>
        <div><dt>Candidate affiliate URL</dt><dd>${escapeSvg(product.affiliateUrl || "Missing")}</dd></div>
        <div><dt>Provider / program</dt><dd>${escapeSvg(product.affiliateProvider || "Missing")} / ${escapeSvg(product.affiliateProgram || "Missing")}</dd></div>
        <div><dt>Review</dt><dd>${escapeSvg(product.affiliateReviewStatus || "draft")} ${escapeSvg(product.affiliateReviewedAt || "")} ${escapeSvg(product.affiliateReviewedBy || "")}</dd></div>
        <div><dt>Verification</dt><dd>${escapeSvg(product.affiliateGenerationStatus || (product.affiliateEligibilityStatus === "match" ? "VERIFIED MATCH" : String(product.affiliateEligibilityStatus || product.affiliateVerificationStatus || "unverified").toUpperCase()))}</dd></div>
        <div><dt>Final resolved URL</dt><dd>${escapeSvg(product.affiliateFinalUrl || "Missing")}</dd></div>
        <div><dt>Destination listing ID</dt><dd>${escapeSvg(product.affiliateDestinationListingId || "Missing")}</dd></div>
        <div><dt>Verified at</dt><dd>${escapeSvg(product.affiliateVerifiedAt || "Never")}</dd></div>
      </dl>
      <div class="admin-row-actions">
        <a class="btn btn-light" href="${escapeAttr(product.listingUrl)}" target="_blank" rel="noopener">Preview</a>
      </div>
    </div>
  `).join("");
}

function adminEtsyStatusLabel(value) {
  const status = String(value || "unknown").trim().toLowerCase();
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function renderAdminEtsyLogs(logs) {
  const target = document.querySelector("[data-admin-etsy-logs]");
  if (!target) return;
  target.innerHTML = `
    <div class="section-head section-head-compact"><div><span class="eyebrow">Sync logs</span><h3>Recent Etsy sync runs</h3></div></div>
    ${logs.length ? logs.map((log) => `
      <div class="mini-row">
        <strong>${escapeSvg(log.sync_type)} - ${escapeSvg(log.status)}</strong>
        <span>${escapeSvg(log.started_at)} | imported ${Number(log.imported_count) || 0}, updated ${Number(log.updated_count) || 0}, failed ${Number(log.failed_count) || 0}${log.error_message ? ` | ${escapeSvg(log.error_message)}` : ""}</span>
      </div>
    `).join("") : `<div class="mini-row"><strong>No sync logs</strong><span>No Etsy sync has run yet.</span></div>`}
  `;
}

async function loadAdminPages() {
  const target = document.querySelector("[data-admin-pages]");
  if (!target) return;
  if (!adminCoreToken()) {
    target.innerHTML = `<div class="mini-row"><strong>Locked</strong><span>Enter the admin token to manage pages.</span></div>`;
    return;
  }

  try {
    const data = await adminCoreJson(adminPagesApiBase);
    renderAdminPages(data.pages || []);
  } catch (error) {
    target.innerHTML = `<div class="mini-row"><strong>Pages unavailable</strong><span>${escapeSvg(error.message)}</span></div>`;
  }
}

function renderAdminPages(pages) {
  const target = document.querySelector("[data-admin-pages]");
  if (!target) return;
  target.innerHTML = pages.map((page) => `
    <div class="row admin-row admin-page-row">
      <strong>${escapeSvg(page.pageName)}</strong>
      <span>${escapeSvg(page.route)}</span>
      <span class="tag">${escapeSvg(page.status)}</span>
      <span>${page.includedInNavigation ? "In nav" : "Hidden from nav"}</span>
      <span>${escapeSvg(page.lastUpdated || "")}</span>
      <span>${escapeSvg(page.scheduledPublishAt || "Not scheduled")}</span>
      <span>${escapeSvg(page.redirectTarget || "No redirect")}</span>
      <div class="admin-row-actions">
        <a class="btn btn-light" href="${escapeAttr(page.route)}" target="_blank" rel="noopener">Preview</a>
        <button class="btn btn-light" type="button" data-admin-page-action="live" data-admin-page-id="${escapeAttr(page.id)}">Set live</button>
        <button class="btn btn-light" type="button" data-admin-page-action="draft" data-admin-page-id="${escapeAttr(page.id)}" ${page.protectedPage ? "disabled" : ""}>Draft</button>
        <button class="btn btn-light" type="button" data-admin-page-action="pause" data-admin-page-id="${escapeAttr(page.id)}" ${page.protectedPage ? "disabled" : ""}>Pause</button>
        <button class="btn btn-secondary" type="button" data-admin-page-action="restore" data-admin-page-id="${escapeAttr(page.id)}">Restore</button>
      </div>
    </div>
  `).join("");
}

function initDogWalkerReferral() {
  const input = document.querySelector("[data-referral-input]");
  if (!input) return;
  const ref = new URLSearchParams(location.search).get("ref") || "";
  input.value = ref;
}

function initDogWalkerServiceDropdown() {
  const form = document.querySelector("[data-dog-walker-application]");
  const details = form?.querySelector(".checkbox-dropdown details");
  const summary = details?.querySelector("summary");
  if (!form || !details || !summary) return;
  const update = () => {
    const selected = new FormData(form).getAll("servicesOffered").filter(Boolean);
    summary.textContent = selected.length ? selected.join(", ") : "Select services";
  };
  details.addEventListener("change", update);
  update();
}

async function submitDogWalkerApplication(form) {
  const message = form.querySelector("[data-club-form-message]");
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  payload.servicesOffered = formData.getAll("servicesOffered").filter(Boolean);
  payload.privacyConsent = formData.get("privacyConsent") === "on";
  payload.marketingConsent = formData.get("marketingConsent") === "on";
  if (message) {
    message.hidden = false;
    message.textContent = "Submitting your application...";
  }
  try {
    const data = await professionalFetch("/applications", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    localStorage.setItem("bingoProfessionalApplication", JSON.stringify({
      applicationId: data.applicationId,
      status: data.status,
      submittedAt: new Date().toISOString(),
      businessName: payload.businessName,
      email: payload.email
    }));
    location.href = "dog-walker-application-success.html";
  } catch (error) {
    if (message) message.textContent = error.message || "Application could not be submitted.";
  }
}

function directoryCard(profile) {
  const tags = [
    profile.foundingMember ? "Founding Member" : "",
    profile.insuranceStatus ? "Insurance declared" : "",
    profile.dbsStatus ? "DBS declared" : ""
  ].filter(Boolean);
  const services = (profile.servicesOffered || []).slice(0, 4);
  const slug = encodeURIComponent(profile.slug || "");
  const type = escapeSvg(profile.professionalType || "Professional");
  const location = escapeSvg(profile.generalLocation || "Local area");
  return `
    <article class="card product-card directory-card">
      <div class="product-tags">${tags.map((tag) => `<p class="tag">${escapeSvg(tag)}</p>`).join("") || `<p class="tag tag-muted">${type}</p>`}</div>
      <h3>${escapeSvg(profile.businessName || "Local professional")}</h3>
      <p>${type} · ${location}</p>
      <p>${escapeSvg(profile.description || "Approved local pet professional.")}</p>
      <div class="chip-list">${services.map((item) => `<span class="chip">${escapeSvg(item)}</span>`).join("")}</div>
      <a class="btn btn-primary" href="professional.html?slug=${slug}">View Profile</a>
    </article>
  `;
}

async function loadProfessionalDirectory(formData = null) {
  const target = document.querySelector("[data-professional-directory]");
  if (!target) return;
  const params = new URLSearchParams();
  if (formData) {
    for (const [key, value] of formData.entries()) {
      if (String(value).trim()) params.set(key, value);
    }
  }
  target.innerHTML = `<article class="card product-card"><h3>Loading professionals</h3><p>Checking approved published profiles.</p></article>`;
  try {
    const data = await professionalFetch(`/directory?${params.toString()}`);
    target.innerHTML = data.profiles.length
      ? data.profiles.map(directoryCard).join("")
      : `<article class="card product-card"><h3>No professionals found</h3><p>Try a different search or check back soon.</p></article>`;
  } catch (error) {
    target.innerHTML = `<article class="card product-card"><h3>Directory temporarily unavailable</h3><p>${error.message}</p></article>`;
  }
}

async function loadProfessionalProfile() {
  const target = document.querySelector("[data-professional-profile]");
  if (!target) return;
  const slug = new URLSearchParams(location.search).get("slug") || "";
  if (!slug) {
    target.innerHTML = `<article class="card"><h1>Profile not found</h1><p>No professional profile was selected.</p></article>`;
    return;
  }
  try {
    const data = await professionalFetch(`/profile?slug=${encodeURIComponent(slug)}`);
    const profile = data.profile;
    document.title = `${profile.businessName} | Bingo Dog Wash`;
    target.innerHTML = `
      <article class="card professional-profile-card">
        <span class="eyebrow">${escapeSvg(profile.professionalType || "Professional")}</span>
        <h1>${escapeSvg(profile.businessName || "Local professional")}</h1>
        <p class="lead">${escapeSvg(profile.description || "Approved local pet professional.")}</p>
        <div class="product-tags">
          ${profile.foundingMember ? `<p class="tag">Founding Member</p>` : ""}
          ${profile.insuranceStatus ? `<p class="tag tag-muted">${escapeSvg(profile.insuranceStatus)}</p>` : ""}
          ${profile.dbsStatus ? `<p class="tag tag-muted">${escapeSvg(profile.dbsStatus)}</p>` : ""}
        </div>
        <div class="grid grid-2">
          <div><h3>Services</h3><p>${escapeSvg((profile.servicesOffered || []).join(", ") || "Contact for services.")}</p></div>
          <div><h3>Areas covered</h3><p>${escapeSvg((profile.areasCovered || []).join(", ") || profile.generalLocation || "Local area")}</p></div>
          <div><h3>Experience</h3><p>${escapeSvg(profile.yearsExperience || "Contact for details.")}</p></div>
          <div><h3>Availability</h3><p>${escapeSvg(profile.availability || "Contact for availability.")}</p></div>
        </div>
        <div class="button-row">
          ${profile.website ? `<a class="btn btn-secondary" href="${escapeAttr(profile.website)}" target="_blank" rel="noopener">Website</a>` : ""}
          ${profile.socialProfile ? `<a class="btn btn-light" href="${escapeAttr(profile.socialProfile)}" target="_blank" rel="noopener">Social Profile</a>` : ""}
        </div>
      </article>
    `;
    const enquiryPanel = document.querySelector("[data-professional-enquiry-panel]");
    if (enquiryPanel) enquiryPanel.hidden = false;
  } catch (error) {
    target.innerHTML = `<article class="card"><h1>Profile unavailable</h1><p>${error.message}</p></article>`;
  }
}

async function submitProfessionalEnquiry(form) {
  const message = form.querySelector("[data-professional-enquiry-message]");
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  payload.shareConsent = formData.get("shareConsent") === "on";
  payload.slug = new URLSearchParams(location.search).get("slug") || "";
  if (message) {
    message.hidden = false;
    message.textContent = "Sending your enquiry...";
  }
  try {
    await professionalFetch("/enquiries", { method: "POST", body: JSON.stringify(payload) });
    form.reset();
    if (message) message.textContent = "Your enquiry has been sent securely.";
  } catch (error) {
    if (message) message.textContent = error.message || "Enquiry could not be sent.";
  }
}

async function saveAdminProfessionalToken(form) {
  const token = String(new FormData(form).get("token") || "").trim();
  const message = document.querySelector("[data-admin-professional-auth-message]");
  const button = form.querySelector("button[type='submit']");
  if (!token) {
    if (message) message.textContent = "Enter the admin token.";
    return;
  }

  if (message) message.textContent = "Checking admin token...";
  if (button) button.disabled = true;
  sessionStorage.setItem(adminProfessionalTokenKey, token);
  localStorage.removeItem(adminProfessionalTokenKey);

  try {
    const stats = await adminProfessionalFetch("/stats");
    renderAdminProfessionalStats(stats);
    const panel = document.querySelector("[data-admin-professional-panel]");
    if (panel) {
      panel.hidden = false;
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (message) message.textContent = "Unlocked. Loading applications...";
    loadAdminProfessionalApplications();
    loadAdminProfessionalMembers();
    loadAdminProfessionalEnquiries();
  } catch (error) {
    sessionStorage.removeItem(adminProfessionalTokenKey);
    localStorage.removeItem(adminProfessionalTokenKey);
    if (message) message.textContent = error.message || "Token could not be verified.";
  } finally {
    if (button) button.disabled = false;
  }
}

function initAdminProfessionals() {
  const panel = document.querySelector("[data-admin-professional-panel]");
  if (!panel) return;
  if (adminProfessionalToken()) {
    panel.hidden = false;
    loadAdminProfessionalStats();
    loadAdminProfessionalApplications();
    loadAdminProfessionalMembers();
    loadAdminProfessionalEnquiries();
  }
  document.addEventListener("click", (event) => {
    const action = event.target.closest("[data-professional-application-action]");
    if (action) {
      adminProfessionalApplicationAction(action.dataset.applicationId, action.dataset.professionalApplicationAction);
      return;
    }
    const tab = event.target.closest("[data-admin-professional-tab]");
    if (tab) {
      document.querySelectorAll("[data-admin-professional-section]").forEach((section) => {
        section.hidden = section.dataset.adminProfessionalSection !== tab.dataset.adminProfessionalTab;
      });
    }
  });
}

async function loadAdminProfessionalStats() {
  const target = document.querySelector("[data-admin-professional-stats]");
  if (!target) return;
  try {
    const stats = await adminProfessionalFetch("/stats");
    renderAdminProfessionalStats(stats);
  } catch (error) {
    target.innerHTML = `<article class="card"><h3>Stats unavailable</h3><p>${escapeSvg(error.message || "Could not load admin stats.")}</p></article>`;
  }
}

function renderAdminProfessionalStats(stats) {
  const target = document.querySelector("[data-admin-professional-stats]");
  if (!target) return;
  target.innerHTML = `
    <article class="card"><span class="eyebrow">Total Applications</span><h3>${Number(stats.totalApplications || 0)}</h3></article>
    <article class="card"><span class="eyebrow">Approved Members</span><h3>${Number(stats.approvedMembers || 0)}</h3></article>
    <article class="card"><span class="eyebrow">Founding Members</span><h3>${Number(stats.foundingMembers || 0)}</h3></article>
    <article class="card"><span class="eyebrow">Places Remaining</span><h3>${Number(stats.placesRemaining || 0)}</h3></article>
  `;
}

async function loadAdminProfessionalApplications(formData = null) {
  const target = document.querySelector("[data-admin-professional-applications]");
  if (!target) return;
  const params = new URLSearchParams();
  if (formData) {
    for (const [key, value] of formData.entries()) {
      if (String(value).trim()) params.set(key, value);
    }
  }
  try {
    const data = await adminProfessionalFetch(`/applications?${params.toString()}`);
    target.innerHTML = data.applications.length ? data.applications.map(adminApplicationRow).join("") : `<div class="mini-row"><strong>No applications found</strong><span>Try another filter.</span></div>`;
  } catch (error) {
    target.innerHTML = `<div class="mini-row"><strong>Could not load applications</strong><span>${error.message}</span></div>`;
  }
}

function adminApplicationRow(application) {
  const publication = application.publicationStatus || "Unpublished";
  const approved = application.status === "Approved";
  const townPostcode = [application.businessTownCity, application.businessPostcode].filter(Boolean).join(" ");
  const submitted = application.submittedAt || application.createdAt || "Not recorded";
  return `
    <div class="mini-row admin-professional-row">
      <strong>${escapeSvg(application.businessName || "Unnamed business")}</strong>
      <span>${escapeSvg(application.fullName || "No applicant name")} &middot; ${escapeSvg(application.email || "No email")} &middot; ${escapeSvg(application.phone || "No phone")} &middot; ${escapeSvg(townPostcode || "No town/postcode")}</span>
      <span><span class="tag">${escapeSvg(application.status || "Pending")}</span> <span class="tag tag-muted">${escapeSvg(publication)}</span></span>
      <details>
        <summary>Review full application</summary>
        <div class="mini-row"><strong>Applicant</strong><span>${escapeSvg(application.fullName || "Not supplied")}</span></div>
        <div class="mini-row"><strong>Business</strong><span>${escapeSvg(application.businessName || "Not supplied")}</span></div>
        <div class="mini-row"><strong>Email</strong><span>${escapeSvg(application.email || "Not supplied")}</span></div>
        <div class="mini-row"><strong>Phone</strong><span>${escapeSvg(application.phone || "Not supplied")}</span></div>
        <div class="mini-row"><strong>Town / postcode</strong><span>${escapeSvg(townPostcode || "Not supplied")}</span></div>
        <div class="mini-row"><strong>Professional type</strong><span>${escapeSvg(application.professionalType || "Not supplied")}</span></div>
        <div class="mini-row"><strong>Services</strong><span>${escapeSvg(application.servicesOffered || "Not supplied")}</span></div>
        <div class="mini-row"><strong>Areas covered</strong><span>${escapeSvg(application.areasCovered || "Not supplied")}</span></div>
        <div class="mini-row"><strong>Insurance</strong><span>${escapeSvg(application.insuranceStatus || "Not supplied")}</span></div>
        <div class="mini-row"><strong>DBS</strong><span>${escapeSvg(application.dbsStatus || "Not supplied")}</span></div>
        <div class="mini-row"><strong>Status</strong><span>${escapeSvg(application.status || "Pending")}</span></div>
        <div class="mini-row"><strong>Published</strong><span>${escapeSvg(publication)}</span></div>
        <div class="mini-row"><strong>Experience</strong><span>${escapeSvg(application.yearsExperience || "Not supplied")}</span></div>
        <div class="mini-row"><strong>Description</strong><span>${escapeSvg(application.businessDescription || "Not supplied")}</span></div>
        <div class="mini-row"><strong>Submitted</strong><span>${escapeSvg(submitted)}</span></div>
        <div class="mini-row"><strong>Consent</strong><span>${escapeSvg(application.privacyPolicyVersion || "Not recorded")}</span></div>
        <div class="mini-row"><strong>Referral</strong><span>${escapeSvg(application.referredByCode || "None")}</span></div>
      </details>
      <div class="button-row">
        <button class="btn btn-secondary" type="button" data-application-id="${application.id}" data-professional-application-action="review">Review</button>
        <button class="btn btn-primary" type="button" data-application-id="${application.id}" data-professional-application-action="approve">Approve</button>
        <button class="btn btn-secondary" type="button" data-application-id="${application.id}" data-professional-application-action="publish" ${approved ? "" : "disabled"}>Publish</button>
        <button class="btn btn-light" type="button" data-application-id="${application.id}" data-professional-application-action="unpublish" ${approved ? "" : "disabled"}>Unpublish</button>
        <button class="btn btn-light" type="button" data-application-id="${application.id}" data-professional-application-action="reject">Reject</button>
      </div>
    </div>
  `;
}

async function adminProfessionalApplicationAction(id, action) {
  if (!id || !action) return;
  try {
    await adminProfessionalFetch(`/applications/${encodeURIComponent(id)}/${encodeURIComponent(action)}`, {
      method: "POST",
      body: JSON.stringify({ adminNotes: "" })
    });
    loadAdminProfessionalStats();
    loadAdminProfessionalApplications();
    loadAdminProfessionalMembers();
  } catch (error) {
    alert(error.message || "Action failed.");
  }
}

async function loadAdminProfessionalMembers() {
  const target = document.querySelector("[data-admin-professional-members]");
  if (!target) return;
  try {
    const data = await adminProfessionalFetch("/members");
    target.innerHTML = data.members.length ? data.members.map((member) => `
      <div class="mini-row">
        <strong>${member.businessName}</strong>
        <span>${member.email} · ${member.professionalType} · ${member.status}</span>
        <span>Referral: ${member.referralCode} · Credits: ${member.washCredits} · Discount: ${member.lifetimeDiscountPercent}%</span>
        <span class="tag">${member.foundingMember ? `Founding #${member.foundingPosition}` : "Standard member"}</span>
      </div>
    `).join("") : `<div class="mini-row"><strong>No members yet</strong><span>Approved applications will appear here.</span></div>`;
  } catch (error) {
    target.innerHTML = `<div class="mini-row"><strong>Could not load members</strong><span>${error.message}</span></div>`;
  }
}

async function loadAdminProfessionalEnquiries() {
  const target = document.querySelector("[data-admin-professional-enquiries]");
  if (!target) return;
  try {
    const data = await adminProfessionalFetch("/enquiries");
    target.innerHTML = data.enquiries.length ? data.enquiries.map((enquiry) => `
      <div class="mini-row">
        <strong>${enquiry.businessName}</strong>
        <span>${enquiry.customerName} · ${enquiry.customerEmail} · ${enquiry.customerPhone || "No phone"}</span>
        <span>${enquiry.serviceRequired || "Service not specified"} · ${enquiry.postcode || "No postcode"} · ${enquiry.status}</span>
      </div>
    `).join("") : `<div class="mini-row"><strong>No enquiries yet</strong><span>Secure directory enquiries will appear here.</span></div>`;
  } catch (error) {
    target.innerHTML = `<div class="mini-row"><strong>Could not load enquiries</strong><span>${error.message}</span></div>`;
  }
}

async function renderProfessionalAccountSnapshot() {
  const target = document.querySelector("[data-professional-account-summary]");
  if (!target) return;
  const saved = storedJson("bingoProfessionalApplication", null);
  if (!saved?.applicationId || !saved?.email) {
    target.innerHTML = `<div class="mini-row"><strong>No professional application saved on this device</strong><span>Apply through the Dog Walker Directory page. This page can only show applications saved in this browser until customer login is available.</span></div>`;
    return;
  }

  target.innerHTML = `<div class="mini-row"><strong>${escapeSvg(saved.businessName || "Dog Walker Directory application")}</strong><span>Checking application status...</span></div>`;
  try {
    const data = await professionalFetch(`/application-status?id=${encodeURIComponent(saved.applicationId)}&email=${encodeURIComponent(saved.email)}`);
    const application = data.application;
    const submitted = application.submittedAt ? new Date(application.submittedAt).toLocaleDateString("en-GB") : "Not recorded";
    target.innerHTML = `<div class="mini-row"><strong>${escapeSvg(application.businessName || saved.businessName || "Dog Walker Directory application")}</strong><span>Application received — we’re reviewing it. Status: ${escapeSvg(application.status)} · Publication: ${escapeSvg(application.publicationStatus)} · Submitted: ${escapeSvg(submitted)}</span></div>`;
  } catch (error) {
    target.innerHTML = `<div class="mini-row"><strong>${escapeSvg(saved.businessName || "Dog Walker Directory application")}</strong><span>Status saved on this device: ${escapeSvg(saved.status || "Pending")}. We could not refresh it from the server right now.</span></div>`;
  }
}

function initGiveaway() {
  const form = document.querySelector("[data-giveaway-form]");
  if (form) {
    const terms = form.elements.termsAccepted;
    const submit = form.querySelector("[data-giveaway-pay]");
    const message = form.querySelector("[data-giveaway-message]");
    const updateButton = () => { submit.disabled = !terms.checked || form.dataset.submitting === "true"; };
    terms.addEventListener("change", updateButton);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity() || !terms.checked || form.dataset.submitting === "true") return;
      const originalText = submit.textContent;
      form.dataset.submitting = "true";
      submit.textContent = "Opening secure Stripe checkout...";
      updateButton();
      try {
        const response = await fetch("/api/giveaway/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: form.elements.firstName.value,
            lastName: form.elements.lastName.value,
            email: form.elements.email.value,
            phone: form.elements.phone.value,
            termsAccepted: terms.checked,
            submissionId: crypto.randomUUID(),
          }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.ok || !result.paymentUrl) throw new Error(result.error || "Giveaway checkout could not open.");
        message.textContent = "Stripe checkout is opening now...";
        window.location.assign(result.paymentUrl);
      } catch (error) {
        message.textContent = error.message || "Giveaway checkout could not open. Please try again.";
        delete form.dataset.submitting;
        submit.textContent = originalText;
        updateButton();
      }
    });
    if (new URLSearchParams(location.search).get("payment") === "cancelled") {
      message.textContent = "Payment was cancelled. Your entry was not recorded.";
    }
    updateButton();
  }

  if (new URLSearchParams(location.search).get("giveaway") === "success") {
    const standard = document.querySelector("[data-standard-thank-you]");
    const giveaway = document.querySelector("[data-giveaway-thank-you]");
    if (standard && giveaway) { standard.hidden = true; giveaway.hidden = false; }
  }
}

let giveawayAdminPage = 1;

function initAdminGiveaway() {
  const filter = document.querySelector("[data-giveaway-filter]");
  if (!filter) return;
  filter.addEventListener("submit", (event) => { event.preventDefault(); giveawayAdminPage = 1; loadAdminGiveawayEntries(); });
  document.querySelector("[data-giveaway-refresh]")?.addEventListener("click", () => loadAdminGiveawayEntries());
  document.querySelector("[data-giveaway-export]")?.addEventListener("click", exportAdminGiveawayEntries);
  document.querySelector("[data-giveaway-pagination]")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-giveaway-page]");
    if (!button) return;
    giveawayAdminPage = Number(button.dataset.giveawayPage);
    loadAdminGiveawayEntries();
  });
}

function giveawayAdminParams() {
  const filter = document.querySelector("[data-giveaway-filter]");
  const params = new URLSearchParams({ page: String(giveawayAdminPage), pageSize: "20" });
  if (filter?.elements.q.value.trim()) params.set("q", filter.elements.q.value.trim());
  params.set("sort", filter?.elements.sort.value || "date");
  params.set("direction", filter?.elements.direction.value || "desc");
  return params;
}

async function loadAdminGiveawayEntries() {
  const target = document.querySelector("[data-giveaway-entries]");
  const pagination = document.querySelector("[data-giveaway-pagination]");
  if (!target || !pagination || !adminCoreToken()) return;
  target.innerHTML = '<div class="mini-row"><strong>Loading</strong><span>Checking verified Stripe entries...</span></div>';
  try {
    const data = await adminCoreJson(`/api/feed-status?view=giveaway&${giveawayAdminParams()}`);
    target.innerHTML = data.entries.length ? `<table class="admin-giveaway-table"><thead><tr><th>Entry Number</th><th>Name</th><th>Email</th><th>Phone</th><th>Amount</th><th>Payment Status</th><th>Date</th></tr></thead><tbody>${data.entries.map((entry) => `<tr><td>${escapeSvg(entry.entryNumber)}</td><td>${escapeSvg(entry.name)}</td><td>${escapeSvg(entry.email)}</td><td>${escapeSvg(entry.phone || "—")}</td><td>${escapeSvg(entry.amountDisplay)}</td><td><span class="tag">${escapeSvg(entry.paymentStatus)}</span></td><td>${escapeSvg(formatAdminDate(entry.createdAt))}</td></tr>`).join("")}</tbody></table>` : '<div class="mini-row"><strong>No entries found</strong><span>Successful paid entries will appear here.</span></div>';
    const pageInfo = data.pagination;
    pagination.innerHTML = `<button class="btn btn-light" type="button" data-giveaway-page="${pageInfo.page - 1}" ${pageInfo.page <= 1 ? "disabled" : ""}>Previous</button><span>Page ${pageInfo.page} of ${pageInfo.totalPages} · ${pageInfo.total} entries</span><button class="btn btn-light" type="button" data-giveaway-page="${pageInfo.page + 1}" ${pageInfo.page >= pageInfo.totalPages ? "disabled" : ""}>Next</button>`;
  } catch (error) {
    target.innerHTML = `<div class="mini-row"><strong>Giveaway entries unavailable</strong><span>${escapeSvg(error.message)}</span></div>`;
    pagination.innerHTML = "";
  }
}

function initNewsletter() {
  document.querySelectorAll("[data-newsletter-form]").forEach((form) => {
    const message = form.querySelector("[data-newsletter-message]");
    if (!message) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const fields = new FormData(form);
      const email = String(fields.get("email") || "").trim();
      const mobile = String(fields.get("mobile") || "").trim();
      const button = form.querySelector("button[type='submit']");
      if (button) button.disabled = true;
      message.textContent = "Joining…";
      try {
        const response = await fetch("/api/newsletter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mobile ? { email, mobile } : { email })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.ok === false) throw new Error(data.error || "Subscription request failed");
        message.textContent = "Welcome to the pack — you're on the list.";
        form.reset();
      } catch (error) {
        message.textContent = "We couldn't add you just now. Please email info@bingodogwash.com.";
      } finally {
        if (button) button.disabled = false;
      }
    });
  });
}

const latestFromBingoConfig = Object.freeze({
  // Add approved Bingo YouTube video IDs here.
  youtube: Object.freeze([
    "CvlkYxbZZ30",
    "lBmrXJs4t3s",
    "vZV32DOuZ2g",
    "sVPgg5rGRvU",
    "guItC4i-nH4"
  ]),
  // Add approved Bingo Instagram post or reel URLs here.
  instagram: Object.freeze([
    "https://www.instagram.com/p/DbG8jqRRYdn/",
    "https://www.instagram.com/p/DbJqvFCxnzu/",
    "https://www.instagram.com/p/Da4-JUMjoO0/",
    "https://www.instagram.com/p/DZiaForO7jn/",
    "https://www.instagram.com/p/DbIrbHeDZZL/"
  ])
});

const latestFromBingoRotationMs = 2 * 60 * 60 * 1000;

function validBingoYoutubeId(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{11}$/.test(value);
}

function validBingoInstagramUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && (url.hostname === "instagram.com" || url.hostname === "www.instagram.com")
      && /^\/(?:p|reel)\/[A-Za-z0-9_-]+\/$/.test(url.pathname);
  } catch {
    return false;
  }
}

function latestBingoRotationPeriod(timestamp = Date.now()) {
  return Math.floor(timestamp / latestFromBingoRotationMs);
}

function initLatestBingoEmbeds() {
  const section = document.querySelector("[data-latest-bingo]");
  if (!section) return;

  const youtubeItems = latestFromBingoConfig.youtube.filter(validBingoYoutubeId);
  const instagramItems = latestFromBingoConfig.instagram.filter(validBingoInstagramUrl);
  const youtubeCard = section.querySelector("[data-youtube-card]");
  const instagramCard = section.querySelector("[data-instagram-card]");
  const youtubeLinks = section.querySelectorAll("[data-youtube-link]");
  const instagramLinks = section.querySelectorAll("[data-instagram-link]");
  let currentRotationPeriod = latestBingoRotationPeriod();

  if (!youtubeItems.length && youtubeCard) youtubeCard.hidden = true;
  if (!instagramItems.length && instagramCard) instagramCard.hidden = true;

  const selectedYoutubeId = () => youtubeItems[currentRotationPeriod % youtubeItems.length];
  const selectedInstagramUrl = () => instagramItems[currentRotationPeriod % instagramItems.length];

  const renderYoutube = () => {
    if (!youtubeItems.length) return;
    const videoId = selectedYoutubeId();
    const url = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
    youtubeLinks.forEach((link) => { link.href = url; });
  };

  const renderInstagram = () => {
    if (!instagramItems.length) return;
    const postUrl = selectedInstagramUrl();
    instagramLinks.forEach((link) => { link.href = postUrl; });
  };

  renderYoutube();
  renderInstagram();

  const rotationCheck = window.setInterval(() => {
    const nextRotationPeriod = latestBingoRotationPeriod();
    if (nextRotationPeriod === currentRotationPeriod) return;
    currentRotationPeriod = nextRotationPeriod;
    renderYoutube();
    renderInstagram();
  }, 60 * 1000);

  const cleanup = () => window.clearInterval(rotationCheck);
  window.addEventListener("pagehide", cleanup);
}

async function loadAdminNewsletter() {
  const target = document.querySelector("[data-admin-newsletter]");
  const count = document.querySelector("[data-admin-newsletter-count]");
  if (!target || !adminCoreToken()) return;
  target.innerHTML = '<div class="mini-row"><strong>Loading</strong><span>Checking community subscribers…</span></div>';
  try {
    const data = await adminCoreJson(adminNewsletterApiBase);
    if (count) count.textContent = String(data.count || 0);
    target.innerHTML = data.subscribers.length
      ? `<table class="admin-giveaway-table"><thead><tr><th>Email</th><th>Status</th><th>Source</th><th>Joined</th></tr></thead><tbody>${data.subscribers.map((subscriber) => `<tr><td>${escapeSvg(subscriber.email)}</td><td><span class="tag">${escapeSvg(subscriber.status)}</span></td><td>${escapeSvg(subscriber.source)}</td><td>${escapeSvg(formatAdminDate(subscriber.subscribedAt))}</td></tr>`).join("")}</tbody></table>`
      : '<div class="mini-row"><strong>No subscribers yet</strong><span>New homepage sign-ups will appear here.</span></div>';
  } catch (error) {
    target.innerHTML = `<div class="mini-row"><strong>Subscribers unavailable</strong><span>${escapeSvg(error.message)}</span></div>`;
  }
}

async function exportAdminNewsletter() {
  const response = await fetch(`${adminNewsletterApiBase}?format=csv`, { headers: adminCoreHeaders() });
  if (!response.ok) return;
  const blob = await response.blob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "bingo-newsletter-subscribers.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

async function exportAdminGiveawayEntries() {
  const params = giveawayAdminParams();
  params.set("page", "1"); params.set("pageSize", "100"); params.set("format", "csv");
  const response = await fetch(`/api/feed-status?view=giveaway&${params}`, { headers: adminCoreHeaders() });
  if (!response.ok) return;
  const blob = await response.blob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob); link.download = "giveaway-entries.csv"; link.click();
  URL.revokeObjectURL(link.href);
}

initNav();
loadFoundingCount();
initDogWalkerReferral();
initDogWalkerServiceDropdown();
loadProfessionalDirectory();
loadProfessionalProfile();
initAdminProfessionals();
initGiftCardForm();
initGiftCardBalanceForm();
initAdminGiftCards();
renderAdminGiftCardDesigns();
initAdminCoreControls();
initGiveaway();
initAdminGiveaway();
initNewsletter();
initLatestBingoEmbeds();
document.querySelector("[data-admin-newsletter-refresh]")?.addEventListener("click", loadAdminNewsletter);
document.querySelector("[data-admin-newsletter-export]")?.addEventListener("click", exportAdminNewsletter);
document.querySelector("[data-admin-etsy-search]")?.addEventListener("submit", (event) => {
  event.preventDefault();
  searchAdminEtsyProducts();
});

wireAdminPublicLinks();
basketCount();
renderCategories();
if (!hasServerRenderedShopProducts) renderProducts();
renderAvasamCategories();
renderAvasamProducts();
renderHomeAvasamProducts();
initUniversalProductSearch();
initShopFilters();
initAvasamFilters();
activateHydratedAvasamControls();
if (!hydratedAvasamProducts.length) loadAvasamProducts();
if (document.querySelector("[data-home-bingo-products], [data-avasam-products], [data-products], [data-cart], [data-product-detail], [data-admin-product-feed], [data-account-orders]")) {
  setInterval(() => loadAvasamProducts({ silent: true }), avasamRefreshMs);
}
loadEtsyProducts();
if (document.querySelector("[data-products], [data-cart], [data-product-detail], [data-admin-product-feed], [data-account-orders]")) {
  setInterval(() => loadEtsyProducts({ silent: true }), etsyRefreshMs);
}
loadEbayProducts();
if (document.querySelector("[data-products], [data-admin-source-summary]")) {
  setInterval(() => loadEbayProducts({ silent: true }), ebayRefreshMs);
}
if (!hasServerRenderedProductDetail) renderProductDetail();
renderCart();
initAccount();
renderAccount();
initShopGreeting();
renderProfessionalAccountSnapshot();
initWashBooking();
renderAdminBookings();
renderAdminProducts();
initAdminEditMode();
