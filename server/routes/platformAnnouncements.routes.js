import express from "express";

export function createPlatformAnnouncementsRouter({ pool, requireAuth }) {
  const router = express.Router();

  router.get("/general-announcements", requireAuth, async (req, res) => {
    const userId = Number(req.user?.id);
    if (!Number.isSafeInteger(userId) || userId < 1) return res.status(401).json({ error: "authentication_required" });
    try {
      const result = await pool.query(`
        WITH user_roles(role) AS (
          SELECT CASE WHEN u.role='admin' THEN 'admin_general' ELSE u.role END
          FROM users u WHERE u.id=$1 AND u.is_active=TRUE
          UNION
          SELECT ra.role
          FROM role_assignments ra
          JOIN users u ON u.id=ra.user_id AND u.is_active=TRUE
          WHERE ra.user_id=$1 AND ra.status='active'
          UNION
          SELECT 'professor'
          WHERE EXISTS (
            SELECT 1 FROM professor_invites pi
            JOIN professor_assignments pa ON pa.invite_id=pi.id
            WHERE pi.user_id=$1 AND pi.is_active=TRUE AND pa.is_active=TRUE AND pa.approval_status='approved'
          )
        ),
        user_scopes(university_id,faculty_id,option_id,study_level_id) AS (
          SELECT u.university_id,u.faculty_id,u.option_id,u.study_level_id
          FROM users u
          WHERE u.id=$1 AND u.is_active=TRUE AND u.university_id IS NOT NULL
          UNION
          SELECT ra.university_id,ra.faculty_id,ra.option_id,ra.study_level_id
          FROM role_assignments ra
          JOIN users u ON u.id=ra.user_id AND u.is_active=TRUE
          WHERE ra.user_id=$1 AND ra.status='active' AND ra.university_id IS NOT NULL
          UNION
          SELECT pa.university_id,pa.faculty_id,pa.option_id,pa.study_level_id
          FROM professor_invites pi
          JOIN professor_assignments pa ON pa.invite_id=pi.id
          JOIN users u ON u.id=pi.user_id AND u.is_active=TRUE
          WHERE pi.user_id=$1 AND pi.is_active=TRUE AND pa.is_active=TRUE AND pa.approval_status='approved'
        )
        SELECT DISTINCT a.id,a.title,a.body,a.created_at
        FROM platform_announcements a
        JOIN platform_announcement_targets t ON t.announcement_id=a.id
        WHERE a.is_active=TRUE
          AND (a.starts_at IS NULL OR a.starts_at<=NOW())
          AND (a.ends_at IS NULL OR a.ends_at>NOW())
          AND (
            CARDINALITY(t.target_roles)=0
            OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.role=ANY(t.target_roles))
          )
          AND (
            (
              t.university_id IS NULL AND t.faculty_id IS NULL AND t.option_id IS NULL AND t.study_level_id IS NULL
              AND (
                EXISTS (SELECT 1 FROM user_scopes s JOIN universities un ON un.id=s.university_id AND un.is_active=TRUE)
                OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.role='admin_general')
              )
            )
            OR EXISTS (
              SELECT 1
              FROM user_scopes s
              JOIN universities un ON un.id=s.university_id AND un.is_active=TRUE
              WHERE (t.university_id IS NULL OR t.university_id=s.university_id)
                AND (t.faculty_id IS NULL OR t.faculty_id=s.faculty_id OR
                  (s.faculty_id IS NULL AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.role='university_admin')))
                AND (t.option_id IS NULL OR t.option_id=s.option_id OR
                  (s.option_id IS NULL AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.role IN ('university_admin','faculty_manager'))))
                AND (t.study_level_id IS NULL OR t.study_level_id=s.study_level_id OR
                  (s.study_level_id IS NULL AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.role IN ('university_admin','faculty_manager','program_manager'))))
            )
          )
        ORDER BY a.created_at DESC
        LIMIT 30
      `, [userId]);
      res.set("Cache-Control", "private, no-store");
      return res.json({ data: result.rows });
    } catch (error) {
      console.error("platform announcement feed:", error.message);
      return res.status(503).json({ error: "platform_announcements_unavailable" });
    }
  });

  return router;
}
