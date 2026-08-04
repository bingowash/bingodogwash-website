import { createRequire } from "module";

const require = createRequire(import.meta.url);
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const SPREADSHEET_PATH =
  "C:\\Users\\User\\Desktop\\avasam images\\ProductImages_bingo_dog_wash_ltd_13072026012851.xlsx";

const APPROVED_HOSTNAMES = new Set([
  "avasamnew.s3.amazonaws.com",
  "esetrix.s3.amazonaws.com"
]);
const DRY_RUN = process.argv.includes("--dry-run");

function normalizeSku(value) {
  return String(value ?? "").trim().toUpperCase();
}

function validateAvasamUrl(rawUrl) {
  const value = String(rawUrl ?? "").trim();

  if (!value) {
    return {
      valid: false,
      reason: "Blank URL"
    };
  }

  try {
    const parsedUrl = new URL(value);

    if (parsedUrl.protocol !== "https:") {
      return {
        valid: false,
        reason: "URL must use HTTPS"
      };
    }

    const hostname = parsedUrl.hostname.toLowerCase();

if (!APPROVED_HOSTNAMES.has(hostname)) {
  return {
    valid: false,
    reason: `Wrong domain: ${hostname}`
  };
}

    if (!parsedUrl.pathname || parsedUrl.pathname === "/") {
      return {
        valid: false,
        reason: "Missing image path"
      };
    }

    return {
      valid: true,
      url: parsedUrl.toString()
    };
  } catch {
    return {
      valid: false,
      reason: "Malformed URL"
    };
  }
}

function getFilename(imageUrl) {
  try {
    return decodeURIComponent(
      new URL(imageUrl).pathname.split("/").pop() || ""
    );
  } catch {
    return "";
  }
}

function getImageNumber(imageUrl) {
  const filename = getFilename(imageUrl);
  const match = filename.match(/(\d+)/);

  return match
    ? Number(match[1])
    : Number.MAX_SAFE_INTEGER;
}

function sortImages(images) {
  return [...new Set(images)].sort((first, second) => {
    const firstFilename = getFilename(first).toLowerCase();
    const secondFilename = getFilename(second).toLowerCase();

    const firstIsMain = firstFilename === "main.png";
    const secondIsMain = secondFilename === "main.png";

    if (firstIsMain && !secondIsMain) return -1;
    if (!firstIsMain && secondIsMain) return 1;

    return getImageNumber(first) - getImageNumber(second);
  });
}

function readSpreadsheet(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Spreadsheet not found: ${filePath}`);
  }

  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: ""
  });

  const imagesBySku = new Map();
  const invalidRows = [];

  for (let index = 1; index < rows.length; index++) {
    const row = rows[index];

    const sku = normalizeSku(row[0]);
    const rawUrl = row[1];

    if (!sku) {
      invalidRows.push({
        row: index + 1,
        reason: "Missing SKU"
      });

      continue;
    }

    const validation = validateAvasamUrl(rawUrl);

    if (!validation.valid) {
      invalidRows.push({
        row: index + 1,
        sku,
        url: rawUrl,
        reason: validation.reason
      });

      continue;
    }

    if (!imagesBySku.has(sku)) {
      imagesBySku.set(sku, []);
    }

    imagesBySku.get(sku).push(validation.url);
  }

  for (const [sku, images] of imagesBySku.entries()) {
    imagesBySku.set(sku, sortImages(images));
  }

  return {
    totalRows: Math.max(rows.length - 1, 0),
    imagesBySku,
    invalidRows
  };
}

function printReport(result) {
  let totalImages = 0;

  for (const images of result.imagesBySku.values()) {
    totalImages += images.length;
  }

  console.log("");
  console.log("Avasam spreadsheet report");
  console.log("-------------------------");
  console.log(`Dry run: ${DRY_RUN}`);
  console.log(`Spreadsheet: ${SPREADSHEET_PATH}`);
  console.log(`Rows read: ${result.totalRows}`);
  console.log(`Unique SKUs: ${result.imagesBySku.size}`);
  console.log(`Valid image URLs: ${totalImages}`);
  console.log(`Invalid rows: ${result.invalidRows.length}`);

  console.log("");
  console.log("SKU summary:");

  for (const [sku, images] of result.imagesBySku.entries()) {
    console.log(`${sku}: ${images.length} images`);
    console.log(`  Primary: ${images[0] || "None"}`);
  }

  if (result.invalidRows.length > 0) {
    console.log("");
    console.log("Invalid rows:");

    for (const item of result.invalidRows) {
      console.log(
        `Row ${item.row}: ${item.sku || "No SKU"} - ${item.reason}`
      );
    }
  }
}

function main() {
  try {
    console.log("Starting Avasam image import check...");

    const result = readSpreadsheet(SPREADSHEET_PATH);

    printReport(result);

    if (DRY_RUN) {
      console.log("");
      console.log("Dry run complete. No database changes were made.");
      return;
    }

    console.log("");
    console.log(
      "Spreadsheet validation succeeded, but database update logic has not been connected yet."
    );

    console.log(
      "Ask Codex to connect this script to the existing product database before running without --dry-run."
    );
  } catch (error) {
    console.error("");
    console.error("Import failed:");
    console.error(error.message);
    process.exitCode = 1;
  }
}

main();
