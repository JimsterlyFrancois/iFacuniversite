# Configuration serveur — iFac Université

## Services
- Interface React/Vite : `http://localhost:3435`.
- API Express : `http://localhost:3434`.
- Base applicative : Neon PostgreSQL via `DATABASE_URL`.
- Identités et confirmation d’e-mail : Supabase Auth.
- Fichiers privés : Supabase Storage.
- En production, Vercel sert le site et relaie les routes `/api/*` vers Express.

Neon et Supabase ont des responsabilités distinctes : les données applicatives sont dans Neon ; Supabase Auth conserve les identités ; Supabase Storage conserve les fichiers privés.

## Configuration
1. Copier `.env.example` vers `.env` pour le développement local. Ne jamais publier ce fichier.
2. Définir `DATABASE_URL` avec la chaîne Neon qui utilise le pooler. Conserver `DIRECT_URL` pour les migrations contrôlées. L’API limite son pool PostgreSQL à une connexion par instance Vercel par défaut.
3. Définir `SUPABASE_URL` et `SUPABASE_PUBLISHABLE_KEY` pour les opérations Auth. La clé `SUPABASE_SECRET_KEY` doit rester côté serveur et sert aux opérations d’administration Auth et Storage.
4. Configurer les buckets Storage privés `ifac-documents` et `ifac-announcements`, puis définir `SUPABASE_STORAGE_BUCKET` et `SUPABASE_ANNOUNCEMENTS_BUCKET`.
5. Définir `APP_BASE_URL=https://i-facuniversite.vercel.app`. Dans Supabase Auth, utiliser cette URL comme adresse du site et autoriser les chemins de confirmation et de récupération utilisés par l’application.
6. Configurer le SMTP de Supabase Auth pour les courriels de confirmation. Configurer aussi `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` et `MAIL_FROM` pour les courriels de récupération envoyés par Express. Les deux services doivent être testés.
7. Définir `ADMIN_EMAIL` avec l’adresse exacte du compte désigné. `IFAC_OWNER_EMAIL` est facultatif et réservé aux droits de gestion des visuels d’annonces.

## Base de données
Pour une base vide, appliquer `server/db/schema.sql` à l’aide de `DIRECT_URL`. Pour une base déjà utilisée, comparer d’abord les tables, colonnes, contraintes et index ; appliquer uniquement les migrations manquantes. Ne jamais réinitialiser une base contenant des comptes ou des documents.

Le schéma applicatif ne doit pas dépendre de la présence du schéma PostgreSQL `auth` dans Neon. L’association aux identités externes utilise la colonne `users.auth_user_id` et les API Auth côté serveur.

## Fonctions raccordées
- Authentification, confirmation d’adresse, profils et sessions.
- Catalogue multi-établissements : universités, facultés, options et niveaux.
- Espaces étudiant, délégué, professeur, responsable de programme, responsable de faculté et administration.
- Documents privés, notes personnelles, annonces, groupes et messages.
- Gestion des rôles et périmètres, comptes, journal d’audit et forfaits.

Les paiements en ligne et la synchronisation hors ligne complète ne sont pas activés dans cette version.

## Contrôles avant publication
Vérifier `GET /api/health`, le chargement des catalogues, la création et la confirmation d’un compte, la connexion, la récupération du mot de passe, les droits par rôle, l’envoi et la lecture de fichiers privés, les annonces et les messages. Ces essais doivent être réalisés sur une branche Neon d’aperçu avant toute modification de production.

Ne jamais placer les valeurs secrètes dans le code source, les journaux ou les messages.
