-- Visuels des annonces : métadonnées des images stockées dans le bucket privé Supabase.
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS image_key TEXT;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS image_mime_type VARCHAR(80);
