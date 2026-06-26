const { createToken, json, mapUser, readBody, request, verifyPassword } = require("./_shared.cjs");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") return json(res, 405, { ok: false, message: "Method not allowed" });
    const body = await readBody(req);
    const users = await request(`users?username=eq.${encodeURIComponent(body.username)}&is_active=eq.true&select=*`);
    const user = users[0];
    if (!user || !verifyPassword(body.password, user.password_hash)) return json(res, 401, { ok: false, message: "Invalid credentials" });
    return json(res, 200, { ok: true, token: createToken(user), user: mapUser(user) });
  } catch (error) {
    return json(res, 500, { ok: false, message: error.message });
  }
};
