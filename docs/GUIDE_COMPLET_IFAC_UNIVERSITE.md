# iFac Université — documentation complète du produit

**Version documentaire : 1.0**  
**Révision : 26 novembre 2026**  
**Dépôt de référence :** https://github.com/JimsterlyFrancois/iFacuniversite  
**Application en production :** https://i-facuniversite.vercel.app

> Ce document décrit l’application à partir du code et des configurations présents dans le dépôt à la date de révision. Il distingue les fonctions déjà implémentées, les règles d’administration et les évolutions qui ne sont pas encore activées. Il ne constitue ni une promesse de résultat académique ni un remplacement des règlements officiels d’un établissement.

## Sommaire

1. Présentation et raison d’être
2. Importance pour la communauté universitaire
3. Publics concernés
4. Les deux hiérarchies d’iFac
5. Les rôles, leurs pouvoirs et leurs limites
6. Règles de nomination et de validation
7. Mise en place complète d’une université
8. Inscription, connexion et cycle de vie d’un compte
9. Bibliothèque, documents et ressources pédagogiques
10. Délégués et gestion des classes
11. Annonces, notifications et communication
12. Matières, cours et affectations professorales
13. Architecture technique et circulation des données
14. Sécurité, confidentialité et traçabilité
15. Site web, application mobile et mises à jour
16. Fonctions disponibles et limites actuelles
17. Guide d’utilisation de bout en bout
18. Gouvernance et bonnes pratiques
19. Glossaire
20. Carte du dépôt et documents complémentaires

---

## 1. Présentation et raison d’être

iFac Université est une plateforme numérique multi-établissements conçue pour organiser les services essentiels d’une communauté universitaire dans un même environnement. Elle réunit les ressources pédagogiques, les espaces de travail selon les responsabilités, les communications institutionnelles, la gestion des parcours académiques et les interactions entre les membres.

iFac ne doit pas être compris comme un simple site de téléchargement de fichiers. Son objectif est de fournir une infrastructure numérique commune dans laquelle chaque personne retrouve les informations et les outils correspondant à son statut et à son périmètre universitaire.

La plateforme repose sur quatre idées directrices :

- **Centraliser :** rassembler les documents, annonces, cours, notes personnelles et échanges qui sont autrement dispersés entre plusieurs canaux.
- **Structurer :** relier chaque compte, ressource et responsabilité à une université et à un périmètre académique précis.
- **Responsabiliser :** donner à chaque niveau administratif des fonctions adaptées à ses attributions, sans lui ouvrir les données des autres périmètres.
- **Rendre accessible :** proposer une expérience utilisable sur ordinateur, tablette et téléphone, avec une application mobile et la possibilité d’enregistrer certains documents pour une consultation hors connexion.

La plateforme est conçue pour accueillir plusieurs universités. Aucune université particulière, y compris l’UPNCH, ne possède de privilège structurel dans le modèle multi-établissements : les mêmes règles de catalogue, de nomination et de contrôle s’appliquent à chaque établissement.

## 2. Importance pour la communauté universitaire

### 2.1 Pour les étudiants

Un étudiant peut retrouver au même endroit les documents de son parcours, les ressources partagées pour sa classe, les annonces qui le concernent, ses notifications, ses groupes de discussion et ses notes privées.

Cela vise notamment à réduire la dispersion des informations, faciliter la continuité du travail personnel et rendre plus lisible le parcours universitaire. L’accès aux ressources dépend du rattachement réel de l’étudiant à une université, une faculté, une option et un niveau actifs.

### 2.2 Pour les professeurs

Le professeur dispose d’un espace dédié à ses cours réellement attribués. Il peut suivre ses demandes, retrouver ses affectations, publier des supports dans les cours autorisés et recevoir des notifications.

Le principe est important : l’inscription comme professeur ne donne pas automatiquement le droit de publier dans tous les cours d’une université. Une affectation doit être validée dans le programme concerné.

### 2.3 Pour les responsables académiques

Les responsables n’ont pas tous les mêmes missions. Le responsable d’université prépare le catalogue de son établissement et supervise ses facultés. Le responsable de faculté organise les programmes de son périmètre. Le responsable de programme structure les matières et les cours, puis traite les demandes professorales correspondantes.

Cette répartition vise à rapprocher les décisions de la personne qui connaît le périmètre concerné, tout en maintenant une chaîne de validation identifiable.

### 2.4 Pour les administrations

L’administration générale dispose d’une vision transversale de la plateforme. Elle peut créer les établissements, désigner leurs responsables, gérer les comptes et les annonces de plateforme, consulter les journaux d’audit et administrer les éléments commerciaux enregistrés dans iFac.

L’administration universitaire, quant à elle, conserve la responsabilité de son propre établissement. Elle ne peut pas créer une autre université ni s’attribuer le rôle d’administrateur général.

### 2.5 Pour les établissements

iFac apporte une structure commune pour organiser les établissements, les facultés, les options, les niveaux, les matières et les cours. Les documents et communications sont rattachés à cette organisation. Les responsables peuvent donc travailler dans un cadre plus cohérent et conserver une trace des opérations administratives importantes.

Les bénéfices attendus sont organisationnels : une meilleure accessibilité aux informations, des responsabilités plus explicites, une circulation documentaire plus ordonnée et une administration moins dépendante de canaux isolés. Leur ampleur réelle devra être évaluée à partir de l’utilisation et des retours des établissements.

## 3. Publics concernés

| Public | Besoin principal | Espace iFac |
|---|---|---|
| Administrateur général | Gouverner et superviser toute la plateforme | Console générale |
| Responsable d’université | Administrer un ou plusieurs établissements qui lui sont attribués | Administration universitaire |
| Responsable de faculté | Superviser une faculté et ses programmes | Espace responsable de faculté |
| Responsable de programme | Organiser les matières, cours et affectations de son programme | Espace responsable de programme |
| Professeur | Travailler dans ses cours attribués | Espace professeur |
| Étudiant | Consulter les ressources et participer à la vie académique | Espace étudiant |
| Délégué | Représenter sa classe dans les fonctions prévues | Espace étudiant avec droits de délégué |
| Demandeur en attente | Suivre la validation d’une demande de responsabilité ou d’affectation | Écran de suivi de demande |

