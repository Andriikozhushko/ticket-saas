# Локальна розробка

## Швидкий старт

1. Із кореня репозиторію запусти Postgres:

```bash
docker compose -f docker-compose.prod.yml up -d db
```

2. У папці `ticket-saas-web` створи `.env` на основі `.env.example`.

3. Переконайся, що `DATABASE_URL` вказує на локальний Postgres:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tickets?schema=public
```

4. Застосуй міграції:

```bash
npm.cmd run prisma:migrate:deploy
```

5. Запусти dev-сервер:

```bash
npm.cmd run dev
```

6. Відкрий [http://localhost:3000](http://localhost:3000).

## Що робити, якщо не працює логін

- Перевір `GET /api/health` - він показує стан DB, пошти, капчі та Monobank.
- Якщо немає `BREVO_API_KEY`, код входу не відправляється листом, а пишеться у консоль dev-сервера.
- У dev-подібних локальних середовищах Turnstile пропускається автоматично.
- Якщо `GET /api/auth/session` повертає `503`, проблема майже точно в доступності Postgres.

## Корисні команди

```bash
npm.cmd run db:up
npm.cmd run db:down
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test
```

## Monobank локально

1. Увійди під email з `ADMIN_EMAIL`.
2. Створи або відкрий організацію й подію в адмінці.
3. Підключи Monobank токен для організації.
4. Прив’яжи jar до події.
5. Для фонового polling використовуй `/api/cron/check-payments`.
