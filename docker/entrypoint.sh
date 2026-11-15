#!/bin/sh
# web    — miqrasiyaları tətbiq edir və veb serveri işə salır
# worker — fon tapşırıqları (QR pəncərələri, gəlməmə, növbə, avadanlıq, məktub təkrarı)
# seed   — başlanğıc məlumatları (kitabxanalar, otaqlar, avadanlıq)
set -e
case "$1" in
  web)
    node node_modules/prisma/build/index.js migrate deploy
    exec node server.js
    ;;
  worker) exec node dist/scripts/worker.js ;;
  seed) exec node dist/prisma/seed.js ;;
  *) exec "$@" ;;
esac
