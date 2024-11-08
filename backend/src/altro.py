from aiokafka import AIOKafkaProducer
import asyncio
import json

async def send_message_to_kafka():
    # Configurazione del producer Kafka
    producer = AIOKafkaProducer(
        bootstrap_servers='localhost:9092',
        value_serializer=lambda v: json.dumps(v).encode('utf-8')  # Serializza il JSON
    )

    # Avvio del producer
    await producer.start()
    
    try:
        # Dati JSON da inviare
        data = {
            "name": "Test Producer",
            "message": "Questo è un messaggio JSON"
        }

        print("Invio del messaggio:", data)
        # Invia il messaggio al topic
        await producer.send('user-updates', key=b'id_1', value=data)
        print("Messaggio inviato con successo")
    except Exception as e:
        print(f"Errore durante l'invio del messaggio: {e}")
    finally:
        # Arresto del producer per una chiusura appropriata
        await producer.stop()

if __name__ == "__main__":
    asyncio.run(send_message_to_kafka())
