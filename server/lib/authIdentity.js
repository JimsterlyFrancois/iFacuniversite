const DEFAULT_USER_PAGE_SIZE = 1000;
const MAX_USER_PAGES = 10;

/**
 * Resolve a profile's external Auth identity without querying the provider's
 * private PostgreSQL schema. This keeps the application database portable to
 * Neon while the Auth provider remains a separate service.
 */
export async function resolveAuthUserId(client, userId, linkedAuthUserId = null, options = {}) {
  if (typeof linkedAuthUserId === "string" && linkedAuthUserId.length > 0) return linkedAuthUserId;

  const profile = await client.query(
    "SELECT email,auth_user_id FROM users WHERE id=$1 LIMIT 1",
    [userId]
  );
  const storedId = profile.rows?.[0]?.auth_user_id;
  if (typeof storedId === "string" && storedId.length > 0) return storedId;

  const email = profile.rows?.[0]?.email;
  const supabaseUrl = String(options.supabaseUrl ?? process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
  const secretKey = options.secretKey ?? process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof email !== "string" || !email || !supabaseUrl || !secretKey || typeof fetchImpl !== "function") return null;

  for (let page = 1; page <= MAX_USER_PAGES; page += 1) {
    const response = await fetchImpl(
      `${supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=${DEFAULT_USER_PAGE_SIZE}`,
      { method: "GET", headers: { apikey: secretKey, Authorization: `Bearer ${secretKey}` } }
    );
    if (!response.ok) throw new Error("supabase_auth_user_lookup_failed");

    const payload = await response.json().catch(() => null);
    const users = Array.isArray(payload?.users) ? payload.users : [];
    const matchedUser = users.find(
      candidate => typeof candidate?.email === "string" && candidate.email.toLowerCase() === email.toLowerCase()
    );

    if (matchedUser && typeof matchedUser.id === "string" && matchedUser.id) {
      const saved = await client.query(
        "UPDATE users SET auth_user_id=COALESCE(auth_user_id,$1) WHERE id=$2 RETURNING auth_user_id",
        [matchedUser.id, userId]
      );
      return saved.rows?.[0]?.auth_user_id || matchedUser.id;
    }
    if (users.length < DEFAULT_USER_PAGE_SIZE) break;
  }

  return null;
}
