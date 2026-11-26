#!/bin/sh
# Crea (o recrea desde cero) la base smo_pruebas con la estructura oficial, para las pruebas de
# integración. Se ejecuta sola la primera vez que se crea el contenedor (docker-entrypoint-initdb.d)
# y a mano con:  pnpm db:pruebas
set -eu

# Carpeta con los scripts bd/NN-*.sql (pnpm db:pruebas la copia a /tmp/smo-bd). Se cargan en orden.
BD_DIR="${BD_DIR:-/docker-entrypoint-initdb.d}"

raiz() { mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" "$@"; }

raiz -e "DROP DATABASE IF EXISTS smo_pruebas;
         CREATE DATABASE smo_pruebas CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci;
         GRANT ALL PRIVILEGES ON smo_pruebas.* TO '${MARIADB_USER:-smo}'@'%';"

for script in "$BD_DIR"/[0-9][0-9]-*.sql; do
  raiz smo_pruebas < "$script"
done
echo "Base smo_pruebas lista."
