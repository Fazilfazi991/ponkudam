const fs = require("fs");
const https = require("https");
const os = require("os");
const path = require("path");

const CACHE_FILE = path.join(os.tmpdir(), "ponkudam-gold-rate-cache.json");
const OUNCE_TO_GRAMS = 31.1035;
const SCHEDULED_IST_HOURS = [9, 14, 19];

let memoryCache;

const formatINR = (value) =>
  new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(Math.round(value));

const getIstParts = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
};

const getCurrentWindowKey = (date = new Date()) => {
  const parts = getIstParts(date);
  const currentHour = Number(parts.hour);
  const latestHour = SCHEDULED_IST_HOURS.filter((hour) => currentHour >= hour).pop();

  if (!latestHour) return null;
  return `${parts.year}-${parts.month}-${parts.day}-${String(latestHour).padStart(2, "0")}`;
};

const readCache = () => {
  if (memoryCache) return memoryCache;

  try {
    memoryCache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    return memoryCache;
  } catch {
    return null;
  }
};

const writeCache = (payload) => {
  memoryCache = payload;

  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(payload), "utf8");
  } catch {
    // Vercel serverless functions may recycle instances; memory cache still helps within the same instance.
  }
};

const createRatePayload = ({ perGram24K, source, updatedWindowKey }) => {
  const rates = {
    rate24K: Math.round(perGram24K),
    rate22K: Math.round((perGram24K * 22) / 24),
    rate18K: Math.round((perGram24K * 18) / 24),
  };

  return {
    ok: true,
    source,
    updatedWindowKey,
    lastUpdated: new Date().toISOString(),
    rates,
    display: {
      rate24K: formatINR(rates.rate24K),
      rate22K: formatINR(rates.rate22K),
      rate18K: formatINR(rates.rate18K),
    },
  };
};

const fetchGoldApi = (apiKey) =>
  new Promise((resolve, reject) => {
    // Provider boundary: replace only this request block if moving away from GoldAPI later.
    const req = https.request(
      {
        hostname: "www.goldapi.io",
        path: "/api/XAU/INR",
        method: "GET",
        headers: {
          "x-access-token": apiKey,
          "Content-Type": "application/json",
        },
      },
      (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`GoldAPI returned ${res.statusCode}`));
            return;
          }

          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error("GoldAPI returned invalid JSON"));
          }
        });
      }
    );

    req.on("error", reject);
    req.end();
  });

const getManualOverride = (currentWindowKey) => {
  if (process.env.MANUAL_GOLD_RATE_ENABLED !== "true") return null;

  const manual24K = Number(process.env.MANUAL_GOLD_RATE_24K);
  if (!Number.isFinite(manual24K) || manual24K <= 0) return null;

  return createRatePayload({
    perGram24K: manual24K,
    source: "manual",
    updatedWindowKey: currentWindowKey || "manual",
  });
};

const shouldRefresh = (cache, currentWindowKey) => {
  if (!currentWindowKey) return false;
  if (!cache) return true;
  return cache.updatedWindowKey !== currentWindowKey;
};

const getGoldRate = async () => {
  const currentWindowKey = getCurrentWindowKey();
  const manualOverride = getManualOverride(currentWindowKey);

  if (manualOverride) {
    writeCache(manualOverride);
    return manualOverride;
  }

  const cache = readCache();

  if (!currentWindowKey) {
    return (
      cache || {
        ok: false,
        source: "empty",
        message: "Gold rate updating soon.",
      }
    );
  }

  if (!shouldRefresh(cache, currentWindowKey)) {
    return cache;
  }

  const apiKey = process.env.GOLD_API_KEY;
  if (!apiKey) {
    return (
      cache || {
        ok: false,
        source: "empty",
        message: "Gold rate updating soon.",
      }
    );
  }

  try {
    const goldApiData = await fetchGoldApi(apiKey);
    const pricePerOunce = Number(goldApiData.price);

    if (!Number.isFinite(pricePerOunce) || pricePerOunce <= 0) {
      throw new Error("GoldAPI response does not include a valid ounce price");
    }

    const payload = createRatePayload({
      perGram24K: pricePerOunce / OUNCE_TO_GRAMS,
      source: "goldapi",
      updatedWindowKey: currentWindowKey,
    });

    writeCache(payload);
    return payload;
  } catch (error) {
    return (
      cache || {
        ok: false,
        source: "error",
        message: "Gold rate updating soon.",
        error: error.message,
      }
    );
  }
};

module.exports = {
  getGoldRate,
};
