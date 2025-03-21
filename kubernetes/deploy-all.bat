@echo off
echo === Создание общего тома ===
kubectl apply -f shared-volume.yaml

echo === Запуск сервисов ===
kubectl apply -f services/server-service.yaml
kubectl apply -f services/frontend-service.yaml

echo === Запуск развертываний ===
kubectl apply -f deployments/server-deployment.yaml
kubectl apply -f deployments/frontend-deployment.yaml
kubectl apply -f deployments/bot-deployment.yaml
kubectl apply -f deployments/scheduler-deployment.yaml

echo === Проверка статуса компонентов ===
kubectl get pods
kubectl get services

echo === Проверка доступа ===
echo Frontend доступен по адресу:
kubectl get service frontend-service -o jsonpath="{.spec.ports[0].nodePort}" | findstr /r /n "^" | find /v /n "" | findstr ":" > temp.txt
set /p FRONTEND_PORT=<temp.txt
del temp.txt
echo http://localhost:%FRONTEND_PORT%

echo API доступен по адресу:
kubectl get service server-service -o jsonpath="{.spec.ports[0].nodePort}" | findstr /r /n "^" | find /v /n "" | findstr ":" > temp.txt
set /p API_PORT=<temp.txt
del temp.txt
echo http://localhost:%API_PORT% 