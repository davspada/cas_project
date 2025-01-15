#!/bin/bash
set -e

# Wait for Kafka to be ready
MAX_TRIES=10
SLEEP_SECONDS=5

for ((i=1; i<=MAX_TRIES; i++)); do
    if kafka-topics --bootstrap-server localhost:9092 --list; then
        echo "Kafka is ready. Creating topics..."
        
        # Create topics with error handling
        /bin/kafka-topics --create --if-not-exists \
            --topic alert-updates \
            --bootstrap-server localhost:9092 || true
        
        /bin/kafka-topics --create --if-not-exists \
            --topic user-updates \
            --bootstrap-server localhost:9092 || true
        
        /bin/kafka-topics --create --if-not-exists \
            --config retention.ms=60000 \
            --topic users-in-danger \
            --bootstrap-server localhost:9092 || true
        
        echo "Topics created successfully."
        exit 0
    else
        echo "Waiting for Kafka to be ready (attempt $i/$MAX_TRIES)..."
        sleep $SLEEP_SECONDS
    fi
done

echo "Kafka did not become ready in time."
exit 1