import kafka
import json

# Configurazione del consumer
consumer = kafka.KafkaConsumer(
    'users-in-danger', 'user-updates', 'alert-updates',
    bootstrap_servers='localhost:9092',
    auto_offset_reset='latest',
    value_deserializer=lambda v: json.loads(v.decode('utf-8'))
)

print("In ascolto...")

# Lettura dei messaggi
for message in consumer:
    print("Messaggio ricevuto:", message.value)
