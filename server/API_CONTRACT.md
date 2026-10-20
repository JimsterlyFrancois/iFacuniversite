# Contrat API — iFac universite (phase 3)

## Statut
Ce document définit les routes et leurs contrôles attendus. Les routes de santé et de lecture du catalogue sont maintenant présentes dans le code. Elles nécessitent PostgreSQL configuré et le schéma appliqué. Les routes d'authentification, de notes, de documents, de messagerie et d'administration restent à développer.

## Principes obligatoires
- Préfixe API : `/api/v1`.
- PostgreSQL en production; requêtes paramétrées exclusivement.
- Aucun mot de passe en clair. Utiliser un algorithme de hachage adapté aux mots de passe et des secrets d'environnement.
- Les sessions doivent être sécurisées (cookies HttpOnly, Secure en production, SameSite adapté) ou utiliser une stratégie équivalente vérifiée.
- Limiter les tentatives d'inscription, de connexion et de récupération.
- Ne jamais accepter un rôle administrateur depuis le formulaire public.
- Vérifier l'identité et les droits côté serveur pour chaque ressource; masquer un bouton dans l'interface n'est pas une autorisation.
- Les erreurs ne doivent pas révéler si une adresse e-mail possède un compte.
- Le catalogue officiel UPNCH doit être validé avant activation. Aucune option ni aucun niveau ne doit être inventé.
- Les données des autres universités restent inactives par défaut.

## Routes

Les routes marquées « prévues » ne sont pas encore opérationnelles.

## Routes prévues

| Méthode | Route | Accès | Règle principale |
|---|---|---|---|
| GET | `/api/v1/health` | Public | Santé du service, sans secret |
| GET | `/api/v1/catalog/universities` | Public | Retourner uniquement les universités actives |
| GET | `/api/v1/catalog/faculties?universityId=` | Public | Facultés actives de l'université active |
| GET | `/api/v1/catalog/options?facultyId=` | Public | Options actives de la faculté active |
| GET | `/api/v1/catalog/levels?optionId=` | Public | Niveaux actifs réellement configurés |
| POST | `/api/v1/auth/register` | Public, limité | Valider profil complet, vérifier combinaison, créer compte non vérifié et jeton à durée limitée |
| POST | `/api/v1/auth/login` | Public, limité | Vérifier le hash, l'état du compte et l'e-mail confirmé |
| POST | `/api/v1/auth/logout` | Session | Révoquer la session |
| POST | `/api/v1/auth/verify-email` | Jeton temporaire | Jeton à usage unique, expiration contrôlée |
| POST | `/api/v1/auth/forgot-password` | Public, limité | Réponse générique anti-énumération |
| POST | `/api/v1/auth/reset-password` | Jeton temporaire | Vérifier jeton, expiration et usage unique |
| GET/POST | `/api/v1/notes` | Session | Lire/créer uniquement les notes du compte connecté |
| PATCH/DELETE | `/api/v1/notes/:id` | Session | Vérifier propriétaire avant modification/suppression |
| GET | `/api/v1/documents` | Session | Filtrer par profil validé et droits d'accès |
| GET | `/api/v1/documents/:id/file` | Session | Vérifier l'accès avant de servir le fichier |
| GET | `/api/v1/announcements` | Session | Appliquer l'audience correspondant au profil |
| GET/POST | `/api/v1/groups/:id/messages` | Membre du groupe | Vérifier l'appartenance à chaque requête |
| POST | `/api/v1/feedback` | Session | Valider catégorie, taille et note |
| /admin | routes dédiées à définir | Admin serveur uniquement | Vérifier le rôle dans la session côté serveur |

## Validation du profil
Lors de l'inscription, charger depuis la base les enregistrements actifs et confirmer que :
1. l'université est active;
2. la faculté appartient à cette université;
3. l'option appartient à cette faculté;
4. le niveau appartient à cette option;
5. l'ensemble est actif et cohérent.
Refuser la requête en cas de mismatch, même si les identifiants ont été soumis manuellement.

## Modèle de données
Le premier schéma PostgreSQL se trouve dans `server/db/schema.sql`. Il couvre les universités, facultés, options, niveaux, utilisateurs, jetons e-mail, matières, documents, notes privées, annonces, groupes, membres, messages et retours.

## Tests à ajouter avant activation
- Accès anonyme aux notes refusé.
- Un étudiant ne peut ni lire ni modifier les notes d'un autre.
- Un non-membre ne peut pas lire ou écrire dans un groupe.
- Un étudiant ne peut pas se donner le rôle admin.
- Une combinaison de profil incohérente est rejetée.
- Un jeton e-mail expiré ou déjà utilisé est rejeté.
- Un compte non vérifié ne peut pas ouvrir une session.
- Les documents ne sont jamais servis sans autorisation.
