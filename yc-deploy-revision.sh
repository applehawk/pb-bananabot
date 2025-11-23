#!/bin/sh
source .env.deploy

yc serverless container revision deploy \
  --container-name "${CONTAINER_NAME}" \
  --image "${IMAGE_URI}" \
  --service-account-id "${SERVICE_ACCOUNT_ID}" \
  --folder-id "${FOLDER_ID}" \
  --memory 512MB \
  --cores 1 \
  --min-instances 1 \
  --concurrency 3 \
  --environment "NODE_ENV=${NODE_ENV},GEMINI_MODEL=${GEMINI_MODEL},REDIS_URL=${REDIS_URL}" \
  --network-id "${NETWORK_ID}" \
  --secret "id=e6qsbf4cnee54kmh9igb,version-id=e6qll9j0g00lsbbhtj8p,key=TELEGRAM_BOT_TOKEN,environment-variable=TELEGRAM_BOT_TOKEN" \
  --secret "id=e6qsbf4cnee54kmh9igb,version-id=e6qll9j0g00lsbbhtj8p,key=GEMINI_API_KEY,environment-variable=GEMINI_API_KEY" \
  --secret "id=e6qsbf4cnee54kmh9igb,version-id=e6qll9j0g00lsbbhtj8p,key=YOOMONEY_TOKEN,environment-variable=YOOMONEY_TOKEN" \
  --secret "id=e6qsbf4cnee54kmh9igb,version-id=e6qll9j0g00lsbbhtj8p,key=YOOMONEY_SECRET,environment-variable=YOOMONEY_SECRET" \
  --secret "id=e6qsbf4cnee54kmh9igb,version-id=e6qll9j0g00lsbbhtj8p,key=DATABASE_URL,environment-variable=DATABASE_URL" \
  --secret "id=e6qsbf4cnee54kmh9igb,version-id=e6qll9j0g00lsbbhtj8p,key=TELEGRAM_SECRET_TOKEN,environment-variable=TELEGRAM_SECRET_TOKEN"