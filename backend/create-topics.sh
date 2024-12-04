#!/bin/bash

sleep 30

/bin/kafka-topics --create --if-not-exists --topic alert-updates --bootstrap-server localhost:9092
/bin/kafka-topics --create --if-not-exists --topic user-updates --bootstrap-server localhost:9092
/bin/kafka-topics --create --if-not-exists --config retention.ms=60000 --topic users-in-danger --bootstrap-server localhost:9092