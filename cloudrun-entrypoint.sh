#!/bin/sh
set -eu

export APP_ENV="${APP_ENV:-production}"
export USE_EMBEDDED_DB="${USE_EMBEDDED_DB:-false}"
export INITIAL_ADMIN_USERNAME="${INITIAL_ADMIN_USERNAME:-admin}"
export INITIAL_ADMIN_PASSWORD="${INITIAL_ADMIN_PASSWORD:-admin123}"
export INITIAL_ADMIN_NAME="${INITIAL_ADMIN_NAME:-系统管理员}"
export INITIAL_ADMIN_ROLE="${INITIAL_ADMIN_ROLE:-super}"

case "$(printf '%s' "$USE_EMBEDDED_DB" | tr '[:upper:]' '[:lower:]')" in
  1|true|yes|on)
    export DB_HOST="${DB_HOST:-127.0.0.1}"
    export DB_PORT="${DB_PORT:-3306}"
    export DB_USER="${DB_USER:-rural_user}"
    export DB_PASSWORD="${DB_PASSWORD:-RuralPass_2026}"
    export DB_NAME="${DB_NAME:-rural_errand}"

    mkdir -p /run/mysqld /var/lib/mysql
    chown -R mysql:mysql /run/mysqld /var/lib/mysql

    if [ ! -d /var/lib/mysql/mysql ]; then
      mariadb-install-db --user=mysql --datadir=/var/lib/mysql >/tmp/mariadb-install.log 2>&1
    fi

    mariadbd \
      --user=mysql \
      --datadir=/var/lib/mysql \
      --bind-address=127.0.0.1 \
      --port=3306 \
      --socket=/run/mysqld/mysqld.sock \
      --pid-file=/run/mysqld/mysqld.pid \
      >/tmp/mariadb.log 2>&1 &

    for i in $(seq 1 60); do
      if mariadb-admin --socket=/run/mysqld/mysqld.sock ping --silent >/dev/null 2>&1; then
        break
      fi
      sleep 1
      if [ "$i" -eq 60 ]; then
        echo "MariaDB failed to start"
        cat /tmp/mariadb.log || true
        exit 1
      fi
    done

    mariadb --socket=/run/mysqld/mysqld.sock -uroot <<SQL
CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'127.0.0.1';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL

    if [ ! -f /var/lib/mysql/.seeded ]; then
      mariadb --socket=/run/mysqld/mysqld.sock -uroot "${DB_NAME}" < /app/cloudrun-seed.sql
      touch /var/lib/mysql/.seeded
    fi

    echo "ready" > /tmp/cloudrun-db-bootstrap.status
    ;;
  *)
    : "${DB_HOST:?DB_HOST is required when USE_EMBEDDED_DB is false}"
    : "${DB_PORT:=3306}"
    : "${DB_USER:?DB_USER is required when USE_EMBEDDED_DB is false}"
    : "${DB_PASSWORD:?DB_PASSWORD is required when USE_EMBEDDED_DB is false}"
    : "${DB_NAME:?DB_NAME is required when USE_EMBEDDED_DB is false}"
    echo "Using external MySQL at ${DB_HOST}:${DB_PORT}/${DB_NAME}"
    ;;
esac

exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}"
