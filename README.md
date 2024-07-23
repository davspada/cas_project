eo-fencing-based emergency ad-
vertising
Focus: location/activity awareness, containerization e de-
ployment micro-servizi
Si vuole realizzare una piattaforma per l’invio di informazioni geo-localizzate
relative a situazioni di pericolo (es. chiusura di un tratto stradale). I messaggi di
allarme devono raggiungere tutti gli utenti che si trovano all’interno del geofence
(=area poligonale definita dal gestore che inserisce i messaggi nella piattaforma).
Al tempo stesso, il sistema tiene in considerazione la modalit`a di trasporto degli
utenti (walking o driving) per fare in modo che il messaggio sia fruito in modalit`a
differente. In caso di modalit`a walking, le informazioni sono mostrate sulla
mappa del dispositivo utente. In caso di modalit`a car, il messaggio del testo
viene riprodotto mediante audio. Pi`u nel dettaglio, il sistema deve prevedere
tre componenti, con le funzionalit`a elencate sotto:
• App mobile. L’app deve prevedere queste funzionalit`a:
1. Riconoscimento automatico della mobilit`a di trasporto (walking o
car). Il riconoscimento deve essere fatto mediante le librerie del
sistema operativo (es. Activity Recognition API per Android).
2. Invio al back-end della posizione utente e della mobilit`a di trasporto
rilevata.
3. Ricezione di eventuali messaggi di allerta ricevuti dal back-end. Il
messaggio include del testo e delle coordinate. Nel caso in cui la
modalit`a corrente sia walking, viene mostrata una notifica; inoltre,
la posizione dell’utente e quella dell’allerta (posizione ricevuta dal
back-end) vengono visualizzate su mappa. Nel caso in cui la modalit`a
corrente sia car, il messaggio viene riprodotto via audio.
• Beck-end . Il deployment del back-end avviene sui nodi edge, che assumi-
amo essere posti in diversi punti della citt`a di Bologna. Il back-end riceve
le posizioni degli utenti e verifica la loro presenza o meno all’interno dei
geo-fence di allarme. I geo-fence sono aree poligonali. Sono definiti tre
livelli di allarmi, a seconda che: (i) l’utente sia all’interno del geofence;
(ii) l’utente sia fuori dal geo-fence ma entro una distanza di 1km dai suoi
confini; (iii) l’utente sia fuori dal geo-fence, ma ad una distanza dai suoi
confini compresa tra 1 e 2 Km. In caso di verifica di una delle suddette
condizioni, l’allarme viene generato e la notifica corrispondente inviata
all’utente.
• Front-end. Il front-end `e una dashboard Web, usata esclusivamente dal
gestore (es, municipalit`a di Bologna). Tramite di essa, il gestore deve
poter:
8
1. Visualizzare le posizioni degli utenti come marker su mappa, con
filtro sulla base della loro mobilit`a di trasporto.
2. Inserire una nuova allerta, sotto forma di: (i) geofence (area poligo-
nale); (ii) messaggi da inviare, per i tre livelli previsti di cui sopra,
3. Colorazione dei geo-fence, sulla base del numero di utenti attualmente
presenti in essi.
4. Clustering delle posizioni utenti utilizzando l’algoritmo K-Means. Il
numero dei cluster deve essere gestito in due modi: (i) configurazione
automatica (il sistema sceglie il numero ottimale dei cluster con il
metodo elbow; (ii) configurazione manuale, con numero dei cluster
inserito dall’utente mediante l’interfaccia.
E’ necessario effettuare uno studio di prestazioni circa l’accuratezza
del sistema di riconoscimento automatico delle attivit`a elencate (cal-
colando metriche quali: accuratezza e precisione).
4.1 Tecnologie da utilizzare
Vincoli sull’implementazione:
• App mobile: sistema operativo a scelta dell’utente. L’interfaccia dell’app
pu`o essere minimale e non `e oggetto di valutazione.
• Il back-end deve gestire dati tramite POSTGIS e query spaziali.
• La dashboard Web deve essere sviluppata con OpenLayers/Leaflet.
• Le componenti del back-end e front-end devono essere sviluppati
all’interno di container Docker orchestrati mediante il framework
Kubernates presentato a lezione.
E’ possibile utilizzare un qualsiasi linguaggio di programmazione o
librerie a scelta dello studente.
4.2 Componenti aggiuntive
• +2pt Considerare un setup con almeno due server edge, simulando che
siano collocati in punti differenti della citt`a. Prevedere un meccanismo
di attivazione/disattivazione automatica del POD contenente il sistema di
generazione degli allarmi sul nodo attualmente pi`u vicino alla maggioranza
degli utenti presenti nel sistema.