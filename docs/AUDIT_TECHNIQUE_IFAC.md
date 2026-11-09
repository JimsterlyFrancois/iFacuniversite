# Audit technique iFac Université — PR #28

Dernière révision : 9 novembre 2026  
Branche auditée : `integration/saas-admin-workspaces-clean`  
Périmètre : API Express, permissions et affectations, espaces React, migrations PostgreSQL/Supabase, tests CI et configuration Vercel.

## Résumé exécutif

L'audit a identifié des blocages fonctionnels qui empêchaient l'onboarding complet d'une nouvelle université et l'utilisation de plusieurs responsabilités par un même compte. Des corrections sont engagées directement dans la branche de la PR #28. La branche n'est pas encore considérée comme prête pour la production : la migration doit être appliquée à Supabase, les derniers contrôles CI/Vercel doivent réussir et les parcours réels doivent être testés.

## Constats et corrections

| Priorité | Constat | Correction dans la branche | État |
|---|---|---|---|
| P1 | Le Responsable d'université ne pouvait pas créer les facultés, options et niveaux. | Nouvelles routes API et écrans de gestion avec création, modification et désactivation. | Implémenté, tests API simulés |
| P1 | Une université nouvellement créée était immédiatement proposée aux inscriptions alors que son catalogue pouvait être vide. | Colonne `registration_enabled`, nouvelle université créée en mode configuration, contrôle dans le catalogue public et à l'inscription. | Implémenté, migration en attente d'application |
| P1 | Un responsable pouvait désactiver le dernier élément du catalogue sans refermer les inscriptions. | Vérification du catalogue après désactivation ; fermeture automatique si le minimum n'est plus disponible. | Implémenté |
| P2 | Un compte possédant plusieurs rôles ne recevait qu'un seul espace de travail. | Le profil authentifié expose les affectations actives ; sélecteur d'espace dans l'application. | Implémenté |
| P1 | Le Responsable de programme ne pouvait pas créer de matières, ce qui bloquait ensuite la création des cours dans un programme nouvellement configuré. | Routes de création, modification et désactivation des matières, avec contrôle du périmètre ; formulaire dans son espace. | Implémenté, tests API simulés |
| P2 | Le contrôle CI vérifiait seulement quelques fichiers serveur et n'exécutait pas de tests. | Vérification syntaxique de toutes les routes, tests Node intégrés au pipeline. | Implémenté ; exécutions récentes réussies |
| P1 | Nodemailer présentait une vulnérabilité de sévérité élevée dans la version installée. | Mise à niveau vers Nodemailer 10.4.0 ; audit npm exécuté dans CI. | Corrigé ; 0 vulnérabilité signalée dans l'audit actuel |
| P1 | La réinitialisation modifiait seulement le hash local, pas le mot de passe vérifié par Supabase Auth. | Liaison des profils à `auth.users`, mise à jour Auth Admin côté serveur, conservation du hash aléatoire pour les comptes Supabase. | Corrigé dans la branche ; migration et tests ajoutés, à valider en préproduction |

## Règles de sécurité appliquées

- L'identifiant d'université utilisé lors de la création d'une faculté est dérivé de l'affectation active côté serveur.
- Si un Responsable d'université gère plusieurs établissements, il doit sélectionner l'affectation concernée.
- Les options sont créées uniquement sous une faculté active appartenant à l'une des universités autorisées.
- Les niveaux sont créés uniquement sous une option active appartenant au périmètre autorisé.
- Les matières sont créées uniquement sous une option et un niveau couverts par une affectation active de Responsable de programme.
- Les désactivations sont logiques : les références et historiques ne sont pas supprimés physiquement.
- Les choix de rôle dans le navigateur ne donnent aucun droit supplémentaire ; chaque route API continue de contrôler l'affectation active en base.

## Tests ajoutés

Les tests de routes utilisent un pool PostgreSQL simulé et vérifient notamment :

- l'impossibilité de forger un `universityId` dans le corps de la requête ;
- l'obligation de choisir une affectation lorsque plusieurs universités sont administrées ;
- le refus de créer une option dans une faculté extérieure au périmètre ;
- le refus d'ouvrir les inscriptions avec un catalogue incomplet ;
- la création d'une matière dans le programme autorisé ;
- le refus de créer une matière dans un autre programme.
- le refus de nommer un Responsable de programme dans une faculté extérieure au périmètre.
- l'appel à l'API Auth Admin utilise uniquement la clé secrète serveur et l'identifiant Auth du compte.

Les contrôles CI sur la révision récente ont confirmé : syntaxe de toutes les routes, tests automatisés, build frontend et audit npm sans vulnérabilité signalée. Ces tests ne remplacent pas les essais sur une base Supabase de préproduction avec des comptes réels.

## Points encore à vérifier avant production

1. Appliquer les migrations dans l'ordre sur le projet Supabase de production, en sauvegardant la base avant toute modification.
2. Vérifier avec de vrais comptes les six espaces et le changement de rôle, y compris les comptes ayant plusieurs affectations.
3. Tester les refus d'accès croisé entre universités, facultés, options et niveaux sur l'ensemble des routes, y compris documents et professeurs.
4. Confirmer les contraintes d'unicité et les règles de révocation des affectations dans la base réelle.
5. Vérifier la configuration des buckets privés, les téléchargements et les permissions de stockage.
6. Maintenir la surveillance des dépendances et exécuter l'audit npm à chaque livraison.
7. Refaire un déploiement Vercel de prévisualisation après disponibilité du quota de build. Les déploiements observés ont été bloqués par une limite de build ; cela ne constitue pas une validation de la version actuelle.
8. Effectuer les parcours de bout en bout : création d'université, nomination du responsable, configuration du catalogue, ouverture des inscriptions, inscription étudiante, nomination des responsables, création des matières/cours et affectation d'un professeur.

