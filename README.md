# iFac Université

iFac est un portail numérique destiné aux communautés universitaires. Il centralise les ressources académiques, les échanges et les espaces de gestion dans une application accessible sur ordinateur, tablette et téléphone.

## Espaces et fonctionnalités

- **Étudiants et délégués :** documents de cours, dépôt de documents de classe, notes privées, annonces, groupes de discussion et profil.
- **Professeurs :** demandes d’accès et gestion des cours ou affectations autorisées.
- **Responsables de programme et de faculté :** gestion des contenus et des utilisateurs dans leur périmètre.
- **Administrateurs d’établissement :** gestion du catalogue, des annonces, des documents et des comptes.
- **Administration générale :** gestion multi-établissements, attribution des rôles, suivi des comptes, journal d’audit et gestion des forfaits.

Les établissements, facultés, programmes et niveaux sont chargés depuis la base de données. Aucun établissement particulier n’est imposé dans l’interface.

## Architecture

- React 19 et Vite pour l’interface.
- Express 5 pour l’API.
- **Neon PostgreSQL** pour les données applicatives.
- Supabase Auth pour les identités et les confirmations d’adresse e-mail.
- Supabase Storage pour les fichiers privés.
- Vercel pour l’hébergement du site et des routes API.

## Démarrage local

Prérequis : Node.js 20 ou plus récent.

```sh
npm install
cp .env.example .env
npm run dev
```

L’interface locale utilise le port 3435 et l’API Express le port 3434. Les requêtes `/api` sont transmises à l’API.

## Configuration

- `DATABASE_URL` : connexion Neon avec pooler pour les requêtes applicatives.
- `DIRECT_URL` : connexion directe facultative pour les migrations contrôlées.
- `SUPABASE_URL` et `SUPABASE_PUBLISHABLE_KEY` : Auth.
- `SUPABASE_SECRET_KEY` : clé serveur pour les opérations d’administration Auth et Storage.
- `SUPABASE_STORAGE_BUCKET` et `SUPABASE_ANNOUNCEMENTS_BUCKET` : buckets privés.
- `APP_BASE_URL`, `ADMIN_EMAIL` et les variables SMTP : URL publique, compte administrateur et e-mails.

Ne jamais publier les valeurs secrètes ni les placer dans le code du navigateur.

## Vérifications

```sh
npm test
npm run build
```

Les paiements en ligne et la synchronisation hors ligne complète restent des évolutions distinctes. Toute modification de schéma ou de connexion doit d’abord être validée sur une branche Neon d’aperçu avant de toucher à la production.
