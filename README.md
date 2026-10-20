# iFacuniversite

Application universitaire en cours de construction.

## État actuel

Cette première base contient une interface React/Vite et un serveur Express minimal. Elle sert de point de départ au développement, et non d'application complète prête pour les étudiants.

- Interface React avec une présentation responsive en noir et or.
- API Express avec les routes `/api/health` et `/api/info`.
- Proxy Vite vers l'API en développement.
- Dépendances et scripts npm à la racine du dépôt.

## Prérequis

- Node.js 20 ou une version compatible avec Vite 7.
- npm.

## Lancer en développement

```bash
npm install
npm run dev
```

L'interface est servie sur le port 5173 et l'API sur le port 3000.

## Construire l'interface

```bash
npm run build
```

Les fichiers générés sont placés dans `client/dist`.

## Fonctionnalités non encore implémentées

L'inscription et la connexion sécurisées, les rôles administrateur, la base de données, la gestion des documents, les notes, la récupération de mot de passe et l'intégration AI Gateway ne sont pas encore implémentés. Ne pas utiliser ce prototype pour stocker de vraies données étudiantes avant l'ajout et la vérification des contrôles de sécurité.

## Configuration sensible

Ne jamais committer de clés API, mots de passe ou fichiers `.env`. Utiliser les variables d'environnement du service de déploiement et un fichier local `.env` ignoré par Git.
