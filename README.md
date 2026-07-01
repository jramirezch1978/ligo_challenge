# Wallet Transaction Service — Ligo Backend Senior Technical Challenge

Microservicio backend (Node.js 20 + TypeScript + NestJS + PostgreSQL) para gestionar operaciones de una
billetera digital regulada: consulta de saldo, movimientos paginados, débitos/créditos, transferencias
entre wallets y reversas, con idempotencia, atomicidad transaccional y auditoría técnica.

## Stack técnico

- **Node.js 20** + **TypeScript** (strict)
- **NestJS 10** (arquitectura modular, Guards, Pipes, Interceptors, Filters)
- **PostgreSQL 16** + **TypeORM** (migraciones versionadas, sin `synchronize`)
- **Docker Compose** (app + base de datos, un solo comando)
- **JWT** (login simulado) + `class-validator`
- **Swagger / OpenAPI** en `/docs`
- **Jest** + **Supertest** (unitarios + integración contra PostgreSQL real)

## Ejecución con un solo comando

Requisitos: Docker + Docker Compose.

```bash
docker compose up --build
```

Esto levanta PostgreSQL, ejecuta las migraciones (schema + seed de wallets demo) y arranca la API en
`http://localhost:3000`. Documentación interactiva en **http://localhost:3000/docs**.

> Los puertos publicados en el host son `3000` (API) y `5434` (Postgres, para no chocar con otra instancia
> local en `5432`). Se pueden sobrescribir con las variables `PORT` y `DATABASE_PORT` en un archivo `.env`
> en la raíz del proyecto (ver `.env.example`).

Para detener y limpiar:

```bash
docker compose down          # detiene los contenedores
docker compose down -v       # además borra el volumen de datos de Postgres
```

## Ejecución en local (sin Docker para la app)

```bash
npm install
cp .env.example .env         # ajustar si es necesario
docker compose up -d postgres   # solo la base de datos
npm run migration:run        # aplica schema + seed
npm run start:dev            # http://localhost:3000
```

## Wallets precargadas (seed)

| walletId  | moneda | saldo inicial | estado   |
|-----------|--------|----------------|----------|
| `wal_001` | PEN    | 1500.00        | ACTIVE   |
| `wal_002` | PEN    | 500.00         | ACTIVE   |
| `wal_003` | USD    | 200.00         | ACTIVE   |
| `wal_004` | PEN    | 300.00         | BLOCKED  |

## Autenticación

```
POST /api/auth/login
{ "username": "senior.backend", "password": "Password123" }
```

Devuelve `{ "token": "...", "expiresIn": 3600 }`. Usar el token como `Authorization: Bearer <token>`
en el resto de endpoints (todos protegidos salvo `/auth/login`, `/health`, `/health/ready` y `/docs`).

## Endpoints principales

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/login` | Login simulado, emite JWT |
| GET | `/api/wallets/:walletId/balance` | Saldo disponible |
| GET | `/api/wallets/:walletId/movements` | Movimientos paginados (`type`, `status`, `page`, `pageSize`) |
| POST | `/api/transactions` | Débito o crédito atómico (`Idempotency-Key` obligatorio) |
| POST | `/api/transactions/transfer` | Transferencia entre wallets (`Idempotency-Key` obligatorio) |
| POST | `/api/transactions/:id/reversal` | Reversa única de una transacción (`Idempotency-Key` obligatorio) |
| GET | `/api/transactions/:id` | Estado de una transacción |
| GET | `/health` | Liveness |
| GET | `/health/ready` | Readiness (verifica conexión a PostgreSQL) |

Contrato completo, ejemplos y códigos de error: ver Swagger en `/docs` y la colección Postman en
[`postman/Ligo-Wallet-Service.postman_collection.json`](postman/Ligo-Wallet-Service.postman_collection.json).

## Reglas de negocio implementadas

- Solo wallets `ACTIVE` pueden operar (débito, crédito, transferencia, reversa).
- No se permite saldo negativo (validado antes de aplicar cualquier débito).
- No se permite operar entre wallets con monedas distintas.
- Los montos se representan **siempre** como `string` decimal (nunca `float`); la aritmética usa
  `decimal.js` y la persistencia usa columnas `numeric(18,2)`.
- Toda operación crítica (débito, crédito, transferencia, reversa) es **atómica**: se ejecuta dentro de
  una única transacción de base de datos con `ROLLBACK` automático ante cualquier fallo.
- Concurrencia controlada con bloqueo pesimista de filas (`SELECT ... FOR UPDATE`); en transferencias,
  ambos wallets se bloquean en orden determinístico para evitar deadlocks.
- `Idempotency-Key` obligatorio en operaciones críticas: mismo key + mismo payload ⇒ misma respuesta
  (sin reprocesar); mismo key + payload distinto ⇒ `409 Conflict`; petición concurrente con el mismo key
  ⇒ `409 Conflict`.
- Una transacción reversada no puede volver a reversarse (`409`); una reversa no puede reversarse (`422`).
- Toda operación crítica queda registrada en `audit_logs` (acción, entidad, quién, metadata).

Detalle de arquitectura y decisiones de diseño: [`docs/architecture.md`](docs/architecture.md).

## Testing

```bash
npm test                 # unitarios (reglas de negocio, idempotencia, auth, money util)
npm run test:cov         # unitarios con cobertura

docker compose -f docker-compose.test.yml up -d   # PostgreSQL efímero para integración (puerto 5435)
npm run test:e2e                                   # integración contra PostgreSQL real
docker compose -f docker-compose.test.yml down     # limpieza
```

Los tests de integración cubren, contra una base de datos real: login, balance, movimientos paginados,
débito/crédito exitoso, fondos insuficientes, wallet bloqueada/inexistente, moneda distinta, transferencia
(éxito y bordes), reversa (débito y transferencia), doble reversa, reversa de una reversa, e idempotencia
(replay exacto y conflicto 409). Los tests unitarios cubren la lógica de negocio de `TransactionsService`
de forma aislada (sin base de datos), `IdempotencyService`, `AuthService` y la utilidad `Money`.

## Variables de entorno

Ver [`.env.example`](.env.example). Los valores por defecto usados por `docker-compose.yml` no requieren
crear un `.env` para el caso de uso estándar.

## Estructura del proyecto

```
src/
  auth/            Login simulado + JWT + guard global
  wallets/         Saldo y movimientos
  transactions/    Débito/crédito/transferencia/reversa (núcleo transaccional)
  idempotency/     Servicio de idempotencia (Idempotency-Key)
  audit/           Auditoría técnica
  health/          Liveness / readiness
  common/          DTOs base, excepciones de dominio, filtros, interceptors, utilidades (Money, ids)
  database/        DataSource de TypeORM + migraciones + seed
test/
  integration/     Tests e2e contra PostgreSQL real (Jest + Supertest)
docs/              Arquitectura y declaración de uso de IA
postman/           Colección Postman
```

## Declaración de uso de IA

Ver [`docs/ai-usage.md`](docs/ai-usage.md).
