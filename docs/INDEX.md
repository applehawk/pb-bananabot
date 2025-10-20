# 📚 Документация BananaBot

Полный указатель документации проекта.

## 🗂️ Структура документации

```
docs/
├── setup/              # Начало работы
├── migration/          # Миграция Telegraf → grammY
├── development/        # Для разработчиков
├── PROJECT-STRUCTURE.md
├── README-GRAMMY.md
├── REFACTORING-SUMMARY.md
└── INDEX.md (этот файл)
```

---

## 🚀 Начало работы

Документы для быстрого старта и настройки проекта.

- **[Quick Start](setup/QUICK-START.md)** - Быстрая установка и запуск (5 минут)
- **[Getting Started with grammY](setup/GETTING-STARTED-GRAMMY.md)** - Детальная настройка grammY версии
- **[Switching Versions](setup/SWITCHING-VERSIONS.md)** - Переключение между Telegraf и grammY

**Рекомендуемый порядок чтения**: Quick Start → Switching Versions → Getting Started with grammY

---

## 🏗️ Архитектура

Описание структуры и архитектуры проекта.

- **[Project Structure](PROJECT-STRUCTURE.md)** - Полная структура проекта
  - Обзор директорий
  - Разделение Telegraf/grammY
  - Shared модули
  - Сравнение реализаций

- **[grammY Architecture](README-GRAMMY.md)** - Архитектура grammY версии
  - Модули и сервисы
  - Conversations
  - Middleware
  - API endpoints

- **[Refactoring Summary](REFACTORING-SUMMARY.md)** - Отчёт о рефакторинге
  - История разделения кода
  - Выполненные задачи
  - Структура до/после
  - Статистика изменений

---

## 🔄 Миграция

Документация по миграции с Telegraf на grammY.

- **[Migration Summary](migration/MIGRATION-SUMMARY.md)** - Краткая сводка миграции
  - Основные изменения
  - Статус миграции
  - Быстрое сравнение

- **[Migration Guide](migration/MIGRATION-GUIDE.md)** - Полное руководство
  - Детальное сравнение API
  - Примеры кода (до/после)
  - Миграция каждого компонента
  - Best practices

- **[Migration Plan](migration/migration-plan.md)** - План миграции
  - Все этапы миграции
  - Чек-листы
  - Временные оценки
  - Риски и митигация

**Рекомендуемый порядок чтения**: Migration Summary → Migration Guide → Migration Plan

---

## 💻 Разработка

Инструкции и guidelines для разработчиков.

- **[CLAUDE.md](development/CLAUDE.md)** - Инструкции для AI-ассистента
  - Project overview
  - Development commands
  - Architecture guidelines
  - Code patterns

- **[CLAUDE-UX.md](development/CLAUDE-UX.md)** - UX Guidelines
  - Best practices
  - User experience guidelines
  - Design patterns
  - Accessibility

- **[Verify Migration](development/VERIFY-MIGRATION.md)** - Проверка миграции
  - Чек-лист файлов
  - Тесты корректности
  - Команды для проверки
  - Функциональное тестирование

---

## 📖 Дополнительная документация

- **[Scenes Logic](scenes-logic.md)** - Логика работы сцен и conversations
  - Описание каждой сцены
  - Flow диаграммы
  - Взаимодействие между сценами

---

## 🔍 Поиск по документации

### По темам

| Тема | Документы |
|------|-----------|
| **Установка** | Quick Start, Getting Started with grammY |
| **Архитектура** | Project Structure, grammY Architecture |
| **Миграция** | Migration Summary, Migration Guide, Migration Plan |
| **Разработка** | CLAUDE.md, CLAUDE-UX.md |
| **Тестирование** | Verify Migration |
| **Рефакторинг** | Refactoring Summary |

### По компонентам

| Компонент | Где найти |
|-----------|-----------|
| **Bot Module** | Project Structure, Migration Guide |
| **Scenes/Conversations** | Scenes Logic, Migration Guide |
| **Database** | Project Structure, CLAUDE.md |
| **Payment** | Project Structure, grammY Architecture |
| **VPN (Outline)** | Project Structure, CLAUDE.md |

---

## 📝 Как читать документацию

### Для новичков:
1. **[Quick Start](setup/QUICK-START.md)** - начните здесь
2. **[Project Structure](PROJECT-STRUCTURE.md)** - изучите структуру
3. **[Switching Versions](setup/SWITCHING-VERSIONS.md)** - выберите версию

### Для разработчиков:
1. **[CLAUDE.md](development/CLAUDE.md)** - архитектура и паттерны
2. **[Project Structure](PROJECT-STRUCTURE.md)** - детали реализации
3. **[grammY Architecture](README-GRAMMY.md)** - grammY специфика

### Для миграции:
1. **[Migration Summary](migration/MIGRATION-SUMMARY.md)** - обзор
2. **[Migration Guide](migration/MIGRATION-GUIDE.md)** - детальное руководство
3. **[Verify Migration](development/VERIFY-MIGRATION.md)** - проверка

---

## 🔗 Быстрые ссылки

- [Главный README](../README.md)
- [Структура проекта](PROJECT-STRUCTURE.md)
- [Быстрый старт](setup/QUICK-START.md)
- [Миграция](migration/MIGRATION-SUMMARY.md)
- [Для разработчиков](development/CLAUDE.md)

---

## 📊 Статистика документации

- **Всего документов**: 12
- **Категорий**: 4 (Setup, Migration, Development, Architecture)
- **Строк документации**: ~4000+
- **Языки**: Русский, English (в коде)

---

<div align="center">

**Вся документация в одном месте**

[⬆ Наверх](#-документация-bananabot) | [🏠 На главную](../README.md)

</div>
