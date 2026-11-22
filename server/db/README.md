# Base de données iFac Université

## Fournisseur et connexions
L’application utilise PostgreSQL sur Neon pour les profils, les catalogues, les sessions, les documents, les annonces, les messages, les notes et les données d’administration.

- `DATABASE_URL` : connexion Neon avec pooler, utilisée par l’API.
- `DIRECT_URL` : connexion directe facultative, réservée aux migrations et opérations de maintenance.
- Toujours conserver les secrets dans les variables d’environnement de l’hébergeur ou dans un fichier local non versionné.

## Initialisation
1. Créer une branche Neon de travail à partir de la branche cible.
2. Vérifier que la branche contient les tables et migrations attendues.
3. Sur une base réellement vide uniquement, appliquer le schéma :

```sh
psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -f server/db/schema.sql
```

4. Sur une base qui contient déjà des données, ne pas rejouer le schéma initial. Appliquer uniquement les migrations manquantes, après comparaison du schéma et sauvegarde vérifiée.
5. Vérifier `GET /api/health` et les routes de catalogue.

## Catalogue et comptes
Les établissements, facultés, options et niveaux sont gérés par l’interface d’administration. Aucun fichier de seed ne doit injecter un établissement ou un catalogue non validé.

Ne jamais créer un administrateur en modifiant un formulaire public. Les demandes de rôle suivent le processus de validation prévu dans l’API.

## Sécurité et fiabilité
- Conserver les connexions PostgreSQL chiffrées.
- Garder les buckets Storage privés et servir les fichiers après contrôle des droits.
- Ne pas exposer les clés Auth ou Storage au navigateur.
- Ne pas activer de politiques d’accès génériques sur la base pour contourner le backend.
- Avant tout changement de structure en production, sauvegarder les données, tester sur une branche Neon séparée et vérifier les contraintes et les relations.