Un compte peut porter plusieurs responsabilités actives. Dans ce cas, iFac propose un sélecteur « Changer d’espace » afin que la personne ouvre l’espace correspondant à l’une de ses affectations. Un rôle n’est donc pas nécessairement synonyme d’un compte différent.

## 4. Les deux hiérarchies d’iFac

iFac organise deux structures complémentaires. Il faut les distinguer pour comprendre correctement les permissions.

### 4.1 Hiérarchie institutionnelle et de responsabilité

La chaîne administrative principale est la suivante :

**Administrateur général → Responsable d’université → Responsable de faculté → Responsable de programme → Professeur**

L’étudiant se rattache au parcours académique et utilise les ressources qui lui sont destinées. Le délégué est un étudiant auquel une fonction de représentation de classe a été attribuée ; il ne constitue pas un niveau d’administration générale supplémentaire.

~~~mermaid
flowchart TD
    A["Administrateur général<br/>Plateforme entière"]
    B["Responsable d’université<br/>Un établissement attribué"]
    C["Responsable de faculté<br/>Une faculté attribuée"]
    D["Responsable de programme<br/>Une option, éventuellement un niveau"]
    E["Professeur<br/>Cours attribués"]
    F["Étudiant<br/>Parcours universitaire"]
    G["Délégué<br/>Étudiant désigné dans une classe"]
    A --> B --> C --> D --> E
    D --> F
    F --> G
~~~

Cette représentation exprime les responsabilités de validation et les périmètres habituels. Elle ne signifie pas que chaque responsable peut consulter librement tous les contenus du niveau inférieur : les routes serveur contrôlent toujours l’affectation et son périmètre.

### 4.2 Hiérarchie académique

La structure utilisée pour organiser le catalogue est :

**Université → Faculté ou école → Option ou programme → Niveau d’études → Matière → Cours**

~~~mermaid
flowchart TD
    U["Université"]
    F["Faculté / école"]
    O["Option / programme"]
    N["Niveau d’études"]
    S["Matière"]
    C["Cours"]
    U --> F --> O --> N --> S --> C
~~~

Chaque élément dépend de son parent :

- une faculté appartient à une université ;
- une option appartient à une faculté ;
- un niveau appartient à une option ;
- une matière est rattachée à une option et à un niveau ;
- un cours est créé à partir d’une matière.

Une classe désigne, dans les fonctions de gestion des étudiants et des délégués, un groupe de personnes rattachées à la même université, faculté, option et niveau. Le mot « classe » n’est donc pas un remplacement de la hiérarchie académique ; il désigne le groupe opérationnel correspondant à un parcours de niveau.

## 5. Les rôles, leurs pouvoirs et leurs limites

### 5.1 Administrateur général — admin_general

**Périmètre : toute la plateforme.**

C’est l’autorité de gestion globale. Le modèle de données limite à un seul l’administrateur général actif.

Fonctions disponibles dans la console générale :

- créer, modifier, activer ou désactiver un établissement ;
- nommer ou remplacer les responsables d’université ;
- gérer les responsables d’université et leurs affectations ;
- consulter et filtrer le répertoire des comptes ;
- suspendre ou réactiver les comptes concernés ;
- publier des annonces officielles de plateforme en ciblant les universités, facultés, options, niveaux et rôles ;
- créer et gérer les forfaits enregistrés dans la plateforme ;
- attribuer un forfait à un établissement ;
- créer des factures, suivre leur statut et enregistrer une référence de paiement ;
- consulter les journaux des actions administratives ;
- consulter les retours transmis par les utilisateurs.

**Limites :** la gestion globale ne transforme pas l’administrateur général en responsable pédagogique de chaque cours. Les accès académiques spécialisés restent liés aux affectations et aux règles de publication. Le système empêche également la désactivation de son propre compte depuis l’action générale de suspension des comptes.

### 5.2 Responsable d’université — university_admin

**Périmètre : un établissement qui lui a été attribué.**

Un établissement peut avoir au maximum deux responsables d’université actifs, limite contrôlée en base de données.

Fonctions disponibles :

- consulter le tableau de bord de son établissement ;
- créer, modifier et désactiver les facultés ;
- créer, modifier et désactiver les options ;
- créer, modifier et désactiver les niveaux d’études ;
- nommer des responsables de faculté parmi les comptes iFac existants ;
- consulter les responsables nommés ;
- publier des annonces destinées à son université ;
- ouvrir ou fermer les inscriptions étudiantes ;
- suivre les principaux indicateurs de l’établissement : facultés, options, niveaux, étudiants, professeurs, responsables, cours, documents et annonces.

Le responsable d’université ne peut administrer que les universités pour lesquelles il possède une affectation active. Il ne peut pas créer un autre établissement ni nommer un responsable d’université de sa propre initiative.

### 5.3 Responsable de faculté — faculty_manager

**Périmètre : une faculté déterminée, dans son université.**

Une faculté peut avoir au maximum quatre responsables de faculté actifs, limite contrôlée en base de données.

Fonctions disponibles :

- consulter le tableau de bord de sa faculté ;
- suivre les options et programmes de la faculté ;
- nommer des responsables de programme dans les options et niveaux autorisés ;
- consulter les responsables de programme nommés ;
- consulter les professeurs affectés dans la faculté ;
- consulter les documents pédagogiques relevant de la faculté ;
- retirer ou réactiver une nomination de responsable de programme dans son périmètre.

Il ne peut pas créer une faculté dans un autre établissement, administrer une autre faculté ou intervenir dans un programme extérieur à son affectation.

### 5.4 Responsable de programme — program_manager

