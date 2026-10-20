# iFacuniversite — intégration prudente de iFac-Plus

## Règle de travail

La branche `main` est conservée intacte pendant l'intégration. Les changements sont préparés dans `integration/ifac-plus-base` et ne doivent être fusionnés qu'après vérification.

## Contrôles effectués sur l'archive reçue

- L'archive ZIP est valide et ses 29 entrées sont lisibles.
- `server/index.js`, `server/db.js` et `server/scripts/migrate-sqlite-to-postgres.js` passent la vérification syntaxique Node.js.
- Les fichiers `server/package.json` et `frontend/package.json` sont des JSON valides.
- La base utilise Express, Prisma et PostgreSQL, avec migrations de schéma.
- Les tests existants couvrent la santé de l'API, l'authentification, les notes, les groupes de messages et la confidentialité des PDF.

## Problèmes à résoudre avant toute mise en production

1. Exécuter la suite de tests avec les dépendances installées. La tentative locale d'installation a dépassé le délai disponible; les tests ne sont donc pas déclarés réussis.
2. Vérifier la compatibilité entre le frontend et l'API: le formulaire d'inscription et de connexion utilise un nom complet, pas une adresse e-mail.
3. Retirer l'écran et le parcours de paiement, conformément au périmètre demandé.
4. Vérifier les autorisations administrateur et la gestion des documents de cours: l'API actuelle permet à un utilisateur authentifié de téléverser des PDF privés, mais ne fournit pas encore de rôle administrateur ni de catalogue pédagogique partagé.
5. Vérifier le routage Vercel, la génération Prisma, les variables d'environnement et les migrations sur une base de test.
6. Ajouter une vérification automatique avant de fusionner dans `main`.

## Règles de sécurité

- Ne pas committer de secrets, de fichiers `.env` ni d'identifiants de base de données.
- Ne pas lancer de migration sur la base de production pendant les essais.
- Ne pas remplacer `main` ni déclarer le déploiement prêt avant les tests.
- Garder les données d'étudiants réelles hors de cette version tant que l'authentification, les rôles et les contrôles d'accès n'ont pas été validés.