## Décision de livraison

**Ne pas fusionner et ne pas publier en production à ce stade.** La version de production reste indépendante de cette branche. La fusion ne sera envisagée qu'après migrations, tests d'autorisation, CI verte, prévisualisation Vercel prête et vérification des parcours critiques.


## Vérification de la base Supabase de production

Projet contrôlé en lecture seule : `iFac universitaire` (`vrwxmsohomeqjqjpgzwn`), état `ACTIVE_HEALTHY`, PostgreSQL 17.11.0.003.

- La base contient actuellement 5 migrations appliquées, jusqu'à `20261108213315_secure_rls_event_trigger`.
- Le catalogue existant contient 1 université, 4 facultés, 12 options et 48 niveaux d'études.
- Sur les 4 profils applicatifs existants, 3 correspondent à un utilisateur Auth par e-mail ; le quatrième est un compte historique sans correspondance Auth et conservera le flux de mot de passe local.
- La colonne `universities.registration_enabled` n'existe pas encore en production. La migration `20261109100000_university_catalog_admin.sql` est donc indispensable avant l'activation de la nouvelle gestion du catalogue.
- La colonne `users.auth_user_id` n'existe pas encore en production. La migration `20261109110000_auth_user_password_recovery.sql` doit suivre la migration du catalogue ; elle relie les 3 profils Auth existants par e-mail.
- Les 22 tables du schéma public observées ont RLS activé et aucune policy. Cela bloque l'accès direct par les rôles Data API ; l'application doit continuer à passer par son backend de confiance. Ne pas ajouter de policies publiques génériques.
- L'advisor Supabase signale que la protection des mots de passe compromis est désactivée. À activer dans les paramètres Auth du projet.
- L'advisor performance signale 38 clés étrangères sans index couvrant et 15 index non utilisés. Ce sont des alertes d'optimisation, pas des preuves d'erreur fonctionnelle ; ne pas supprimer ou ajouter ces index sans examiner les requêtes et la charge réelle.
- Les tables publiques contrôlées ont RLS activé sans policy ; cela doit rester intentionnel tant que le backend est le seul chemin d'accès aux données. Ne pas ajouter de policy permissive sans matrice de permissions et tests.

Aucune migration n'a été appliquée à la base de production pendant cet audit.


## Autres blocages de liaison entre interfaces et hiérarchie

### A. Contrôle d'accès hérité incompatible avec les rôles attribués

Le middleware commun \`requireAdmin\` dans \`server/index.js\` n'autorise que \`users.role = 'admin'\`. Il ne reconnaît pas une affectation active \`admin_general\` dans \`role_assignments\`. Or les routes historiques \`/admin/*\` des fichiers \`classDocuments.routes.js\` et \`professors.routes.js\` utilisent ce middleware.

Conséquence : un Administrateur général nommé uniquement par affectation peut ouvrir sa console SaaS, mais recevoir 403 sur les fonctions historiques de gestion des professeurs, classes, documents et délégués. Le compte principal historique ayant \`users.role='admin'\` n'est pas touché. Correction nécessaire : créer des gardes distinctes pour le rôle général et pour les rôles locaux, puis contrôler le périmètre sur chaque route. Ne pas simplement autoriser tous les rôles de gestion sur toutes les routes historiques.

### B. Migration d'identité Auth pas encore appliquée

Le code de la branche utilise maintenant \`users.auth_user_id\` pour relier le profil iFac au compte Supabase Auth. La base de production ne possède pas encore cette colonne. La migration \`20261109110000_auth_user_password_recovery.sql\` est obligatoire avant le déploiement de cette version. À la vérification en lecture seule, la base contenait 4 profils ; 3 correspondaient à un compte Supabase Auth par e-mail et 1 n'avait pas de compte correspondant. Ce dernier profil devra être traité selon son statut réel avant d'activer la récupération de mot de passe.

### C. Hiérarchie insuffisamment représentée dans les données réelles

La base de production observée ne contient qu'une seule affectation de rôle active, associée au compte administrateur historique. Les espaces Responsable d'université, Responsable de faculté et Responsable de programme ne peuvent donc pas encore être validés par des parcours réels de comptes nommés. Il faut créer des comptes de test dédiés, leur attribuer les rôles et tester les changements d'espace ainsi que les refus d'accès croisé.

### D. Prévisualisation Vercel indisponible temporairement

Les contrôles GitHub de la branche passent, mais Vercel a refusé les déploiements de prévisualisation en raison de la limite quotidienne du plan gratuit (\`api-deployments-free-per-day\`). Le succès CI ne prouve donc pas que les routes fonctionnent dans l'environnement Vercel. Une prévisualisation doit être obtenue après réinitialisation du quota, puis testée avant fusion.

### E. Couverture des parcours encore incomplète

Les tests actuels sont principalement des tests de routes avec PostgreSQL simulé, plus la syntaxe et le build frontend. Il manque une suite de bout en bout couvrant : Administrateur général → création université → nomination Responsable d'université → création faculté/option/niveau → ouverture des inscriptions → inscription étudiant → nomination Responsable de faculté → nomination Responsable de programme → création matière/cours → affectation professeur → connexion professeur → dépôt et validation d'un document.

Ces lacunes sont des conditions de livraison, pas des détails cosmétiques.
