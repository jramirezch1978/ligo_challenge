# ---- Build stage -----------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json nest-cli.json ./
COPY src ./src

RUN npm run build

# ---- Production stage -------------------------------------------------------
FROM node:20-alpine AS production

ENV NODE_ENV=production
WORKDIR /usr/src/app

# Zona horaria fija: America/Lima (UTC-5). Alpine no trae tzdata por defecto,
# por lo que se instala explicitamente. Esto hace que Node (Date, logs) y las
# librerias de fecha usen la hora de Peru en lugar de UTC/hora del host.
ENV TZ=America/Lima
RUN apk add --no-cache tzdata \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime \
    && echo "$TZ" > /etc/timezone

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /usr/src/app/dist ./dist
COPY docker ./docker
RUN chmod +x ./docker/entrypoint.sh && \
    addgroup -S appgroup && adduser -S appuser -G appgroup && \
    chown -R appuser:appgroup /usr/src/app

USER appuser

EXPOSE 3000

ENTRYPOINT ["./docker/entrypoint.sh"]
