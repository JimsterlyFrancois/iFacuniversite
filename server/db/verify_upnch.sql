-- Vérification après schema.sql puis seed_upnch.sql.
-- À exécuter dans Supabase > SQL Editor.
-- Ce script ne modifie aucune donnée.

SELECT 'universities' AS table_name, COUNT(*) AS total,
       COUNT(*) FILTER (WHERE is_active) AS active_total
FROM universities
UNION ALL
SELECT 'faculties', COUNT(*), COUNT(*) FILTER (WHERE is_active)
FROM faculties
UNION ALL
SELECT 'options', COUNT(*), COUNT(*) FILTER (WHERE is_active)
FROM options
UNION ALL
SELECT 'study_levels', COUNT(*), COUNT(*) FILTER (WHERE is_active)
FROM study_levels
ORDER BY table_name;

-- Contrôle attendu pour le catalogue UPNCH de cette version :
-- universities = 1, faculties = 4, options = 12, study_levels = 48.
SELECT
  (SELECT COUNT(*) FROM universities WHERE code = 'UPNCH' AND is_active) AS active_upnch,
  (SELECT COUNT(*) FROM faculties f JOIN universities u ON u.id = f.university_id
   WHERE u.code = 'UPNCH' AND f.is_active) AS active_faculties,
  (SELECT COUNT(*) FROM options o JOIN faculties f ON f.id = o.faculty_id
   JOIN universities u ON u.id = f.university_id
   WHERE u.code = 'UPNCH' AND o.is_active) AS active_options,
  (SELECT COUNT(*) FROM study_levels l JOIN options o ON o.id = l.option_id
   JOIN faculties f ON f.id = o.faculty_id
   JOIN universities u ON u.id = f.university_id
   WHERE u.code = 'UPNCH' AND l.is_active) AS active_study_levels;

-- Contrôle API côté Vercel : ouvrir https://TON-DOMAINE/api/health
-- Résultat attendu : status = "ok", database = "connected".
