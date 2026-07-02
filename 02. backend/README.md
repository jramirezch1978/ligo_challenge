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

| walletId  | moneda | saldo inicial | estado   | ownerName      |
|-----------|--------|----------------|----------|----------------|
| `wal_001` | PEN    | 1500.00        | ACTIVE   | Juan Perez     |
| `wal_002` | PEN    | 500.00         | ACTIVE   | Maria Lopez    |
| `wal_003` | USD    | 200.00         | ACTIVE   | Carlos Gomez   |
| `wal_004` | PEN    | 300.00         | BLOCKED  | Ana Torres     |

## Autenticación

Login simulado (sin store de usuarios real) con dos cuentas demo, cada una con un rol distinto:

| Cuenta | username | password | rol | alcance |
|---|---|---|---|---|
| Backoffice | `senior.backend` | `Password123` | `ADMIN` | Puede operar **cualquier** wallet |
| Cliente demo | `juan.perez` | `Cliente123` | `CUSTOMER` | Solo puede operar wallets con `ownerName = "Juan Perez"` (`wal_001`) |

```
POST /api/auth/login
{ "username": "senior.backend", "password": "Password123" }
```

Devuelve `{ "token": "...", "expiresIn": 3600 }`. Usar el token como `Authorization: Bearer <token>`
en el resto de endpoints (todos protegidos salvo `/auth/login`, `/health`, `/health/ready` y `/docs`).

Si se usa el token de `juan.perez` (rol `CUSTOMER`) contra un wallet que no le pertenece
(por ejemplo `wal_002`), la API responde `403 Forbidden` (ver `WalletAccessService`).

## Endpoints principales

| Método | Ruta | Identificador | Descripción |
|---|---|---|---|
| POST | `/api/auth/login` | body | Login simulado, emite JWT |
| GET | `/api/wallets/list` | — | Wallets accesibles (todas para ADMIN, solo propias para CUSTOMER) |
| GET | `/api/wallets/balance?walletId=` | query param | Saldo disponible |
| GET | `/api/wallets/movements?walletId=&type=&status=&page=&pageSize=` | query param | Movimientos paginados |
| POST | `/api/transactions` | body (`walletId`) | Débito o crédito atómico (`Idempotency-Key` obligatorio) |
| POST | `/api/transactions/transfer` | body (`sourceWalletId`/`targetWalletId`) | Transferencia entre wallets (`Idempotency-Key` obligatorio) |
| POST | `/api/transactions/reversal` | body (`transactionId`) | Reversa única de una transacción (`Idempotency-Key` obligatorio) |
| GET | `/api/transactions/status?transactionId=` | query param | Estado de una transacción |
| GET | `/health` | — | Liveness |
| GET | `/health/ready` | — | Readiness (verifica conexión a PostgreSQL) |

Convención de la API: toda ruta `GET` recibe el identificador del recurso como **query param**; toda ruta
`POST`/`PUT`/`PATCH`/`DELETE` lo recibe en el **body**. No hay path params ni rutas `PUT`/`PATCH`/`DELETE`
— el ledger de transacciones es inmutable, ver `04. Entregables/architecture.md` §6.

Contrato completo, ejemplos y códigos de error: ver Swagger en `/docs` y la colección Postman en
[`../04. Entregables/postman/Ligo-Wallet-Service.postman_collection.json`](<../04. Entregables/postman/Ligo-Wallet-Service.postman_collection.json>).

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

Detalle de arquitectura y decisiones de diseño: [`../04. Entregables/architecture.md`](<../04. Entregables/architecture.md>).

## Testing

```bash
npm test                 # unitarios (reglas de negocio, idempotencia, auth, money util)
npm run test:cov         # unitarios con cobertura

docker compose -f docker-compose.test.yml up -d   # PostgreSQL 17 efímero para integración (puerto 5435)
npm run test:e2e                                   # integración contra PostgreSQL real
docker compose -f docker-compose.test.yml down     # limpieza
```

**91 tests automatizados en verde** (46 unitarios + 45 e2e, verificado en este entorno contra PostgreSQL 17
real). Los tests de integración cubren, contra una base de datos real: login, balance, movimientos paginados,
débito/crédito exitoso, fondos insuficientes, wallet bloqueada/inexistente, moneda distinta, transferencia
(éxito y bordes), reversa (débito y transferencia), doble reversa, reversa de una reversa, idempotencia
(replay exacto y conflicto 409), auditoría (`audit_logs` recibe una entrada por cada operación crítica), y
seguridad (401/403 por rol). Los tests unitarios cubren la lógica de negocio de `TransactionsService` de
forma aislada (sin base de datos), `IdempotencyService`, `AuthService` y la utilidad `Money`.

La tabla completa que mapea **cada regla de negocio crítica del challenge** con su test unitario, su test e2e
y su request de Postman correspondiente está en
[`../04. Entregables/architecture.md`](<../04. Entregables/architecture.md>), sección "Cobertura de pruebas
de las reglas de negocio críticas". La colección Postman
(`../04. Entregables/postman/Ligo-Wallet-Service.postman_collection.json`) incluye scripts `pm.test`
ejecutables (Collection Runner) en las carpetas **"Reglas de negocio - Wallet"** y **"Reglas de negocio -
Transacciones"**, uno por cada regla del checklist, no solo requests para inspección manual.

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

Ver [`../04. Entregables/declaracion-ia.md`](<../04. Entregables/declaracion-ia.md>).