**Périmètre : une option déterminée et, selon la nomination, un niveau ou plusieurs niveaux couverts.**

Fonctions disponibles :

- consulter les indicateurs de son programme ;
- créer et désactiver les matières ;
- créer les cours à partir des matières existantes ;
- déclarer un professeur ou traiter ses demandes de cours ;
- examiner, accepter ou refuser les demandes professorales relevant de son programme ;
- consulter les cours et les documents pédagogiques de son périmètre ;
- gérer les affectations professorales couvertes par son autorité.

Une personne peut avoir plusieurs affectations de responsable de programme. Chaque affectation conserve son propre périmètre. La possession d’un accès dans une option ne donne aucun accès automatique à toutes les autres options de la faculté.

### 5.5 Professeur — professor

**Périmètre : les cours qui lui ont été attribués et activés.**

Le professeur peut :

- demander un compte depuis l’onglet « Espace professeur » ;
- proposer plusieurs demandes de cours au cours de l’inscription, dans la limite de vingt demandes par formulaire ;
- suivre séparément l’état de chaque demande ;
- consulter ses cours et affectations actives ;
- publier des documents PDF dans un cours qui lui a effectivement été attribué ;
- consulter les documents déjà publiés dans ses cours ;
- consulter ses notifications.

Chaque demande de cours est examinée dans le programme correspondant. Une validation sur un cours ne valide pas automatiquement les autres demandes.

Un professeur peut travailler dans plusieurs universités ou programmes avec un seul compte. Les affectations sont enregistrées indépendamment. Le retrait d’une affectation ne supprime ni le compte ni les autres affectations actives.

### 5.6 Étudiant — student

**Périmètre : son établissement et son parcours universitaire.**

L’étudiant peut :

- consulter les documents accessibles à son option et à son niveau ;
- rechercher des documents dans la bibliothèque ;
- consulter les documents de classe ;
- consulter les annonces qui concernent son parcours ;
- recevoir et lire ses notifications ;
- participer aux groupes de messagerie auxquels il appartient ;
- créer et conserver des notes privées ;
- consulter et mettre à jour les informations de son profil selon les champs disponibles ;
- choisir ses préférences d’affichage.

Un étudiant ne peut pas nommer des responsables, modifier le catalogue universitaire ou publier dans les cours en dehors des droits qui lui ont été explicitement attribués.

### 5.7 Délégué — delegate

**Périmètre : sa classe universitaire.**

Le délégué reste un membre de la communauté étudiante. Il utilise l’espace étudiant avec des fonctions supplémentaires, plutôt qu’un tableau de bord administratif indépendant.

Fonctions spécifiques :

- transmettre un message à l’administration au sujet de sa classe ;
- publier des documents de classe dans le périmètre autorisé ;
- retrouver les ressources et les communications accessibles à sa classe.

Une même classe peut compter au maximum trois délégués. La limite est imposée par la base de données et vérifiée par le serveur. Le responsable administratif autorisé peut désigner un étudiant déjà inscrit ou retirer sa fonction de délégué. Le retrait de cette fonction remet le compte au rôle étudiant ; il ne supprime pas le compte.

### 5.8 Demandeur en attente — applicant

applicant est un statut de compte utilisé pendant l’examen d’une demande de rôle. Ce n’est pas un rang supplémentaire dans la hiérarchie.

La personne peut se connecter et consulter l’état de sa demande, mais elle ne reçoit pas l’espace privilégié tant qu’aucune affectation active n’a été accordée. Une demande refusée, révoquée ou bloquée par la désactivation d’un périmètre ne doit pas être considérée comme un accès actif.

### 5.9 Compatibilité du rôle historique admin

Le rôle technique historique admin reste présent pour la compatibilité de certains comptes et outils existants. Dans le parcours de connexion, il est rapproché de l’administration générale lorsqu’une affectation admin_general est active. Il ne faut pas créer de nouveaux comptes en s’appuyant sur ce mécanisme historique sans passer par les procédures d’administration prévues.

## 6. Règles de nomination et de validation

### 6.1 Chaîne des approbateurs

Les demandes suivent la chaîne suivante :

| Demande | Autorité qui doit être active |
|---|---|
| Responsable d’université | Administrateur général |
| Responsable de faculté | Responsable d’université de l’établissement |
| Responsable de programme | Responsable de faculté de la faculté choisie |
| Professeur pour un cours | Responsable de programme couvrant le cours |

Une demande ne doit pas être créée comme si elle pouvait être validée lorsqu’aucun approbateur approprié n’est actif. L’API refuse alors la demande et explique quelle nomination doit être effectuée en premier.

### 6.2 Une nomination n’est pas une simple sélection dans le navigateur

Les rôles actifs sont enregistrés côté serveur. Les écrans affichent les outils correspondant aux affectations retournées après authentification, mais l’interface ne décide pas seule des droits.

Toute action sensible est contrôlée par l’API : rôle, statut, établissement et rattachement académique sont vérifiés avant l’exécution.

### 6.3 Limites de nomination actuellement imposées

| Fonction | Limite d’affectations actives |
|---|---:|
| Administrateur général | 1 pour la plateforme |
| Responsable d’université | 2 par université |
| Responsable de faculté | 4 par faculté |
| Délégué | 3 par classe |

Ces limites sont des règles techniques appliquées en base de données. Elles ne doivent pas être présentées comme de simples recommandations d’interface.

### 6.4 Révocation et conservation de l’historique

Retirer un rôle ou désactiver un périmètre retire l’accès correspondant. Cela ne signifie pas que le compte personnel, les cours, les documents ou l’historique sont automatiquement effacés.

Les facultés, options et niveaux sont désactivés logiquement. Les données historiques sont conservées afin de préserver les références et les traces administratives.

## 7. Mise en place complète d’une université

La création d’un nouvel établissement suit un ordre obligatoire.

### Étape 1 — Création de l’établissement

