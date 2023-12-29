#!/bin/bash

set -eu

for json in "$1"/*-??-??T??_??_??.???Z.json; do
  if [ ! -e "${json%.json}.md" ]; then
    echo "$json"
  fi
done
