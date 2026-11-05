# Мини-CRM «Объекты и задачи»

Приложение для учёта объектов и задач. Постановщик создаёт объекты, назначает задачи и принимает результат. Исполнитель видит назначенные ему задачи и меняет их статус. [Посмотреть демо](https://120nmine.tech/crm).

## Как запустить локально

Понадобятся Node.js 20.9+, pnpm 9 и запущенный Docker.

1. Установите зависимости: `pnpm install`.
2. Запустите локальный Supabase: `pnpm exec supabase start`. Миграции из [`supabase/migrations`](supabase/migrations/) применятся автоматически.
3. Скопируйте `.env.example` в `.env.local`. Выполните `pnpm exec supabase status -o env` и укажите полученные `API_URL` и `PUBLISHABLE_KEY` (либо `ANON_KEY`) в переменных `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` и `SUPABASE_PUBLISHABLE_KEY`. Остальные значения оставьте как в примере.
4. Добавьте тестовые данные: `pnpm seed:local`.
5. Запустите приложение: `pnpm dev`. Откройте [http://localhost:3000](http://localhost:3000).

Для входа в локальную версию используйте `manager1@example.test` (постановщик) или `worker1@example.test` (исполнитель). Пароль для обоих: `LocalTestPassw0rd!`. Данные создаются только в локальной базе; существующий облачный проект при таком запуске не изменяется.

## Проверки

`pnpm lint`, `pnpm typecheck`, `pnpm test` и `pnpm build` проверяют код и сборку. Проверки прав доступа к базе запускаются командой `pnpm db:test` при работающем локальном Supabase.

Краткое [объяснение для руководителя](.docs/FOR_MANAGER.md) и [памятка PDF](output/pdf/mini-crm-guide.pdf) описывают работу приложения без технических деталей. [Устройство проекта](.docs/PROJECT.md) вынесено в отдельный документ.