L’administrateur général crée l’établissement dans la console générale et lui attribue son nom et son code. L’établissement peut être préparé dans iFac, mais cela n’ouvre pas automatiquement les inscriptions étudiantes.

### Étape 2 — Nomination du responsable d’université

L’administrateur général nomme une personne à partir de son compte iFac existant ou traite une demande de responsabilité admissible. Deux responsables d’université actifs au maximum peuvent être associés à l’établissement.

### Étape 3 — Configuration des facultés et écoles

Le responsable d’université crée les facultés ou écoles avec leurs codes et leurs noms. Il vérifie ensuite que chaque faculté correspond à l’organisation officielle de l’établissement.

### Étape 4 — Configuration des options ou programmes

Chaque option est créée sous sa faculté. Une option ne peut pas être rattachée à une faculté d’un autre établissement.

### Étape 5 — Configuration des niveaux

Le responsable crée les niveaux sous la bonne option, avec leur code, leur libellé et leur ordre d’affichage. Les libellés ne sont pas figés dans le code : ils viennent du catalogue configuré.

### Étape 6 — Nomination des responsables de faculté

Le responsable d’université nomme les responsables de faculté à partir des comptes iFac existants. La personne doit être affectée à la faculté concernée.

### Étape 7 — Nomination des responsables de programme

Le responsable de faculté nomme les responsables de programme dans les options et niveaux couverts par son périmètre.

### Étape 8 — Création des matières et des cours

Le responsable de programme crée les matières, puis les cours correspondants. Les professeurs ne peuvent pas demander une affectation à un cours qui n’existe pas dans le catalogue actif.

### Étape 9 — Ouverture des inscriptions étudiantes

Le responsable d’université peut ouvrir les inscriptions lorsqu’il existe au moins une chaîne académique complète et active :

**Faculté active → Option active → Niveau actif**

L’établissement doit également rester actif et disposer d’au moins un responsable d’université actif. Les étudiants ne voient dans le catalogue public que les établissements répondant à ces conditions et dont les inscriptions sont ouvertes.

### Étape 10 — Arrivée des étudiants et organisation des classes

Les étudiants choisissent l’établissement, la faculté, l’option et le niveau disponibles. Les groupes de messagerie peuvent ensuite être créés à l’échelle d’une faculté, d’une option ou d’une classe.

### 7.1 Fermeture automatique des inscriptions

iFac ferme automatiquement les inscriptions étudiantes lorsque :

- la désactivation d’une faculté, d’une option ou d’un niveau fait disparaître le dernier parcours complet actif ;
- le dernier responsable d’université actif est retiré.

La nomination ou la réactivation d’un responsable ne rouvre pas automatiquement les inscriptions. Le responsable doit les ouvrir explicitement après vérification du catalogue.

Les comptes existants et les données historiques ne sont pas supprimés par cette fermeture.

## 8. Inscription, connexion et cycle de vie d’un compte

### 8.1 Inscription étudiante

Le parcours étudiant demande notamment :

- nom et prénom ;
- adresse e-mail ;
- université ;
- faculté ou école ;
- option ;
- niveau d’études ;
- mot de passe et confirmation.

Le mot de passe doit contenir au moins dix caractères. Les choix académiques sont chargés depuis le catalogue de la base. Le serveur vérifie à nouveau que les identifiants forment un parcours valide ; modifier les valeurs envoyées depuis le navigateur ne permet pas de contourner cette vérification.

Après l’inscription, l’utilisateur doit confirmer son adresse e-mail selon le processus configuré pour Supabase Auth.

### 8.2 Inscription d’un responsable

Dans l’onglet « Espace responsables », une personne peut demander une responsabilité proposée par l’application. Les informations de périmètre dépendent du rôle demandé. La création du compte ne lui confère pas immédiatement les permissions : l’approbateur indiqué dans la chaîne doit valider l’affectation.

### 8.3 Inscription ou demande d’un professeur

Le professeur utilise l’onglet « Espace professeur ». Il sélectionne les cours demandés et peut soumettre plusieurs demandes, jusqu’à la limite de vingt éléments dans un même formulaire. Les demandes sont examinées par le responsable de programme correspondant.

Le compte reste en attente d’accès au travail professoral tant qu’aucune affectation approuvée et active ne lui permet d’ouvrir son espace et de publier.

### 8.4 Connexion et récupération

La connexion utilise l’adresse e-mail et le mot de passe. La récupération du mot de passe passe par le service configuré. La session Web est conservée dans la session du navigateur ; l’application native utilise un stockage sécurisé pour sa session. Le mot de passe n’est pas mémorisé dans l’application.

### 8.5 Plusieurs responsabilités pour un même compte

Un même compte peut avoir différentes responsabilités ou affectations. Après connexion, iFac récupère les espaces actifs. Lorsque plusieurs espaces sont disponibles, la personne peut utiliser « Changer d’espace ». Les droits de chaque espace restent séparés.

### 8.6 Suspension et désactivation

Une désactivation de compte empêche l’utilisation normale de celui-ci. Une révocation d’affectation retire uniquement la fonction concernée. Une désactivation de l’université ou d’un élément parent peut également rendre certains espaces indisponibles. Les enregistrements historiques sont conservés.

## 9. Bibliothèque, documents et ressources pédagogiques

iFac distingue plusieurs catégories de documents. Elles n’ont pas le même auteur, le même périmètre ni les mêmes règles de publication.

### 9.1 Bibliothèque documentaire officielle

La bibliothèque regroupe les documents PDF rattachés aux matières et parcours du catalogue. Les outils d’administration permettent d’ajouter une ressource officielle, de la renommer ou de la retirer.

Dans l’interface d’administration étudiant historique, le formulaire de la bibliothèque limite les fichiers PDF à 15 Mo. Les documents restent dans un stockage privé ; ils ne sont pas supposés être publiés dans un répertoire public librement accessible.

### 9.2 Documents de classe

