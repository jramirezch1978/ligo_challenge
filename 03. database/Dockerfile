# Imagen propia de PostgreSQL 17 con el esquema y el seed ya incluidos en la
# imagen (en vez de montarlos por bind-mount en tiempo de despliegue). Esto
# permite versionar y distribuir la base de datos como una imagen Docker local
# autocontenida, igual que el backend y el frontend.
FROM postgres:17

# ---------------------------------------------------------------------------
# Zona horaria fija: America/Lima (UTC-5)
# ---------------------------------------------------------------------------
# Ajusta la hora del sistema operativo del contenedor (logs, comandos,
# chrony). El GUC "timezone" de PostgreSQL en si se fija en tiempo de
# ejecucion via "-c timezone=America/Lima" (ver 03. database/deploy.bat), para
# que quede versionado junto al resto de flags del "docker run" y no dependa
# de un postgresql.conf adicional.
ENV TZ=America/Lima
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo "$TZ" > /etc/timezone

# ---------------------------------------------------------------------------
# Sincronizacion horaria activa (chrony)
# ---------------------------------------------------------------------------
# chrony mantiene el reloj del contenedor sincronizado contra servidores NTP
# publicos mientras PostgreSQL esta corriendo, evitando que la base de datos
# "se atrase" por drift del reloj del host/VM de Docker. Se arranca desde
# docker-entrypoint-wrapper.sh. Requiere el flag "--cap-add=SYS_TIME" en
# "docker run" (ya incluido en deploy.bat); si el host no lo permite, el
# arranque de PostgreSQL continua igualmente (degradacion sin corte de servicio).
RUN apt-get update \
    && apt-get install -y --no-install-recommends chrony \
    && rm -rf /var/lib/apt/lists/*

COPY init/ /docker-entrypoint-initdb.d/
COPY docker-entrypoint-wrapper.sh /usr/local/bin/docker-entrypoint-wrapper.sh
RUN chmod +x /usr/local/bin/docker-entrypoint-wrapper.sh

ENTRYPOINT ["docker-entrypoint-wrapper.sh"]
