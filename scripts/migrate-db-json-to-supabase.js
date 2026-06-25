const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const dbPath = path.join(__dirname, "..", "data", "db.json");
const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

const db = JSON.parse(fs.readFileSync(dbPath, "utf8"));

const roleToDb = (role) =>
  ({
    "Super Admin": "super_admin",
    "Product Manager": "product_manager",
    "Content Manager": "content_manager",
    super_admin: "super_admin",
    product_manager: "product_manager",
    content_manager: "content_manager",
  })[role] || "content_manager";

const statusToDb = (status) =>
  ({
    Published: "published",
    Draft: "draft",
    Hidden: "hidden",
    published: "published",
    draft: "draft",
    hidden: "hidden",
  })[status] || "published";

const stockToDb = (status) =>
  ({
    "In Stock": "in_stock",
    "Out of Stock": "out_of_stock",
    "Made to Order": "made_to_order",
    in_stock: "in_stock",
    out_of_stock: "out_of_stock",
    made_to_order: "made_to_order",
  })[status] || "in_stock";

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(String(password), salt, 120000, 32, "sha256").toString("hex");
  return `pbkdf2_sha256$120000$${salt}$${hash}`;
};

const cleanNumber = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const upsert = async (table, rows, conflict) => {
  if (!rows.length) return [];
  const { data, error } = await supabase.from(table).upsert(rows, { onConflict: conflict }).select();
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`${table}: upserted ${data.length}`);
  return data;
};

(async () => {
  const users = await upsert(
    "users",
    (db.users || []).map((user) => ({
      username: user.username,
      email: user.email || null,
      password_hash: user.password_hash || hashPassword(user.password || "changeme"),
      role: roleToDb(user.role),
      is_active: true,
    })),
    "username"
  );

  const categories = await upsert(
    "categories",
    (db.categories || []).map((category) => ({
      name: category.name,
      slug: category.slug || category.id,
      image_url: category.image || category.image_url || null,
      description: category.description || null,
      visibility: category.visible === false || category.visibility === "hidden" ? "hidden" : "visible",
      sort_order: cleanNumber(category.sortOrder) || 0,
    })),
    "slug"
  );

  const categoryBySlug = Object.fromEntries(categories.map((category) => [category.slug, category.id]));
  const categoryRowsWithParents = (db.categories || [])
    .filter((category) => category.parent && categoryBySlug[category.slug])
    .map((category) => ({
      id: categoryBySlug[category.slug],
      parent_category_id: categoryBySlug[category.parent] || null,
    }));
  if (categoryRowsWithParents.length) await upsert("categories", categoryRowsWithParents, "id");

  await upsert(
    "products",
    (db.products || []).map((product) => ({
      product_name: product.name,
      product_code: product.code || product.id,
      slug: product.slug || product.id,
      category_id: categoryBySlug[product.category] || null,
      subcategory_id: categoryBySlug[product.subcategory] || null,
      product_type: product.type || null,
      short_description: product.shortDescription || null,
      full_description: product.fullDescription || null,
      featured_image_url: product.featuredImage || product.image || null,
      gallery_images: product.galleryImages || product.images || [],
      metal_type: product.metalType || null,
      purity: product.purity || null,
      weight_grams: cleanNumber(product.weight),
      stone_details: product.stoneDetails || null,
      diamond_details: product.diamondDetails || null,
      price: cleanNumber(product.price),
      offer_price: cleanNumber(product.offerPrice),
      stock_status: stockToDb(product.stockStatus),
      visibility: statusToDb(product.status),
      is_featured: Boolean(product.featured),
      is_new_arrival: Boolean(product.newArrival),
      is_best_seller: Boolean(product.bestSeller),
      show_contact_for_price: product.priceMode === "contact",
      price_note: product.priceMode === "variable" ? "Price may vary based on gold rate" : null,
    })),
    "product_code"
  );

  const userByName = Object.fromEntries(users.map((user) => [user.username, user.id]));
  const { count: existingGoldRateCount, error: goldCountError } = await supabase
    .from("gold_rates")
    .select("id", { count: "exact", head: true });
  if (goldCountError) throw new Error(`gold_rates: ${goldCountError.message}`);
  if (!existingGoldRateCount) {
    const { data, error } = await supabase
      .from("gold_rates")
      .insert((db.gold_rates || []).map((rate) => ({
      rate_24k_1g: cleanNumber(rate.rate24K),
      rate_22k_1g: cleanNumber(rate.rate22K),
      rate_22k_8g: cleanNumber(rate.rate22K8g),
      rate_18k_1g: cleanNumber(rate.rate18K),
      silver_rate: cleanNumber(rate.silverRate),
      rate_date: rate.rateDate || null,
      rate_time: rate.rateTime || null,
      english_message: rate.englishMessage || null,
      malayalam_message: rate.malayalamMessage || null,
      marquee_enabled: rate.enabled !== false,
      show_in_header: rate.showOnHeader !== false,
      is_active: true,
      updated_by: userByName.admin || null,
    })))
      .select();
    if (error) throw new Error(`gold_rates: ${error.message}`);
    console.log(`gold_rates: inserted ${data.length}`);
  } else {
    console.log("gold_rates: skipped because rows already exist");
  }

  await upsert(
    "enquiries",
    (db.enquiries || []).map((enquiry) => ({
      customer_name: enquiry.customerName || null,
      phone: enquiry.phone || null,
      email: enquiry.email || null,
      product_name: enquiry.productName || null,
      product_code: enquiry.productCode || null,
      product_link: enquiry.productLink || null,
      price: cleanNumber(enquiry.price),
      message: enquiry.message || null,
      status: String(enquiry.status || "new").toLowerCase(),
    })),
    "id"
  );

  if (db.settings) {
    const settingsPayload = {
      store_name: db.settings.storeName,
      logo_url: db.settings.logo,
      contact_number: db.settings.contactNumber,
      whatsapp_number: db.settings.whatsappNumber,
      email: db.settings.email,
      address: db.settings.address,
      google_map_link: db.settings.googleMapLink,
      facebook_link: db.settings.facebookLink,
      instagram_link: db.settings.instagramLink,
      youtube_link: db.settings.youtubeLink,
      bis_logo_url: db.settings.bisLogo,
      footer_content: db.settings.footerContent,
      opening_hours: db.settings.openingHours,
    };
    const { data: existingSettings, error: settingsFindError } = await supabase
      .from("settings")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (settingsFindError) throw new Error(`settings: ${settingsFindError.message}`);
    const settingsQuery = existingSettings
      ? supabase.from("settings").update(settingsPayload).eq("id", existingSettings.id)
      : supabase.from("settings").insert(settingsPayload);
    const { error } = await settingsQuery;
    if (error) throw new Error(`settings: ${error.message}`);
    console.log(existingSettings ? "settings: updated 1" : "settings: inserted 1");
  }

  console.log("Migration complete.");
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