Les documents de classe sont associés à un parcours précis : université, faculté, option et niveau. Ils peuvent être publiés par les délégués et les personnes autorisées dans ce périmètre. Le serveur contrôle le fichier PDF réel et accepte un fichier de 25 Mo maximum dans cette route.

Une publication valide est associée à son auteur et à son périmètre. Les étudiants concernés peuvent la consulter et reçoivent une notification dans l’application. Les droits de consultation et de téléchargement sont contrôlés par l’API.

### 9.3 Supports publiés par les professeurs

Le professeur sélectionne un cours qui figure dans ses affectations actives. Le serveur refuse toute tentative de publication dans un cours qui ne lui a pas été attribué. Le document est alors lié au cours et au parcours correspondant.

### 9.4 Documents enregistrés sur le téléphone

Dans l’application native, certains documents peuvent être enregistrés dans le cache local de l’application puis rouverts sans connexion. Le stockage hors ligne est limité aux documents que l’utilisateur a effectivement enregistrés et au cache conservé par l’appareil.

Le site Web ne présente pas le même bouton d’enregistrement hors ligne. Il ne faut donc pas confondre l’accès Web aux documents avec la fonction de cache de l’application native.

### 9.5 Notes privées

Les notes personnelles appartiennent au compte qui les a créées. Elles ne sont pas des documents publics de cours et ne doivent pas être assimilées à des annonces ou des messages de groupe.

## 10. Délégués et gestion des classes

### 10.1 Identification d’une classe

Pour la gestion des classes, iFac utilise le parcours complet : université, faculté, option et niveau. Les responsables autorisés peuvent consulter les étudiants inscrits dans cette combinaison.

### 10.2 Désignation d’un délégué

Un administrateur autorisé sélectionne un étudiant actif de la classe et lui attribue le rôle de délégué. Le serveur refuse une quatrième désignation active dans la même classe. Le responsable peut retirer cette fonction si nécessaire.

### 10.3 Messages transmis par les délégués

Le délégué peut transmettre un sujet et un message à l’administration. Les messages sont conservés dans une boîte de réception administrative. Les responsables peuvent les consulter, les marquer comme lus, les modifier ou les supprimer selon les outils disponibles.

### 10.4 Groupes de messagerie

La gestion des groupes permet de créer des groupes selon trois périmètres :

- faculté ;
- option ;
- classe.

À la création, les comptes étudiants et délégués qui correspondent au périmètre sont ajoutés automatiquement, ainsi que le compte créateur. Un utilisateur ne consulte que les groupes auxquels il appartient.

## 11. Annonces, notifications et communication

iFac dispose de plusieurs canaux qu’il faut garder distincts.

### 11.1 Annonces de plateforme

Elles sont publiées par l’administration générale. Elles peuvent viser toutes les universités actives ou un périmètre académique déterminé. L’auteur peut cibler un ou plusieurs rôles : responsables d’université, responsables de faculté, responsables de programme, professeurs, étudiants, délégués et administrateurs généraux.

Les annonces actives apparaissent dans un espace commun au-dessus de l’espace de travail des comptes concernés. Le serveur recalcule les destinataires à partir des rôles et des affectations ; un filtre d’interface ne suffit pas à définir l’audience.

### 11.2 Annonces d’université

Le responsable d’université peut publier une annonce liée à son établissement. Les annonces sont destinées au périmètre choisi dans l’interface, selon les options de ciblage disponibles. Elles ne doivent pas être confondues avec une annonce générale de plateforme.

### 11.3 Notifications

Les notifications de l’application signalent notamment les nouvelles ressources publiées dans le parcours de l’utilisateur. L’utilisateur peut consulter sa liste et marquer les notifications comme lues.

Les notifications visibles dans l’application sont distinctes des notifications push du système mobile. Les notifications push natives ne sont pas activées dans la version documentée ici.

### 11.4 Messagerie de groupes

Les messages sont envoyés dans les groupes auxquels le compte appartient. La création et l’administration des groupes relèvent des fonctions autorisées.

### 11.5 Messages des délégués

Il s’agit de messages adressés à l’administration par les représentants de classe. Ce canal ne remplace ni les annonces institutionnelles, ni les conversations générales des groupes.

### 11.6 Communication visuelle

L’administration générale peut publier des annonces de plateforme ciblées. Pour les annonces visuelles de l’espace étudiant historique, l’ajout d’un flyer est soumis à une autorisation spécifique du compte propriétaire iFac configuré. Le droit d’écrire une annonce ne signifie donc pas automatiquement que l’on peut téléverser une image.

## 12. Matières, cours et affectations professorales

### 12.1 Matières et cours

Une matière doit être associée à une option et à un niveau. Un cours est créé à partir d’une matière existante. Cette organisation évite de créer des cours sans rattachement académique identifiable.

### 12.2 Demande et examen des affectations

Une demande de professeur précise le cours et son parcours. L’API contrôle que le cours appartient bien à l’université, à la faculté, à l’option et au niveau indiqués. Le responsable de programme qui couvre ce périmètre peut ensuite examiner la demande.

### 12.3 Plusieurs affectations

Les affectations sont conservées séparément. Un professeur peut recevoir plusieurs cours, y compris dans plusieurs établissements. L’activation ou le retrait d’un cours n’efface pas les autres affectations.

### 12.4 Publication et consultation

Un professeur ne peut publier que dans un cours actif qui lui a été attribué. Les responsables voient les documents correspondant à leur périmètre. Les étudiants voient les documents qui correspondent à leur parcours et à leurs droits.

## 13. Architecture technique et circulation des données

### 13.1 Composants

| Composant | Technologie | Fonction |
|---|---|---|
| Interface Web | React 19 et Vite | Écrans, formulaires et espaces de travail |
| API | Node.js et Express 5 | Authentification applicative, autorisations, logique métier et fichiers |
| Base de données applicative | Neon PostgreSQL | Comptes applicatifs, catalogues, affectations, messages, documents et journaux |
| Identité et e-mail de confirmation | Supabase Auth | Création et vérification de l’identité de connexion |
| Fichiers privés | Supabase Storage | Stockage des documents et images privés |
| Hébergement | Vercel | Site Web, routes API et build de production |
| Application native | Capacitor 8 | Intégration du client Web dans les applications mobiles |
| Mise à jour de l’interface Android | Capawesome Live Update avec signature RSA | Distribution des bundles Web compatibles |

