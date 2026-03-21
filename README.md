# ticket-saas

Основной продуктовый путь живёт в `ticket-saas-web/`.

## Что где находится

- `ticket-saas-web/` — основной Next.js monolith: публичные страницы, auth, admin, ticketier, API routes, Prisma, тесты.
- `src/` в корне — legacy Fastify backend. Он сохранён для переходного периода и локального сравнения старого поведения, но не считается основным dev-flow.
- `docker-compose.yml` — локальная Postgres для основного web-приложения.
- `tickets.dump`, `tickets_dump.sql` — локальные артефакты дампа, не часть основного runtime flow.

## Рекомендуемый запуск

Из корня репозитория:

```bash
npm run dev
```

Это проксирует запуск в `ticket-saas-web`.

Полезные команды:

```bash
npm run dev:web
npm run lint
npm run typecheck
npm run test
```

Legacy Fastify остаётся доступным отдельно:

```bash
npm run dev:legacy
npm run build:legacy
npm run start:legacy
```

## Документация

- Локальная настройка: `ticket-saas-web/LOCAL_DEV.md`
- Архитектурная карта: `ticket-saas-web/ARCHITECTURE.md`
- Deployment заметки legacy-контура: `DEPLOY.md`

## Текущее правило

Если вы добавляете новую бизнес-логику, API или UI, делайте это в `ticket-saas-web/`, если только нет очень явной причины поддерживать legacy Fastify путь.
