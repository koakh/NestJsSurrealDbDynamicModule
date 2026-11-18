#!/usr/bin/env bash

DT=$(date +%Y-%m-%d-%H-%M)
DIR=.bak
FILE="$DIR/$DT.tgz"
FILE_EXCLUDE=exclude.tag
mkdir $DIR -p

touch .bak/${FILE_EXCLUDE}
touch .trash/${FILE_EXCLUDE}
touch database/${FILE_EXCLUDE}
touch node_modules/${FILE_EXCLUDE}
touch packages/app-lib/node_modules/${FILE_EXCLUDE}
touch packages/app-rst/node_modules/${FILE_EXCLUDE}

# TODO: review this list, and convert to a exclude file
tar -czf $FILE \
  --exclude-from=.bak/exclude.tag \
  --exclude="*node_modules*" \
  --exclude="*dist*" \
  --exclude="*coverage*" \
  --exclude=".git" \
  --exclude="*.tgz" \
  --exclude="*.log" \
  --exclude="exclude.tag" \
  .

echo "backup created at $FILE"
