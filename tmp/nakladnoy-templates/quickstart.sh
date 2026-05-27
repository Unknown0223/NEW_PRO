#!/bin/bash

# SavdoDesk Nakladnoy Templates - Quick Start Script

echo "🚀 SavdoDesk Nakladnoy Templates Quick Start"
echo "=============================================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js topilmadi! Iltimos, Node.js 20+ o'rnating."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "⚠️  Node.js versiyasi $NODE_VERSION. Kamida 18 versiyasi kerak."
    exit 1
fi

echo "✅ Node.js $(node -v)"
echo ""

# Install dependencies
echo "📦 Dependencies o'rnatilmoqda..."
npm install
echo ""

# Create output directory
if [ ! -d "output" ]; then
    mkdir output
    echo "📁 output/ papka yaratildi"
fi
echo ""

# Generate all templates
echo "🎨 Barcha shablon lar yaratilmoqda..."
echo ""
npm run generate:all
echo ""

# Test templates
echo "🧪 Shablon larni test qilish..."
echo ""
npm run test
echo ""

echo "=============================================="
echo "✨ Tayyor!"
echo ""
echo "📂 Shablon lar joylashgan: output/"
echo "📄 Hisobot: output/test-report.json"
echo ""
echo "Keyingi qadamlar:"
echo "  1. output/ papkasidagi shablon larni ko'ring"
echo "  2. Backend ga integratsiya qiling"
echo "  3. Ma'lumot to'ldiring"
echo ""
echo "Yordam: README.md faylini o'qing"
echo "=============================================="
