#!/bin/sh
set -e

# ============================================================================
# Wrapper del entrypoint oficial de PostgreSQL que anade sincronizacion
# horaria activa (NTP via chrony) antes de arrancar la base de datos.
#
#   1. Intenta un ajuste inmediato del reloj (chronyd -q) contra servidores
#      NTP publicos, para arrancar con la hora correcta.
#   2. Deja chronyd corriendo en segundo plano durante toda la vida del
#      contenedor, para que el reloj se mantenga sincronizado ("siempre al
#      dia") mientras la base de datos esta activa.
#   3. Si el host/VM de Docker no otorga el capability SYS_TIME, ambos pasos
#      se degradan de forma segura (solo advierten) y PostgreSQL arranca
#      igual con la hora que le provea el kernel del host.
# ============================================================================

echo "Zona horaria del contenedor: ${TZ:-America/Lima}"

if command -v chronyd >/dev/null 2>&1; then
  echo "[chrony] Ajuste inicial de hora contra servidores NTP..."
  chronyd -q "server 0.pool.ntp.org iburst" "server 1.pool.ntp.org iburst" "server 2.pool.ntp.org iburst" \
    || echo "[chrony] Aviso: no se pudo hacer el ajuste inicial (sin red o sin capability SYS_TIME); se continua igual."

  echo "[chrony] Iniciando sincronizacion horaria activa en segundo plano..."
  chronyd \
    || echo "[chrony] Aviso: no se pudo iniciar chronyd en segundo plano (revisar --cap-add=SYS_TIME); se continua sin sincronizacion continua."
fi

exec docker-entrypoint.sh "$@"
