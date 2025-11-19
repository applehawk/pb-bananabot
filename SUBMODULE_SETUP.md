# Настройка Git Submodule для bananabot-admin

## Шаги для завершения настройки:

### 1. Создайте репозиторий на GitHub
Создайте новый приватный репозиторий на GitHub:
- Имя: `bananabot-admin`
- URL: `https://github.com/applehawk/bananabot-admin`

### 2. Добавьте remote и запушьте bananabot-admin
```bash
cd /Users/vladmac/Code/NodeJS/bananabot-admin
git remote add origin git@github.com:applehawk/bananabot-admin.git
git remote add amvera https://git.msk0.amvera.ru/defg/bananabot-admin
git branch -M main
git push -u origin main
git push amvera main
```

### 3. Вернитесь в основной репозиторий bananabot
```bash
cd /Users/vladmac/Code/NodeJS/bananabot
```

### 4. Добавьте submodule
```bash
# Убедитесь что .gitmodules уже создан (он уже есть)
# Теперь клонируйте submodule
git submodule add git@github.com:applehawk/bananabot-admin.git bananabot-admin
```

### 5. Закоммитьте изменения в bananabot
```bash
git add .gitmodules bananabot-admin Makefile
git commit -m "Refactor: Move admin panel to separate submodule

- Moved web directory to separate bananabot-admin repository
- Added bananabot-admin as git submodule
- Updated Makefile to remove web-specific commands
- Admin panel now has its own Makefile

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### 6. Запушьте изменения
```bash
git push origin imggenbot
```

## Работа с submodule в будущем

### Клонирование репозитория с submodules
```bash
git clone --recurse-submodules git@github.com:applehawk/pb-bananabot.git
```

Или если уже клонировали:
```bash
git submodule init
git submodule update
```

### Обновление submodule
```bash
cd bananabot-admin
git pull origin main
cd ..
git add bananabot-admin
git commit -m "Update bananabot-admin submodule"
```

### Работа с изменениями в submodule
```bash
# Внесите изменения в bananabot-admin
cd bananabot-admin
# ... make changes ...
git add .
git commit -m "Your commit message"
git push origin main

# Обновите ссылку в основном репозитории
cd ..
git add bananabot-admin
git commit -m "Update bananabot-admin submodule reference"
git push
```

## Структура проекта после настройки
```
NodeJS/
├── bananabot/              # Основной репозиторий
│   ├── .gitmodules         # Конфигурация submodules
│   ├── bananabot-admin/    # Submodule (админ-панель)
│   ├── src/                # Код бота
│   └── Makefile            # Makefile для бота
└── bananabot-admin/        # Отдельный репозиторий (будет удален после setup)
    ├── .git/
    ├── app/
    └── Makefile            # Makefile для админ-панели
```

## Деплой на Amvera Cloud

### Настройка для основного репозитория (bananabot)
Основной репозиторий уже имеет remote для Amvera:
```bash
git remote -v | grep amvera
# amvera	https://git.msk0.amvera.ru/defg/bananaartbot (fetch)
# amvera	https://git.msk0.amvera.ru/defg/bananaartbot (push)
```

### Настройка для bananabot-admin
После создания репозитория на GitHub и добавления remote amvera (см. шаг 2), вы сможете деплоить админ-панель отдельно на Amvera.

### Dockerfile
- Основной бот использует Dockerfile в корне bananabot/
- Админ-панель может иметь свой собственный Dockerfile в bananabot-admin/

## Примечания
- Файл `.gitmodules` уже создан и настроен
- Makefile в bananabot обновлен (удалены команды web-*)
- Makefile для bananabot-admin создан и закоммичен
- Директория web удалена из основного репозитория
- Оба репозитория могут быть задеплоены независимо на Amvera Cloud
