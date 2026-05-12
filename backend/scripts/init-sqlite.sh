#!/usr/bin/env sh
set -eu

export DATABASE_URL="${DATABASE_URL:-file:./supplier_system.db}"

rm -f prisma/supplier_system.db
npx prisma generate
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > /tmp/supplier-system-schema.sql
sqlite3 prisma/supplier_system.db < /tmp/supplier-system-schema.sql
npx prisma db seed
