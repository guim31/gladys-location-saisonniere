# Location saisonnière (Holiday rental, iCal)

Les arrivées et départs des voyageurs d'un logement loué, lus dans les calendriers d'export iCal que chaque
plateforme donne pour chaque annonce (Airbnb, Booking.com, Abritel, Vrbo, Gîtes de France, Smoobu et autres
gestionnaires de canaux) : ni compte, ni API partenaire. Préchauffer avant l'arrivée, couper le chauffage au départ,
prévenir le ménage un jour de rotation.

Développée sans compte d'hôte réel : vos retours sont les bienvenus. Les formats ont été vérifiés sur des exports
réels publiés.

## Ce que vous obtenez

- Un appareil par logement (trois au plus), avec :
  - **Occupé** (oui / non) : un séjour est en cours, de son heure d'arrivée à son heure de départ ;
  - **Arrivée imminente** (oui / non) : la prochaine arrivée est dans le délai d'anticipation des options (3 heures
    par défaut) ;
  - **À préparer aujourd'hui** (oui / non) : des voyageurs partent et d'autres arrivent le même jour ;
  - **Prochaine arrivée** et **Prochain départ** : jour, heure et plateforme, par exemple « ven. 13 nov., 16:00 ·
    Booking.com » ;
  - **Heures avant l'arrivée** (arrondi au-dessus) et **Jours avant l'arrivée** ;
  - **Nuits restantes** du séjour en cours.
- Trois déclencheurs de scène : arrivée des voyageurs, départ des voyageurs, arrivée imminente.
- Une action de scène qui lit le séjour en cours ou le prochain, pour un message.
- Un widget de tableau de bord : occupé ou libre maintenant, puis les séjours à venir.

## Configuration

Pour chaque logement, dans **Intégrations → Holiday rental (iCal) → Configuration** :

- **Nom** : le nom de l'appareil dans Gladys (vous pourrez renommer l'appareil ensuite).
- **Adresse iCal** : l'adresse d'export (.ics) du calendrier du logement sur une plateforme. **Autre adresse
  iCal** : le même logement sur une deuxième plateforme. Plusieurs adresses peuvent aussi être collées dans un même
  champ, séparées par une espace. Les séjours de toutes les adresses sont fusionnés et les doublons retirés.
- **Heure d'arrivée** et **Heure de départ** (16 h et 11 h par défaut) : les plateformes exportent des jours, pas
  des heures. Quand un flux donne une heure (certains gestionnaires de canaux), c'est elle qui compte.

Où trouver l'adresse :

- **Airbnb** : Calendrier → l'annonce → Disponibilités → Connecter des calendriers → Exporter le calendrier.
- **Booking.com** (extranet) : Tarifs et disponibilités → Synchroniser les calendriers → Exporter. Booking.com écrit
  chaque date réservée ou fermée « CLOSED - Not available » : choisissez d'exporter les seules dates réservées quand
  l'extranet le propose.
- **Abritel / Vrbo** : Calendrier → Importer et exporter → Exporter le calendrier.
- **Gîtes de France, Clévacances, Smoobu, Lodgify, Beds24…** : la page « export iCal » ou « synchronisation de
  calendrier » de l'annonce.

Options :

- **Anticipation avant l'arrivée** (heures, de 0 à 72) : quand « Arrivée imminente » passe à oui et que son
  déclencheur part. 0 le désactive.
- **Dates « Not available »** : Booking.com et Smoobu exportent chaque réservation en « Not available », exactement
  comme une date que vous avez fermée. Par défaut, elles comptent comme séjours (sans quoi un hôte Booking.com ne
  verrait aucune réservation) ; choisissez « Les ignorer » si toutes vos réservations viennent de flux qui les
  nomment (Airbnb « Reserved », Abritel « Reserved - … »). Les blocages d'Airbnb (« Airbnb (Not available) ») et
  d'Abritel / Vrbo (« Blocked ») sont toujours ignorés : chez Airbnb, ils contiennent aussi les réservations
  importées des autres plateformes, que leur propre flux apporte.
- **Afficher noms et codes des voyageurs** : désactivé par défaut. Activé, le prénom (Abritel / Vrbo) et le code de
  réservation (Airbnb) que portent certains flux apparaissent dans le widget et dans la variable `guest` des scènes.
