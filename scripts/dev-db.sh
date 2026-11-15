#!/usr/bin/env bash
# Lokal inkişaf üçün istifadəçi səviyyəsində PostgreSQL (root tələb etmir).
# İstifadə: bash scripts/dev-db.sh start|stop|status
set -euo pipefail
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
DIR="$(cd "$(dirname "$0")/.." && pwd)/.data/pg"
PORT="${PGPORT:-5434}"
case "${1:-start}" in
  start)
    if [ ! -f "$DIR/PG_VERSION" ]; then
      mkdir -p "$DIR"
      "$PGBIN/initdb" -D "$DIR" -U kitabxana --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null
      echo "unix_socket_directories = '$DIR'" >> "$DIR/postgresql.conf"
      echo "listen_addresses = 'localhost'" >> "$DIR/postgresql.conf"
      echo "port = $PORT" >> "$DIR/postgresql.conf"
      echo "timezone = 'UTC'" >> "$DIR/postgresql.conf"
    fi
    if "$PGBIN/pg_ctl" -D "$DIR" status >/dev/null 2>&1; then echo "PostgreSQL artıq işləyir (port $PORT)"; exit 0; fi
    "$PGBIN/pg_ctl" -D "$DIR" -l "$DIR/server.log" -w start >/dev/null
    "$PGBIN/psql" -h localhost -p "$PORT" -U kitabxana -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='kitabxana'" | grep -q 1 \
      || "$PGBIN/createdb" -h localhost -p "$PORT" -U kitabxana kitabxana
    echo "PostgreSQL işləyir: postgresql://kitabxana@localhost:$PORT/kitabxana"
    ;;
  stop) "$PGBIN/pg_ctl" -D "$DIR" -w stop ;;
  status) "$PGBIN/pg_ctl" -D "$DIR" status ;;
  *) echo "start|stop|status"; exit 1 ;;
esac
