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

HEALTHCHECK --interval=10s --timeout=5s --retries=10 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80 || exit 1
