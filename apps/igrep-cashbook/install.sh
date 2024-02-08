#!/bin/bash

set -eu

dest_dir="$1"

cd "$(dirname "$0")"

npm run custard-transpile

cp package.json .provided-symbols.cstd src/index.mjs "$dest_dir"
cd "$dest_dir"
npm install
