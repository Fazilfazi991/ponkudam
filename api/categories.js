const { json, mapCategory, request, verifyToken } = require("./_shared.cjs");

module.exports = async function handler(req, res) {
  try {
    if (!verifyToken(req)) return json(res, 401, { ok: false, message: "Unauthorized" });
    const rows = await request("categories?select=*&order=sort_order.asc");
    const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
    return json(res, 200, { ok: true, categories: rows.map((row) => mapCategory(row, byId)) });
  } catch (error) {
    return json(res, 500, { ok: false, message: error.message });
  }
};