### 13.2 Répartition des données

Neon et Supabase ont des responsabilités différentes :

- **Neon PostgreSQL** contient les données applicatives : profils iFac, rattachements universitaires, affectations de rôle, catalogue académique, documents et métadonnées, annonces, groupes, messages, notifications et journaux.
- **Supabase Auth** gère l’identité externe et la confirmation des adresses e-mail.
- **Supabase Storage** conserve les fichiers privés. Les métadonnées et les références de fichiers sont gérées par l’application.

Le profil iFac est lié à l’identité d’authentification par un identifiant externe. Les clés privées de service ne doivent jamais être exposées au navigateur.

### 13.3 Parcours d’une requête

1. Le navigateur ou l’application native envoie une requête à l’API.
2. L’API vérifie la session et identifie le compte iFac.
3. L’API récupère les rôles et affectations qui sont actifs.
4. Pour une opération protégée, elle vérifie le rôle et le périmètre demandé.
5. Si l’opération concerne un document privé, l’API vérifie également le droit de consulter ou de publier le fichier.
6. L’API effectue l’opération dans la base ou dans le stockage privé et renvoie un résultat à l’interface.

Le fait qu’un bouton soit absent de l’écran n’est jamais le seul contrôle d’autorisation.

### 13.4 Développement local

Les ports utilisés en développement sont :

- interface Vite : port 3435 ;
- API Express : port 3434.

Les scripts principaux du dépôt sont npm run dev, npm run build et npm test. Les changements de schéma doivent être préparés et testés sur un environnement isolé avant une modification de la base de production.

### 13.5 Organisation des données

Les principales entités du schéma sont :

- établissements : universities ;
- facultés : faculties ;
- options : options ;
- niveaux : study_levels ;
- comptes : users ;
- affectations de rôles : role_assignments ;
- matières et cours : subjects, courses ;
- documents : documents ;
- notes personnelles : personal_notes ;
- groupes et conversations : message_groups, group_members, messages ;
- annonces : announcements, platform_announcements et leurs cibles ;
- demandes et affectations professorales : professor_invites, professor_assignments ;
- notifications : notifications ;
- messages des délégués : delegate_messages ;
- audit : admin_audit_logs ;
- gestion commerciale : saas_plans, university_subscriptions, billing_records.

La base sépare l’identité du compte des affectations de responsabilité. Cette séparation permet à une personne de recevoir plusieurs responsabilités sans créer plusieurs comptes de connexion.

## 14. Sécurité, confidentialité et traçabilité

Les mesures présentes dans le code comprennent notamment :

- authentification par session et contrôle serveur des requêtes protégées ;
- vérification des rôles et des périmètres d’affectation ;
- validation de la cohérence des relations université, faculté, option, niveau, matière et cours ;
- stockage privé des fichiers et vérification des droits avant leur restitution ;
- validation des fichiers PDF et limites de taille sur les routes de dépôt ;
- limitation de certaines requêtes et en-têtes de protection HTTP ;
- règles de sécurité et RLS sur les tables concernées ;
- journalisation de plusieurs opérations administratives et de publication ;
- conservation des affectations révoquées et des données historiques ;
- stockage sécurisé de la session dans l’application native.

Ces contrôles réduisent les accès hors périmètre, mais ils ne dispensent pas l’exploitant de configurer les services externes correctement, de contrôler les sauvegardes, de surveiller les accès et de tester régulièrement les scénarios réels.

### 14.1 Données à protéger

Les informations de compte, les adresses e-mail, les documents privés, les notes personnelles, les messages et les journaux administratifs ne doivent pas être diffusés sans motif et sans autorisation.

Les administrateurs doivent utiliser des comptes nominatifs, éviter le partage de mots de passe et retirer rapidement les affectations qui ne sont plus nécessaires.

### 14.2 Secrets techniques

Les secrets de Neon, Supabase, SMTP, Vercel et de signature OTA restent dans les variables d’environnement ou les secrets gérés par les services concernés. Ils ne doivent jamais figurer dans le code public, les captures d’écran non masquées, les journaux partagés ou les documents destinés aux utilisateurs.

## 15. Site web, application mobile et mises à jour

### 15.1 Site Web

Le site Web est publié sur Vercel et reste accessible depuis un navigateur compatible. L’interface est conçue pour s’adapter aux écrans d’ordinateur, de tablette et de téléphone.

Les changements de l’interface Web sont publiés par le pipeline de production après validation des modifications dans le dépôt.

### 15.2 Application Android et iOS

Capacitor embarque le client Web dans une application mobile. L’identifiant natif configuré est ht.edu.ifac.universite.

Le dépôt contient les dépendances Android et iOS. La production d’un paquet iOS et sa publication nécessitent toutefois un environnement macOS avec Xcode et une procédure de signature appropriée ; la présence des dépendances ne signifie pas qu’une version iOS est déjà publiée.

### 15.3 Documents hors connexion

L’application native peut enregistrer certains documents dans son cache local et les rouvrir hors connexion. Le système d’exploitation peut supprimer des éléments du cache en cas de manque d’espace. La synchronisation complète de toutes les données de l’application hors connexion n’est pas disponible.

### 15.4 Mises à jour OTA Android

Après installation d’un APK qui contient le composant Live Update, les changements compatibles de l’interface — HTML, CSS, JavaScript et ressources Web — peuvent être distribués sous forme de bundle signé sans demander un nouvel APK à chaque fois.

Le mécanisme vérifie l’intégrité du bundle et sa signature à partir de la clé publique embarquée. La clé privée de signature est conservée dans un secret de production Vercel, jamais dans Git.

