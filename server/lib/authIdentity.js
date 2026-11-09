export async function resolveAuthUserId(client, userId, linkedAuthUserId = null) {
  if (typeof linkedAuthUserId === "string" && linkedAuthUserId.length > 0) return linkedAuthUserId;
  const result = await client.query(
    "SELECT au.id FROM auth.users au JOIN users u ON lower(u.email)=lower(au.email) WHERE u.id=$1 LIMIT 1",
    [userId]
  );
  const authUserId = result.rows?.[0]?.id || null;
  if (authUserId) await client.query("UPDATE users SET auth_user_id=$1 WHERE id=$2", [authUserId,userId]);
  return authUserId;
}
