# Развертывание BananaBot в Yandex.Cloud

Пошаговое руководство по развертыванию Telegram-бота в Yandex.Cloud с использованием Serverless Containers.

## Предварительные требования

- Аккаунт в [Yandex.Cloud](https://cloud.yandex.ru/)
- Установленный [Yandex Cloud CLI (`yc`)](https://cloud.yandex.ru/docs/cli/quickstart)
- Docker Desktop
- Telegram Bot Token (получить у [@BotFather](https://t.me/BotFather))
- Gemini API Key (получить на [Google AI Studio](https://aistudio.google.com/))

## Шаг 1: Настройка Yandex Cloud CLI

### 1.1 Установка CLI

**macOS:**
```bash
curl -sSL https://storage.yandexcloud.net/yandexcloud-yc/install.sh | bash
```

**Linux:**
```bash
curl -sSL https://storage.yandexcloud.net/yandexcloud-yc/install.sh | bash
```

### 1.2 Инициализация CLI

```bash
yc init
```

Следуйте инструкциям:
1. Получите OAuth токен по ссылке
2. Выберите облако (cloud)
3. Выберите или создайте каталог (folder)
4. Выберите зону доступности (рекомендуется `ru-central1-a`)

### 1.3 Проверка конфигурации

```bash
yc config list
```

Должны увидеть:
- `token`
- `cloud-id`
- `folder-id`

## Шаг 2: Создание виртуальной машины для PostgreSQL и Redis

### 2.1 Создание VM

```bash
yc compute instance create \
  --name bananabot-vm \
  --zone ru-central1-b \
  --platform standard-v3 \
  --cores 2 \
  --memory 2GB \
  --core-fraction 20 \
  --create-boot-disk image-folder-id=standard-images,image-family=ubuntu-2204-lts,size=15GB \
  --network-interface subnet-name=default-ru-central1-b,nat-ip-version=ipv4 \
  --ssh-key ~/.ssh/id_bananabot.pub
```

**Примечание:** Если у вас нет SSH ключа, создайте его:
```bash
ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_bananabot
```

### 2.2 Подключение к VM

Получите публичный IP:
```bash
yc compute instance get bananabot-vm --format json | grep "address" | head -2
```

Подключитесь:
```bash
ssh -i ~/.ssh/id_bananabot ubuntu@<PUBLIC_IP>
```

### 2.3 Установка Docker на VM

```bash
# Обновление пакетов
sudo apt update && sudo apt upgrade -y

# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Добавление пользователя в группу docker
sudo usermod -aG docker ubuntu

# Выход и повторное подключение
exit
```

### 2.4 Запуск PostgreSQL и Redis

Создайте `docker-compose.yml` на VM:

```bash
ssh -i ~/.ssh/id_bananabot ubuntu@<PUBLIC_IP>
```

```bash
mkdir -p ~/bananabot && cd ~/bananabot
cat > docker-compose.yml << 'EOF'
services:
  postgres:
    image: postgres:16-alpine
    container_name: bananabot-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: bananabot
      POSTGRES_PASSWORD: your_secure_password_here
      POSTGRES_DB: bananabot
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - bananabot-network
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U bananabot']
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: bananabot-redis
    restart: unless-stopped
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    networks:
      - bananabot-network
    command: redis-server --appendonly yes
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5

networks:
  bananabot-network:
    name: bananabot-network
    driver: bridge

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
EOF
```

Запустите контейнеры:
```bash
docker compose up -d
```

Проверьте статус:
```bash
docker ps
```

Выйдите из VM:
```bash
exit
```

### 2.5 Сохранение конфигурации VM

Получите VM ID:
```bash
yc compute instance get bananabot-vm --format json | grep '"id"' | head -1
```

Получите внутренний IP:
```bash
yc compute instance get bananabot-vm --format json | grep '"address"' | head -1
```

Сохраните эти значения - они понадобятся позже.

## Шаг 3: Создание Yandex Lockbox Secret

### 3.1 Создание секрета

```bash
yc lockbox secret create \
  --name bananabot-secrets \
  --payload "[
    {\"key\":\"TELEGRAM_BOT_TOKEN\",\"text_value\":\"YOUR_BOT_TOKEN\"},
    {\"key\":\"TELEGRAM_SECRET_TOKEN\",\"text_value\":\"$(openssl rand -hex 32)\"},
    {\"key\":\"GEMINI_API_KEY\",\"text_value\":\"YOUR_GEMINI_API_KEY\"},
    {\"key\":\"YOOMONEY_TOKEN\",\"text_value\":\"YOUR_YOOMONEY_TOKEN\"},
    {\"key\":\"YOOMONEY_SECRET\",\"text_value\":\"YOUR_YOOMONEY_SECRET\"},
    {\"key\":\"DATABASE_URL\",\"text_value\":\"postgresql://bananabot:your_secure_password_here@INTERNAL_VM_IP:5432/bananabot?schema=public\"}
  ]"
```

**Замените:**
- `YOUR_BOT_TOKEN` - токен от BotFather
- `YOUR_GEMINI_API_KEY` - API ключ от Google AI Studio
- `YOUR_YOOMONEY_TOKEN` и `YOUR_YOOMONEY_SECRET` - данные от YooMoney (если используете)
- `INTERNAL_VM_IP` - внутренний IP вашей VM (например, `10.129.0.22`)
- `your_secure_password_here` - пароль PostgreSQL из docker-compose.yml

### 3.2 Получение ID секрета

```bash
yc lockbox secret get --name bananabot-secrets --format json | grep '"id"' | head -1
```

Сохраните `SECRET_ID` и `SECRET_VERSION_ID`.

## Шаг 4: Настройка конфигурации деплоя

### 4.1 Копирование примера конфигурации

```bash
cd deploy/yandex.cloud
cp .yc-config.example .yc-config
```

### 4.2 Редактирование `.yc-config`

Откройте файл и заполните:

```bash
# VM Configuration
VM_ID="epd..." # ID вашей VM
VM_SSH_KEY="~/.ssh/id_bananabot"
VM_SSH_USER="ubuntu"

# Serverless Container Configuration
CONTAINER_NAME="banana-bot-container"

# Security Group Configuration
SECURITY_GROUP_NAME="bananabot-sg"

# Yandex Lockbox Secret Configuration
SECRET_ID="e6q..." # ID вашего секрета
SECRET_VERSION_ID="e6q..." # Version ID вашего секрета
```

## Шаг 5: Сборка и деплой

### 5.1 Сборка Docker образа

```bash
make yc-build
```

Эта команда:
- Проверит наличие `yc` CLI
- Создаст или найдет Container Registry
- Соберет Docker образ
- Загрузит образ в Registry

### 5.2 Деплой в Serverless Container

```bash
make yc-deploy
```

Эта команда:
- Создаст Serverless Container (если не существует)
- Развернет новую ревизию
- Настроит переменные окружения
- Подключит секреты из Lockbox

### 5.3 Настройка webhook

```bash
make yc-webhook
```

Эта команда:
- Получит URL контейнера
- Установит webhook для Telegram бота
- Проверит статус webhook

## Шаг 6: Проверка работы

### 6.1 Просмотр логов

```bash
make yc-logs
```

Вы должны увидеть:
```
[Nest] LOG [NestFactory] Starting Nest application...
[Nest] LOG [GrammYService] Connected to Redis
[Nest] LOG [GrammYService] Bot initialized: @your_bot_name
[Nest] LOG [PrismaService] Database connected successfully
[Nest] LOG [Bootstrap] 🚀 BananaBot (grammY) running on port 8080
```

### 6.2 Проверка VM

```bash
make vm-check
```

Проверьте, что Redis и PostgreSQL работают корректно.

### 6.3 Тестирование бота

Откройте Telegram и отправьте `/start` вашему боту.

## Дополнительные команды

### Проверка статуса контейнеров на VM
```bash
make vm-check
```

### Исправление Redis (если возникли проблемы)
```bash
make vm-fix-redis
```

### Проверка Security Groups
```bash
make vm-check-sg
```

### Настройка Security Group
```bash
make vm-setup-sg
```

## Обновление бота

Для обновления кода бота:

```bash
# 1. Сборка нового образа
make yc-build

# 2. Деплой новой версии
make yc-deploy

# 3. Проверка логов
make yc-logs
```

## Устранение неполадок

### Бот не отвечает

1. Проверьте логи:
   ```bash
   make yc-logs
   ```

2. Проверьте webhook:
   ```bash
   make yc-webhook
   ```

3. Проверьте статус контейнера:
   ```bash
   yc serverless container revision list --container-name banana-bot-container
   ```

### Ошибка подключения к базе данных

1. Проверьте, что PostgreSQL запущен на VM:
   ```bash
   make vm-check
   ```

2. Проверьте `DATABASE_URL` в Lockbox:
   ```bash
   yc lockbox payload get --name bananabot-secrets
   ```

3. Убедитесь, что внутренний IP VM правильный в `DATABASE_URL`

### Ошибка подключения к Redis

1. Проверьте Redis на VM:
   ```bash
   make vm-check
   ```

2. Если Redis в режиме replica, исправьте:
   ```bash
   make vm-fix-redis
   ```

### Security Group блокирует соединения

Если вы видите ошибки `ETIMEDOUT`:

```bash
# Удалите Security Group с VM
yc compute instance update-network-interface <VM_ID> --network-interface-index 0 --clear-security-groups
```

## Стоимость

Примерная стоимость при минимальной нагрузке:
- **Serverless Container**: ~100-300 ₽/месяц (зависит от количества запросов)
- **VM (2 vCPU, 2GB RAM, 20% core-fraction)**: ~400 ₽/месяц
- **Container Registry**: ~10 ₽/месяц
- **Lockbox**: бесплатно (до 1000 запросов/месяц)

**Итого:** ~500-700 ₽/месяц

## Полезные ссылки

- [Документация Yandex.Cloud](https://cloud.yandex.ru/docs)
- [Serverless Containers](https://cloud.yandex.ru/docs/serverless-containers/)
- [Container Registry](https://cloud.yandex.ru/docs/container-registry/)
- [Lockbox](https://cloud.yandex.ru/docs/lockbox/)
- [Compute Cloud](https://cloud.yandex.ru/docs/compute/)

## Поддержка

Если возникли проблемы:
1. Проверьте логи: `make yc-logs`
2. Проверьте статус VM: `make vm-check`
3. Откройте issue в репозитории проекта
