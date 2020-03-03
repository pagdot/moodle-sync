#!/bin/sh
set -e

PUID=${PUID:-911}
PGID=${PGID:-911}

groupmod -o -g "$PGID" node
usermod -o -u "$PUID" node

echo "
User uid:    $(id -u node)
User gid:    $(id -g node)
"

chown node:node /data

sudo -u node -g node -E "$@"
