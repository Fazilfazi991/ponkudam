const fs = require("fs");
const http = require("http");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT || 8000);
const dbFile = path.join(root, "data", "db.json");
const uploadDir = path.join(root, "images", "uploads");
const types = {
  ".css": "text/css",
  ".html": "text/html",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".webp": "image/webp",
};

const nowIso = () => new Date().toISOString();
const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const seedProducts = () => {
  const featured = [
    ["featured-heritage-emerald-temple-necklace", "Heritage Emerald Temple Necklace", "necklaces", "Necklaces", 345000, "images/ChatGPT%20Image%20Jun%2014,%202026,%2006_33_09%20AM%20(1).webp"],
    ["featured-diamond-floral-drop-earrings", "Diamond Floral Drop Earrings", "earrings", "Earrings", 128000, "images/ChatGPT%20Image%20Jun%2014,%202026,%2006_33_09%20AM%20(2).webp"],
    ["featured-classic-filigree-gold-bangle", "Classic Filigree Gold Bangle", "bangles", "Bangles", 98500, "images/ChatGPT%20Image%20Jun%2014,%202026,%2006_33_10%20AM%20(3).webp"],
    ["featured-solitaire-diamond-engagement-ring", "Solitaire Diamond Engagement Ring", "rings", "Rings", 135000, "images/ChatGPT%20Image%20Jun%2014,%202026,%2006_33_10%20AM%20(4).webp"],
    ["featured-peacock-diamond-pendant-set", "Peacock Diamond Pendant Set", "pendants", "Pendants", 162000, "images/ChatGPT%20Image%20Jun%2014,%202026,%2006_33_10%20AM%20(5).webp"],
  ];
  const generated = [
    ["bangles", "Bangles", 8, (n) => `Heritage Gold Bangle ${n}`, (n) => `images/bangles/webp/ponkudam_featured_product_${n}_800x1000.webp`],
    ["earrings", "Earrings", 8, (n) => `Diamond Drop Earrings ${n}`, (n) => `images/earings/webp/ponkudam_pdf2_product_${n}_800x1000.webp`],
    ["necklaces", "Necklaces", 11, (n) => `Signature Necklace ${n}`, (n) => `images/necklaces/webp/ponkudam_pdf3_product_${n}_800x1000.webp`],
    ["pendants", "Pendants", 5, (n) => `Diamond Pendant ${n}`, (n) => `images/pendants/webp/ponkudam_pdf4_product_${n}_800x1000.webp`],
  ].flatMap(([category, type, count, nameFor, imageFor]) =>
    Array.from({ length: count }, (_, index) => {
      const n = String(index + 1).padStart(2, "0");
      return [category, nameFor(n), category, type, null, imageFor(n), `${category}-${n}`];
    })
  );

  return [...featured, ...generated].map(([id, name, category, type, price, image, forcedId]) => ({
    id: forcedId || id,
    name,
    code: (forcedId || id).toUpperCase().replace(/-/g, "-"),
    slug: slugify(name),
    category,
    subcategory: "",
    type,
    shortDescription: `${name} from Ponkudam Gold & Diamonds.`,
    fullDescription: `${name} crafted for elegant jewellery styling and customer enquiries.`,
    featuredImage: image,
    galleryImages: [image],
    metalType: "Gold",
    purity: "22K",
    weight: "",
    stoneDetails: "",
    diamondDetails: "",
    price,
    offerPrice: "",
    priceMode: price ? "show" : "contact",
    stockStatus: "In Stock",
    status: "Published",
    visible: true,
    featured: id.startsWith("featured-"),
    newArrival: false,
    bestSeller: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }));
};

const createInitialDb = () => ({
  users: [
    { id: "user-super-admin", name: "Super Admin", username: "admin", password: "admin123", role: "Super Admin" },
    { id: "user-products", name: "Product Manager", username: "products", password: "products123", role: "Product Manager" },
    { id: "user-content", name: "Content Manager", username: "content", password: "content123", role: "Content Manager" },
  ],
  categories: ["rings", "bangles", "chains", "earrings", "pendants", "necklaces", "bridal-jewellery", "diamond-jewellery", "daily-wear", "new-arrivals"].map((slug, index) => ({
    id: slug,
    name: slug.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join(" "),
    slug,
    image: "",
    description: "",
    parent: "",
    visible: true,
    sortOrder: index + 1,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  })),
  products: seedProducts(),
  gold_rates: [],
  settings: {
    storeName: "Ponkudam Gold & Diamonds",
    logo: "images/ponkudam_2003_logo_transparent.png",
    contactNumber: "+91 98765 43210",
    whatsappNumber: "919876543210",
    email: "hello@ponkudam.com",
    address: "123, Heritage Road, Coimbatore - 641 002.",
    googleMapLink: "",
    facebookLink: "",
    instagramLink: "https://www.instagram.com/",
    youtubeLink: "",
    bisLogo: "",
    footerContent: "Timeless jewellery created with love, purity and craftsmanship for every celebration.",
    openingHours: "10:00 AM - 8:00 PM Everyday",
  },
  enquiries: [],
  tokens: [],
});

