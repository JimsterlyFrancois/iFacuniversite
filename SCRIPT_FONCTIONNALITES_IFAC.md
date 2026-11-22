# Cahier des fonctionnalités — iFac

## 1. Concept
iFac est un portail numérique de ressources et de services destiné aux communautés universitaires. Les utilisateurs consultent les documents dans l’application (PDF, Word, Excel et PowerPoint) et prennent leurs notes personnelles au même endroit. Les documents sont organisés par université, faculté ou école, option, niveau et matière.

## 2. Inscription et filtrage obligatoires
Le formulaire d’inscription comprend au minimum : nom complet, faculté ou école, option et niveau. Les trois derniers champs sont obligatoires. Les champs de compte nécessaires (adresse e-mail et mot de passe) sont également requis lorsque l’authentification sera activée.

- Les facultés et écoles sont définies dans le catalogue de chaque établissement ; aucune liste n’est figée dans le code.
- La liste des options dépend de la faculté ou de l’école choisie.
- La liste des niveaux dépend de l’option sélectionnée et ne présente que les niveaux réellement configurés et actifs.
- Les catalogues doivent être validés par les établissements concernés. Ne créer aucune option ni aucun niveau par supposition.
- Lorsqu’une faculté ou une école change, l’option et le niveau sont réinitialisés. Lorsqu’une option change, le niveau est réinitialisé.
- Le bouton « Rejoindre ma classe » reste désactivé tant que tous les champs obligatoires ne sont pas valides.
- Le serveur vérifie à nouveau la combinaison université–faculté/école–option–niveau. Toute combinaison inconnue ou désactivée est refusée, même si elle a été envoyée manuellement par le navigateur.
- Les niveaux L1 à L4 sont prévus au lancement. Les masters pourront être ajoutés ultérieurement lorsqu’ils seront confirmés dans le catalogue.

## 3. Accueil et bibliothèque de documents
- L’étudiant voit uniquement les matières correspondant à son profil actif.
- Chaque matière présente ses documents avec leur type (PDF, DOCX, PPTX ou XLSX).
- Si aucun contenu n’est disponible, afficher : « Aucun document pour l’instant ».
- Les fichiers sont servis par le serveur après vérification des droits d’accès. Le lecteur intégré peut afficher un filigrane nominatif.
- Le filigrane ne garantit pas à lui seul qu’un document ne puisse jamais être copié. Le partage et l’export doivent être désactivés dans l’interface lorsque possible, sans promettre une protection absolue.
- L’ouverture des fichiers Office doit passer par une visionneuse compatible ou une conversion contrôlée côté serveur; ne pas prétendre que tous les formats sont lisibles nativement dans tous les navigateurs.

## 4. Notes personnelles
Chaque étudiant peut créer, modifier et supprimer ses notes privées. Les notes ne sont accessibles qu’à leur propriétaire, avec vérification des droits côté serveur.

## 5. Messagerie
Trois groupes sont associés automatiquement au profil : faculté/école, option et classe (option + niveau).
- L’étudiant ne peut lire et écrire que dans les groupes correspondant à son profil.
- Les nouveaux messages apparaissent sans rechargement de page, au moyen d’une connexion temps réel.
- Un étudiant peut supprimer ses propres messages. Un administrateur autorisé peut modérer les messages de tous les groupes.
- Les permissions sont appliquées côté serveur, pas uniquement masquées dans l’interface.

## 6. Classe et annonces
L’onglet « Classe » affiche les annonces destinées à l’université, à la faculté/école, à l’option ou à la classe de l’étudiant. Chaque annonce possède une audience, un état actif/inactif et, si nécessaire, une période de publication.

## 7. Profil
Le profil contient les informations de l’étudiant, le mode sombre, les suggestions et questions, la présentation d’iFac, l’évaluation de l’application, l’espace sponsors, l’abonnement et le paiement lorsqu’ils seront activés, ainsi que la déconnexion.

## 8. Administration
Rôles prévus : étudiant, délégué, professeur et administrateur.
- L’administrateur peut ajouter, modifier et désactiver sans suppression définitive les universités, facultés/écoles, options, niveaux, matières, documents, annonces et utilisateurs.
- Ces opérations se font depuis l’interface d’administration, sans modification directe du code ni manipulation manuelle de la base.
- Les rôles et autorisations sont vérifiés côté serveur.
- L’administrateur peut vérifier les paiements et activer l’accès pour une durée définie lorsque le module de paiement sera développé.
- Aucun utilisateur ne devient administrateur simplement en choisissant un rôle dans le formulaire.

## 9. Paiement — phase ultérieure
Les paiements MonCash et NatCash ne sont pas inclus dans la première version fonctionnelle. Dans une phase ultérieure, l’étudiant pourra soumettre une référence de transaction; un administrateur vérifiera le paiement avant d’activer l’accès pour la durée prévue. Le montant, la durée et la procédure de vérification restent à définir. Ne jamais afficher un paiement comme confirmé avant vérification réelle.

## 10. Expérience mobile et fonctionnement hors ligne
Objectif de phase mobile : application native ou enveloppe mobile avec stockage privé, chiffré et lié au compte pour les documents téléchargés, consultables hors connexion.
- Le stockage local doit être sécurisé et les fichiers ne doivent pas être accessibles par d’autres comptes de l’appareil.
- La synchronisation et la révocation d’accès doivent être définies avant de promettre un accès hors ligne permanent.
- Le blocage des captures d’écran peut être appliqué sur Android natif dans les écrans compatibles; il ne peut pas être garanti de façon universelle dans un navigateur web.
- Le fonctionnement hors ligne complet est une phase distincte et ne doit pas être présenté comme disponible avant son implémentation et ses tests.

## 11. Gestion multi-établissements
L’architecture prend en charge plusieurs universités et établissements. Chaque établissement possède son catalogue, ses règles et ses responsables. Un établissement reste inactif tant que son catalogue et ses autorisations n’ont pas été configurés et validés.

## 12. Design et navigation
- Identité visuelle : vert sarcelle (teal), avec mode sombre.
- Mise en page responsive pour smartphone, tablette et ordinateur.
- Barre de navigation inférieure sur mobile avec cinq destinations : Classe, Messages, Accueil, Notes et Profil.
- L’Accueil est la destination centrale.
- Animation d’arrière-plan discrète, désactivée si l’appareil demande une réduction des animations.
- Prévoir des états de chargement, des erreurs compréhensibles, des écrans vides et une navigation accessible au clavier.

## Ordre de réalisation
1. Valider le catalogue de chaque établissement (facultés/écoles, options et niveaux).
2. Construire la navigation responsive et les écrans principaux avec des états vides explicites.
3. Concevoir le schéma de données et les API avec validation des permissions côté serveur.
4. Relier l’authentification, la confirmation d’e-mail et la récupération de compte.
5. Construire les documents et les notes personnelles.
6. Ajouter annonces, messagerie et administration.
7. Traiter le paiement et le hors-ligne comme phases distinctes.
8. Tester les permissions, les formats de fichiers, les tailles d’écran et les scénarios d’erreur avant publication.

## État de réalisation et limites
Le dépôt contient l’interface, l’API, les espaces par rôle et les modules de catalogue, documents, notes, annonces, messagerie et administration. Leur disponibilité effective dépend de la configuration des services et des tests de déploiement. Les paiements et la synchronisation hors ligne complète restent des phases ultérieures.
