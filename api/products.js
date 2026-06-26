const { json, mapProduct, request, verifyToken } = require("./_shared.cjs");

module.exports = async function handler(req, res) {
  try {
    if (!verifyToken(req)) return json(res, 401, { ok: false, message: "Unauthorized" });
    const [categories, products] = await Promise.all([
      request("categories?select=*"),
      request("products?select=*&order=created_at.desc"),
    ]);
    const byId = Object.fromEntries(categories.map((row) => [row.id, row]));
    return json(res, 200, { ok: true, products: products.map((row) => mapProduct(row, byId)) });
  } catch (error) {
    return json(res, 500, { ok: false, message: error.message });
  }
};
