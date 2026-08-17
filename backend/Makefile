.PHONY: help up down logs seed test fmt shell migrate revision

help:
	@echo "up       - start dev stack (api+worker+db+redis)"
	@echo "down     - stop stack"
	@echo "logs     - tail api+worker logs"
	@echo "seed     - (re)seed demo catalog"
	@echo "test     - run pytest"
	@echo "migrate  - alembic upgrade head"
	@echo "revision - autogenerate a migration (m=\"message\")"

up:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f api worker

seed:
	docker compose exec api python -m app.seed --force

test:
	docker compose exec api pytest

migrate:
	docker compose exec api alembic upgrade head

revision:
	docker compose exec api alembic revision --autogenerate -m "$(m)"
