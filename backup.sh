#!/usr/bin/env bash

DT=$(date +%Y-%m-%d-%H-%M)
DIR=.bak
FILE="$DIR/$DT.tgz"
FILE_EXCLUDE=exclude.tag
mkdir $DIR -p

touch .bak/${FILE_EXCLUDE}
touch .removed//${FILE_EXCLUDE}
touch .trash/${FILE_EXCLUDE}
touch @temp-app-surrealdb-graphql/${FILE_EXCLUDE}
touch database/${FILE_EXCLUDE}
touch node_modules/${FILE_EXCLUDE}
touch packages/app-gql/node_modules/${FILE_EXCLUDE}
touch packages/app-lib/node_modules/${FILE_EXCLUDE}
touch packages/app-lib-gql/node_modules/${FILE_EXCLUDE}
touch packages/app-rst/node_modules/${FILE_EXCLUDE}
touch packages/app/node_modules/${FILE_EXCLUDE}
touch packages/dataloader/node_modules/${FILE_EXCLUDE}
touch packages/tutorial-graphql/node_modules/${FILE_EXCLUDE}

tar -zcvf $FILE \
	--exclude-tag-all=${FILE_EXCLUDE} \
	--exclude='FILE|DIR' \
	.
