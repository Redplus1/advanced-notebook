#!/bin/bash
# Advanced Notebook — одна команда для полной установки и запуска
# Использование: bash setup.sh

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}   Advanced Notebook — Установка                  ${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Проверка Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js не найден.${NC}"
    echo "  Скачай: https://nodejs.org (кнопка LTS)"
    exit 1
fi
echo -e "${GREEN}✓ Node.js $(node --version)${NC}"

# Проверка Rust
if ! command -v cargo &> /dev/null; then
    echo -e "${YELLOW}⚠ Rust не найден. Устанавливаю...${NC}"
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
fi
echo -e "${GREEN}✓ Rust $(rustc --version | cut -d' ' -f2)${NC}"

# Apple Silicon target
if [[ "$(uname -m)" == "arm64" ]]; then
    rustup target add aarch64-apple-darwin 2>/dev/null || true
fi

echo ""
echo -e "${BLUE}Устанавливаю npm зависимости...${NC}"
npm install

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ Готово! Запускаю приложение...${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  Первый запуск займёт 3-7 минут (компиляция Rust)"
echo "  Последующие запуски — быстрые"
echo ""

npm run tauri:dev
