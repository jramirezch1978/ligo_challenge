# Declaración de uso de IA

## Uso de IA

- **Herramienta utilizada**: Cursor (agente de codificación, modelos Claude/Sonnet y Composer).

- **¿Para qué la usé?**
  Para acelerar el andamiaje (scaffolding) de un proyecto NestJS + TypeScript + TypeORM + PostgreSQL desde cero: estructura de módulos, entidades, migraciones SQL, DTOs con `class-validator`, guards de JWT, filtro global de excepciones, servicio de idempotencia, lógica transaccional (débito/crédito/transferencia/reversa), Dockerfile/docker-compose, frontend de demostración (React + TypeScript + Vite), y la batería de tests unitarios e de integración.

- **¿Qué código acepté?**
  La mayor parte del código generado, tras revisarlo contra los requisitos explícitos del challenge (contrato de API, reglas de negocio, checklist funcional/técnico/seguridad). En particular acepté:
  - El diseño de modelo de datos con *ledger* de doble entrada (`transactions` + `movements`), que no estaba explícito en el PDF pero es la forma correcta de modelar transferencias y reversas de forma auditable.
  - La estrategia de idempotencia basada en insertar el registro de `Idempotency-Key` **dentro de la misma transacción de negocio**, para que un `ROLLBACK` libere la clave automáticamente ante fallos.
  - El uso de bloqueo pesimista (`SELECT ... FOR UPDATE`) con orden determinístico de bloqueo en transferencias, para evitar *deadlocks* entre transferencias cruzadas concurrentes.
  - La reorganización del repositorio en capas (`01. frontend`, `02. backend`, `03. database`, `04. Entregables`) con scripts `build.bat`/`deploy.bat` por capa.
  - El selector de wallet por rol en el frontend (dropdown para ADMIN, campo de solo lectura para CUSTOMER) y el endpoint `GET /api/wallets/list`.

- **¿Qué código descarté o ajusté manualmente?**
  - Se descartó un enfoque inicial de usar un interceptor HTTP genérico para idempotencia (fuera de la transacción de base de datos), porque no garantizaba atomicidad real entre el registro de la clave y el efecto de negocio.
  - Se eliminó una columna `@VersionColumn` (optimistic locking) que quedaba inconsistente con el uso de `QueryBuilder.update()` directo; se documentó que el control de concurrencia real es el bloqueo pesimista de filas.
  - Se ajustó la comparación de credenciales del login simulado para usar `crypto.timingSafeEqual` con buffers de longitud fija (la primera versión generada tenía una comparación de padding circular defectuosa).
  - Se refactorizaron los endpoints para usar query params en lecturas (`GET`) y body params en escrituras (`POST`), eliminando path params, según convención acordada con el evaluador.
  - Se descartó depender de un contexto Docker remoto (`cronos`) para pruebas locales; el despliegue debe hacerse contra Docker Desktop (`desktop-linux`) para que `localhost` responda.

- **¿Qué validé manualmente?**
  - Que cada regla de negocio del PDF (wallet activa, sin saldo negativo, mismas monedas, idempotencia exacta/conflicto, reversa única) tuviera una excepción de dominio explícita y un test (unitario o de integración) que la cubriera.
  - Que las migraciones SQL crearan correctamente los tipos `ENUM`, índices y llaves foráneas antes de ejecutarlas contra PostgreSQL real vía Docker Compose.
  - Que el flujo completo (`deploy.bat all` o `docker compose up` → seed → login → operaciones) funcionara de punta a punta contra contenedores reales.
  - Los códigos de estado HTTP devueltos en cada camino de error, contrastándolos con la tabla de códigos exigida (400/401/403/404/409/422/500).
  - Que el frontend fuera responsive (PC, tablet, móvil) y que el OpenAPI exportado (`openapi.json`) coincidiera con los endpoints desplegados (`/docs-json`).
  - Que el backend compilara (`npm run build`), los tests unitarios pasaran (46/46) y el TypeScript del frontend no tuviera errores (`tsc --noEmit`).

- **¿Qué riesgos identifiqué?**
  - **Sobre-confianza en código generado sin ejecutar**: mitigado ejecutando `npm run build`, la suite de tests unitarios y de integración contra una base de datos PostgreSQL real en Docker antes de dar el trabajo por terminado.
  - **Idempotencia mal diseñada** (el riesgo más crítico en un servicio financiero): mitigado colocando el registro de la clave dentro de la misma transacción atómica que el efecto de negocio, y cubriéndolo con tests que verifican tanto el *replay* exacto como el conflicto por payload distinto y la ejecución concurrente.
  - **Precisión numérica**: mitigado prohibiendo `float` en todo el dominio (uso exclusivo de `string` + `decimal.js` + columnas `numeric` en PostgreSQL).
  - **Exposición de información sensible en logs/errores**: mitigado con un filtro global que nunca expone stack traces al cliente y un interceptor de logging que redacta campos sensibles.
  - **Contexto Docker incorrecto**: mitigado documentando que los scripts `.bat` usan el contexto activo del CLI; para acceso local debe estar seleccionado `desktop-linux`.

> El uso de IA no resta puntos. Lo que se evalúa es criterio, revisión, validación y capacidad de explicar decisiones.
