# Git Submodules - Руководство для BananaBot

Полное руководство по работе с git submodules в проекте BananaBot.

## Структура Submodules

```
bananabot/
├── .gitmodules                     # Конфигурация submodules
├── prisma/                         # ← Submodule: bananabot-prisma
│   └── .git                        # Отдельный git репозиторий
└── bananabot-admin/                # ← Submodule: bananabot-admin
    ├── .git                        # Отдельный git репозиторий
    └── prisma/                     # ← Nested submodule: bananabot-prisma
        └── .git                    # Отдельный git репозиторий
```

### Репозитории

- **bananabot-prisma:** https://github.com/applehawk/bananabot-prisma
- **bananabot-admin:** https://github.com/applehawk/bananabot-admin

## Быстрые команды (Makefile)

```bash
# Обновить все submodules до последних коммитов
make submodules-update

# Проверить статус submodules
make submodules-status

# Pull изменения в submodules
make submodules-pull
```

## Работа с Submodules

### 1. Клонирование проекта с submodules

#### Вариант A: При первом клонировании

```bash
git clone --recurse-submodules git@github.com:applehawk/pb-bananabot.git
cd pb-bananabot
```

#### Вариант B: Если уже клонировали без submodules

```bash
git clone git@github.com:applehawk/pb-bananabot.git
cd pb-bananabot

# Инициализировать и загрузить submodules
git submodule init
git submodule update --init --recursive
```

### 2. Обновление submodules до последних версий

```bash
# Обновить все submodules до latest commits
git submodule update --remote --recursive

# Или через Makefile
make submodules-update
```

### 3. Проверка статуса submodules

```bash
# Показать текущие commits в submodules
git submodule status

# Или через Makefile
make submodules-status
```

Вывод:
```
 8f905fc8... prisma (heads/main)
 44a16c8a... bananabot-admin (heads/main)
```

## Редактирование Submodules из корня bananabot

### ✅ ДА, можно менять и коммитить!

Вы МОЖЕТЕ редактировать файлы внутри submodule директорий и делать коммиты в их репозитории прямо из корня bananabot.

### Workflow для изменений в submodule

#### Сценарий 1: Изменить Prisma Schema

```bash
# 1. Войти в директорию submodule
cd prisma

# 2. Убедиться что на нужной ветке
git checkout main
git pull origin main

# 3. Внести изменения в schema.prisma
vim schema.prisma

# 4. Создать миграцию (если нужно)
npm run migrate:dev --name add_new_field

# 5. Закоммитить изменения
git add .
git commit -m "feat: Add new field to User model"

# 6. Запушить в удаленный репозиторий
git push origin main

# 7. Вернуться в корень bananabot
cd ..

# 8. Обновить reference на новый commit в основном репозитории
git add prisma
git commit -m "chore: Update prisma submodule to latest version"
git push origin imggenbot
```

#### Сценарий 2: Изменить Admin Panel

```bash
# 1. Войти в директорию submodule
cd bananabot-admin

# 2. Проверить текущую ветку
git status
git checkout main

# 3. Внести изменения
vim app/page.tsx

# 4. Закоммитить изменения
git add app/page.tsx
git commit -m "feat: Update home page design"
git push origin main

# 5. Вернуться в корень и обновить reference
cd ..
git add bananabot-admin
git commit -m "chore: Update bananabot-admin submodule"
git push origin imggenbot
```

## Понимание Submodule Reference

### Что такое submodule reference?

Когда вы делаете `git add prisma`, вы НЕ добавляете файлы из prisma в основной репозиторий. Вместо этого вы добавляете **ссылку (reference)** на конкретный commit в репозитории bananabot-prisma.

```
bananabot/.gitmodules:
  [submodule "prisma"]
    url = git@github.com:applehawk/bananabot-prisma.git

bananabot/prisma:
  → Указывает на commit 8f905fc в bananabot-prisma
```

### Проверка reference

```bash
# Показать на какой commit указывает submodule
git ls-tree HEAD prisma

# Вывод:
# 160000 commit 8f905fc8...  prisma
```

## Автоматическое обновление при build и start

В Makefile настроены автоматические обновления:

```makefile
# Build автоматически обновит submodules
make build

# Start также обновит submodules
make start
```

Это гарантирует что вы всегда используете последние версии Prisma schema и Admin panel.

## Работа с Nested Submodules

Admin panel имеет вложенный submodule (prisma):

```
bananabot-admin/
└── prisma/  ← Тоже submodule, указывает на bananabot-prisma
```

