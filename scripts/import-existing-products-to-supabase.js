const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { createClient } = require("@supabase/supabase-js");

const root = path.join(__dirname, "..");
const dbPath = path.join(root, "data", "db.json");
const productBucket = "product-images";
const dryRun = process.argv.includes("--dry-run");
const report = {
  productsFound: 0,
  productsImported: 0,
  categoriesImported: 0,
  imagesUploaded: 0,
  skipped: [],
  missingFields: [],
  errors: [],
};

const loadEnv = () => {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
};

loadEnv();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!dryRun && (!supabaseUrl || !serviceKey)) {
  console.error("Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY.");
  process.exit(1);
}

if (!dryRun && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("SUPABASE_SERVICE_ROLE_KEY is not set. Falling back to SUPABASE_ANON_KEY; uploads/writes may fail if policies block anon writes.");
}

const supabase = dryRun ? null : createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const titleCase = (value) =>
  String(value || "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const cleanNumber = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const stockToDb = (status) =>
  ({
    "In Stock": "in_stock",
    "Out of Stock": "out_of_stock",
    "Made to Order": "made_to_order",
    in_stock: "in_stock",
    out_of_stock: "out_of_stock",
    made_to_order: "made_to_order",
  })[status] || "in_stock";

const statusToDb = (status) =>
  ({
    Published: "published",
    Draft: "draft",
    Hidden: "hidden",
    published: "published",
    draft: "draft",
    hidden: "hidden",
  })[status] || "published";

const readDb = () => JSON.parse(fs.readFileSync(dbPath, "utf8"));

const loadJsProducts = () => {
  const context = {
    window: {},
    Intl,
  };
  context.window.window = context.window;
  vm.createContext(context);
  for (const file of ["products.js", "diamond-products.js"]) {
    const filePath = path.join(root, file);
    if (fs.existsSync(filePath)) vm.runInContext(fs.readFileSync(filePath, "utf8"), context, { filename: file });
  }

  return [
    ...(context.window.featuredProducts || []),
    ...(context.window.allStandardProducts || []),
    ...(context.window.diamondProducts || []).map((product) => ({ ...product, category: product.category || "diamond" })),
  ];
};

const normalizeProduct = (product, index) => {
  const name = product.name || product.product_name;
  const legacyId = product.id || product.legacyId || "";
  const category = product.category || (legacyId.includes("diamond") ? "diamond" : "");
  const code = product.code || product.product_code || (legacyId ? legacyId.toUpperCase().replace(/[^A-Z0-9]+/g, "-") : `PKD-${String(index + 1).padStart(3, "0")}`);
  const featuredImage = product.featuredImage || product.image || product.featured_image_url || "";
  const galleryImages = product.galleryImages || product.images || product.gallery_images || (featuredImage ? [featuredImage] : []);

  if (!name) report.missingFields.push(`${legacyId || code}: missing name`);
  if (!category) report.missingFields.push(`${name || code}: missing category`);
  if (!featuredImage) report.missingFields.push(`${name || code}: missing featured image`);

  return {
    legacyId,
    name,
    code,
    slug: product.slug || slugify(name || code),
    category: category || "uncategorized",
    subcategory: product.subcategory || "",
    type: product.type || product.product_type || "",
    shortDescription: product.shortDescription || product.description || product.short_description || "",
    fullDescription: product.fullDescription || product.description || product.full_description || "",
    featuredImage,
    galleryImages: [...new Set(galleryImages.filter(Boolean))],
    metalType: product.metalType || product.metal_type || (category === "diamond" ? "Diamond" : "Gold"),
    purity: product.purity || "",
    weight: product.weight || product.weight_grams || "",
    stoneDetails: product.stoneDetails || product.stone_details || "",
    diamondDetails: product.diamondDetails || product.diamond_details || "",
    price: cleanNumber(product.price),
    offerPrice: cleanNumber(product.offerPrice || product.offer_price),
    priceMode: product.priceMode || (product.price ? "show" : "contact"),
    stockStatus: product.stockStatus || "In Stock",
    status: product.status || "Published",
    featured: Boolean(product.featured || legacyId.startsWith("featured-")),
    newArrival: Boolean(product.newArrival),
    bestSeller: Boolean(product.bestSeller),
  };
};

const collectProducts = () => {
  const db = readDb();
  const found = [...(db.products || []), ...loadJsProducts()].map(normalizeProduct);
  const seen = new Set();
  const products = [];
  for (const product of found) {
    const key = product.legacyId || product.code || product.slug;
    if (seen.has(key)) {
      report.skipped.push(`${key}: duplicate local source`);
      continue;
    }
    seen.add(key);
    products.push(product);
  }
  report.productsFound = products.length;
  return { db, products };
};

const getMime = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
};

const imageCache = new Map();

