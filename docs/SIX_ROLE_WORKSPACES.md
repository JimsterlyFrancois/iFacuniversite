# iFac Université — six espaces et modèle de permissions

## Objet

Préparer l'évolution d'iFac Université vers six espaces de travail distincts, sélectionnés automatiquement après connexion selon le rôle et les affectations de l'utilisateur.

Cette livraison est une **fondation de conception**. Elle ne modifie ni les comptes, ni les permissions effectives, ni la base de données en production. Les écrans et contrôles serveur doivent être livrés dans des étapes suivantes afin de ne pas accorder des privilèges par simple changement de rôle côté navigateur.

## Les six espaces

### 1. Administrateur général

Périmètre : toute la plateforme.

- Créer, modifier, activer et désactiver des universités.
- Nommer un ou deux administrateurs pour chaque université.
- Consulter et superviser toutes les universités, facultés, options, niveaux, cours et documents.
- Gérer les dirigeants et révoquer leurs affectations administratives.
- Publier des annonces globales et envoyer des messages à toutes les audiences autorisées.
- Consulter les journaux d'activité et les statistiques globales.

### 2. Administrateur d'université

Périmètre : une université attribuée par l'administrateur général.

- Administrer les informations de son université et consulter son organisation.
- Nommer les responsables des facultés de cette université.
- Superviser les facultés et leurs responsables.
- Publier des annonces et messages destinés à son université.
- Ne peut pas créer une autre université ni nommer un autre administrateur d'université.

L'administrateur général désigne directement un ou deux administrateurs par université.

### 3. Responsable de faculté

Périmètre : une faculté attribuée dans une université.

- Superviser les options et niveaux de sa faculté.
- Nommer les responsables de programme dans sa faculté.
- Nommer les professeurs dans les options et niveaux de sa faculté.
- Consulter les cours, matières, documents et activités de sa faculté.
- Publier des annonces et messages destinés à sa faculté.

La limite convenue est de quatre responsables de faculté au maximum par faculté. La règle doit être imposée côté serveur et en base, pas uniquement dans l'interface.

### 4. Responsable de programme

Périmètre : faculté, option et niveau explicitement attribués.

- Créer et organiser les matières et les cours dans son périmètre.
- Rechercher les professeurs déjà inscrits dans l'annuaire iFac.
- Affecter un professeur existant à une matière ou à un cours de son périmètre.
- Envoyer des annonces et messages à son audience autorisée.
- Ne peut pas créer ou modifier les cours d'un autre programme.

Le responsable de faculté nomme les responsables de programme.

### 5. Professeur

Périmètre : toutes ses affectations pédagogiques actives.

- Créer son propre compte depuis l'onglet « Espace professeur » de la page de connexion.
- Après inscription, son statut est « En attente de nomination ».
- Être recherché dans l'annuaire par les responsables de programme et être affecté à des cours.
- Consulter dans un seul compte toutes ses affectations, y compris dans plusieurs universités, facultés, options et niveaux.
- Publier des supports de cours et documents pédagogiques uniquement dans les classes/cours auxquels il est affecté.
- Communiquer dans les espaces autorisés.

L'inscription ne crée aucune affectation et ne confère aucun droit d'enseignement automatiquement. Le compte professeur est unique ; les affectations sont des enregistrements distincts. Retirer une affectation ne supprime jamais le compte.

### 6. Étudiant

Périmètre : son inscription universitaire et ses appartenances aux groupes.

- Consulter les matières, cours, documents et annonces accessibles à son option et à son niveau.
- Télécharger les documents autorisés.
- Utiliser la messagerie et les notes privées.
- Consulter son profil et ses notifications.
- Ne peut pas accéder aux outils de nomination, d'administration ou de publication réservés aux dirigeants et professeurs.

## Règles transversales

### Messagerie

Tous les dirigeants peuvent envoyer des messages, mais uniquement dans leur périmètre :

| Rôle | Audience maximale |
|---|---|
| Administrateur général | Toutes les universités |
| Administrateur d'université | Son université |
| Responsable de faculté | Sa faculté |
| Responsable de programme | Son programme, ses options et niveaux attribués |
| Professeur | Ses classes et groupes autorisés |
| Étudiant | Ses groupes et conversations autorisés |

Les annonces officielles et les conversations doivent rester des fonctionnalités distinctes, avec leurs propres droits et historiques.

### Documents

- Administrateur général : documents institutionnels globaux.
- Administrateur d'université : documents administratifs de son université.
- Responsable de faculté : documents de sa faculté.
- Responsable de programme : documents pédagogiques de son programme.
- Professeur : supports, exercices et ressources pédagogiques de ses cours attribués.
- Étudiant : consultation et téléchargement uniquement.

Chaque document doit conserver son auteur, sa date, son audience, son statut et son rattachement universitaire. Les droits de téléchargement doivent être contrôlés côté API.

## Modèle de données cible

