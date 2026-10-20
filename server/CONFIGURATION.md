# Configuration serveur — iFac universite

## Ports locaux
- API Express : `http://localhost:3434` (ou `PORT` fourni par l'hébergeur).
- Interface Vite : `http://localhost:3435`.
- Vite transmet `/api` à l'API sur le port 3434.

## Préparation
1. Copier `.env.example` dans un fichier local `.env` (ne jamais publier ce fichier).
2. Renseigner `DATABASE_URL` avec une base PostgreSQL.
3. Configurer un SMTP réel : `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`. Sans SMTP, l'inscription refuse de créer un compte plutôt que de prétendre qu'un e-mail est envoyé.
4. Définir `APP_BASE_URL` sur l'URL publique de l'application et `ADMIN_EMAIL` sur l'adresse exacte destinée à l'administration.
5. Appliquer le schéma : `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f server/db/schema.sql`.
6. Installer les dépendances avec `npm install`, puis lancer `npm run dev`.

## Endpoints implémentés dans cette branche
- Authentification : inscription, confirmation d'adresse, connexion, déconnexion, profil de session.
- Notes privées : lecture, création, modification et suppression limitées au propriétaire.
- Catalogue : universités, facultés, options et niveaux actifs.
- Documents : liste des métadonnées pour l'option et le niveau du compte. L'envoi et le téléchargement privé des fichiers ne sont pas encore raccordés.
- Annonces : lecture ciblée selon le profil et création par administrateur.
- Messagerie : groupes dont l'étudiant est membre, lecture et envoi de messages avec contrôle d'appartenance.
- Administration : aperçu des statistiques et publication d'annonces.

Les paiements, la synchronisation hors ligne, l'interface complète de gestion des fichiers, la récupération de mot de passe et la connexion de l'interface React à ces endpoints restent à construire. L'API seule ne rend pas encore ces fonctions accessibles depuis tous les écrans de l'application.
