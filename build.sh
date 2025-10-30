rm -rf dist
mkdir -p dist

npx tsc --build --force --verbose

echo build done
