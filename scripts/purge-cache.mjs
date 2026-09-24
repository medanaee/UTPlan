#!/usr/bin/env node

/**
 * UT-ECE Universal Cache Purge & Revalidation Script
 * 
 * Purges and resets caches across all layers:
 * 1. Server-Side Memory Cache (RAM & Entity Versions)
 * 2. Cloudflare Worker Cache API (caches.default)
 * 3. Cloudflare CDN Edge Cache (via Cloudflare API if token available)
 * 4. Warms up and revalidates all public API endpoints
 * 
 * Usage:
 *   node scripts/purge-cache.mjs
 *   node scripts/purge-cache.mjs --target=https://ut.medanaee.ir
 *   node scripts/purge-cache.mjs --local
 *   npm run cache:purge
 */

const DEFAULT_TARGET = "https://ut.medanaee.ir";
const DEFAULT_SECRET = process.env.CACHE_PURGE_SECRET || "ut-ece-purge-cache-secret-2026";
const DEFAULT_ZONE_ID = process.env.CLOUDFLARE_ZONE_ID || "fc7561cd094063870023bac51b6469ad";

const ENDPOINTS = [
  "/api/courses",
  "/api/faculties",
  "/api/faculties/links",
  "/api/majors",
  "/api/tracks",
  "/api/tracks/assignments?trackId=default",
  "/api/professors",
  "/api/physical-faculties",
  "/api/categories?trackId=default",
  "/api/offerings",
  "/api/events",
  "/api/charts",
];

// Parse command line arguments
const args = process.argv.slice(2);
let targetUrl = DEFAULT_TARGET;
let secret = DEFAULT_SECRET;
let cfToken = process.env.CLOUDFLARE_API_TOKEN || null;
let zoneId = DEFAULT_ZONE_ID;

for (const arg of args) {
  if (arg === "--local") {
    targetUrl = "http://localhost:3000";
  } else if (arg.startsWith("--target=")) {
    targetUrl = arg.split("=")[1].replace(/\/$/, "");
  } else if (arg.startsWith("--secret=")) {
    secret = arg.split("=")[1];
  } else if (arg.startsWith("--cf-token=")) {
    cfToken = arg.split("=")[1];
  } else if (arg.startsWith("--zone=")) {
    zoneId = arg.split("=")[1];
  }
}

// Colors for terminal formatting
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
  gray: "\x1b[90m",
};

