# Configuration serveur — iFac universite

## Connexions utilisées
- Interface React/Vite : `http://localhost:3435`.
- API Express : `http://localhost:3434` (ou le port fourni par l'hébergeur).
- Base de données : PostgreSQL via `DATABASE_URL`.
- Le catalogue d'inscription est chargé depuis l'API : universités, facultés, options et niveaux. Les listes dépendantes sont filtrées par les identifiants renvoyés par la base.
- Les appels de l'interface vers `/api/v1` doivent être servis par l'API Express. En local, Vite transmet `/api` au serveur sur le port 3434.

## Configuration locale et hébergement
1. Copier `.env.example` vers `.env` localement. Ne jamais publier ce fichier ni partager ses secrets.
2. Définir `DATABASE_URL` avec la chaîne de connexion PostgreSQL fournie par Supabase (section Connect) ou par la base PostgreSQL déjà choisie pour iFac.
3. Définir `APP_BASE_URL` sur l'URL publique de l'application et `ADMIN_EMAIL` sur l'adresse exacte du compte administrateur.
4. Configurer `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` et `MAIL_FROM`. Le SMTP est requis pour l'inscription, la confirmation de l'adresse et la récupération du mot de passe. L'inscription est refusée si le service e-mail est absent ou si l'envoi échoue. La connexion est refusée tant que l'adresse n'est pas confirmée.
5. Créer dans Supabase Storage un bucket nommé `ifac-documents`, en le laissant **privé**, avec une limite de fichier de 15 Mo et le type autorisé PDF. Configurer `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` et `SUPABASE_STORAGE_BUCKET=ifac-documents` dans l'environnement du serveur.
6. Ne jamais exposer `SUPABASE_SERVICE_ROLE_KEY` au navigateur, ne jamais lui donner un préfixe `VITE_` et ne jamais l'ajouter au dépôt GitHub.
7. Appliquer le schéma à la base ciblée : `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f server/db/schema.sql`. Exécuter ensuite `server/db/seed_upnch.sql` si le catalogue UPNCH n'y est pas déjà présent.
8. Installer les dépendances avec `npm install`, puis lancer `npm run dev`.

## Fonctions raccordées à l'API
- Authentification : inscription, connexion, déconnexion, profil de session et demande de récupération du mot de passe.
- Catalogue : universités, facultés, options et niveaux actifs, servis depuis PostgreSQL.
- Notes privées : lecture, création, modification et suppression limitées au propriétaire.
- Documents : liste des métadonnées et routes d'envoi/téléchargement protégées par authentification et rôle administrateur.
- Annonces : lecture ciblée selon le profil et création par administrateur.
- Messagerie : groupes auxquels l'étudiant appartient, lecture et envoi de messages avec contrôle d'appartenance.
- Administration : statistiques et consultation des matières.

## État des connexions et contrôles requis
- **Stockage PDF :** le code téléverse et télécharge les fichiers via Supabase Storage privé. Les fichiers précédemment enregistrés sur un disque local ne sont pas migrés automatiquement ; ils doivent être transférés avant de réutiliser leurs enregistrements.
- **E-mail :** l'inscription génère un jeton de confirmation valable 24 heures et la connexion exige une adresse vérifiée. Il faut configurer et tester le SMTP avant d'ouvrir les inscriptions.
- **Administration :** l'interface et les routes API prennent en charge la création de matières, la publication d'annonces générales, la création de groupes par faculté/option/niveau et le retrait des documents. Le rôle administrateur est protégé côté serveur.
- **Avis :** le formulaire étudiant est raccordé à la route API de réception des avis.
- **Déploiement :** les variables doivent être ajoutées dans l'environnement qui exécute réellement l'API, et pas seulement dans le projet Vercel de l'interface. Vérifier que l'API Express est déployée correctement et que `GET /api/health` renvoie `status: ok`.
- **Tests finaux à effectuer après configuration :** inscription, réception du courriel, confirmation, connexion, création/téléchargement/suppression d'un PDF, création de matière, annonce, groupe et avis.
- **Sécurité :** ne jamais placer les valeurs secrètes dans le code source ou dans un message.

Les paiements et la synchronisation hors ligne ne font pas partie du périmètre de cette version.
