docker build images (backend & frontend)

kind create cluster --config kind-cluster.yaml

kind load docker-image prod-cas-frontend1:latest
kind load docker-image prod-cas-backend1:latest

kubectl apply -f k8s/