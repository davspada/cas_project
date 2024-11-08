from aiokafka import AIOKafkaConsumer
import asyncio
import json

async def subscribe_to_kafka_topic():
    # Configurazione del consumer
    consumer = AIOKafkaConsumer(
        'users-in-danger', 'user-updates', 'alert-updates',
        bootstrap_servers='localhost:9092',
        auto_offset_reset='latest',
        value_deserializer=lambda v: json.loads(v.decode('utf-8'))
    )

    # Avvio del consumer
    await consumer.start()
    print("In ascolto...")

    try:
        # Lettura dei messaggi
        async for message in consumer:
            print("Messaggio ricevuto:", message.value)
    except Exception as e:
        print(f"Errore nel consumer: {e}")
    finally:
        # Arresto del consumer per una pulizia appropriata
        await consumer.stop()

if __name__ == "__main__":  
    asyncio.run(subscribe_to_kafka_topic())
