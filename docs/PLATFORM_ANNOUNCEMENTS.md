# Annonces de plateforme iFac Université

La console Super Admin possède une rubrique **Annonces de plateforme**, distincte des annonces locales d'une université.

## Ciblage disponible

- Toutes les universités actives, ou une université active déterminée.
- Faculté, option et niveau, avec vérification de la hiérarchie côté serveur.
- Un ou plusieurs rôles : responsable d'université, responsable de faculté, responsable de programme, professeur, étudiant, délégué ou administrateur général.
- Aucune sélection de rôle signifie « tous les rôles » dans le périmètre académique choisi.

Les annonces actives apparaissent dans un encart commun au-dessus de l'espace de travail des comptes destinataires. Le serveur recalcule les rôles et les périmètres depuis la base à chaque consultation ; les filtres du navigateur ne déterminent jamais les destinataires.

## Déploiement

Appliquer d'abord `supabase/migrations/20261125160000_platform_announcements.sql` au projet Supabase, puis déployer le code correspondant. La migration crée uniquement les deux nouvelles tables et leurs index, active RLS et interdit leur accès direct aux rôles `anon` et `authenticated`. Les données des universités et des utilisateurs ne sont pas modifiées.

Les annonces publiées peuvent être suspendues et réactivées depuis la console. Les publications et changements de statut sont consignés dans `admin_audit_logs`.

## Transfert des responsables d'université

La rubrique **Administrateurs** du Super Admin est transversale : aucune université, y compris l'UPNCH, n'a de privilège spécial dans cette gestion. Un administrateur général peut nommer un compte déjà créé et actif pour n'importe quelle université, puis retirer une affectation de responsable.

Pour quitter soi-même une université, il faut d'abord nommer un successeur dans cette université, puis utiliser **Me retirer de cette université** sur sa propre ligne. Cette action retire uniquement l'affectation `university_admin` concernée ; elle ne retire pas le rôle global `admin_general`. Si le dernier responsable actif est retiré, le système ferme automatiquement les inscriptions étudiantes jusqu'à la nomination d'un autre responsable.
