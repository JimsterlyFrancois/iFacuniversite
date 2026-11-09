export async function updateSupabaseUserPassword({ supabaseUrl, secretKey, userId, password, fetchImpl = globalThis.fetch }) {
  if (!supabaseUrl || !secretKey || !userId || typeof password !== "string" || typeof fetchImpl !== "function") {
    return { ok: false, status: 0 };
  }
  const baseUrl = supabaseUrl.replace(/\/$/, "");
  const response = await fetchImpl(baseUrl + "/auth/v1/admin/users/" + encodeURIComponent(userId), {
    method: "PUT",
    headers: {
      apikey: secretKey,
      Authorization: "Bearer " + secretKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ password })
  });
  return { ok: response.ok, status: response.status };
}