const resolveLocalImage = (imagePath) => {
  if (!imagePath || /^https?:\/\//i.test(imagePath)) return null;
  const decoded = decodeURIComponent(imagePath).replace(/^\//, "");
  const localPath = path.join(root, decoded);
  return fs.existsSync(localPath) ? localPath : null;
};

const uploadImage = async (imagePath, productSlug) => {
  if (!imagePath) return "";
  if (/^https?:\/\//i.test(imagePath)) return imagePath;
  if (imageCache.has(imagePath)) return imageCache.get(imagePath);

  const localPath = resolveLocalImage(imagePath);
  if (!localPath) {
    report.errors.push(`Missing image: ${imagePath}`);
    imageCache.set(imagePath, imagePath);
    return imagePath;
  }

  const hash = crypto.createHash("sha1").update(imagePath).digest("hex").slice(0, 10);
  const ext = path.extname(localPath).toLowerCase() || ".webp";
  const filename = `${slugify(productSlug)}/${hash}-${slugify(path.basename(localPath, ext))}${ext}`;
  const buffer = fs.readFileSync(localPath);
  const { error } = await supabase.storage.from(productBucket).upload(filename, buffer, {
    contentType: getMime(localPath),
    upsert: true,
  });

  if (error) {
    report.errors.push(`Upload failed for ${imagePath}: ${error.message}`);
    imageCache.set(imagePath, imagePath);
    return imagePath;
  }

  const { data } = supabase.storage.from(productBucket).getPublicUrl(filename);
  report.imagesUploaded += 1;
  imageCache.set(imagePath, data.publicUrl);
  return data.publicUrl;
};

const upsertCategories = async (db, products) => {
  const categoryMap = new Map();
  for (const category of db.categories || []) {
    categoryMap.set(category.slug || category.id, {
      name: category.name || titleCase(category.slug || category.id),
      slug: category.slug || category.id,
      image_url: category.image || null,
      description: category.description || null,
      visibility: category.visible === false ? "hidden" : "visible",
      sort_order: cleanNumber(category.sortOrder) || categoryMap.size + 1,
    });
  }

  for (const product of products) {
    if (!categoryMap.has(product.category)) {
      categoryMap.set(product.category, {
        name: titleCase(product.category),
        slug: product.category,
        image_url: null,
        description: null,
        visibility: "visible",
        sort_order: categoryMap.size + 1,
      });
    }
  }

  const rows = [...categoryMap.values()];
  const { data, error } = await supabase.from("categories").upsert(rows, { onConflict: "slug" }).select();
  if (error) throw new Error(`categories: ${error.message}`);
  report.categoriesImported = data.length;
  return Object.fromEntries(data.map((category) => [category.slug, category.id]));
};

const importProducts = async (products, categoryBySlug) => {
  let counter = 1;
  for (const product of products) {
    try {
      const code = product.code || `PKD-${String(counter++).padStart(3, "0")}`;
      const featuredImage = await uploadImage(product.featuredImage, product.slug);
      const galleryImages = [];
      for (const image of product.galleryImages.length ? product.galleryImages : [product.featuredImage]) {
        const uploaded = await uploadImage(image, product.slug);
        if (uploaded) galleryImages.push(uploaded);
      }

      const payload = {
        product_name: product.name,
        product_code: code,
        slug: product.slug,
        category_id: categoryBySlug[product.category] || null,
        subcategory_id: categoryBySlug[product.subcategory] || null,
        product_type: product.type || null,
        short_description: product.shortDescription || null,
        full_description: product.fullDescription || null,
        featured_image_url: featuredImage || null,
        gallery_images: [...new Set(galleryImages)],
        metal_type: product.metalType || null,
        purity: product.purity || null,
        weight_grams: cleanNumber(product.weight),
        stone_details: product.stoneDetails || null,
        diamond_details: product.diamondDetails || null,
        price: cleanNumber(product.price),
        offer_price: cleanNumber(product.offerPrice),
        stock_status: stockToDb(product.stockStatus),
        visibility: statusToDb(product.status),
        is_featured: product.featured,
        is_new_arrival: product.newArrival,
        is_best_seller: product.bestSeller,
        show_contact_for_price: product.priceMode === "contact",
        price_note: product.priceMode === "variable" ? "Price may vary based on gold rate" : product.legacyId || null,
      };

      const { error } = await supabase.from("products").upsert(payload, { onConflict: "product_code" });
      if (error) throw error;
      report.productsImported += 1;
      console.log(`Imported: ${code} - ${product.name}`);
    } catch (error) {
      report.errors.push(`${product.code || product.name}: ${error.message}`);
      console.error(`Failed: ${product.code || product.name} - ${error.message}`);
    }
  }
};

(async () => {
  const { db, products } = collectProducts();
  if (dryRun) {
    const categories = new Set([...(db.categories || []).map((category) => category.slug || category.id), ...products.map((product) => product.category)]);
    const imageCount = new Set(products.flatMap((product) => [product.featuredImage, ...product.galleryImages].filter(Boolean))).size;
    console.log(JSON.stringify({
      productsFound: products.length,
      categoriesFound: categories.size,
      uniqueImagesFound: imageCount,
      missingFields: report.missingFields,
      skipped: report.skipped,
    }, null, 2));
    return;
  }
  const categoryBySlug = await upsertCategories(db, products);
  await importProducts(products, categoryBySlug);

  console.log("\nImport report");
  console.log(JSON.stringify(report, null, 2));
  if (report.errors.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
