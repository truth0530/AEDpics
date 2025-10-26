#!/bin/bash

# Pre-push script to check build before pushing to GitHub
# This prevents Vercel build errors

echo "Running pre-push checks..."

# Navigate to project directory
cd aed-check-system 2>/dev/null || true

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "Error: package.json not found. Are you in the right directory?"
    exit 1
fi

echo "1. Running lint check..."
npm run lint
if [ $? -ne 0 ]; then
    echo "❌ Lint check failed. Please fix linting errors before pushing."
    exit 1
fi
echo "✅ Lint check passed"

echo "2. Running build check..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed. Please fix build errors before pushing."
    exit 1
fi
echo "✅ Build check passed"

echo "✅ All pre-push checks passed. Ready to push!"
exit 0