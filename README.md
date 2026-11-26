# iFac Université

iFac Université est une plateforme numérique multi-établissements qui centralise les ressources pédagogiques, les échanges et les espaces de gestion des communautés universitaires. Elle organise les accès selon les responsabilités et les affectations réelles de chaque compte.

**Application :** https://i-facuniversite.vercel.app  
**Dépôt :** https://github.com/JimsterlyFrancois/iFacuniversite

## Documentation de référence

Commencez par le **[Guide complet d’iFac Université](docs/GUIDE_COMPLET_IFAC_UNIVERSITE.md)**. Il explique le projet de A à Z : importance, publics, hiérarchie institutionnelle et académique, rôles, limites de responsabilité, parcours d’une université, inscriptions, documents, communications, architecture, sécurité, application mobile et limites actuelles.

Consultez également l’[index de la documentation](docs/README.md) pour retrouver les guides fonctionnels et techniques spécialisés.

## Espaces et fonctionnalités

- **Étudiants et délégués :** bibliothèque documentaire, documents de classe, notes privées, annonces, groupes de discussion, notifications et profil.
- **Professeurs :** demandes et suivi des affectations, supports pédagogiques publiés dans les cours attribués.
- **Responsables de programme :** matières, cours, demandes professorales et ressources du programme.
- **Responsables de faculté :** programmes, nominations et supervision du périmètre de la faculté.
- **Responsables d’université :** catalogue des facultés, options et niveaux, responsables de faculté, inscriptions et annonces.
- **Administration générale :** gestion multi-établissements, comptes, annonces de plateforme, journal d’audit, forfaits et factures.

Les établissements, facultés, options et niveaux sont chargés depuis la base de données. Aucun établissement particulier n’est codé en dur comme établissement privilégié.

## Architecture

- React 19 et Vite pour l’interface.
- Node.js et Express 5 pour l’API.
- **Neon PostgreSQL** pour les données applicatives.
- **Supabase Auth** pour les identités et la confirmation des adresses e-mail.
- **Supabase Storage** pour les fichiers privés.
- Vercel pour l’hébergement du site et des routes API.
- Capacitor 8 pour l’application mobile et Live Update pour les mises à jour Android compatibles.

Neon contient les données applicatives. Supabase Auth et Supabase Storage ont des responsabilités distinctes ; Supabase n’est pas la base PostgreSQL applicative de ce dépôt.

## Démarrage local

Prérequis : Node.js 20 ou plus récent.

    npm install
    cp .env.example .env
    npm run dev

L’interface locale utilise le port 3435 et l’API Express le port 3434.

## Configuration

Les variables essentielles sont décrites dans .env.example et server/CONFIGURATION.md :

- DATABASE_URL : connexion Neon avec pooler pour les requêtes applicatives.
- DIRECT_URL : connexion directe facultative pour les migrations contrôlées.
- SUPABASE_URL et SUPABASE_PUBLISHABLE_KEY : opérations Auth.
- SUPABASE_SECRET_KEY : opérations serveur sensibles Auth et Storage.
- SUPABASE_STORAGE_BUCKET et SUPABASE_ANNOUNCEMENTS_BUCKET : buckets privés.
- APP_BASE_URL, ADMIN_EMAIL et les variables SMTP : URL de l’application, compte administrateur et e-mails.

Ne jamais publier les valeurs secrètes ni les placer dans le code du navigateur.

## Vérifications

    npm test
    npm run build

Les paiements en ligne, les notifications push natives et la synchronisation hors ligne complète ne sont pas activés dans la version documentée. Les limites et les procédures de mise à jour sont précisées dans le guide complet.
