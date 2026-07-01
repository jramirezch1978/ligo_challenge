# Ligo — Wallet Transaction Service

Solución al *Backend Senior NodeJS/TypeScript - Ligo Challenge*: un microservicio de billetera digital
regulada (débitos, créditos, transferencias, reversas, idempotencia, atomicidad y auditoría), acompañado
de un frontend de demostración y de los scripts de base de datos para desplegar cada capa de forma
independiente en Docker local.

## Estructura del repositorio

```
01. frontend/    React + TypeScript + Vite — SPA que consume la API (login, saldo, movimientos, operaciones)
02. backend/     Node.js 20 + TypeScript + NestJS + TypeORM — el microservicio del challenge
03. database/    Imagen Docker propia de PostgreSQL 17 — esquema + datos semilla horneados, independiente del backend
docs/            Arquitectura y declaración de uso de IA
postman/         Colección Postman de la API
build.bat        Dispatcher unificado: build.bat [database|backend|frontend|all]
deploy.bat       Dispatcher unificado: deploy.bat [database|backend|frontend|all]
```

Cada capa es autocontenida: tiene su propio código fuente, `Dockerfile` y sus propios `build.bat`
(compilar / construir la imagen local) y `deploy.bat` (desplegar en Docker local). El detalle de cada
una está en su propio README:

- [`01. frontend/README.md`](<01. frontend/README.md>)
- [`02. backend/README.md`](<02. backend/README.md>)
- [`03. database/`](<03. database>) (ver más abajo)

## Despliegue local (comando unificado)

Requisito: Docker Desktop corriendo. En la raíz del repositorio hay un `build.bat` y un `deploy.bat`
únicos que reciben la capa como parámetro (`database`, `backend`, `frontend` o `all`) y delegan en el
script correspondiente de cada carpeta:

```bat
rem 1) Base de datos (PostgreSQL 17): build crea la imagen local con el
rem    esquema + seed horneados; deploy es IDEMPOTENTE, siempre elimina el
rem    contenedor y el volumen previos y reconstruye todo desde cero.
build.bat database
deploy.bat database

rem 2) Backend (API NestJS): build compila, deploy construye la imagen y
rem    despliega el contenedor (requiere la base de datos ya desplegada).
build.bat backend
deploy.bat backend

rem 3) Frontend (SPA servida por nginx): build compila, deploy construye la
rem    imagen y despliega el contenedor (requiere el backend ya desplegado).
build.bat frontend
deploy.bat frontend

rem Alternativa: las 3 capas de una sola vez, en el orden correcto
build.bat all
deploy.bat all
```

Todas las capas construyen su propia imagen Docker local (`ligo-wallet-postgres:17`,
`ligo-wallet-backend:latest`, `ligo-wallet-frontend:latest`) y se conectan entre sí mediante una red
Docker compartida llamada `ligo-network`, que los propios scripts crean si no existe.

> `deploy.bat database` es idempotente por diseño: cada vez que se ejecuta, elimina el contenedor y el
> volumen de datos existentes y levanta uno nuevo desde la imagen local, con el esquema y los datos
> semilla recién cargados. Es la forma de "resetear" la base de datos a su estado inicial en cualquier
> momento.

Cada `build.bat`/`deploy.bat` también puede ejecutarse directamente dentro de su propia carpeta
(`cd "02. backend" && build.bat`), sin pasar por el dispatcher de la raíz.

Al finalizar:

| Capa | URL |
|---|---|
| Frontend | http://localhost:8080 |
| Backend API | http://localhost:3000/api |
| Backend Swagger | http://localhost:3000/docs |
| Backend health | http://localhost:3000/health |
| PostgreSQL | localhost:5434 (`wallet_service` / usuario `ligo`) |

Credenciales de demo (login): `senior.backend` / `Password123`.

> `build.bat` compila cada proyecto (instala dependencias y genera el artefacto: `dist/` en backend y
> frontend). `deploy.bat` construye la imagen Docker correspondiente y levanta el contenedor en la red
> `ligo-network`. Se pueden ejecutar de forma independiente y en cualquier orden salvo por las
> dependencias de red en tiempo de ejecución (el backend espera activamente a PostgreSQL antes de
> arrancar; el frontend hace de reverse proxy hacia el backend).

## 03. database

Contiene los scripts SQL para recrear el esquema completo (`wallets`, `transactions`, `movements`,
`idempotency_keys`, `audit_logs`) y los datos semilla, horneados dentro de una imagen Docker propia
(`ligo-wallet-postgres:17`, ver `Dockerfile`) que extiende la imagen oficial `postgres:17` copiando los
scripts a `docker-entrypoint-initdb.d`:

```
03. database/
  Dockerfile         FROM postgres:17 + COPY init/ -> /docker-entrypoint-initdb.d/
  init/
    001_schema.sql   Tipos, tablas, índices y foreign keys
    002_seed.sql     Wallets de demo (wal_001..wal_004)
  build.bat          Construye la imagen local ligo-wallet-postgres:17
  deploy.bat         IDEMPOTENTE: siempre elimina el contenedor y el volumen previos y
                     levanta uno nuevo desde la imagen, con el esquema y el seed recien cargados
```

El esquema es equivalente al generado por las migraciones de TypeORM del backend; el script además
pre-marca esas migraciones como aplicadas, de modo que ambos mecanismos (SQL directo o `npm run
migration:run` del backend) son compatibles entre sí sin duplicar ni chocar la creación de tablas.

## Reglas de negocio implementadas (resumen)

- Solo wallets `ACTIVE` pueden operar; no se permite saldo negativo ni operar entre monedas distintas.
- Montos siempre como `string` decimal (`decimal.js` + `numeric(18,2)`), nunca `float`.
- Operaciones críticas (débito, crédito, transferencia, reversa) atómicas, con bloqueo pesimista de filas
  y orden determinístico de bloqueo en transferencias (evita deadlocks).
- `Idempotency-Key` obligatorio en operaciones críticas (mismo key + mismo payload ⇒ misma respuesta sin
  reprocesar; mismo key + payload distinto ⇒ `409`; concurrencia con el mismo key ⇒ `409`).
- Una transacción reversada no puede reversarse de nuevo; una reversa no puede reversarse.
- Toda operación crítica queda registrada en `audit_logs`.

Detalle completo de arquitectura y decisiones de diseño: [`docs/architecture.md`](docs/architecture.md).

## Testing (backend)

```bash
cd "02. backend"
npm test                                           # unitarios
docker compose -f docker-compose.test.yml up -d    # PostgreSQL 17 efímero para integración
npm run test:e2e                                   # integración contra PostgreSQL real
docker compose -f docker-compose.test.yml down     # limpieza
```

## Declaración de uso de IA

Ver [`docs/ai-usage.md`](docs/ai-usage.md).
