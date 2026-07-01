# Arquitectura — Wallet Transaction Service

## Vista general

```mermaid
flowchart TB
    Client["Cliente / Postman / Swagger UI"]

    subgraph API["Wallet Transaction Service (NestJS)"]
        direction TB
        Guard["JwtAuthGuard (global)"]
        Filter["GlobalExceptionFilter"]
        subgraph Modules["Módulos de dominio"]
            Auth["AuthModule\n(login simulado + JWT)"]
            Wallets["WalletsModule\n(saldo, movimientos)"]
            Transactions["TransactionsModule\n(débito/crédito, transferencia, reversa)"]
            Idempotency["IdempotencyModule\n(Idempotency-Key)"]
            Audit["AuditModule\n(auditoría técnica)"]
            Health["HealthModule\n(liveness/readiness)"]
        end
    end

    DB[("PostgreSQL\nwallets / transactions / movements\nidempotency_keys / audit_logs")]

    Client -->|HTTPS + Bearer JWT| Guard
    Guard --> Modules
    Modules --> Filter
    Transactions --> Idempotency
    Transactions --> Audit
    Wallets --> DB
    Transactions --> DB
    Idempotency --> DB
    Audit --> DB
    Health --> DB
```

## Decisiones clave

### 1. Modelo de datos (double-entry ledger)

- **`wallets`**: saldo disponible (`numeric(18,2)`), moneda y estado (`ACTIVE`/`BLOCKED`/`CLOSED`).
- **`transactions`**: representa la *operación* de negocio (DEBIT, CREDIT, TRANSFER, REVERSAL) con su estado (`PENDING`/`COMPLETED`/`FAILED`/`REVERSED`).
- **`movements`**: el *asiento contable* (ledger entry). Un débito/crédito simple genera 1 movimiento; una transferencia genera 2 (débito en origen, crédito en destino) enlazados por `transactionId`, implementando doble partida contable real.
- **`idempotency_keys`**: una fila por `(idempotencyKey, endpoint)`, con el hash del payload y la respuesta cacheada.
- **`audit_logs`**: rastro técnico mínimo de toda operación crítica (quién, qué, cuándo, metadata).

Los montos **nunca** se representan como `float`: se almacenan como `numeric(18,2)` en PostgreSQL y se transportan como `string` en la API. Toda aritmética usa `decimal.js` (ver `src/common/utils/money.util.ts`) para evitar errores de redondeo IEEE-754.

### 2. Atomicidad y consistencia

Cada operación crítica (`POST /transactions`, `POST /transactions/transfer`, `POST /transactions/:id/reversal`) se ejecuta dentro de **una única transacción de base de datos** (`QueryRunner` con `START TRANSACTION`). Si cualquier paso falla, se hace `ROLLBACK` completo: ni el saldo, ni el movimiento, ni el registro de idempotencia ni la auditoría quedan escritos parcialmente.

**Concurrencia**: antes de leer/mutar un saldo se bloquea la fila del wallet con `SELECT ... FOR UPDATE` (`pessimistic_write`). En transferencias, ambos wallets se bloquean en un **orden determinístico** (por `id` ascendente) para evitar *deadlocks* entre transferencias cruzadas concurrentes.

### 3. Idempotencia

El header `Idempotency-Key` es obligatorio en toda operación crítica. `IdempotencyService.run(...)` inserta un registro `(idempotencyKey, endpoint)` **dentro de la misma transacción** que la lógica de negocio:

- Si la clave no existe → se procesa la operación y se persiste la respuesta junto con el efecto de negocio, de forma atómica.
- Si la clave ya existe con el **mismo** hash de payload → se devuelve la respuesta cacheada sin reprocesar (idempotencia real).
- Si la clave ya existe con **distinto** payload → `409 Conflict`.
- Si la clave está `PROCESSING` (petición concurrente en curso) → `409 Conflict`.
- Si la operación de negocio falla, el `ROLLBACK` también revierte el registro de idempotencia, dejando la clave libre para un reintento legítimo.

### 4. Reversas

Una reversa **no** modifica la transacción original in-place; crea una **nueva transacción** de tipo `REVERSAL` con los movimientos inversos, y marca la original como `REVERSED` mediante `reversedByTransactionId`. Esto preserva el historial completo (auditable) y garantiza que una transacción reversada no pueda reversarse nuevamente (`409 Conflict`) ni que una reversa pueda volver a reversarse (`422`).

### 5. Seguridad

