# iFac Université — ordre de configuration institutionnelle

## Chaîne de responsabilités

1. **Administrateur général** : crée l’établissement et nomme ou valide son responsable d’université.
2. **Responsable d’université** : configure les facultés, puis les options et les niveaux d’études. Il nomme ou valide les responsables de faculté.
3. **Responsable de faculté** : nomme ou valide les responsables de programme de sa faculté.
4. **Responsable de programme** : structure les matières et les cours de son périmètre, puis examine les demandes des professeurs.
5. **Professeur** : demande une ou plusieurs affectations de cours. L’accès pédagogique n’est accordé qu’après validation.
6. **Étudiant** : choisit un parcours complet dans un établissement dont les inscriptions sont explicitement ouvertes.

## Deux catalogues distincts

- `GET /api/v1/catalog/universities` est destiné à l’inscription étudiante. Il ne retourne que les établissements actifs qui disposent d’au moins un responsable d’université actif, dont les inscriptions sont ouvertes et qui possèdent au moins une chaîne active Faculté → Option → Niveau.
- `GET /api/v1/catalog/role-universities` sert aux demandes de responsables et de professeurs. Il retourne les établissements actifs même pendant leur configuration.
- Les catalogues de facultés, d’options et de niveaux continuent à respecter la relation parent-enfant et le statut actif de chaque élément.
- L’API de création du compte étudiant vérifie à nouveau que l’établissement est ouvert et que le parcours complet est actif. Masquer un choix dans l’interface n’est jamais considéré comme un contrôle de sécurité suffisant.

## Ouverture et fermeture des inscriptions

Une université nouvellement créée reste active pour sa préparation administrative, mais `registration_enabled` est initialisé à `false`. La présence d’une université dans le formulaire des responsables n’implique donc pas que les étudiants peuvent s’y inscrire.

Le responsable d’université peut ouvrir les inscriptions lorsqu’au moins une chaîne active Faculté → Option → Niveau existe. Il peut aussi les fermer manuellement. Si une désactivation de faculté, d’option ou de niveau fait disparaître le dernier parcours complet, ou si l’administrateur général retire le dernier responsable d’université actif, l’API referme automatiquement les inscriptions. Réactiver ou nommer un responsable ne rouvre jamais automatiquement les inscriptions. Les comptes existants et les données historiques ne sont pas supprimés.

## Validation hiérarchique des demandes

- Une demande de responsable d’université est traitée par l’administrateur général.
- Une demande de responsable de faculté exige au moins un responsable d’université actif pour cet établissement.
- Une demande de responsable de programme exige un responsable de faculté actif dans la faculté sélectionnée.
- Chaque demande de cours d’un professeur exige un responsable de programme actif couvrant l’option et le niveau demandés.
- Si le supérieur hiérarchique manque, l’API refuse la demande avec une explication au lieu de créer une demande qui ne peut pas être examinée.

Les nominations effectuées directement par l’autorité habilitée restent possibles. Les rôles et affectations historiques ne sont pas supprimés par cette évolution.

## Espaces visibles après connexion

Un rôle actif n’est renvoyé comme espace accessible que si son établissement et son périmètre académique parent sont actifs. Une affectation attachée à un établissement désactivé reste dans la base, mais ne donne pas un espace affiché qui échouerait ensuite sur toutes ses routes. La réactivation de l’établissement peut rendre le périmètre de nouveau disponible.

## Déploiement

Appliquer la migration `20261125130000_harden_university_registration_lifecycle.sql` avant de déployer le code. Elle change la valeur par défaut des futures universités et ferme seulement les établissements qui ne possèdent actuellement aucun parcours complet actif. Elle ne supprime aucun compte, rôle ou contenu.

Les tests automatisés couvrent les règles du catalogue, les approbateurs hiérarchiques et l’ouverture/fermeture des inscriptions. Un test réel avec un responsable d’université, un responsable de faculté, un responsable de programme, un professeur et un étudiant reste nécessaire après déploiement.
