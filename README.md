# Мини-CRM «Объекты и задачи»

Next.js + TypeScript + Ant Design + Axios + Zustand + Supabase. Постановщики управляют строительными объектами и задачами; исполнители видят только назначенную им работу и проводят задачи через разрешённые статусы.

## Запуск

Нужны Node.js 20.9+, pnpm 9 и Docker для локального Supabase.

1. `pnpm install`
2. Скопировать `.env.example` в `.env.local`. Указать URL проекта и **publishable key**. Пароль БД и secret/service_role key в этот файл и во фронтенд не добавлять.
3. `pnpm exec supabase start -x studio,postgres-meta,storage-api,imgproxy,realtime,edge-runtime,logflare,vector,supavisor,mailpit` — поднимет одноразовую локальную базу и применит миграции.
4. `pnpm seed:local` — создаст локально двух постановщиков и двух исполнителей, три объекта и задачи в разных статусах. Пароль локальных пользователей `LocalTestPassw0rd!`; email: `manager1@example.test`, `manager2@example.test`, `worker1@example.test`, `worker2@example.test`. Эти данные **только для локального стенда**.
5. Для работы с локальным стендом укажите его `API_URL` и `PUBLISHABLE_KEY` из `pnpm exec supabase status -o env` в `.env.local`, затем `pnpm dev`. Для облачного проекта оставьте параметры из панели Supabase.

`pnpm test:coverage`, `pnpm db:test`, `pnpm test:security`, `pnpm test:concurrency` и `pnpm test:e2e` проверяют интерфейс, права доступа, прямой Data API и одновременные операции с объектом. E2E сам запускает приложение с локальными параметрами Supabase; перед ним должны работать локальный Supabase и `pnpm seed:local`. Для `test:concurrency` нужен Docker с локальным контейнером базы. На Windows E2E использует установленный Edge, в CI — Chromium. `pnpm build` проверяет production-сборку.

GitHub Actions запускает полный набор проверок при любом изменении вне корневых Markdown-файлов и каталога `docs/`. Если изменена только документация, выполняется проверка diff без сборок.

## Публичный стенд

CRM работает по адресу [https://120nmine.tech/crm](https://120nmine.tech/crm), healthcheck — [https://120nmine.tech/crm/api/health](https://120nmine.tech/crm/api/health). Это отдельный контейнер `crm-app` и отдельный Compose проект в `/opt/mini-crm-objects-tasks`; существующие сервисы Minecraft и его PostgreSQL не менялись. В Caddy добавлен только маршрут `/crm` и `/crm/*`. Образ собирается локально через `Dockerfile` с `CRM_BASE_PATH=/crm` и публичным ключом Supabase; на сервер попадает только publishable key. `APP_ORIGIN` на сервере — `https://120nmine.tech`.

Перед очередным ручным обновлением: дождаться зелёного CI, собрать образ с теми же build args, передать его в `/opt/mini-crm-objects-tasks`, выполнить `docker load`, обновить `CRM_IMAGE` в `.env` и запустить `docker compose --project-directory /opt/mini-crm-objects-tasks --env-file /opt/mini-crm-objects-tasks/.env -f /opt/mini-crm-objects-tasks/compose.yml up -d`. Проверить `/crm/api/health` и браузерный сценарий. При переустановке Minecraft сайта, если его Caddyfile был заменён, повторно выполнить `/opt/mini-crm-objects-tasks/install-route.sh`.

Для полного удаления CRM **после показа** выполнить на сервере `/opt/mini-crm-objects-tasks/uninstall.sh`. Скрипт убирает только помеченный маршрут CRM, контейнер, его образ и каталог приложения. Сеть и контейнеры Minecraft остаются. Облачный проект Supabase удаляется отдельно в панели Supabase после показа; скрипт его не затрагивает.

Публичный E2E запускается с локальным файлом учётных записей через `CRM_DEMO_ACCOUNTS_FILE=... pnpm test:deploy`. Прямые проверки RLS и cookie запускаются `pnpm test:deployed-security` с `CRM_DEMO_ACCOUNTS_FILE`, `CRM_SUPABASE_URL` и `CRM_SUPABASE_PUBLISHABLE_KEY`. Пароли и ключи не коммитятся.

## Структура проекта

- `src/app/` — пять экранов и серверные маршруты входа, обновления сессии, выхода и healthcheck.
- `src/components/` — общая навигация и переиспользуемые поля форм объектов и задач.
- `src/lib/api/` — отдельные запросы профилей, объектов и задач; `client.ts` добавляет publishable key и access token.
- `src/lib/auth/` — серверная работа с refresh cookie и клиентская сессия с access token в памяти.
- `supabase/migrations/` — схема, права, RLS и функции записи. `supabase/tests/` и `scripts/check-rls.mjs` проверяют правила БД напрямую.
- `tests/e2e/` — сценарии ролей, экранов, сессии и полного цикла статусов.

Новую операцию добавлять последовательно: миграция с проверкой роли → типизированный запрос в нужном API-модуле → экран или общая форма → прямой тест прав и E2E. Так права остаются в БД, а интерфейс не дублирует бизнес-правила как единственный источник истины.

## Облачный проект

В Supabase должны быть включены Data API и RLS, выключены автоматические права для новых таблиц и **Allow new users to sign up**. Миграции хранятся в `supabase/migrations/` и добавляют только CRM-схему. Облачную базу **не сбрасывать**. Перед применением новых миграций проверить их через `supabase db push --remote=<connection-string> --dry-run`; затем применить через CLI. Обе текущие миграции уже применены к созданному проекту.

В `Authentication → Users → Add user` вручную создайте пользователей с подтверждённым email. Роли назначаются только администратором базы в `public.profiles`, например:

```sql
insert into public.profiles (id, display_name, role)
select id, 'Руководитель', 'manager' from auth.users where email = 'manager@example.com';
```

Для исполнителей используйте роль `executor`. После назначения ролей постановщик создаёт объекты и задачи через интерфейс. Никакого маршрута саморегистрации или изменения роли пользователем нет. Секреты не коммитить; для серверного запуска нужны `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `APP_ORIGIN` и публичные `NEXT_PUBLIC_*` из `.env.example`.

## Защита данных

RLS ограничивает чтение строк. У браузерной роли нет прямых прав на изменение таблиц. Запись идёт через функции PostgreSQL, которые повторно проверяют роль и назначение, а статус и история изменяются одной транзакцией. История не удаляется вместе с объектом или задачей. Access token находится только в памяти вкладки, refresh token — в HttpOnly cookie, выдаваемой Next.js. `service_role` не используется приложением.

## Текущее состояние сдачи

Код опубликован в [GitHub](https://github.com/ngrvsn/mini-crm-objects-tasks). Миграции применены к созданному облачному Supabase без сброса базы. Для демонстрации созданы один постановщик, два исполнителя, три объекта и четыре задачи в разных статусах. Логины и случайные пароли сохранены только на этой машине в `C:\Users\AIAvenger\Desktop\mini-crm-demo-accounts.json`; этот файл не входит в репозиторий. После деплоя проверены публичный сценарий постановщика и двух исполнителей, защищённая cookie и прямые запреты RLS на облачном Data API. См. [решения и допущения](DECISIONS.md), [аудит безопасности](SECURITY_AUDIT.md) и [объяснение для руководителя](FOR_MANAGER.md).