- Login simulado que firma un JWT real (HS256) sobre credenciales mock validadas con comparación de tiempo constante (`crypto.timingSafeEqual`).
- `JwtAuthGuard` global; rutas públicas explícitas vía `@Public()` (login, health checks, Swagger).
- Validación estricta de DTOs con `class-validator` (`whitelist`, `forbidNonWhitelisted`).
- Filtro de excepciones centralizado: nunca expone stack traces; solo se loguean server-side.
- `LoggingInterceptor` redacta campos sensibles (`password`, `token`, `authorization`, etc.) antes de loguear.
- `helmet` habilitado, variables sensibles solo por entorno (`.env`, nunca hardcodeadas).

### 6. Códigos de estado HTTP

| Código | Significado en este servicio |
|---|---|
| 400 | Validación de DTO o header `Idempotency-Key` faltante/ inválido |
| 401 | JWT ausente/ inválido/expirado, o credenciales de login inválidas |
| 403 | Reservado para autorización por rol/alcance (extensible vía guards) |
| 404 | Wallet o transacción no encontrada |
| 409 | Conflicto de `Idempotency-Key`, o intento de reversar una transacción ya reversada |
| 422 | Regla de negocio violada (wallet inactiva, fondos insuficientes, monedas distintas, transacción no reversable) |
| 500 | Error inesperado (nunca expone detalles internos) |

### 7. Por qué NestJS + TypeORM

NestJS aporta una arquitectura modular por capas (Controller → Service → Repository) con inyección de dependencias, guards, pipes e interceptors nativos, ideal para aplicar Clean Code y separar responsabilidades. TypeORM permite migraciones versionadas explícitas (requisito del challenge) y control fino sobre transacciones (`QueryRunner`) necesario para el bloqueo pesimista de filas.

### 8. Despliegue en 3 capas independientes

El repositorio está organizado en `01. frontend`, `02. backend` y `03. database`, cada una con su propio
`build.bat` (compilar / construir la imagen local) y `deploy.bat` (desplegar en Docker local), sin
depender de un único `docker-compose` orquestador. Un `build.bat`/`deploy.bat` en la raíz del repositorio
actúa como dispatcher unificado (`deploy.bat database|backend|frontend|all`), delegando en el script de
la carpeta correspondiente:

```mermaid
flowchart LR
    FE["01. frontend\n(React + Vite, servido por nginx)"] -- "proxy /api, /health" --> BE["02. backend\n(NestJS API)"]
    BE -- "TCP 5432" --> DB[("03. database\nPostgreSQL 17")]
    subgraph net["red Docker compartida: ligo-network"]
        FE
        BE
        DB
    end
```

- **`03. database`** es la fuente de verdad del esquema: una imagen Docker propia
  (`ligo-wallet-postgres:17`, ver `03. database/Dockerfile`) que extiende `postgres:17` horneando los
  scripts `init/001_schema.sql` y `init/002_seed.sql` dentro de `docker-entrypoint-initdb.d` en tiempo de
  build (no por bind-mount en tiempo de despliegue), igual que el backend y el frontend construyen su
  propia imagen local. Esos scripts también pre-insertan las migraciones de TypeORM en la tabla
  `migrations`, de modo que si el backend llega a ejecutar sus propias migraciones contra esa misma base
  de datos (por ejemplo en un entorno donde se despliega solo el backend contra un Postgres vacío) no
  intenta recrear tablas ya existentes: ambos caminos (SQL directo o TypeORM) son compatibles y no
  colisionan. `deploy.bat database` es **idempotente**: en cada ejecución elimina el contenedor y el
  volumen de datos previos y levanta uno nuevo desde la imagen, garantizando siempre el mismo estado
  inicial (esquema + seed).
- **`02. backend`** espera activamente (TCP polling) a que PostgreSQL esté disponible antes de aplicar
  migraciones y arrancar, para tolerar que las capas se desplieguen en cualquier orden.
- **`01. frontend`** se sirve como estáticos vía nginx, que además actúa de reverse proxy de `/api/*` y
  `/health` hacia el contenedor del backend (por nombre, en la red compartida), evitando problemas de CORS
  en el navegador.
- Las tres capas se conectan mediante una red Docker (`ligo-network`) creada automáticamente por los
  propios scripts `deploy.bat` si no existe, simulando el patrón de despliegue independiente por
  microservicio (cada capa con su propio ciclo de compilación/despliegue) sin acoplar sus pipelines.
