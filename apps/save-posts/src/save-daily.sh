#!/bin/bash

set -eux

outDir="$1"

cd "$(dirname "$0")"

hours=92
set +e
node ./throttle.mjs "$outDir" "$hours";
if [ "$?" -ne 0 ]; then
  echo "$hours hours has not yet passed since the last update. Exiting."
  exit 0
fi
set -e

node ./save.mjs "$outDir"

# Stop running from here because BlueSky now supports non-logged-in users' view.
# I don't have to generate markdown files anymore.
exit 0

toSplit=($(bash ./list-not-formatted.sh "$outDir"))
node ./split.mjs "${toSplit[@]}"

toFormat=($(bash ./list-not-formatted.sh "$outDir"))
node ./format.mjs "${toFormat[@]}"

read -p "Delete backup files? [y/N] " -n 1 -r reply
if [[ $reply =~ ^[Yy]$ ]]; then
  rm -f "$outDir"/*-??-??T??_??_??.???Z.json.bk
fi
