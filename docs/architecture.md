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
- **Autorización por propiedad de wallet** (`WalletAccessService`): el JWT lleva `role` (`ADMIN`/`CUSTOMER`) y `ownerName`. `ADMIN` (cuenta de backoffice, `senior.backend`) opera cualquier wallet; `CUSTOMER` (cuenta demo `juan.perez`, ligada al `ownerName` "Juan Perez") solo puede operar wallets cuyo `ownerName` coincide, y recibe `403 Forbidden` en caso contrario. Se aplica en balance, movimientos, débito/crédito, el lado origen de una transferencia y la reversa.
- Validación estricta de DTOs con `class-validator` (`whitelist`, `forbidNonWhitelisted`).
- Filtro de excepciones centralizado: nunca expone stack traces; solo se loguean server-side.
- `LoggingInterceptor` redacta campos sensibles (`password`, `token`, `authorization`, etc.) antes de loguear.
- `helmet` habilitado, variables sensibles solo por entorno (`.env`, nunca hardcodeadas).

### 6. Códigos de estado HTTP

| Código | Significado en este servicio |
|---|---|
| 400 | Validación de DTO o header `Idempotency-Key` faltante/ inválido |
| 401 | JWT ausente/ inválido/expirado, o credenciales de login inválidas |
| 403 | El wallet solicitado no pertenece al usuario autenticado (rol `CUSTOMER`, ver `WalletAccessService`) |
| 404 | Wallet o transacción no encontrada |
| 409 | Conflicto de `Idempotency-Key`, o intento de reversar una transacción ya reversada |
| 422 | Regla de negocio violada (wallet inactiva, fondos insuficientes, monedas distintas, transacción no reversable) |
| 500 | Error inesperado (nunca expone detalles internos) |

### 7. Por qué NestJS + TypeORM

NestJS aporta una arquitectura modular por capas (Controller → Service → Repository) con inyección de dependencias, guards, pipes e interceptors nativos, ideal para aplicar Clean Code y separar responsabilidades. TypeORM permite migraciones versionadas explícitas (requisito del challenge) y control fino sobre transacciones (`QueryRunner`) necesario para el bloqueo pesimista de filas.

### 8. Despliegue en 3 capas independientes

El repositorio está organizado en `01. frontend`, `02. backend` y `03. database`, cada una con su propio
`build.bat` y `deploy.bat`, sin depender de un único `docker-compose` orquestador. Un `build.bat`/
`deploy.bat` en la raíz del repositorio actúa como dispatcher unificado
(`deploy.bat database|backend|frontend|all`), delegando en el script de la carpeta correspondiente.

Separación estricta de responsabilidades entre ambos scripts, en las tres capas:

- **`build.bat`** compila **dentro de Docker** (build multi-stage del `Dockerfile` de cada capa: etapa
  `builder` con `npm ci` + compilación) y produce la imagen local lista para desplegar. No depende del
  Node/npm del host, garantizando que la compilación siempre ocurre en el mismo entorno que correrá en
  producción. Las imágenes finales (`production`) **no contienen código fuente**, solo los artefactos
  compilados (`dist/` en el backend, estáticos en el frontend).
- **`deploy.bat`** **solo despliega**: crea la red, el contenedor y lo publica, pero nunca reconstruye a
  partir del código fuente. Si la imagen todavía no existe la construye una única vez delegando en
  `build.bat`.

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

### 9. Zona horaria y sincronización horaria (America/Lima)

Tanto la base de datos como el backend fijan explícitamente su zona horaria en **America/Lima (UTC-5)**,
para que `now()`, `CURRENT_DATE`, los timestamps de auditoría y los logs reflejen la hora real de Perú en
lugar de UTC o la hora del host:

- **`03. database`**: la imagen fija `TZ=America/Lima` a nivel de sistema operativo, y
  `03. database/deploy.bat` arranca PostgreSQL con `-c timezone=America/Lima -c log_timezone=America/Lima`,
  por lo que el GUC `timezone` del servidor (no solo del cliente) queda fijado independientemente de quién
  se conecte.
- **`02. backend`**: la imagen instala `tzdata` (Alpine no la trae por defecto) y fija `TZ=America/Lima`
  tanto en build como en runtime (`deploy.bat` inyecta `-e TZ=America/Lima`), de modo que `Date`, los logs
  de Nest y cualquier formateo de fecha en Node usan la hora de Lima.

**Sincronización horaria activa (NTP):** los contenedores Docker comparten el reloj del kernel del
host/VM, por lo que no tienen un reloj de hardware propio; para blindar a la base de datos contra un
eventual *drift* del reloj (por ejemplo tras suspender/reanudar la máquina o la VM de Docker Desktop), la
imagen `03. database` instala **chrony** y lo arranca desde
`03. database/docker-entrypoint-wrapper.sh` (que envuelve al entrypoint oficial de PostgreSQL):

1. Hace un ajuste inmediato del reloj (`chronyd -q`) contra servidores NTP públicos antes de iniciar
   PostgreSQL.
2. Deja `chronyd` corriendo en segundo plano durante toda la vida del contenedor para mantenerlo
   sincronizado ("siempre al día").
3. Requiere el flag `--cap-add=SYS_TIME` en `docker run` (ya incluido en `deploy.bat`); si el host no lo
   otorga, ambos pasos se degradan de forma segura (solo advierten) sin impedir el arranque de la base de
   datos.

Verificación rápida ya validada en este entorno: `docker exec ligo-wallet-postgres chronyc tracking` /
`chronyc sources` muestran sincronización activa contra `pool.ntp.org`, y `SHOW timezone;` /
`SELECT now();` devuelven `America/Lima` con el offset `-05` correcto.
