const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const bundledDbFile = path.join(process.cwd(), "data", "db.json");
const runtimeDbFile = path.join(os.tmpdir(), "ponkudam-db.json");
const normalizeSupabaseUrl = (value) => {
  let raw = String(value || "").trim().replace(/^["']|["']$/g, "");
  raw = raw.replace(/^SUPABASE_URL\s*=\s*/i, "").trim();
  const urlMatch = raw.match(/https?:\/\/[^\s"']+|[a-z0-9-]+\.supabase\.co/i);
  if (urlMatch) raw = urlMatch[0];
  if (!raw) return "";
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withProtocol);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString().replace(/\/$/, "") : "";
  } catch {
    return "";
  }
};

const normalizeSecret = (value) => {
  let raw = String(value || "").trim().replace(/^["']|["']$/g, "");
  raw = raw.replace(/^SUPABASE_(SERVICE_ROLE_KEY|ANON_KEY)\s*=\s*/i, "").trim();
  const jwtMatch = raw.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  if (jwtMatch) raw = jwtMatch[0];
  return raw && !raw.includes("paste_your") ? raw : "";
};

const serviceUrl = normalizeSupabaseUrl(process.env.SUPABASE_URL);
const serviceRoleKey = normalizeSecret(process.env.SUPABASE_SERVICE_ROLE_KEY);
const hasSupabase = Boolean(serviceUrl && serviceRoleKey);
const tokenSecret = process.env.ADMIN_TOKEN_SECRET || serviceRoleKey || "ponkudam-local-dev-secret";

const nowIso = () => new Date().toISOString();
let supabaseClient;

const getSupabase = () => {
  if (!hasSupabase) return null;
  if (!supabaseClient) {
    supabaseClient = createClient(serviceUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
  }
  return supabaseClient;
};

const sendJson = (res, status, payload) => {
  if (typeof res.status === "function" && typeof res.json === "function") {
    return res.status(status).json(payload);
  }
  res.statusCode = status;
  res.setHeader?.("Content-Type", "application/json");
  return res.end(JSON.stringify(payload));
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

const cleanNumber = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(String(password), salt, 120000, 32, "sha256").toString("hex");
  return `pbkdf2_sha256$120000$${salt}$${hash}`;
};

const verifyPassword = (password, stored) => {
  if (!stored) return false;
  if (!stored.includes("$")) return password === stored;
  const [method, iterations, salt, expected] = stored.split("$");
  if (method !== "pbkdf2_sha256") return false;
  const hash = crypto.pbkdf2Sync(String(password), salt, Number(iterations), 32, "sha256").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expected));
};

const roleToApi = (role) =>
  ({
    super_admin: "Super Admin",
    product_manager: "Product Manager",
    content_manager: "Content Manager",
    "Super Admin": "Super Admin",
    "Product Manager": "Product Manager",
    "Content Manager": "Content Manager",
  })[role] || "Content Manager";

const roleToDb = (role) =>
  ({
    "Super Admin": "super_admin",
    "Product Manager": "product_manager",
    "Content Manager": "content_manager",
    super_admin: "super_admin",
    product_manager: "product_manager",
    content_manager: "content_manager",
  })[role] || "content_manager";

const statusToApi = (status) => ({ published: "Published", draft: "Draft", hidden: "Hidden" })[status] || status || "Published";
const statusToDb = (status) => ({ Published: "published", Draft: "draft", Hidden: "hidden" })[status] || status || "published";
const stockToApi = (status) => ({ in_stock: "In Stock", out_of_stock: "Out of Stock", made_to_order: "Made to Order" })[status] || status || "In Stock";
const stockToDb = (status) => ({ "In Stock": "in_stock", "Out of Stock": "out_of_stock", "Made to Order": "made_to_order" })[status] || status || "in_stock";
const enquiryStatusToApi = (status) => ({ new: "New", contacted: "Contacted", closed: "Closed" })[status] || status || "New";
const enquiryStatusToDb = (status) => String(status || "new").toLowerCase();

const base64url = (input) => Buffer.from(input).toString("base64url");
const sign = (payload) => crypto.createHmac("sha256", tokenSecret).update(payload).digest("base64url");

const createToken = (user) => {
  const payload = base64url(JSON.stringify({ sub: user.id, username: user.username, role: user.role, iat: Date.now() }));
  return `${payload}.${sign(payload)}`;
};

const verifyToken = (token) => {
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  if (signature !== sign(payload)) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
};

const ensureRuntimeDb = () => {
  if (!fs.existsSync(runtimeDbFile)) fs.copyFileSync(bundledDbFile, runtimeDbFile);
};

const readJsonDb = () => {
  ensureRuntimeDb();
  return JSON.parse(fs.readFileSync(runtimeDbFile, "utf8"));
};

const writeJsonDb = (db) => fs.writeFileSync(runtimeDbFile, JSON.stringify(db, null, 2));

const mapUser = (row) => ({ id: row.id, name: row.name || row.username, username: row.username, role: roleToApi(row.role) });

const mapCategory = (row, byId = {}) => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  image: row.image_url || "",
  description: row.description || "",
  parent: row.parent_category_id ? byId[row.parent_category_id]?.slug || "" : "",
  visible: row.visibility !== "hidden",
  sortOrder: row.sort_order || 0,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapProduct = (row, categoriesById = {}) => {
  const category = row.category_id ? categoriesById[row.category_id]?.slug || "" : "";
  const subcategory = row.subcategory_id ? categoriesById[row.subcategory_id]?.slug || "" : "";
  return {
    id: row.id,
    name: row.product_name,
    code: row.product_code,
    slug: row.slug,
    category,
    subcategory,
    type: row.product_type || "",
    shortDescription: row.short_description || "",
    fullDescription: row.full_description || "",
    featuredImage: row.featured_image_url || "",
    image: row.featured_image_url || "",
    galleryImages: row.gallery_images || [],
    images: row.gallery_images || [],
    metalType: row.metal_type || "",
    purity: row.purity || "",
    weight: row.weight_grams ?? "",
    stoneDetails: row.stone_details || "",
    diamondDetails: row.diamond_details || "",
    price: row.price,
    offerPrice: row.offer_price ?? "",
    priceMode: row.show_contact_for_price ? "contact" : row.price_note ? "variable" : "show",
    priceLabel: row.price_note || "",
    stockStatus: stockToApi(row.stock_status),
    status: statusToApi(row.visibility),
    visible: row.visibility !== "hidden",
    featured: Boolean(row.is_featured),
    newArrival: Boolean(row.is_new_arrival),
    bestSeller: Boolean(row.is_best_seller),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const mapGoldRate = (row) => ({
  id: row.id,
  rate24K: row.rate_24k_1g ?? "",
  rate22K: row.rate_22k_1g ?? "",
  rate22K8g: row.rate_22k_8g ?? "",
  rate18K: row.rate_18k_1g ?? "",
  silverRate: row.silver_rate ?? "",
  rateDate: row.rate_date || "",
  rateTime: row.rate_time || "",
  malayalamMessage: row.malayalam_message || "",
  englishMessage: row.english_message || "",
  enabled: row.marquee_enabled !== false,
  showOnHeader: row.show_in_header !== false,
  updatedBy: row.updated_by_username || row.users?.username || "",
  updatedAt: row.created_at,
});

const mapEnquiry = (row) => ({
  id: row.id,
  customerName: row.customer_name || "",
  phone: row.phone || "",
  email: row.email || "",
  productId: row.product_id || "",
  productName: row.product_name || "",
  productCode: row.product_code || "",
  productLink: row.product_link || "",
  price: row.price,
  message: row.message || "",
  status: enquiryStatusToApi(row.status),
  date: row.created_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapSettings = (row = {}) => ({
  storeName: row.store_name || "Ponkudam Gold & Diamonds",
  logo: row.logo_url || "images/ponkudam_2003_logo_transparent.webp",
  contactNumber: row.contact_number || "",
  whatsappNumber: row.whatsapp_number || "",
  email: row.email || "",
  address: row.address || "",
  googleMapLink: row.google_map_link || "",
  facebookLink: row.facebook_link || "",
  instagramLink: row.instagram_link || "",
  youtubeLink: row.youtube_link || "",
  bisLogo: row.bis_logo_url || "",
  huidLogo: row.huid_logo_url || "",
  footerContent: row.footer_content || "",
  openingHours: row.opening_hours || "",
});

const productToDb = (body, categoriesBySlug = {}) => {
  const payload = {};
  if (body.name !== undefined) payload.product_name = body.name;
  if (body.code !== undefined || body.id !== undefined || body.name !== undefined) payload.product_code = body.code || body.id || slugify(body.name).toUpperCase();
  if (body.slug !== undefined || body.name !== undefined) payload.slug = body.slug || slugify(body.name);
  if (body.category !== undefined) payload.category_id = categoriesBySlug[body.category] || null;
  if (body.subcategory !== undefined) payload.subcategory_id = categoriesBySlug[body.subcategory] || null;
  if (body.type !== undefined) payload.product_type = body.type || null;
  if (body.shortDescription !== undefined) payload.short_description = body.shortDescription || null;
  if (body.fullDescription !== undefined) payload.full_description = body.fullDescription || null;
  if (body.featuredImage !== undefined || body.image !== undefined) payload.featured_image_url = body.featuredImage || body.image || null;
  if (body.galleryImages !== undefined || body.images !== undefined) payload.gallery_images = body.galleryImages || body.images || [];
  if (body.metalType !== undefined) payload.metal_type = body.metalType || null;
  if (body.purity !== undefined) payload.purity = body.purity || null;
  if (body.weight !== undefined) payload.weight_grams = cleanNumber(body.weight);
  if (body.stoneDetails !== undefined) payload.stone_details = body.stoneDetails || null;
  if (body.diamondDetails !== undefined) payload.diamond_details = body.diamondDetails || null;
  if (body.price !== undefined) payload.price = cleanNumber(body.price);
  if (body.offerPrice !== undefined) payload.offer_price = cleanNumber(body.offerPrice);
  if (body.stockStatus !== undefined) payload.stock_status = stockToDb(body.stockStatus);
  if (body.status !== undefined) payload.visibility = statusToDb(body.status);
  if (body.featured !== undefined) payload.is_featured = Boolean(body.featured);
  if (body.newArrival !== undefined) payload.is_new_arrival = Boolean(body.newArrival);
  if (body.bestSeller !== undefined) payload.is_best_seller = Boolean(body.bestSeller);
  if (body.priceMode !== undefined) payload.show_contact_for_price = body.priceMode === "contact";
  if (body.priceMode !== undefined || body.priceLabel !== undefined) payload.price_note = body.priceMode === "variable" ? "Price may vary based on gold rate" : body.priceLabel || null;
  return payload;
};

const categoryToDb = (body, categoriesBySlug = {}) => {
  const payload = {};
  if (body.name !== undefined) payload.name = body.name;
  if (body.slug !== undefined || body.name !== undefined) payload.slug = body.slug || slugify(body.name);
  if (body.image !== undefined) payload.image_url = body.image || null;
  if (body.description !== undefined) payload.description = body.description || null;
  if (body.parent !== undefined) payload.parent_category_id = categoriesBySlug[body.parent] || null;
  if (body.visible !== undefined) payload.visibility = body.visible === false || body.visible === "false" ? "hidden" : "visible";
  if (body.sortOrder !== undefined) payload.sort_order = cleanNumber(body.sortOrder) || 0;
  return payload;
};

const settingsToDb = (body) => ({
  store_name: body.storeName,
  logo_url: body.logo,
  contact_number: body.contactNumber,
  whatsapp_number: body.whatsappNumber,
  email: body.email,
  address: body.address,
  google_map_link: body.googleMapLink,
  facebook_link: body.facebookLink,
  instagram_link: body.instagramLink,
  youtube_link: body.youtubeLink,
  bis_logo_url: body.bisLogo,
  huid_logo_url: body.huidLogo,
  footer_content: body.footerContent,
  opening_hours: body.openingHours,
});

const canAccess = (user, resource) => {
  if (user.role === "Super Admin" || user.role === "super_admin") return true;
  if (user.role === "Product Manager" || user.role === "product_manager") return ["products", "categories", "uploads", "duplicate-product"].includes(resource);
  if (user.role === "Content Manager" || user.role === "content_manager") return ["enquiries", "settings"].includes(resource);
  return false;
};

const getSupabaseCategories = async () => {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("categories").select("*").order("sort_order", { ascending: true });
  if (error) throw error;
  const byId = Object.fromEntries((data || []).map((row) => [row.id, row]));
  return { rows: data || [], byId, bySlug: Object.fromEntries((data || []).map((row) => [row.slug, row.id])) };
};

const getAuthUser = async (req) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const payload = verifyToken(token);
  if (!payload) return null;

  if (!hasSupabase) {
    const db = readJsonDb();
    const user = db.users.find((item) => item.id === payload.sub || item.username === payload.username);
    return user ? mapUser(user) : null;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.from("users").select("id, username, role, is_active").eq("id", payload.sub).maybeSingle();
  if (error || !data || data.is_active === false) return null;
  return mapUser(data);
};

const requireAuth = async (req, res) => {
  const user = await getAuthUser(req);
  if (!user) sendJson(res, 401, { ok: false, message: "Unauthorized" });
  return user;
};

const handleJsonFallback = async (req, res, resource, id, url) => {
  const db = readJsonDb();
  if (resource === "login" && req.method === "POST") {
    const body = await readBody(req);
    const user = db.users.find((item) => item.username === body.username && verifyPassword(body.password, item.password_hash || item.password));
    if (!user) return sendJson(res, 401, { ok: false, message: "Invalid credentials" });
    return sendJson(res, 200, { ok: true, token: createToken(user), user: mapUser(user) });
  }
  if (resource === "logout" && req.method === "POST") return sendJson(res, 200, { ok: true });
  if (resource === "public-products" && req.method === "GET") {
    const category = url.searchParams.get("category");
    const products = db.products.filter((product) => product.status === "Published" && product.visible !== false && (!category || product.category === category));
    return sendJson(res, 200, { ok: true, products });
  }
  if (resource === "products" && id && req.method === "GET") {
    const product = db.products.find((item) => item.id === id);
    return product ? sendJson(res, 200, { ok: true, product }) : sendJson(res, 404, { ok: false, message: "Product not found" });
  }
  if (resource === "settings" && req.method === "GET") return sendJson(res, 200, { ok: true, settings: db.settings });
  if (resource === "gold-rate" && req.method === "GET") {
    const latest = db.gold_rates.filter((rate) => rate.enabled !== false && rate.showOnHeader !== false).at(-1);
    if (!latest) return sendJson(res, 200, { ok: false, message: "Gold rate unavailable" });
    return sendJson(res, 200, {
      ok: true,
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
  if (resource === "enquiries" && req.method === "POST" && !(await getAuthUser(req))) {
    const enquiry = { id: `enquiry-${Date.now()}`, status: "New", date: nowIso(), ...(await readBody(req)) };
    db.enquiries.unshift(enquiry);
    writeJsonDb(db);
    return sendJson(res, 201, { ok: true, enquiry });
  }

  const user = await requireAuth(req, res);
  if (!user) return;
  if (!canAccess(user, resource)) return sendJson(res, 403, { ok: false, message: "You do not have permission for this section" });
  if (resource === "uploads" && req.method === "POST") {
    const body = await readBody(req);
    const match = String(body.dataUrl || "").match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/);
    if (!match) return sendJson(res, 400, { ok: false, message: "Upload must be a PNG, JPG, or WEBP data URL" });
    const buffer = Buffer.from(match[2], "base64");
    if (buffer.length > 5 * 1024 * 1024) return sendJson(res, 400, { ok: false, message: "Image must be 5MB or smaller" });
    const ext = match[1].split("/")[1].replace("jpeg", "jpg");
    const filename = `${Date.now()}-${slugify(body.name || "image")}.${ext}`;
    const uploadDir = path.join(process.cwd(), "images", "uploads");
    fs.mkdirSync(uploadDir, { recursive: true });
    fs.writeFileSync(path.join(uploadDir, filename), buffer);
    return sendJson(res, 201, { ok: true, url: `images/uploads/${filename}` });
  }
  if (resource === "duplicate-product" && id && req.method === "POST") {
    const source = db.products.find((item) => item.id === id);
    if (!source) return sendJson(res, 404, { ok: false, message: "Product not found" });
    const copy = { ...source, id: `product-${Date.now()}`, name: `${source.name} Copy`, slug: `${source.slug}-copy-${Date.now()}`, status: "Draft", createdAt: nowIso(), updatedAt: nowIso() };
    db.products.unshift(copy);
    writeJsonDb(db);
    return sendJson(res, 201, { ok: true, product: copy });
  }
  if (resource === "settings" && req.method === "PUT") {
    db.settings = { ...db.settings, ...(await readBody(req)), updatedAt: nowIso() };
    writeJsonDb(db);
    return sendJson(res, 200, { ok: true, settings: db.settings });
  }
  const collections = { products: "products", categories: "categories", enquiries: "enquiries", users: "users" };
  const collectionName = collections[resource];
  if (collectionName) {
    const collection = db[collectionName];
    if (req.method === "GET") {
      const payload = resource === "users" ? collection.map(({ password, password_hash, ...item }) => item) : collection;
      return sendJson(res, 200, { ok: true, [collectionName]: payload });
    }
    const body = await readBody(req);
    if (req.method === "POST") {
      const item = { id: body.id || `${resource}-${Date.now()}`, ...body, createdAt: nowIso(), updatedAt: nowIso() };
      collection.unshift(item);
      writeJsonDb(db);
      return sendJson(res, 201, { ok: true, item });
    }
    const index = collection.findIndex((item) => item.id === id);
    if (index === -1) return sendJson(res, 404, { ok: false, message: "Not found" });
    if (req.method === "PUT") {
      collection[index] = { ...collection[index], ...body, updatedAt: nowIso() };
      writeJsonDb(db);
      return sendJson(res, 200, { ok: true, item: collection[index] });
    }
    if (req.method === "DELETE") {
      collection.splice(index, 1);
      writeJsonDb(db);
      return sendJson(res, 200, { ok: true });
    }
  }
  if (resource === "gold-rates") {
    if (req.method === "GET") return sendJson(res, 200, { ok: true, gold_rates: db.gold_rates });
    const rate = { id: `gold-${Date.now()}`, ...(await readBody(req)), updatedBy: user.name, updatedAt: nowIso() };
    db.gold_rates.push(rate);
    writeJsonDb(db);
    return sendJson(res, 201, { ok: true, rate });
  }
  return sendJson(res, 404, { ok: false, message: "API route not found" });
};

module.exports = async function handler(req, res) {
  try {
    const url = new URL(req.url, `https://${req.headers.host || "ponkudam.org"}`);
    const parts = url.pathname.split("/").filter(Boolean);
    const resource = parts[1];
    const id = parts[2];

    if (!hasSupabase) return handleJsonFallback(req, res, resource, id, url);
    const supabase = getSupabase();

    if (resource === "login" && req.method === "POST") {
      const body = await readBody(req);
      let { data: user, error } = await supabase.from("users").select("*").eq("username", body.username).eq("is_active", true).maybeSingle();
      if (error) throw error;
      if (!user && body.username === "admin" && body.password === "admin123") {
        const { count, error: countError } = await supabase.from("users").select("id", { count: "exact", head: true });
        if (countError) throw countError;
        if (!count) {
          const { data: inserted, error: insertError } = await supabase
            .from("users")
            .insert({
              username: "admin",
              password_hash: hashPassword("admin123"),
              role: "super_admin",
              is_active: true,
            })
            .select()
            .single();
          if (insertError) throw insertError;
          user = inserted;
        }
      }
      if (!user || !verifyPassword(body.password, user.password_hash)) return sendJson(res, 401, { ok: false, message: "Invalid credentials" });
      return sendJson(res, 200, { ok: true, token: createToken(user), user: mapUser(user) });
    }

    if (resource === "logout" && req.method === "POST") return sendJson(res, 200, { ok: true });

    if (resource === "public-products" && req.method === "GET") {
      const { rows, byId } = await getSupabaseCategories();
      const category = url.searchParams.get("category");
      let query = supabase.from("products").select("*").eq("visibility", "published").order("created_at", { ascending: false });
      if (category) query = query.eq("category_id", Object.fromEntries(rows.map((row) => [row.slug, row.id]))[category] || "00000000-0000-0000-0000-000000000000");
      const { data, error } = await query;
      if (error) throw error;
      return sendJson(res, 200, { ok: true, products: (data || []).map((row) => mapProduct(row, byId)) });
    }

    if (resource === "products" && id && req.method === "GET") {
      const { byId } = await getSupabaseCategories();
      const cleanCode = String(id).toUpperCase().replace(/[^A-Z0-9]+/g, "-");
      const filters = [`slug.eq.${id}`, `product_code.eq.${cleanCode}`];
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) filters.unshift(`id.eq.${id}`);
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .or(filters.join(","))
        .maybeSingle();
      if (error) throw error;
      return data ? sendJson(res, 200, { ok: true, product: mapProduct(data, byId) }) : sendJson(res, 404, { ok: false, message: "Product not found" });
    }

    if (resource === "settings" && req.method === "GET") {
      const { data, error } = await supabase.from("settings").select("*").order("created_at", { ascending: true }).limit(1).maybeSingle();
      if (error) throw error;
      return sendJson(res, 200, { ok: true, settings: mapSettings(data) });
    }

    if (resource === "gold-rate" && req.method === "GET") {
      const { data, error } = await supabase
        .from("gold_rates")
        .select("*")
        .eq("is_active", true)
        .eq("marquee_enabled", true)
        .eq("show_in_header", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return sendJson(res, 200, { ok: false, message: "Gold rate unavailable" });
      return sendJson(res, 200, {
        ok: true,
        lastUpdated: data.created_at,
        display: {
          rate24K: data.rate_24k_1g,
          rate22K: data.rate_22k_1g,
          rate22K8g: data.rate_22k_8g,
          rate18K: data.rate_18k_1g,
          silverRate: data.silver_rate,
          englishMessage: data.english_message,
          malayalamMessage: data.malayalam_message,
        },
      });
    }

    if (resource === "enquiries" && req.method === "POST" && !(await getAuthUser(req))) {
      const body = await readBody(req);
      const { data, error } = await supabase
        .from("enquiries")
        .insert({
          customer_name: body.customerName,
          phone: body.phone,
          email: body.email,
          product_name: body.productName,
          product_code: body.productCode,
          product_link: body.productLink,
          price: cleanNumber(body.price),
          message: body.message,
          status: "new",
        })
        .select()
        .single();
      if (error) throw error;
      return sendJson(res, 201, { ok: true, enquiry: mapEnquiry(data) });
    }

    const user = await requireAuth(req, res);
    if (!user) return;
    if (!canAccess(user, resource)) return sendJson(res, 403, { ok: false, message: "You do not have permission for this section" });

    if (resource === "uploads" && req.method === "POST") {
      const body = await readBody(req);
      const match = String(body.dataUrl || "").match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/);
      if (!match) return sendJson(res, 400, { ok: false, message: "Upload must be a PNG, JPG, or WEBP data URL" });
      const buffer = Buffer.from(match[2], "base64");
      if (buffer.length > 5 * 1024 * 1024) return sendJson(res, 400, { ok: false, message: "Image must be 5MB or smaller" });
      const ext = match[1].split("/")[1].replace("jpeg", "jpg");
      const bucket = body.bucket || "product-images";
      const safeBucket = ["product-images", "category-images", "site-assets"].includes(bucket) ? bucket : "product-images";
      const filename = `${Date.now()}-${slugify(body.name || "image")}.${ext}`;
      const { error } = await supabase.storage.from(safeBucket).upload(filename, buffer, { contentType: match[1], upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from(safeBucket).getPublicUrl(filename);
      return sendJson(res, 201, { ok: true, url: data.publicUrl });
    }

    if (resource === "categories") {
      const { rows, byId, bySlug } = await getSupabaseCategories();
      if (req.method === "GET") return sendJson(res, 200, { ok: true, categories: rows.map((row) => mapCategory(row, byId)) });
      const body = await readBody(req);
      if (req.method === "POST") {
        const { data, error } = await supabase.from("categories").insert(categoryToDb(body, bySlug)).select().single();
        if (error) throw error;
        return sendJson(res, 201, { ok: true, item: mapCategory(data, byId) });
      }
      if (req.method === "PUT") {
        const { data, error } = await supabase.from("categories").update(categoryToDb(body, bySlug)).eq("id", id).select().single();
        if (error) throw error;
        return sendJson(res, 200, { ok: true, item: mapCategory(data, byId) });
      }
      if (req.method === "DELETE") {
        const { error } = await supabase.from("categories").delete().eq("id", id);
        if (error) throw error;
        return sendJson(res, 200, { ok: true });
      }
    }

    if (resource === "products") {
      const { byId, bySlug } = await getSupabaseCategories();
      if (req.method === "GET") {
        const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
        if (error) throw error;
        return sendJson(res, 200, { ok: true, products: (data || []).map((row) => mapProduct(row, byId)) });
      }
      const body = await readBody(req);
      if (req.method === "POST") {
        const { data, error } = await supabase.from("products").insert(productToDb(body, bySlug)).select().single();
        if (error) throw error;
        return sendJson(res, 201, { ok: true, item: mapProduct(data, byId) });
      }
      if (req.method === "PUT") {
        const { data, error } = await supabase.from("products").update(productToDb(body, bySlug)).eq("id", id).select().single();
        if (error) throw error;
        return sendJson(res, 200, { ok: true, item: mapProduct(data, byId) });
      }
      if (req.method === "DELETE") {
        const { error } = await supabase.from("products").delete().eq("id", id);
        if (error) throw error;
        return sendJson(res, 200, { ok: true });
      }
    }

    if (resource === "duplicate-product" && id && req.method === "POST") {
      const { byId, bySlug } = await getSupabaseCategories();
      const { data: source, error: findError } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
      if (findError) throw findError;
      if (!source) return sendJson(res, 404, { ok: false, message: "Product not found" });
      const copy = mapProduct(source, byId);
      copy.name = `${copy.name} Copy`;
      copy.code = `${copy.code}-COPY-${Date.now()}`;
      copy.slug = `${copy.slug}-copy-${Date.now()}`;
      copy.status = "Draft";
      const { data, error } = await supabase.from("products").insert(productToDb(copy, bySlug)).select().single();
      if (error) throw error;
      return sendJson(res, 201, { ok: true, product: mapProduct(data, byId) });
    }

    if (resource === "gold-rates") {
      if (req.method === "GET") {
        const { data, error } = await supabase.from("gold_rates").select("*").order("created_at", { ascending: true });
        if (error) throw error;
        return sendJson(res, 200, { ok: true, gold_rates: (data || []).map(mapGoldRate) });
      }
      if (req.method === "POST") {
        const body = await readBody(req);
        const { data, error } = await supabase
          .from("gold_rates")
          .insert({
            rate_24k_1g: cleanNumber(body.rate24K),
            rate_22k_1g: cleanNumber(body.rate22K),
            rate_22k_8g: cleanNumber(body.rate22K8g),
            rate_18k_1g: cleanNumber(body.rate18K),
            silver_rate: cleanNumber(body.silverRate),
            rate_date: body.rateDate || null,
            rate_time: body.rateTime || null,
            english_message: body.englishMessage || null,
            malayalam_message: body.malayalamMessage || null,
            marquee_enabled: body.enabled !== false,
            show_in_header: body.showOnHeader !== false,
            is_active: true,
            updated_by: user.id,
          })
          .select()
          .single();
        if (error) throw error;
        return sendJson(res, 201, { ok: true, rate: mapGoldRate(data) });
      }
    }

    if (resource === "enquiries") {
      if (req.method === "GET") {
        const { data, error } = await supabase.from("enquiries").select("*").order("created_at", { ascending: false });
        if (error) throw error;
        return sendJson(res, 200, { ok: true, enquiries: (data || []).map(mapEnquiry) });
      }
      if (req.method === "PUT") {
        const { data, error } = await supabase.from("enquiries").update({ status: enquiryStatusToDb((await readBody(req)).status) }).eq("id", id).select().single();
        if (error) throw error;
        return sendJson(res, 200, { ok: true, item: mapEnquiry(data) });
      }
      if (req.method === "DELETE") {
        const { error } = await supabase.from("enquiries").delete().eq("id", id);
        if (error) throw error;
        return sendJson(res, 200, { ok: true });
      }
    }

    if (resource === "settings") {
      if (req.method === "PUT") {
        const body = await readBody(req);
        const { data: existing } = await supabase.from("settings").select("id").order("created_at", { ascending: true }).limit(1).maybeSingle();
        const payload = settingsToDb(body);
        const query = existing
          ? supabase.from("settings").update(payload).eq("id", existing.id)
          : supabase.from("settings").insert(payload);
        const { data, error } = await query.select().single();
        if (error) throw error;
        return sendJson(res, 200, { ok: true, settings: mapSettings(data) });
      }
    }

    if (resource === "users" && req.method === "GET") {
      const { data, error } = await supabase.from("users").select("id, username, role, is_active, created_at, updated_at").order("created_at", { ascending: true });
      if (error) throw error;
      return sendJson(res, 200, { ok: true, users: (data || []).map(mapUser) });
    }

    return sendJson(res, 404, { ok: false, message: "API route not found" });
  } catch (error) {
    return sendJson(res, 500, { ok: false, message: error.message });
  }
};