const readDb = () => {
  ensureDir(path.dirname(dbFile));
  if (!fs.existsSync(dbFile)) fs.writeFileSync(dbFile, JSON.stringify(createInitialDb(), null, 2));
  return JSON.parse(fs.readFileSync(dbFile, "utf8"));
};

const writeDb = (db) => {
  ensureDir(path.dirname(dbFile));
  fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 20_000_000) reject(new Error("Request body too large"));
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
  });

const sendJson = (res, status, payload) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
};

const getAuthUser = (req, db) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const session = db.tokens.find((item) => item.token === token);
  if (!session) return null;
  return db.users.find((user) => user.id === session.userId) || null;
};

const requireAuth = (req, res, db) => {
  const user = getAuthUser(req, db);
  if (!user) sendJson(res, 401, { ok: false, message: "Unauthorized" });
  return user;
};

const canAccess = (user, resource) => {
  if (user.role === "Super Admin") return true;
  if (user.role === "Product Manager") return ["products", "categories", "uploads", "duplicate-product"].includes(resource);
  if (user.role === "Content Manager") return ["enquiries", "settings"].includes(resource);
  return false;
};

const handleApi = async (req, res, url) => {
  const db = readDb();
  const parts = url.pathname.split("/").filter(Boolean);
  const resource = parts[1];
  const id = parts[2];

  if (resource === "login" && req.method === "POST") {
    const body = await readBody(req);
    const user = db.users.find((item) => item.username === body.username && item.password === body.password);
    if (!user) return sendJson(res, 401, { ok: false, message: "Invalid credentials" });
    const token = Buffer.from(`${user.id}:${Date.now()}:${Math.random()}`).toString("base64url");
    db.tokens.push({ token, userId: user.id, createdAt: nowIso() });
    writeDb(db);
    return sendJson(res, 200, { ok: true, token, user: { id: user.id, name: user.name, role: user.role } });
  }

  if (resource === "logout" && req.method === "POST") {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    db.tokens = db.tokens.filter((item) => item.token !== token);
    writeDb(db);
    return sendJson(res, 200, { ok: true });
  }

  if (resource === "gold-rate" && req.method === "GET") {
    const latest = db.gold_rates.filter((rate) => rate.enabled !== false).at(-1);
    if (!latest || latest.showOnHeader === false) return sendJson(res, 200, { ok: false, message: "Gold rate updating soon." });
    return sendJson(res, 200, {
      ok: true,
      source: "admin",
      lastUpdated: latest.updatedAt,
      display: {
        rate24K: latest.rate24K,
        rate22K: latest.rate22K,
        rate22K8g: latest.rate22K8g,
        rate18K: latest.rate18K,
        silverRate: latest.silverRate,
        englishMessage: latest.englishMessage,
        malayalamMessage: latest.malayalamMessage,
      },
    });
  }

  if (resource === "public-products" && req.method === "GET") {
    const category = url.searchParams.get("category");
    const products = db.products.filter((product) => product.status === "Published" && product.visible !== false && (!category || product.category === category));
    return sendJson(res, 200, { ok: true, products });
  }

  if (resource === "products" && id && req.method === "GET") {
    const product = db.products.find((item) => item.id === id);
    return product ? sendJson(res, 200, { ok: true, product }) : sendJson(res, 404, { ok: false, message: "Product not found" });
  }

  if (resource === "settings" && req.method === "GET") {
    return sendJson(res, 200, { ok: true, settings: db.settings });
  }

  if (resource === "enquiries" && req.method === "POST" && !getAuthUser(req, db)) {
    const body = await readBody(req);
    const enquiry = { id: `enquiry-${Date.now()}`, status: "New", date: nowIso(), ...body };
    db.enquiries.unshift(enquiry);
    writeDb(db);
    return sendJson(res, 201, { ok: true, enquiry });
  }

  const user = requireAuth(req, res, db);
  if (!user) return;
  if (!canAccess(user, resource)) return sendJson(res, 403, { ok: false, message: "You do not have permission for this section" });

  if (resource === "uploads" && req.method === "POST") {
    const body = await readBody(req);
    const match = String(body.dataUrl || "").match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
    if (!match) return sendJson(res, 400, { ok: false, message: "Upload must be a PNG, JPG, or WEBP data URL" });
    const ext = match[1].split("/")[1].replace("jpeg", "jpg");
    const filename = `${Date.now()}-${slugify(body.name || "image")}.${ext}`;
    ensureDir(uploadDir);
    fs.writeFileSync(path.join(uploadDir, filename), Buffer.from(match[2], "base64"));
    return sendJson(res, 201, { ok: true, url: `images/uploads/${filename}` });
  }

  const collections = { products: "products", categories: "categories", enquiries: "enquiries", users: "users" };
  const collectionName = collections[resource];
  if (collectionName) {
    const collection = db[collectionName];
    if (req.method === "GET") {
      const payload = resource === "users" ? collection.map(({ password, ...userItem }) => userItem) : collection;
      return sendJson(res, 200, { ok: true, [collectionName]: payload });
    }
    const body = await readBody(req);
    if (req.method === "POST") {
      const item = { id: body.id || `${resource}-${Date.now()}`, ...body, createdAt: nowIso(), updatedAt: nowIso() };
      collection.unshift(item);
      writeDb(db);
      return sendJson(res, 201, { ok: true, item });
    }
    const index = collection.findIndex((item) => item.id === id);
    if (index === -1) return sendJson(res, 404, { ok: false, message: "Not found" });
    if (req.method === "PUT") {
      collection[index] = { ...collection[index], ...body, updatedAt: nowIso() };
      writeDb(db);
      return sendJson(res, 200, { ok: true, item: collection[index] });
    }
    if (req.method === "DELETE") {
      collection.splice(index, 1);
      writeDb(db);
      return sendJson(res, 200, { ok: true });
    }
  }

  if (resource === "duplicate-product" && id && req.method === "POST") {
    const source = db.products.find((item) => item.id === id);
    if (!source) return sendJson(res, 404, { ok: false, message: "Product not found" });
    const copy = { ...source, id: `product-${Date.now()}`, name: `${source.name} Copy`, slug: `${source.slug}-copy`, status: "Draft", createdAt: nowIso(), updatedAt: nowIso() };
    db.products.unshift(copy);
    writeDb(db);
    return sendJson(res, 201, { ok: true, product: copy });
  }

  if (resource === "gold-rates") {
    if (req.method === "GET") return sendJson(res, 200, { ok: true, gold_rates: db.gold_rates });
    const body = await readBody(req);
    if (req.method === "POST") {
      const rate = { id: `gold-${Date.now()}`, ...body, updatedBy: user.name, updatedAt: nowIso() };
      db.gold_rates.push(rate);
      writeDb(db);
      return sendJson(res, 201, { ok: true, rate });
    }
  }

  if (resource === "settings") {
    if (req.method === "GET") return sendJson(res, 200, { ok: true, settings: db.settings });
    if (req.method === "PUT") {
      db.settings = { ...db.settings, ...(await readBody(req)), updatedAt: nowIso() };
      writeDb(db);
      return sendJson(res, 200, { ok: true, settings: db.settings });
    }
  }

  sendJson(res, 404, { ok: false, message: "API route not found" });
};

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
    if (url.pathname.startsWith("/api/")) {
      try {
        await handleApi(req, res, url);
      } catch (error) {
        sendJson(res, 500, { ok: false, message: error.message });
      }
      return;
    }

    let pathname = decodeURIComponent(url.pathname);

    if (pathname === "/") pathname = "/index.html";
    if (!path.extname(pathname)) pathname = `${pathname}.html`;

    const file = path.join(root, pathname);
    if (!file.startsWith(root)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    fs.readFile(file, (error, data) => {
      if (error) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
      res.end(data);
    });
  })
  .listen(port, "127.0.0.1", () => {
    console.log(`Ponkudam local server running at http://127.0.0.1:${port}/`);
  });
