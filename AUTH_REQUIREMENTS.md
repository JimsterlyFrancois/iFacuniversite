# iFac Université — exigences d’inscription et de connexion

## Périmètre
- L’application prend en charge plusieurs universités et établissements.
- Les universités, facultés ou écoles, options et niveaux proviennent du catalogue administré dans la base de données.
- Aucun nom d’établissement ni catalogue particulier ne doit être codé en dur dans l’interface.
- Les niveaux sont affichés à partir des libellés réellement configurés, par exemple « 1re année (L1) » à « 4e année (L4) ».

## Inscription
Champs requis : nom, prénom, adresse e-mail valide, établissement, faculté ou école, option et niveau lorsque ces niveaux sont requis par le parcours, mot de passe et confirmation. Les choix dépendants sont chargés depuis l’API. Le serveur vérifie à nouveau la cohérence des identifiants avant de créer le profil.

Le mot de passe doit contenir au moins 10 caractères. La confirmation doit correspondre au mot de passe. Les champs de mot de passe doivent pouvoir être affichés ou masqués.

## Connexion et identité
- Supabase Auth gère l’identité et la confirmation de l’adresse e-mail.
- Le profil applicatif, les rôles et les sessions sont enregistrés dans Neon PostgreSQL.
- Le lien entre le profil applicatif et l’identité externe est conservé dans `users.auth_user_id`.
- Le code serveur ne doit pas supposer que le schéma PostgreSQL `auth.users` existe dans Neon. La recherche d’une identité non liée passe par l’API d’administration Auth, depuis le serveur uniquement.
- La récupération du mot de passe utilise un jeton à durée limitée, à usage unique, vérifié côté serveur.

## Rôles et autorisations
Un utilisateur ne peut pas s’attribuer un rôle administratif depuis un formulaire public. Les demandes de responsabilité sont validées par le niveau d’administration autorisé. Chaque route vérifie l’identité et le périmètre d’accès côté serveur.

## Interface et accessibilité
- Afficher une image de couverture universitaire avec un texte alternatif pertinent.
- Adapter les écrans aux téléphones, tablettes et ordinateurs.
- Respecter `prefers-reduced-motion`.
- Prévoir des erreurs compréhensibles, des états de chargement et une navigation clavier.
- Ne pas ajouter de faux témoignages, logos partenaires ou garanties de sécurité non vérifiées.

## Contrôles avant production
Tester l’inscription, la confirmation e-mail, la connexion, la récupération du mot de passe, la révocation de session, les permissions par rôle, les catalogues multi-établissements et les fichiers privés sur un environnement d’aperçu connecté à une branche Neon isolée.
