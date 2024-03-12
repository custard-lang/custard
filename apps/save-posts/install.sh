#!/bin/bash

set -eux

dest_dir="$1"

cd "$(dirname "$0")"

npm run custard-transpile

cp package.json .provided-symbols.cstd save-daily.bat save-daily.command "$dest_dir"
mkdir -p "$dest_dir"/src
cp src/*.{mjs,sh} "$dest_dir"/src
cd "$dest_dir"
npm install
