# Wallet Transaction Service — Frontend

Cliente web (React 18 + TypeScript + Vite) para consumir la API del `02. backend`: login, consulta de
saldo, movimientos paginados con filtros, y formularios para débito/crédito, transferencia, reversa y
consulta de estado de una transacción.

> Esta es la capa **01. frontend** del repositorio. Ver el [README raíz](../README.md) para la visión
> general de las 3 capas y el orden de despliegue.

## Stack técnico

- **React 18** + **TypeScript** (strict)
- **Vite 5** (dev server + build)
- CSS propio (sin dependencias de UI), **totalmente responsive** (mobile-first, breakpoints en 420px /
  480px / 640px / 900px): tablas con scroll horizontal, tabs deslizables, formularios en 1 o 2 columnas
  según ancho, botones con área táctil mínima de 44px en pantallas táctiles, header y toasts adaptados
  a móvil
- **nginx** (imagen de producción) como servidor de estáticos y reverse proxy hacia el backend

## Compilar y desplegar

```bat
cd "01. frontend"
build.bat     rem compila DENTRO de Docker (multi-stage) -> imagen ligo-wallet-frontend:latest
deploy.bat    rem SOLO despliega esa imagen (no recompila ni toca el codigo fuente)
```

`build.bat` compila usando el `Dockerfile` (etapa `builder`: `npm ci` + `tsc -b` + `vite build`), sin
depender del Node/npm instalados en el host, y produce la imagen final de producción (nginx) que **no
contiene código fuente** (solo los estáticos compilados). `deploy.bat` requiere que el contenedor del
backend (`ligo-wallet-backend`) ya esté corriendo (ver [`../02. backend`](../02.%20backend)) y conecta el
contenedor del frontend a la misma red Docker (`ligo-network`). nginx hace de reverse proxy de `/api/*` y
`/health` hacia `ligo-wallet-backend:3000`, por lo que el navegador solo ve rutas relativas (sin
problemas de CORS). Publica la SPA en `http://localhost:8090`.

## Desarrollo local (sin Docker)

```bash
npm install
npm run dev        # http://localhost:5173, con proxy a http://localhost:3000 para /api y /health
```

Requiere que el backend esté corriendo en `localhost:3000` (ver `02. backend`).

## Credenciales de demo

```
usuario:     senior.backend
contraseña:  Password123
```

## Estructura del proyecto

```
src/
  api/          Cliente HTTP (fetch) + tipos de la API
  context/      AuthContext (sesión/JWT) y ToastContext (notificaciones)
  components/   LoginPage, DashboardPage, BalanceCard, MovementsTable,
                OperationsPanel (Débito/Crédito, Transferencia, Reversa, Consultar estado)
build.bat        Instala dependencias y compila (dist/)
deploy.bat       Construye la imagen Docker (nginx) y levanta el contenedor
nginx.conf       Configuración de reverse proxy usada en producción
```
