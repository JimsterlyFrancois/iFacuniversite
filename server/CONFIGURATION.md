# Configuration serveur — iFac universite

## Connexions utilisées
- Interface React/Vite : `http://localhost:3435`.
- API Express : `http://localhost:3434` (ou le port fourni par l'hébergeur).
- Base de données : PostgreSQL via `DATABASE_URL`.
- Le catalogue d'inscription est chargé depuis l'API : universités, facultés, options et niveaux. Les listes dépendantes sont filtrées par les identifiants renvoyés par la base.
- Les appels de l'interface vers `/api/v1` doivent être servis par l'API Express. En local, Vite transmet `/api` au serveur sur le port 3434.

## Configuration locale et hébergement
1. Copier `.env.example` dans un fichier local `.env`. Ne jamais publier ce fichier ni partager ses valeurs secrètes.
2. Renseigner `DATABASE_URL` avec une base PostgreSQL accessible depuis l'environnement où tourne le serveur.
3. Définir `APP_BASE_URL` sur l'URL publique de l'application et `ADMIN_EMAIL` sur l'adresse exacte du compte administrateur.
4. Le service SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`) est requis pour envoyer les e-mails de récupération du mot de passe. L'inscription de cette version est provisoirement activée sans confirmation par e-mail ; elle ne doit pas être considérée comme le flux final de vérification.
5. Appliquer le schéma à la base ciblée : `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f server/db/schema.sql`. Exécuter ensuite `server/db/seed_upnch.sql` si le catalogue UPNCH n'y est pas déjà présent.
6. Installer les dépendances avec `npm install`, puis lancer `npm run dev`.

## Fonctions raccordées à l'API
- Authentification : inscription, connexion, déconnexion, profil de session et demande de récupération du mot de passe.
- Catalogue : universités, facultés, options et niveaux actifs, servis depuis PostgreSQL.
- Notes privées : lecture, création, modification et suppression limitées au propriétaire.
- Documents : liste des métadonnées et routes d'envoi/téléchargement protégées par authentification et rôle administrateur.
- Annonces : lecture ciblée selon le profil et création par administrateur.
- Messagerie : groupes auxquels l'étudiant appartient, lecture et envoi de messages avec contrôle d'appartenance.
- Administration : statistiques et consultation des matières.

## Connexions encore à finaliser
- **Stockage durable des PDF :** le code utilise actuellement le système de fichiers local. Sur Vercel, le dossier temporaire `/tmp` n'est pas un stockage durable ; les fichiers peuvent disparaître après un redémarrage ou un nouveau déploiement. Il faut raccorder un stockage persistant privé (par exemple Supabase Storage ou un service équivalent) et vérifier les autorisations avant de considérer les documents comme fiables en production.
- **E-mail de vérification :** l'inscription provisoire marque le compte comme vérifié sans envoyer de message. Avant la mise en production, rétablir l'envoi d'un lien de confirmation et imposer la vérification avant la connexion.
- **Administration :** l'interface complète pour créer/modifier les matières, gérer les groupes et supprimer les documents n'est pas encore disponible.
- **Commentaires/avis :** une interface de retour existe partiellement, mais le parcours de soumission n'est pas raccordé à une route API complète.
- **Tests de déploiement :** vérifier séparément les variables d'environnement dans l'hébergeur, la connexion à la base, les e-mails et le stockage. Ne pas placer les secrets dans le code source.

Les paiements et la synchronisation hors ligne ne font pas partie du périmètre de cette version.
