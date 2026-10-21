-- Catalogue initial iFac — UPNCH uniquement.
-- Les autres universités publiques ne sont PAS activées dans cette version.
-- Les noms ci-dessous reprennent les facultés/options connues dans le cahier des charges
-- iFac. Vérifier les intitulés administratifs exacts auprès de l'UPNCH avant production.
-- Idempotent : peut être exécuté plusieurs fois sans dupliquer les lignes.
-- Prérequis : exécuter d'abord server/db/schema.sql sur la base PostgreSQL configurée.

BEGIN;

INSERT INTO universities (code, name, is_active)
VALUES ('UPNCH', 'Université Publique du Nord au Cap-Haïtien', TRUE)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, is_active = TRUE, updated_at = NOW();

WITH faculty_seed(code, name) AS (
  VALUES
    ('FSE', 'Faculté des Sciences de l’Éducation'),
    ('ESSAP_MT_TS', 'École de Santé Publique, Médecine Tropicale et Travail Social'),
    ('ESUTH', 'École Supérieure Universitaire de Tourisme et d’Hôtellerie'),
    ('FDSPRI', 'Faculté de Droit, Sciences Politiques et Relations Internationales')
)
INSERT INTO faculties (university_id, code, name, is_active)
SELECT u.id, fs.code, fs.name, TRUE
FROM universities u CROSS JOIN faculty_seed fs
WHERE u.code = 'UPNCH'
ON CONFLICT (university_id, code) DO UPDATE
SET name = EXCLUDED.name, is_active = TRUE, updated_at = NOW();

WITH option_seed(faculty_code, code, name) AS (
  VALUES
    ('FSE', 'PSYCHOPEDAGOGIE', 'Psychopédagogie'),
    ('FSE', 'ADMINISTRATION_SCOLAIRE', 'Administration scolaire'),
    ('FSE', 'MATHEMATIQUES_PHYSIQUE', 'Mathématiques et Physique'),
    ('FSE', 'HISTOIRE_GEOGRAPHIE', 'Histoire et Géographie'),
    ('ESSAP_MT_TS', 'SANTE_PUBLIQUE', 'Santé Publique'),
    ('ESSAP_MT_TS', 'MEDECINE_TROPICALE', 'Médecine Tropicale'),
    ('ESSAP_MT_TS', 'TRAVAIL_SOCIAL', 'Travail Social'),
    ('ESUTH', 'GESTION_TOURISTIQUE', 'Gestion Touristique'),
    ('ESUTH', 'HOTELLERIE_RESTAURATION', 'Hôtellerie et Restauration'),
    ('FDSPRI', 'SCIENCES_JURIDIQUES_DROIT', 'Sciences Juridiques / Droit'),
    ('FDSPRI', 'SCIENCE_POLITIQUE', 'Science Politique'),
    ('FDSPRI', 'RELATIONS_INTERNATIONALES', 'Relations Internationales')
)
INSERT INTO options (faculty_id, code, name, is_active)
SELECT f.id, os.code, os.name, TRUE
FROM faculties f
JOIN universities u ON u.id = f.university_id
JOIN option_seed os ON os.faculty_code = f.code
WHERE u.code = 'UPNCH'
ON CONFLICT (faculty_id, code) DO UPDATE
SET name = EXCLUDED.name, is_active = TRUE, updated_at = NOW();

WITH level_seed(code, label, sort_order) AS (
  VALUES
    ('L1', '1ère année', 1),
    ('L2', '2ème année', 2),
    ('L3', '3ème année', 3),
    ('L4', '4ème année', 4)
)
INSERT INTO study_levels (option_id, code, label, sort_order, is_active)
SELECT o.id, ls.code, ls.label, ls.sort_order, TRUE
FROM options o
JOIN faculties f ON f.id = o.faculty_id
JOIN universities u ON u.id = f.university_id
CROSS JOIN level_seed ls
WHERE u.code = 'UPNCH'
ON CONFLICT (option_id, code) DO UPDATE
SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order, is_active = TRUE;

COMMIT;
