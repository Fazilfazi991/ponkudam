const fs = require("fs");
const os = require("os");
const path = require("path");

const bundledDbFile = path.join(process.cwd(), "data", "db.json");
const runtimeDbFile = path.join(os.tmpdir(), "ponkudam-db.json");
const uploadDir = path.join(os.tmpdir(), "ponkudam-uploads");
const tokenPrefix = "ponkudam-admin";

const nowIso = () => new Date().toISOString();

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const ensureRuntimeDb = () => {
  if (!fs.existsSync(runtimeDbFile)) {
    fs.copyFileSync(bundledDbFile, runtimeDbFile);
  }
};

const readDb = () => {
  ensureRuntimeDb();
  return JSON.parse(fs.readFileSync(runtimeDbFile, "utf8"));
};

const writeDb = (db) => {
  fs.writeFileSync(runtimeDbFile, JSON.stringify(db, null, 2));
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
  res.status(status).json(payload);
};

const createToken = (user) =>
  Buffer.from(`${tokenPrefix}:${user.id}:${Date.now()}`).toString("base64url");

const getAuthUser = (req, db) => {
  const raw = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!raw) return null;

  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    const [, userId] = decoded.split(":");
    return decoded.startsWith(`${tokenPrefix}:`) ? db.users.find((user) => user.id === userId) || null : null;
  } catch {
    return null;
  }
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

const publicProduct = (product) => product.status === "Published" && product.visible !== false;

module.exports = async function handler(req, res) {
  try {
    const db = readDb();
    const url = new URL(req.url, `https://${req.headers.host || "ponkudam.org"}`);
    const parts = url.pathname.split("/").filter(Boolean);
    const resource = parts[1];
    const id = parts[2];

    if (resource === "login" && req.method === "POST") {
      const body = await readBody(req);
      const user = db.users.find((item) => item.username === body.username && item.password === body.password);
      if (!user) return sendJson(res, 401, { ok: false, message: "Invalid credentials" });
      return sendJson(res, 200, {
        ok: true,
        token: createToken(user),
        user: { id: user.id, name: user.name, role: user.role },
      });
    }

    if (resource === "logout" && req.method === "POST") {
      return sendJson(res, 200, { ok: true });
    }

    if (resource === "public-products" && req.method === "GET") {
      const category = url.searchParams.get("category");
      const products = db.products.filter((product) => publicProduct(product) && (!category || product.category === category));
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
      fs.mkdirSync(uploadDir, { recursive: true });
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
      if (req.method === "POST") {
        const body = await readBody(req);
        const rate = { id: `gold-${Date.now()}`, ...body, updatedBy: user.name, updatedAt: nowIso() };
        db.gold_rates.push(rate);
        writeDb(db);
        return sendJson(res, 201, { ok: true, rate });
      }
    }

    if (resource === "settings") {
      if (req.method === "PUT") {
        db.settings = { ...db.settings, ...(await readBody(req)), updatedAt: nowIso() };
        writeDb(db);
        return sendJson(res, 200, { ok: true, settings: db.settings });
      }
    }

    return sendJson(res, 404, { ok: false, message: "API route not found" });
  } catch (error) {
    return sendJson(res, 500, { ok: false, message: error.message });
  }
};
