#!/bin/sh
# Crea (o recrea desde cero) la base smo_pruebas con la estructura oficial, para las pruebas de
# integración. Se ejecuta sola la primera vez que se crea el contenedor (docker-entrypoint-initdb.d)
# y a mano con:  pnpm db:pruebas
set -eu

# Carpeta con 01-estructura.sql y 02-ampliacion-modelo.sql (pnpm db:pruebas la copia a /tmp/smo-bd).
BD_DIR="${BD_DIR:-/docker-entrypoint-initdb.d}"

raiz() { mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" "$@"; }

raiz -e "DROP DATABASE IF EXISTS smo_pruebas;
         CREATE DATABASE smo_pruebas CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci;
         GRANT ALL PRIVILEGES ON smo_pruebas.* TO '${MARIADB_USER:-smo}'@'%';"

for script in "$BD_DIR/01-estructura.sql" "$BD_DIR/02-ampliacion-modelo.sql"; do
  raiz smo_pruebas < "$script"
done
echo "Base smo_pruebas lista."