Une mise à jour OTA ne peut pas remplacer un plugin natif, changer les permissions Android, modifier le manifeste ou remplacer le code Android natif. Ce type de modification exige un nouvel APK ou AAB. Les appareils qui ne possèdent pas encore le composant OTA doivent d’abord installer une version native qui l’intègre.

Le mécanisme configuré dans le dépôt vérifie les mises à jour au lancement et à la reprise de l’application. Le bundle téléchargé est programmé pour un prochain lancement plutôt que d’interrompre une session en cours.

## 16. Fonctions disponibles et limites actuelles

La distinction ci-dessous est importante pour la communication avec les universités, les professeurs et les étudiants.

### 16.1 Fonctions présentes dans le dépôt

- plusieurs établissements et catalogues académiques distincts ;
- six espaces de travail correspondant aux responsabilités principales ;
- inscriptions étudiantes conditionnées par l’ouverture de l’établissement ;
- demandes de responsabilité et chaîne de validation ;
- gestion des facultés, options et niveaux par le responsable d’université ;
- gestion des matières et cours par le responsable de programme ;
- demandes et affectations professorales par cours ;
- bibliothèque documentaire et documents de classe ;
- notes privées ;
- groupes de messagerie et messages des délégués ;
- annonces de plateforme et annonces d’université ;
- notifications intégrées à l’application ;
- console générale, journaux d’audit et fonctions de gestion de forfaits et factures ;
- application native basée sur Capacitor et mécanisme OTA Android pour les bundles Web compatibles.

### 16.2 Fonctions non activées ou non complètes dans cette version

- **Paiements en ligne :** iFac contient des forfaits, des abonnements et un registre de factures. La création d’une facture ou le statut « payée » ne déclenche pas un encaissement automatique. Aucun parcours de paiement par carte ou portefeuille électronique n’est considéré comme opérationnel sur la seule base de ces écrans.
- **Synchronisation hors connexion complète :** le cache natif de documents ne signifie pas que les messages, profils, annonces et toutes les données sont synchronisés hors ligne.
- **Notifications push natives :** les notifications de l’application sont disponibles, mais l’envoi de notifications push Android/iOS n’est pas implémenté dans la documentation actuelle.
- **Publication iOS :** la configuration Capacitor existe ; la compilation signée et la distribution iOS nécessitent encore leur propre environnement et pipeline.
- **Mise à jour OTA des changements natifs :** les mises à jour OTA concernent les ressources Web compatibles, pas les plugins ni le code natif.
- **Analytique avancée :** les tableaux de bord présentent des indicateurs de gestion, mais ne doivent pas être décrits comme un système complet d’analytique pédagogique ou de mesure des performances académiques.
- **Évaluation de l’impact :** les bénéfices attendus d’iFac doivent être étudiés à partir des usages, des retours et d’indicateurs définis avec les établissements ; ils ne sont pas automatiquement démontrés par l’existence de la plateforme.

Cette liste doit être révisée à chaque livraison importante.

## 17. Guide d’utilisation de bout en bout

### Pour lancer un établissement

1. L’administrateur général crée l’établissement.
2. Il désigne un responsable d’université actif.
3. Le responsable crée les facultés.
4. Il ajoute les options à chaque faculté.
5. Il ajoute les niveaux à chaque option.
6. Il nomme les responsables de faculté.
7. Les responsables de faculté nomment les responsables de programme.
8. Les responsables de programme ajoutent les matières et les cours.
9. Les professeurs demandent ou reçoivent leurs affectations.
10. Le responsable d’université vérifie qu’un parcours complet est actif et ouvre les inscriptions.
11. Les étudiants s’inscrivent et confirment leur adresse e-mail.
12. Les administrateurs autorisés organisent les groupes et désignent les délégués.

### Pour un étudiant

1. Ouvrir iFac et choisir « Inscription étudiant ».
2. Sélectionner l’établissement ouvert, la faculté, l’option et le niveau.
3. Saisir l’identité et créer un mot de passe conforme.
4. Confirmer l’adresse e-mail.
5. Se connecter.
6. Consulter la bibliothèque, les documents de classe, les annonces et les notifications.
7. Utiliser les groupes de messagerie disponibles.
8. Conserver ses notes dans « Notes privées ».
9. Dans l’application native, enregistrer les documents nécessaires pour une consultation hors connexion, lorsque cette option est disponible.

### Pour un délégué

1. Être inscrit comme étudiant dans la classe concernée.
2. Être désigné par un administrateur autorisé.
3. Accéder aux fonctions supplémentaires de l’espace étudiant.
4. Transmettre un message à l’administration si nécessaire.
5. Publier les documents de classe autorisés et respecter le périmètre documentaire.

### Pour un professeur

1. Ouvrir l’onglet « Espace professeur ».
2. Créer le compte ou transmettre les demandes de cours.
3. Confirmer l’adresse e-mail.
4. Attendre l’examen de chaque demande par le responsable de programme concerné.
5. Se connecter lorsque l’affectation est active.
6. Consulter les cours attribués.
7. Publier les documents dans le cours autorisé.
8. Suivre les notifications et l’état de ses affectations.

### Pour un responsable de programme

1. Recevoir ou obtenir une affectation active dans son option et ses niveaux.
2. Ouvrir l’espace responsable de programme.
3. Créer les matières.
4. Créer les cours correspondants.
5. Examiner les demandes de professeurs relevant du périmètre.
6. Valider ou refuser chaque demande avec discernement.
7. Suivre les cours, les professeurs et les documents du programme.

### Pour un responsable de faculté

1. Ouvrir son espace et vérifier le périmètre affiché.
2. Consulter les programmes de la faculté.
3. Nommer les responsables de programme nécessaires.
4. Vérifier la liste des responsables nommés.
5. Consulter les professeurs et les documents relevant de la faculté.
6. Retirer une affectation devenue invalide ou réactiver une nomination justifiée.

