# iFac universite

Application universitaire en cours de développement pour l'UPNCH. Cette version utilise une interface React/Vite, une API Express et PostgreSQL hébergé par Supabase.

## Architecture de la base de données

Le serveur Express se connecte à Supabase en tant que base PostgreSQL via la variable **`DATABASE_URL`** et le pilote `pg`. Le navigateur communique avec l'API `/api/v1`; il ne se connecte pas directement à la base.

**Ne pas ajouter de clé `service_role` ni de mot de passe à l'interface web.** Dans cette architecture, il n'est pas nécessaire d'ajouter `@supabase/supabase-js` ni les variables `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` pour que l'API PostgreSQL fonctionne. Une intégration Supabase côté navigateur ne doit être ajoutée que si l'application adopte explicitement cette architecture et que les politiques RLS sont conçues et testées.

## Configuration locale

Prérequis : Node.js 20 ou version compatible avec Vite 7, et npm.

1. Copier `.env.example` vers `.env`.
2. Dans Supabase, ouvrir les paramètres de connexion de la base de données et récupérer une URI PostgreSQL. Pour un environnement serverless, choisir un mode de connexion adapté à Supabase/Vercel (pooler si recommandé par Supabase).
3. Remplacer la valeur d'exemple de `DATABASE_URL` dans le fichier local `.env`. Ne jamais publier cette valeur.
4. Exécuter le schéma SQL de `server/db/schema.sql` dans le SQL Editor de Supabase. Exécuter ensuite le script de données initiales prévu par le projet, si les données ont été validées.
5. Lancer :

```bash
npm install
npm run dev
```

Le serveur API écoute par défaut sur le port 3434 et Vite sur le port 3435.

## Vérifier la connexion

Ouvrir `http://localhost:3434/api/health`. Lorsque la configuration est correcte, la réponse doit contenir :

```json
{
  "status": "ok",
  "service": "ifacuniversite-api",
  "database": "connected"
}
```

Si la réponse indique `database_not_configured`, la variable `DATABASE_URL` n'est pas chargée. Si elle indique `database_unavailable`, vérifier l'URI PostgreSQL, l'accès réseau et les paramètres de connexion Supabase.

## Configuration Vercel

Dans les paramètres du projet Vercel, ajouter `DATABASE_URL` dans **Settings → Environment Variables** pour chaque environnement utilisé (Preview et/ou Production). Utiliser la valeur PostgreSQL fournie par Supabase. Après modification, redéployer le projet. Ne pas placer le mot de passe dans le code ni dans une variable `VITE_*`, car les variables `VITE_*` sont intégrées au code client.

Tester ensuite `https://TON-DOMAINE/api/health`. La réponse attendue est `status: ok` avec `database: connected`.

Les variables SMTP et `ADMIN_EMAIL` ne sont nécessaires que pour les fonctionnalités correspondantes. Pour Gmail, utiliser un mot de passe d'application, jamais le mot de passe principal du compte.

## SQL et sécurité

- Le schéma de référence est `server/db/schema.sql`.
- Les requêtes SQL applicatives sont exécutées côté serveur avec des paramètres, pas avec des secrets dans le navigateur.
- Les routes protégées utilisent les sessions et les rôles côté API. Toute nouvelle route doit conserver ces contrôles.
- Avant d'activer l'accès réel aux étudiants, vérifier les contraintes du schéma, les rôles, les règles d'accès et les sauvegardes.
- Ne jamais committer `.env`, `.env.local`, des clés API, des URI de base contenant un mot de passe ou des fichiers d'upload privés.

## Construire

```bash
npm run build
```

Les fichiers de l'interface sont générés dans `client/dist`.