Le rôle global seul ne suffit pas : une même personne peut exercer plusieurs fonctions ou être professeur dans plusieurs établissements. Il faut séparer les comptes des affectations.

Tables ou entités à prévoir :

- `users` : identité et compte de connexion uniques.
- `universities`, `faculties`, `options`, `study_levels` : structure académique.
- `role_assignments` : rôle, utilisateur, université, faculté, option et niveau du périmètre, dates d'effet et statut.
- `professor_assignments` : affectations pédagogiques multiples d'un même compte professeur, avec cours/matière et période.
- `subjects`, `courses` : catalogue académique.
- `announcements` et tables de messagerie : audience et auteur.
- `documents` : propriétaire, auteur, rattachement et statut.
- `admin_audit_logs` : nominations, révocations et actions sensibles.

Les références de périmètre doivent être cohérentes entre elles : une faculté appartient à l'université sélectionnée, une option à cette faculté, et un niveau à cette option.

## Sécurité et compatibilité

1. Les six espaces sont déterminés par les rôles/affectations renvoyés par l'API après authentification. Le navigateur ne peut jamais s'attribuer un rôle.
2. Toute route API vérifie le rôle ET le périmètre de l'affectation active.
3. Les règles doivent également être protégées par les politiques de base de données appropriées lorsque des accès directs Supabase sont possibles.
4. Les nominations, révocations et publications sensibles sont journalisées.
5. La révocation d'un rôle retire les droits immédiatement, sans supprimer le compte personnel.
6. Les comptes historiques `admin`, `professor`, `student` et `delegate` doivent être migrés explicitement et testés. Aucun compte existant ne doit perdre son accès par défaut.
7. Les fonctions actuelles de gestion des professeurs utilisent des invitations préalables et des routes réservées à `admin`. Elles devront être adaptées à l'inscription autonome du professeur et à la recherche/affectation par les responsables de programme. Il ne faut pas simplement exposer ces routes existantes aux nouveaux rôles.

## Plan de livraison recommandé

1. **Fondation des rôles et affectations** : migration additive, compatibilité des comptes historiques, fonctions de nomination et tests d'autorisation API.
2. **Espaces de travail** : six tableaux de bord responsive, menus et navigation adaptés aux rôles et périmètres renvoyés par l'API.
3. **Annuaire et affectations des professeurs** : inscription autonome, statut en attente, recherche, affectations multiples et retrait indépendant.
4. **Catalogue académique** : options, niveaux, matières et cours selon la chaîne de nomination convenue.
5. **Messagerie et documents** : audiences, publications et contrôles de visibilité.
6. **Tests de sécurité** : tentatives d'accès croisé entre universités, facultés, programmes et niveaux ; tests de révocation et de comptes multi-affectations.

## Critères d'acceptation

- Un utilisateur voit le bon espace après connexion et ne peut pas sélectionner lui-même un rôle privilégié.
- Un administrateur d'université ne peut agir que dans son établissement.
- Un responsable de faculté ne peut agir que dans sa faculté.
- Un responsable de programme ne peut modifier que les matières et cours de son périmètre.
- Un professeur a un seul compte et peut recevoir plusieurs affectations dans différentes universités.
- Un professeur nouvellement inscrit reste en attente jusqu'à sa première affectation.
- Les professeurs ne publient que dans les cours auxquels ils sont affectés.
- Les annonces, messages et documents respectent le périmètre de chaque auteur et destinataire.
- Les comptes existants et l'espace étudiant actuel continuent de fonctionner.

## État de cette livraison

Ce document fixe les décisions fonctionnelles et le plan technique. Aucun changement de comportement de l'application ou de la base de données n'est inclus dans cette fondation. La première étape de code devra implémenter et tester les permissions serveur avant d'activer les nouveaux tableaux de bord.


## Mise à jour d'implémentation — branche de travail

La conception ci-dessus est désormais partiellement implémentée dans la PR #28. Les changements suivants sont présents dans la branche :

- Les affectations actives sont renvoyées au client dans le profil authentifié et l'utilisateur peut basculer entre les espaces auxquels il a réellement droit.
- Le Responsable d'université dispose d'un espace pour créer, modifier et désactiver les facultés, options et niveaux de sa ou ses universités attribuées.
- Une université créée par l'Administrateur général reste en mode configuration. Les inscriptions ne s'ouvrent qu'après vérification du catalogue académique.
- Le Responsable de programme peut créer et gérer les matières de son programme avant d'y ajouter des cours.
- Les tests automatisés contrôlent plusieurs refus d'accès hors périmètre.

La migration \`20261109100000_university_catalog_admin.sql\` doit être appliquée à Supabase avant d'utiliser cette fonctionnalité en production. Les tests actuels sont des tests de routes avec base simulée ; les parcours réels Supabase et les contrôles de sécurité de bout en bout restent obligatoires.

Voir \`docs/AUDIT_TECHNIQUE_IFAC.md\` pour les constats, les tests effectués et les conditions restantes avant fusion.
