from kafka import KafkaProducer
import json

# Configurazione del producer Kafka
producer = KafkaProducer(
    bootstrap_servers='localhost:9092',
    value_serializer=lambda v: json.dumps(v).encode('utf-8')  # Serializza il JSON
)

# Dati JSON da inviare
data = {
    "name": "Test Producer",
    "message": "Questo è un messaggio JSON"
}

print("Messaggio inviato:", data)
# Invia il messaggio al topic
producer.send('user-updates', key=b'id_1', value=data)
print("Messaggio inviato con successo")
producer.flush()  # Assicura che il messaggio venga inviato immediatamente