### Pour un responsable d’université

1. Ouvrir son espace universitaire.
2. Vérifier l’établissement administré.
3. Configurer les facultés, options et niveaux dans cet ordre.
4. Nommer les responsables de faculté.
5. Publier les annonces destinées à l’établissement.
6. Vérifier le catalogue et l’état des inscriptions.
7. Ouvrir ou fermer les inscriptions selon la situation réelle de l’établissement.

### Pour l’administrateur général

1. Ouvrir la console générale.
2. Créer ou mettre à jour un établissement.
3. Nommer ou remplacer son responsable d’université.
4. Consulter le répertoire des comptes et traiter les suspensions nécessaires.
5. Publier les annonces de plateforme avec le bon périmètre et les bons destinataires.
6. Consulter les actions consignées dans le journal d’audit.
7. Gérer les forfaits, abonnements et factures comme registres administratifs.
8. Vérifier régulièrement que les responsables et les périmètres sont toujours pertinents.

## 18. Gouvernance et bonnes pratiques

Pour éviter qu’une plateforme de centralisation ne devienne elle-même une source de désordre, les établissements devraient adopter les règles de fonctionnement suivantes :

- nommer uniquement des responsables identifiés et autorisés par leur établissement ;
- maintenir au moins un responsable d’université actif ;
- configurer le catalogue avant d’ouvrir les inscriptions ;
- vérifier régulièrement les comptes et les affectations ;
- retirer les rôles devenus inutiles sans supprimer l’historique ;
- créer des groupes de messagerie uniquement avec une audience claire ;
- publier les documents dans la bonne matière, le bon cours ou la bonne classe ;
- privilégier les annonces institutionnelles pour les informations officielles ;
- ne pas utiliser les messages de délégués comme substitut à une procédure administrative formelle ;
- protéger les notes privées et les documents qui contiennent des informations personnelles ;
- contrôler les journaux d’audit pour les opérations sensibles ;
- prévoir des règles de conservation, de sauvegarde et de traitement des demandes d’assistance ;
- informer les utilisateurs des limites du mode hors connexion et des notifications.

iFac fournit des outils de coordination ; la responsabilité académique, la validation des contenus, les calendriers et les décisions officielles restent sous l’autorité des établissements concernés.

## 19. Glossaire

| Terme | Définition dans iFac |
|---|---|
| Établissement / université | Organisation universitaire racine du catalogue |
| Faculté / école | Unité académique appartenant à un établissement |
| Option / programme | Parcours académique appartenant à une faculté |
| Niveau | Année ou niveau d’études associé à une option |
| Matière | Unité académique associée à une option et un niveau |
| Cours | Enseignement créé à partir d’une matière |
| Affectation | Attribution active d’un rôle ou d’un cours à un compte |
| Périmètre | Partie de l’établissement sur laquelle une affectation autorise une action |
| Responsable d’université | Compte administrant un établissement déterminé |
| Responsable de faculté | Compte administrant une faculté déterminée |
| Responsable de programme | Compte administrant une option et les niveaux autorisés |
| Délégué | Étudiant désigné pour une fonction de représentation de classe |
| Annonce de plateforme | Communication publiée par l’administration générale |
| Annonce d’université | Communication locale publiée pour un établissement |
| Document de classe | Ressource PDF rattachée à une classe ou à un cours |
| OTA | Mise à jour à distance des ressources Web compatibles d’une application native |
| RLS | Règles PostgreSQL/Supabase qui limitent l’accès direct aux lignes selon les politiques définies |

## 20. Carte du dépôt et documents complémentaires

Les fichiers importants pour comprendre le produit sont :

| Chemin | Rôle |
|---|---|
| client/src/App.jsx | Connexion, inscription, choix de l’espace et assemblage des espaces |
| client/src/StudentShell.jsx | Espace étudiant, documents, notes, groupes, annonces et fonctions liées aux délégués |
| client/src/ProfessorShell.jsx | Espace professeur |
| client/src/ProgramManagerShell.jsx | Espace responsable de programme |
| client/src/FacultyManagerShell.jsx | Espace responsable de faculté |
| client/src/UniversityAdminShell.jsx | Espace responsable d’université |
| client/src/GeneralAdminShell.jsx | Console administrateur général |
| server/index.js | API principale et fonctions historiques partagées |
| server/routes/ | Routes dédiées aux responsabilités, catalogues, professeurs, documents et annonces |
| server/lib/roleHierarchy.js | Règles de chaîne des approbateurs |
| server/lib/roleAuthorization.js | Vérifications communes de rôles |
| server/db/schema.sql | Schéma de la base applicative |
| supabase/migrations/ | Migrations de sécurité et de fonctionnalités liées aux services Supabase |
| docs/ | Documentation fonctionnelle et technique |

### Documents détaillés à consulter

- docs/UNIVERSITY_HIERARCHY.md — règles de configuration institutionnelle et d’ouverture des inscriptions.
- docs/SIX_ROLE_WORKSPACES.md — historique de conception des espaces et du modèle de permissions.
- docs/PLATFORM_ANNOUNCEMENTS.md — annonces officielles de plateforme et transfert des responsables.
- docs/MOBILE_APP.md — intégration mobile Capacitor, cache des documents et configuration des applications.
- docs/mobile-ota.md — fonctionnement et limites des mises à jour OTA.
- server/API_CONTRACT.md — contrat des routes API.
- server/CONFIGURATION.md — services, variables d’environnement et contrôles avant publication.
- AUTH_REQUIREMENTS.md — exigences d’inscription et de connexion.

---

## Déclaration de référence

Ce guide constitue la présentation fonctionnelle générale d’iFac Université pour les équipes, les responsables d’établissements et les utilisateurs. En cas de différence entre ce guide et le comportement réellement déployé, le code exécuté, la configuration de production et les tests de la version concernée déterminent le comportement effectif. Toute nouvelle fonction doit être ajoutée au guide après vérification de son implémentation et de ses limites.
