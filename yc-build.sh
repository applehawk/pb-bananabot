#!/bin/sh
source .env.deploy

docker build -t bananabot:v1.0.0 -f Dockerfile .
docker tag bananabot:v1.0.0 ${IMAGE_URI}
docker push ${IMAGE_URI}