#!/bin/bash
# Skrypt do pobrania i instalacji optymalizatorów, które wymagają zewnętrznych zależności (Rust/Go/Node)
# Oraz routera, który wymaga Twoich kluczy API.

echo "========================================="
echo " Instalacja RTK (Rust Token Killer)      "
echo "========================================="
# Upewnij się, że masz zainstalowane Cargo (Rust)
if command -v cargo &> /dev/null
then
    echo "Pobieram RTK via Cargo..."
    cargo install rtk-ai
else
    echo "[UWAGA] Nie wykryto Cargo. RTK wymaga Rusta. Zainstaluj z https://rustup.rs/"
fi

echo ""
echo "========================================="
echo " Pobieranie claude-code-router           "
echo "========================================="
cd ~/Desktop
git clone https://github.com/musistudio/claude-code-router
cd claude-code-router
npm install
npm run build

echo ""
echo "=========================================================================="
echo " SUKCES! Gotowe do konfiguracji."
echo " 1. Aby używać routera, skopiuj plik config.example.yaml do config.yaml"
echo "    i wklej swoje klucze API (DeepSeek/Gemini/Ollama)."
echo " 2. Odpalaj go lokalnie w tle."
echo "=========================================================================="
