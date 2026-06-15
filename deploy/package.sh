#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_NAME="$(basename "$PROJECT_ROOT")"
OUTPUT_DIR="${OUTPUT_DIR:-${PROJECT_ROOT}/release}"
PACKAGE_NAME="${PACKAGE_NAME:-${PROJECT_NAME}-$(date +%Y%m%d-%H%M%S).zip}"

mkdir -p "$OUTPUT_DIR"

cd "$(dirname "$PROJECT_ROOT")"

COPYFILE_DISABLE=1 zip -qry "${OUTPUT_DIR}/${PACKAGE_NAME}" "$PROJECT_NAME" \
  -x "${PROJECT_NAME}/.git/*" \
  -x "${PROJECT_NAME}/.scannerwork/*" \
  -x "${PROJECT_NAME}/.playwright-mcp/*" \
  -x "${PROJECT_NAME}/backend/node_modules/*" \
  -x "${PROJECT_NAME}/backend/dist/*" \
  -x "${PROJECT_NAME}/backend/uploads/*" \
  -x "${PROJECT_NAME}/backend/prisma/*.db" \
  -x "${PROJECT_NAME}/backend/prisma/*.db-*" \
  -x "${PROJECT_NAME}/backend/.env" \
  -x "${PROJECT_NAME}/**/.env" \
  -x "${PROJECT_NAME}/**/*.pem" \
  -x "${PROJECT_NAME}/**/*.key" \
  -x "${PROJECT_NAME}/**/id_rsa*" \
  -x "${PROJECT_NAME}/frontend/node_modules/*" \
  -x "${PROJECT_NAME}/frontend/dist/*" \
  -x "${PROJECT_NAME}/frontend/tmp-vite-check/*" \
  -x "${PROJECT_NAME}/logs/*" \
  -x "${PROJECT_NAME}/release/*" \
  -x "${PROJECT_NAME}/.DS_Store"

printf '交付包已生成：%s\n' "${OUTPUT_DIR}/${PACKAGE_NAME}"
