# Wallet Transaction Service — Backend

Microservicio backend (Node.js 20 + TypeScript + NestJS + PostgreSQL) para gestionar operaciones de una
billetera digital regulada: consulta de saldo, movimientos paginados, débitos/créditos, transferencias
entre wallets y reversas, con idempotencia, atomicidad transaccional y auditoría técnica.

> Este proyecto es la capa **02. backend** del repositorio. La base de datos se gestiona de forma
> independiente en [`../03. database`](../03.%20database) y el cliente web en [`../01. frontend`](../01.%20frontend).
> Ver también el [README raíz](../README.md) para la visión general de las 3 capas y el orden de despliegue.

## Stack técnico

- **Node.js 20** + **TypeScript** (strict)
- **NestJS 10** (arquitectura modular, Guards, Pipes, Interceptors, Filters)
- **PostgreSQL 17** + **TypeORM** (migraciones versionadas, sin `synchronize`)
- **Docker** (imagen propia, ver `Dockerfile` / `build.bat` / `deploy.bat`)
- **JWT** (login simulado) + `class-validator`
- **Swagger / OpenAPI** en `/docs`
- **Jest** + **Supertest** (unitarios + integración contra PostgreSQL real)

## Compilar y desplegar

```bat
cd "02. backend"
build.bat     rem compila DENTRO de Docker (multi-stage) -> imagen ligo-wallet-backend:latest
deploy.bat    rem SOLO despliega esa imagen (no recompila ni toca el codigo fuente)
```

`build.bat` compila usando el `Dockerfile` (etapa `builder`: `npm ci` + `nest build`), sin depender del
Node/npm instalados en el host, y produce la imagen final de producción que **no contiene código fuente**
(solo `dist/`). `deploy.bat` requiere que el contenedor de base de datos ya esté corriendo (ver
[`../03. database`](../03.%20database)) y conecta el contenedor del backend a la misma red Docker
(`ligo-network`) para poder resolverlo por nombre (`ligo-wallet-postgres`). Publica la API en
`http://localhost:3000` (`/docs` para Swagger, `/health` para liveness).

El propio contenedor espera activamente a que PostgreSQL esté disponible y luego aplica las migraciones
de TypeORM; si la base de datos ya fue inicializada por la capa `03. database` (que además pre-marca esas
mismas migraciones como aplicadas), este paso no hace nada — es idempotente en cualquier orden de
despliegue.

## Ejecución en local (sin Docker para la app)

```bash
npm install
cp .env.example .env         # ajustar si es necesario
npm run migration:run        # aplica schema + seed (si la BD aún no existe)
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
[`../postman/Ligo-Wallet-Service.postman_collection.json`](../postman/Ligo-Wallet-Service.postman_collection.json).

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

Detalle de arquitectura y decisiones de diseño: [`../docs/architecture.md`](../docs/architecture.md).

## Testing

```bash
npm test                 # unitarios (reglas de negocio, idempotencia, auth, money util)
npm run test:cov         # unitarios con cobertura

docker compose -f docker-compose.test.yml up -d   # PostgreSQL 17 efímero para integración (puerto 5435)
npm run test:e2e                                   # integración contra PostgreSQL real
docker compose -f docker-compose.test.yml down     # limpieza
```

Los tests de integración cubren, contra una base de datos real: login, balance, movimientos paginados,
débito/crédito exitoso, fondos insuficientes, wallet bloqueada/inexistente, moneda distinta, transferencia
(éxito y bordes), reversa (débito y transferencia), doble reversa, reversa de una reversa, e idempotencia
(replay exacto y conflicto 409). Los tests unitarios cubren la lógica de negocio de `TransactionsService`
de forma aislada (sin base de datos), `IdempotencyService`, `AuthService` y la utilidad `Money`.

## Variables de entorno

Ver [`.env.example`](.env.example).

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
docker/            entrypoint.sh + wait-for-postgres.js (usados por la imagen Docker)
build.bat          Instala dependencias y compila (dist/)
deploy.bat         Construye la imagen Docker y levanta el contenedor
```

## Declaración de uso de IA

Ver [`../docs/ai-usage.md`](../docs/ai-usage.md).
