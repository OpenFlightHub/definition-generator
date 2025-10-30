rmdir /q/s dist
mkdir dist

call npx.cmd tsc --build --force --verbose

echo build done