async function main() {
  console.log(`\n${c.bold}${c.cyan}======================================================${c.reset}`);
  console.log(`${c.bold}${c.cyan}      UT-ECE Cache Purge & Reset Utility             ${c.reset}`);
  console.log(`${c.bold}${c.cyan}======================================================${c.reset}\n`);

  console.log(`${c.gray}Target Domain :${c.reset} ${c.bold}${targetUrl}${c.reset}`);
  console.log(`${c.gray}Timestamp     :${c.reset} ${new Date().toISOString()}`);
  console.log(`${c.gray}Endpoints     :${c.reset} ${ENDPOINTS.length} API routes\n`);

  // Step 1: Call Server-Side Cache Purge API
  console.log(`${c.bold}[1/3] Calling Server Purge API...${c.reset}`);
  try {
    const purgeUrl = `${targetUrl}/api/admin/cache/purge`;
    const res = await fetch(purgeUrl, {
      method: "POST",
      headers: {
        "x-purge-secret": secret,
        "Content-Type": "application/json",
      },
    });

    if (res.ok) {
      const data = await res.json();
      console.log(`  ${c.green}✔ سرور پاسخ داد:${c.reset} ${data.message || "کش‌ها ریست شدند"}`);
      if (data.cfCachePurged) {
        console.log(`  ${c.green}✔ Cloudflare Worker Cache API (caches.default) پاک‌سازی شد.${c.reset}`);
      }
    } else {
      console.log(`  ${c.yellow}⚠ وضعیت سرور ${res.status}: اندپوینت purge هنوز در این دامنه مستقر نشده است (ادامه با Revalidation مستقیم).${c.reset}`);
    }
  } catch (err) {
    console.log(`  ${c.yellow}⚠ عدم دسترسی به اندپوینت purge: ${err.message}${c.reset}`);
  }

  // Step 2: Cloudflare Zone Purge API (if token provided)
  console.log(`\n${c.bold}[2/3] Cloudflare Zone CDN Purge...${c.reset}`);
  if (cfToken) {
    try {
      console.log(`  ${c.blue}ℹ Sending purge_everything to zone ${zoneId}...${c.reset}`);
      const cfRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ purge_everything: true }),
      });
      const cfData = await cfRes.json();
      if (cfData.success) {
        console.log(`  ${c.green}✔ Cloudflare CDN Edge Cache به صورت کامل (purge_everything) پاک‌سازی شد!${c.reset}`);
      } else {
        console.log(`  ${c.red}✖ خطای کلادفلر: ${JSON.stringify(cfData.errors)}${c.reset}`);
      }
    } catch (cfErr) {
      console.log(`  ${c.red}✖ خطا در ارتباط با API کلادفلر: ${cfErr.message}${c.reset}`);
    }
  } else {
    console.log(`  ${c.gray}ℹ متغیر CLOUDFLARE_API_TOKEN تنظیم نشده است (از طریق لایه ورکر و هدرهای نوکش انجام شد).${c.reset}`);
    console.log(`  ${c.gray}  (برای Purge کلی کلادفلر، می‌توانید توکن با دسترسی Zone.Cache Purge را تنظیم کنید).${c.reset}`);
  }

  // Step 3: Revalidate & Warm Up all URLs with cache-busting headers
  console.log(`\n${c.bold}[3/3] Revalidating & Warming All API URLs...${c.reset}`);
  const results = [];

  for (const endpoint of ENDPOINTS) {
    const fullUrl = `${targetUrl}${endpoint}`;
    const t0 = Date.now();
    try {
      const res = await fetch(fullUrl, {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
        },
      });
      const duration = Date.now() - t0;
      const cfStatus = res.headers.get("cf-cache-status") || "N/A";
      const etag = res.headers.get("etag") || "-";
      let itemCount = null;

      try {
        const json = await res.json();
        if (Array.isArray(json)) itemCount = json.length;
        else if (Array.isArray(json?.data)) itemCount = json.data.length;
      } catch {}

      results.push({
        endpoint,
        status: res.status,
        duration: `${duration}ms`,
        cfStatus,
        etag: etag.replace(/^W\//, ""),
        items: itemCount !== null ? itemCount : "-",
        ok: res.ok,
      });
    } catch (err) {
      results.push({
        endpoint,
        status: "ERR",
        duration: "-",
        cfStatus: "ERR",
        etag: "-",
        items: "-",
        ok: false,
        error: err.message,
      });
    }
  }

  // Display results table
  console.log("");
  console.log("┌───────────────────────────┬────────┬──────────┬──────────────┬──────────────┬────────┐");
  console.log("│ Endpoint                  │ Status │ Duration │ CF-Cache     │ ETag         │ Items  │");
  console.log("├───────────────────────────┼────────┼──────────┼──────────────┼──────────────┼────────┤");

  for (const r of results) {
    const ep = r.endpoint.padEnd(25);
    const st = String(r.status).padEnd(6);
    const dur = r.duration.padEnd(8);
    const cf = r.cfStatus.padEnd(12);
    const et = r.etag.slice(0, 12).padEnd(12);
    const it = String(r.items).padEnd(6);
    const color = r.ok ? c.green : c.red;
    console.log(`│ ${color}${ep}${c.reset} │ ${st} │ ${dur} │ ${cf} │ ${et} │ ${it} │`);
  }
  console.log("└───────────────────────────┴────────┴──────────┴──────────────┴──────────────┴────────┘");

  const successCount = results.filter((r) => r.ok).length;
  console.log(`\n${c.bold}${c.green}✔ ابطال و بازنشانی کش با موفقیت پایان یافت (${successCount}/${results.length} اندپوینت با موفقیت فراخوانی شدند).${c.reset}\n`);
}

main().catch((err) => {
  console.error(`\n${c.red}خطای اسکریپت:${c.reset}`, err);
  process.exit(1);
});
