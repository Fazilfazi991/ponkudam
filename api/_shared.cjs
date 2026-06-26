const crypto = require("crypto");

const normalizeSupabaseUrl = (value) => {
  let raw = String(value || "").trim().replace(/^["']|["']$/g, "");
  raw = raw.replace(/^SUPABASE_URL\s*=\s*/i, "").trim();
  const match = raw.match(/https?:\/\/[^\s"']+|[a-z0-9-]+\.supabase\.co/i);
  if (match) raw = match[0];
  if (!raw) return "";
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withProtocol).toString().replace(/\/$/, "");
  } catch {
    return "";
  }
};

const normalizeSecret = (value) => {
  let raw = String(value || "").trim().replace(/^["']|["']$/g, "");
  raw = raw.replace(/^SUPABASE_(SERVICE_ROLE_KEY|ANON_KEY)\s*=\s*/i, "").trim();
  const match = raw.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  return match ? match[0] : raw;
};

const supabaseUrl = normalizeSupabaseUrl(process.env.SUPABASE_URL);
const supabaseKey = normalizeSecret(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);
const tokenSecret = normalizeSecret(process.env.ADMIN_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "ponkudam-local-dev-secret");

const json = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
  });

const request = async (path, options = {}) => {
  if (!supabaseUrl || !supabaseKey) throw new Error("Supabase environment variables are missing or invalid");
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(data?.message || data?.hint || response.statusText);
  return data;
};

const verifyPassword = (password, stored) => {
  if (!stored) return false;
  if (!stored.includes("$")) return password === stored;
  const [method, iterations, salt, expected] = stored.split("$");
  if (method !== "pbkdf2_sha256") return false;
  const hash = crypto.pbkdf2Sync(String(password), salt, Number(iterations), 32, "sha256").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expected));
};

const sign = (payload) => crypto.createHmac("sha256", tokenSecret).update(payload).digest("base64url");
const createToken = (user) => {
  const payload = Buffer.from(JSON.stringify({ sub: user.id, username: user.username, role: user.role, iat: Date.now() })).toString("base64url");
  return `${payload}.${sign(payload)}`;
};

const verifyToken = (req) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  if (signature !== sign(payload)) return null;
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
};

const roleToApi = (role) =>
  ({ super_admin: "Super Admin", product_manager: "Product Manager", content_manager: "Content Manager" })[role] || role || "Content Manager";

const statusToApi = (status) => ({ published: "Published", draft: "Draft", hidden: "Hidden" })[status] || "Published";
const stockToApi = (status) => ({ in_stock: "In Stock", out_of_stock: "Out of Stock", made_to_order: "Made to Order" })[status] || "In Stock";

const mapUser = (user) => ({ id: user.id, username: user.username, name: user.username, role: roleToApi(user.role) });
const mapCategory = (row, byId = {}) => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  image: row.image_url || "",
  description: row.description || "",
  parent: row.parent_category_id ? byId[row.parent_category_id]?.slug || "" : "",
  visible: row.visibility !== "hidden",
  sortOrder: row.sort_order || 0,
});
const mapProduct = (row, categoriesById = {}) => ({
  id: row.id,
  name: row.product_name,
  code: row.product_code,
  slug: row.slug,
  category: row.category_id ? categoriesById[row.category_id]?.slug || "" : "",
  type: row.product_type || "",
  shortDescription: row.short_description || "",
  fullDescription: row.full_description || "",
  featuredImage: row.featured_image_url || "",
  image: row.featured_image_url || "",
  galleryImages: row.gallery_images || [],
  metalType: row.metal_type || "",
  purity: row.purity || "",
  weight: row.weight_grams ?? "",
  price: row.price,
  offerPrice: row.offer_price ?? "",
  priceMode: row.show_contact_for_price ? "contact" : row.price_note ? "variable" : "show",
  stockStatus: stockToApi(row.stock_status),
  status: statusToApi(row.visibility),
  visible: row.visibility !== "hidden",
  featured: Boolean(row.is_featured),
  newArrival: Boolean(row.is_new_arrival),
  bestSeller: Boolean(row.is_best_seller),
});

module.exports = {
  createToken,
  json,
  mapCategory,
  mapProduct,
  mapUser,
  readBody,
  request,
  verifyPassword,
  verifyToken,
};
