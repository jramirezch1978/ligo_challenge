# 04. Entregables

Esta carpeta reúne, en un solo lugar, los entregables exigidos por el *Backend Senior NodeJS/TypeScript -
Ligo Challenge* que no son código de una capa específica (frontend/backend/database), para que sean
fáciles de ubicar durante la revisión.

> **Requisito:** Docker instalado y corriendo en la máquina local. Tanto los scripts `build.bat`/`deploy.bat`
> de la raíz como este `docker compose` dependen del daemon de Docker local para crear contenedores y
> compilar dentro de ellos. Ver [`../README.md`](../README.md#requisitos-fundamentales).

## Checklist de entregables

| # | Entregable exigido | Dónde está | Estado |
|---|---|---|---|
| 1 | Repositorio GitHub/GitLab | Este mismo repositorio (rama `master`) | ✅ |
| 2 | README con instrucciones claras | [`../README.md`](../README.md) (raíz) + README por capa ([`01. frontend`](<../01. frontend/README.md>), [`02. backend`](<../02. backend/README.md>)) | ✅ |
| 3 | Docker Compose para app + PostgreSQL | [`docker-compose.yml`](docker-compose.yml) (este mismo directorio) | ✅ |
| 4 | Migraciones o script de inicialización | Migraciones TypeORM: [`../02. backend/src/database/migrations`](<../02. backend/src/database/migrations>) · Scripts SQL: [`../03. database/init`](<../03. database/init>) | ✅ |
| 5 | Swagger / OpenAPI | Spec exportado: [`openapi.json`](openapi.json) · UI en vivo: `http://localhost:3000/docs` (`SwaggerModule` en `02. backend/src/main.ts`) | ✅ |
| 6 | Tests unitarios e integración | Unitarios: `*.spec.ts` en [`../02. backend/src`](../02. backend/src) · Integración: [`../02. backend/test/integration`](../02. backend/test/integration) | ✅ |
| 7 | Diagrama simple de arquitectura | [`architecture.md`](architecture.md) | ✅ |
| 8 | Colección Postman | [`postman/Ligo-Wallet-Service.postman_collection.json`](postman/Ligo-Wallet-Service.postman_collection.json) | ✅ |
| 9 | Declaración de uso de IA | [`declaracion-ia.md`](declaracion-ia.md) | ✅ |

## Contenido de esta carpeta

```
04. Entregables/
  README.md               Este archivo (checklist de entregables)
  docker-compose.yml       App + PostgreSQL + backend + frontend en un solo comando
  openapi.json             Especificación OpenAPI 3.0 exportada del backend (/docs-json)
  architecture.md          Diagrama de arquitectura y decisiones de diseño
  declaracion-ia.md        Declaración de uso de IA (plantilla del challenge)
  postman/
    Ligo-Wallet-Service.postman_collection.json
```

## Cómo levantar todo con un solo comando (Docker Compose)

```bash
cd "04. Entregables"
docker compose up --build -d
```

Esto construye y levanta, en la red Docker `ligo-network`:

| Servicio | URL | Descripción |
|---|---|---|
| `postgres` | `localhost:5434` | PostgreSQL 17, base `wallet_service`, usuario `ligo` |
| `backend` | `http://localhost:3000/api` | API REST (Swagger en `/docs`, health en `/health` y `/health/ready`) |
| `frontend` | `http://localhost:8090` | SPA de demostración (reverse proxy hacia el backend) |

```bash
docker compose ps                 # ver estado y healthchecks
docker compose logs -f backend    # logs de un servicio puntual
docker compose down               # detener (conserva los datos en el volumen)
docker compose down -v            # detener y reiniciar la base de datos desde cero (re-siembra)
```

> Este `docker-compose.yml` usa las mismas imágenes/`Dockerfile` que `build.bat`/`deploy.bat` de cada capa
> (`01. frontend`, `02. backend`, `03. database`), a las que llega por rutas relativas (`../01. frontend`,
> etc.). Es una alternativa multiplataforma a los `.bat`, pensada para levantarse "desde cero" en cualquier
> máquina. No se recomienda mezclar ambos mecanismos a la vez (o `.bat`, o `docker compose`) para evitar
> tener dos Postgres o dos backends corriendo en paralelo.

## Credenciales de demo (login)

| Cuenta | username | password | rol | Alcance |
|---|---|---|---|---|
| Backoffice | `senior.backend` | `Password123` | `ADMIN` | Opera cualquier wallet |
| Cliente demo | `juan.perez` | `Cliente123` | `CUSTOMER` | Solo opera `wal_001` (dueño "Juan Perez"); `403 Forbidden` sobre cualquier otro wallet |

## OpenAPI

El archivo [`openapi.json`](openapi.json) contiene la especificación OpenAPI 3.0 exportada desde el backend
en ejecución (`GET /docs-json`). Incluye todos los endpoints actuales:

- `POST /api/auth/login`
- `GET /api/wallets/list`
- `GET /api/wallets/balance`
- `GET /api/wallets/movements`
- `POST /api/transactions`
- `POST /api/transactions/transfer`
- `POST /api/transactions/reversal`
- `GET /api/transactions/status`

Para regenerarlo tras cambios en la API:

```bash
docker exec ligo-wallet-backend node -e "const http=require('http');http.get('http://127.0.0.1:3000/docs-json',res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>console.log(d));})" > openapi.json
```

(O abrir `http://localhost:3000/docs` en el navegador para la UI interactiva de Swagger.)
