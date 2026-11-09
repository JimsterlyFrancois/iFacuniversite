# Audit technique iFac Université — PR #28

Dernière révision : 9 novembre 2026  
Branche auditée : \`integration/saas-admin-workspaces-clean\`  
Périmètre : API Express, permissions et affectations, espaces React, migrations PostgreSQL/Supabase, tests CI et configuration Vercel.

## Résumé exécutif

L'audit a identifié des blocages fonctionnels qui empêchaient l'onboarding complet d'une nouvelle université et l'utilisation de plusieurs responsabilités par un même compte. Des corrections sont engagées directement dans la branche de la PR #28. La branche n'est pas encore considérée comme prête pour la production : la migration doit être appliquée à Supabase, les derniers contrôles CI/Vercel doivent réussir et les parcours réels doivent être testés.

## Constats et corrections

| Priorité | Constat | Correction dans la branche | État |
|---|---|---|---|
| P1 | Le Responsable d'université ne pouvait pas créer les facultés, options et niveaux. | Nouvelles routes API et écrans de gestion avec création, modification et désactivation. | Implémenté, tests API simulés |
| P1 | Une université nouvellement créée était immédiatement proposée aux inscriptions alors que son catalogue pouvait être vide. | Colonne \`registration_enabled\`, nouvelle université créée en mode configuration, contrôle dans le catalogue public et à l'inscription. | Implémenté, migration en attente d'application |
| P1 | Un responsable pouvait désactiver le dernier élément du catalogue sans refermer les inscriptions. | Vérification du catalogue après désactivation ; fermeture automatique si le minimum n'est plus disponible. | Implémenté |
| P2 | Un compte possédant plusieurs rôles ne recevait qu'un seul espace de travail. | Le profil authentifié expose les affectations actives ; sélecteur d'espace dans l'application. | Implémenté |
| P1 | Le Responsable de programme ne pouvait pas créer de matières, ce qui bloquait ensuite la création des cours dans un programme nouvellement configuré. | Routes de création, modification et désactivation des matières, avec contrôle du périmètre ; formulaire dans son espace. | Implémenté, tests API simulés |
| P2 | Le contrôle CI vérifiait seulement quelques fichiers serveur et n'exécutait pas de tests. | Vérification syntaxique de toutes les routes, tests Node intégrés au pipeline. | Implémenté ; exécutions récentes réussies sur plusieurs commits |

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

- l'impossibilité de forger un \`universityId\` dans le corps de la requête ;
- l'obligation de choisir une affectation lorsque plusieurs universités sont administrées ;
- le refus de créer une option dans une faculté extérieure au périmètre ;
- le refus d'ouvrir les inscriptions avec un catalogue incomplet ;
- la création d'une matière dans le programme autorisé ;
- le refus de créer une matière dans un autre programme.

Ces tests ne remplacent pas les essais sur une base Supabase de préproduction avec des comptes réels.

## Points encore à vérifier avant production

1. Appliquer les migrations dans l'ordre sur le projet Supabase de production, en sauvegardant la base avant toute modification.
2. Vérifier avec de vrais comptes les six espaces et le changement de rôle, y compris les comptes ayant plusieurs affectations.
3. Tester les refus d'accès croisé entre universités, facultés, options et niveaux sur l'ensemble des routes, y compris documents et professeurs.
4. Confirmer les contraintes d'unicité et les règles de révocation des affectations dans la base réelle.
5. Vérifier la configuration des buckets privés, les téléchargements et les permissions de stockage.
6. Identifier et corriger la vulnérabilité de sévérité élevée signalée par \`npm install\` lors de l'audit de dépendances.
7. Refaire un déploiement Vercel de prévisualisation après disponibilité du quota de build. Les déploiements observés ont ensuite été bloqués par une limite de build ; cela ne constitue pas une validation de la version actuelle.
8. Effectuer les parcours de bout en bout : création d'université, nomination du responsable, configuration du catalogue, ouverture des inscriptions, inscription étudiante, nomination des responsables, création des matières/cours et affectation d'un professeur.

## Décision de livraison

**Ne pas fusionner et ne pas publier en production à ce stade.** La version de production reste indépendante de cette branche. La fusion ne sera envisagée qu'après migrations, tests d'autorisation, CI verte, prévisualisation Vercel prête et vérification des parcours critiques.
