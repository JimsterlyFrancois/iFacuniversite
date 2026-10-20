# Base de données iFac universite

## Préparation PostgreSQL

1. Créer une base PostgreSQL dédiée à l'application.
2. Configurer la variable d'environnement `DATABASE_URL` dans l'environnement du serveur. Ne jamais committer cette valeur dans Git.
3. Appliquer le schéma initial depuis la racine du dépôt avec un client PostgreSQL :

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f server/db/schema.sql
```

4. Redémarrer le serveur, puis vérifier `GET /api/health`.
5. Vérifier `GET /api/v1/catalog/universities`. La réponse peut contenir une liste vide tant qu'aucune université n'a été activée et validée.

## Sécurité et données initiales

- Le schéma ne charge volontairement aucune faculté, option ou niveau : les informations officielles UPNCH doivent être confirmées avant insertion.
- Ne pas créer d'utilisateur administrateur en modifiant un formulaire public.
- Ne pas utiliser de vrais comptes étudiants tant que l'inscription, le hash des mots de passe, les sessions, la confirmation e-mail et la récupération de compte ne sont pas implémentés et testés.
- Pour la production, restreindre l'accès réseau à PostgreSQL et utiliser une connexion TLS conforme aux paramètres du fournisseur.
- Les routes de catalogue sont des lectures publiques; elles ne remplacent pas la validation serveur requise lors de la future inscription.
