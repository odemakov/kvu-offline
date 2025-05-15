
dev:
	docker compose -f docker-compose.dev.yml up --build

build:
	docker compose -f docker-compose.yml build

prod:
	docker stack deploy --detach -c docker-stack.yml kvu-offline
