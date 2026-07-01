# ---- Build stage -----------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Production stage (static files served by nginx) -----------------------
FROM nginx:1.27-alpine AS production

COPY --from=builder /usr/src/app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# Se usa 127.0.0.1 explícito (no "localhost"): nginx solo escucha en IPv4
# ("listen 80;" en nginx.conf) y "localhost" resuelve primero a "::1" (IPv6)
# dentro del contenedor, lo que hacía fallar el healthcheck con "Connection
# refused" aunque el servidor funcionara correctamente.
HEALTHCHECK --interval=10s --timeout=5s --retries=10 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:80 || exit 1
