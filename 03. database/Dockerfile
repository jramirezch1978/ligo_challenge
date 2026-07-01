# Imagen propia de PostgreSQL 17 con el esquema y el seed ya incluidos en la
# imagen (en vez de montarlos por bind-mount en tiempo de despliegue). Esto
# permite versionar y distribuir la base de datos como una imagen Docker local
# autocontenida, igual que el backend y el frontend.
FROM postgres:17

COPY init/ /docker-entrypoint-initdb.d/