### Обновление nested submodules

```bash
# Из корня bananabot (обновит все уровни)
git submodule update --init --recursive --remote

# Или
make submodules-update
```

## Частые сценарии

### Синхронизация изменений между командой

**Член команды A** внес изменения в Prisma schema:

```bash
# Член команды A
cd prisma
vim schema.prisma
git add schema.prisma
git commit -m "Add new model"
git push origin main

cd ..
git add prisma
git commit -m "Update prisma submodule"
git push origin imggenbot
```

**Член команды B** получает изменения:

```bash
# Член команды B
git pull origin imggenbot

# Обновить submodules
git submodule update --remote --recursive
# Или
make submodules-update
```

### Откат submodule к предыдущему коммиту

```bash
# 1. Войти в submodule
cd prisma

# 2. Посмотреть историю
git log --oneline

# 3. Откатиться на нужный commit
git checkout abc123

# 4. Вернуться в корень
cd ..

# 5. Зафиксировать новый reference
git add prisma
git commit -m "Revert prisma to commit abc123"
```

### Создание новой ветки в submodule

```bash
# 1. Войти в submodule
cd bananabot-admin

# 2. Создать новую ветку
git checkout -b feature/new-dashboard

# 3. Внести изменения и закоммитить
git add .
git commit -m "WIP: New dashboard"
git push origin feature/new-dashboard

# 4. В основном репозитории reference будет указывать на эту ветку
cd ..
git add bananabot-admin
git commit -m "Update admin to feature branch"
```

## Troubleshooting

### Проблема: Submodule не обновляется

```bash
# Форсированное обновление
git submodule update --init --force --recursive --remote
```

### Проблема: Изменения в submodule не видны

```bash
# Проверить статус
cd prisma
git status

# Если есть uncommitted changes
git add .
git commit -m "Save changes"

cd ..
git add prisma
```

### Проблема: Detached HEAD в submodule

Это нормальное состояние для submodules. Если хотите работать на ветке:

```bash
cd prisma
git checkout main
git pull origin main
# Внесите изменения
git push origin main
```

### Проблема: Конфликты при обновлении submodule

```bash
cd prisma
git status
# Разрешите конфликты вручную
git add .
git commit -m "Resolve conflicts"
git push origin main
```

## Best Practices

### ✅ DO

1. **Всегда коммитьте в submodule репозиторий первым**
   ```bash
   cd prisma
   git commit && git push
   cd ..
   git add prisma && git commit && git push
   ```

2. **Используйте `make submodules-update` перед началом работы**
   ```bash
   make submodules-update
   ```

3. **Проверяйте статус перед коммитом**
   ```bash
   make submodules-status
   ```

4. **Документируйте изменения в submodules**
   ```bash
   git commit -m "Update prisma: Add User.avatar field (prisma#123)"
   ```

### ❌ DON'T

1. **Не забывайте пушить изменения в submodule**
   ```bash
   # ПЛОХО: изменили файлы в submodule, но не запушили
   cd prisma
   git commit -m "changes"
   # Забыли git push!
   ```

2. **Не используйте `git add .` в корне если есть изменения в submodules**
   ```bash
   # ПЛОХО
   git add .  # Может добавить незавершенные изменения в submodules

   # ХОРОШО
   git add specific-file.ts
   ```

3. **Не делайте force push в shared submodules**
   ```bash
   # ПЛОХО
   cd prisma
   git push --force  # Может сломать работу других
   ```

## Полезные команды

```bash
# Показать все submodules
git submodule status

# Показать URL submodules
git config --file .gitmodules --get-regexp url

# Выполнить команду во всех submodules
git submodule foreach 'git checkout main'
git submodule foreach 'git pull origin main'

# Показать diff в submodules
git diff --submodule

# Удалить submodule (если нужно)
git submodule deinit -f prisma
git rm -f prisma
rm -rf .git/modules/prisma
```

## Интеграция с CI/CD

Для CI/CD добавьте в скрипты:

```bash
# .github/workflows/deploy.yml
- name: Checkout with submodules
  uses: actions/checkout@v3
  with:
    submodules: recursive

- name: Update submodules
  run: git submodule update --init --recursive --remote
```

## Ссылки

- [Git Submodules Documentation](https://git-scm.com/book/en/v2/Git-Tools-Submodules)
- [Pro Git Book - Submodules (Russian)](https://git-scm.com/book/ru/v2/Инструменты-Git-Подмодули)
- [GitHub: Working with Submodules](https://github.blog/2016-02-01-working-with-submodules/)
