# Declaración de uso de IA

- **Herramienta utilizada**: Cursor (agente de codificación, modelo Claude/Sonnet).

- **¿Para qué la usé?**
  Para acelerar el andamiaje (scaffolding) de un proyecto NestJS + TypeScript + TypeORM + PostgreSQL desde cero: estructura de módulos, entidades, migraciones SQL, DTOs con `class-validator`, guards de JWT, filtro global de excepciones, servicio de idempotencia, lógica transaccional (débito/crédito/transferencia/reversa), Dockerfile/docker-compose, y la batería de tests unitarios e de integración.

- **¿Qué código acepté?**
  La mayor parte del código generado, tras revisarlo contra los requisitos explícitos del challenge (contrato de API, reglas de negocio, checklist funcional/técnico/seguridad). En particular acepté:
  - El diseño de modelo de datos con *ledger* de doble entrada (`transactions` + `movements`), que no estaba explícito en el PDF pero es la forma correcta de modelar transferencias y reversas de forma auditable.
  - La estrategia de idempotencia basada en insertar el registro de `Idempotency-Key` **dentro de la misma transacción de negocio**, para que un `ROLLBACK` libere la clave automáticamente ante fallos.
  - El uso de bloqueo pesimista (`SELECT ... FOR UPDATE`) con orden determinístico de bloqueo en transferencias, para evitar *deadlocks* entre transferencias cruzadas concurrentes.

- **¿Qué código descarté o ajusté manualmente?**
  - Se descartó un enfoque inicial de usar un interceptor HTTP genérico para idempotencia (fuera de la transacción de base de datos), porque no garantizaba atomicidad real entre el registro de la clave y el efecto de negocio.
  - Se eliminó una columna `@VersionColumn` (optimistic locking) que quedaba inconsistente con el uso de `QueryBuilder.update()` directo; se documentó que el control de concurrencia real es el bloqueo pesimista de filas.
  - Se ajustó la comparación de credenciales del login simulado para usar `crypto.timingSafeEqual` con buffers de longitud fija (la primera versión generada tenía una comparación de padding circular defectuosa).

- **¿Qué validé manualmente?**
  - Que cada regla de negocio del PDF (wallet activa, sin saldo negativo, mismas monedas, idempotencia exacta/ conflicto, reversa única) tuviera una excepción de dominio explícita y un test (unitario o de integración) que la cubriera.
  - Que las migraciones SQL crearan correctamente los tipos `ENUM`, índices y llaves foráneas antes de ejecutarlas contra PostgreSQL real vía Docker Compose.
  - Que el flujo completo (`docker compose up` → migraciones → seed → login → operaciones) funcionara de punta a punta contra un contenedor real, no solo en teoría.
  - Los códigos de estado HTTP devueltos en cada camino de error, contrastándolos con la tabla de códigos exigida (400/401/403/404/409/422/500).

- **¿Qué riesgos identifiqué?**
  - **Sobre-confianza en código generado sin ejecutar**: mitigado ejecutando `npm run build`, la suite de tests unitarios y de integración contra una base de datos PostgreSQL real en Docker antes de dar el trabajo por terminado.
  - **Idempotencia mal diseñada** (el riesgo más crítico en un servicio financiero): mitigado colocando el registro de la clave dentro de la misma transacción atómica que el efecto de negocio, y cubriéndolo con tests que verifican tanto el *replay* exacto como el conflicto por payload distinto y la ejecución concurrente.
  - **Precisión numérica**: mitigado prohibiendo `float` en todo el dominio (uso exclusivo de `string` + `decimal.js` + columnas `numeric` en PostgreSQL).
  - **Exposición de información sensible en logs/errores**: mitigado con un filtro global que nunca expone stack traces al cliente y un interceptor de logging que redacta campos sensibles.

- **Iteración posterior — reorganización en 3 capas + frontend**:
  A petición del usuario, también usé el agente para reorganizar el repositorio en `01. frontend`,
  `02. backend` y `03. database` (cada una con `build.bat`/`deploy.bat` propios), extraer el esquema de
  TypeORM a scripts SQL planos ejecutables por un contenedor `postgres:17` oficial, y generar un frontend
  de demostración (React + TypeScript + Vite) que consume la API existente. Validé manualmente que:
  - El backend siguiera compilando (`npm run build`) tras mover todos los archivos de carpeta.
  - El frontend compilara sin errores de TypeScript (`tsc -b && vite build`).
  - Los scripts SQL extraídos fueran equivalentes a las migraciones de TypeORM ya probadas, y que
    pre-marcar esas migraciones como aplicadas evitara colisiones si el backend llega a ejecutarlas.
  - No dupliqué lógica de negocio en el frontend: es un cliente delgado sobre la API ya validada por los
    tests de integración del backend.
