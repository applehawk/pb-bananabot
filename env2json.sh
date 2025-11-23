#!/usr/bin/env bash

echo "{" > env.json
grep -v '^#' .env | while IFS='=' read -r key value
do
    echo "\"$key\": \"$value\"," >> env.json
done
sed -i '' 's/,$//' env.json
echo "}" >> env.json