- **Rafraîchissement des calendriers** : toutes les 15, 30 (par défaut) ou 60 minutes, ou toutes les 3 heures. Les
  plateformes mettent elles-mêmes à jour leurs exports au mieux toutes les quelques heures : un rythme plus rapide
  ne voit pas une réservation plus tôt de leur côté.
- **Langue des noms** : noms des fonctionnalités et textes des états, fixés à la création de l'appareil.

Ouvrez ensuite l'onglet **Découverte** et ajoutez chaque logement à Gladys.

## Actions

**Vérifier les calendriers** télécharge à nouveau chaque calendrier et résume, par logement, le nombre de séjours à
venir et la prochaine arrivée, ou les calendriers illisibles.

## Scènes

Déclencheurs (catégorie « Holiday rental (iCal) » de l'éditeur de scènes), chacun filtrable par logement :

- **Arrivée des voyageurs** : l'heure d'arrivée d'un séjour est atteinte.
- **Départ des voyageurs** : l'heure de départ est atteinte : chauffage coupé, ménage. Ajoutez une action
  « Attendre » à la scène pour le ménage quelques heures plus tard.
- **Arrivée imminente** : le délai d'anticipation avant une arrivée est atteint : préchauffage.

Variables des trois : logement, plateforme, nuits, arrivée, départ, rotation le même jour (oui / non) et voyageur
(vide sauf option activée).

Les états de l'appareil servent aussi de conditions : « Heures avant l'arrivée » à 24 ou moins pour programmer le
code d'une serrure connectée la veille, « Occupé » à non pour garder le chauffage en hors-gel, « À préparer
aujourd'hui » à oui pour prévenir l'équipe de ménage le matin. Sans séjour connu, « Heures avant l'arrivée » vaut
9999 et « Jours avant l'arrivée » 999, pour qu'un seuil ne parte jamais dessus.

Action : **Lire le prochain séjour** renvoie, pour un logement, le séjour en cours ou à défaut le prochain : trouvé
(oui / non), logement, occupé maintenant, arrivée, départ, nuits, jours avant l'arrivée, plateforme.

## Tableau de bord

Ajoutez le widget **Séjours du logement** : une ligne d'état par logement (occupé jusqu'au…, ou libre et la
prochaine arrivée), puis jusqu'à huit séjours à venir avec leurs dates, leur nombre de nuits et leur plateforme ; le
séjour en cours et les arrivées du jour sont signalés. Réglages : un logement (tous si vide), et l'affichage ou non
des lignes occupé / libre.

## Dépannage

- **L'écran de configuration indique « Calendrier injoignable »** : l'adresse est mal copiée, ou la plateforme l'a
  renouvelée. Copiez-la à nouveau depuis la plateforme. « Vérifier les calendriers » dit quel logement échoue. Les
  séjours déjà lus sont gardés en attendant.
- **Un séjour manque** : est-il dans l'export de la plateforme ? Certaines n'exportent que les 12 mois à venir, et
  une réservation Booking.com demande que les dates « Not available » comptent comme séjours.
- **Une date que vous avez bloquée apparaît comme un séjour** : elle est arrivée dans un flux « Not available »
  (Booking.com importe les blocages d'Airbnb). Exportez les seules dates réservées sur Booking.com, ou choisissez
  « Les ignorer ».
- **Les heures sont décalées d'une heure ou plus** : elles sont lues dans le fuseau horaire de Gladys (Paramètres →
  Système). Le logement et Gladys doivent être dans le même fuseau.

## Limites

- Trois logements au plus, deux champs d'adresse chacun (plusieurs adresses peuvent partager un champ).
- Les plateformes rafraîchissent leurs exports à leur rythme, souvent toutes les quelques heures : une réservation
  faite il y a une minute peut n'apparaître que plus tard.
- Les arrivées anticipées et départs tardifs convenus avec les voyageurs ne sont pas dans les exports : les heures
  configurées s'appliquent.
- Aucun séjour n'est ajouté au calendrier de Gladys : l'intégration Calendriers ICS peut y afficher les mêmes flux.

## Confidentialité et sécurité

Les adresses iCal sont des secrets (qui les a lit votre calendrier) : elles sont stockées par Gladys, servent
uniquement à télécharger les calendriers et n'apparaissent jamais dans les journaux (seul le nom d'hôte y
figure). Rien n'est écrit sur le disque. Les noms des voyageurs et les codes de réservation restent masqués sauf si
vous activez l'option. Sans lien avec Airbnb, Booking.com, Abritel, Vrbo ni aucune plateforme citée ici.
