# Локальна розробка

## 1. Запустити БД

З **кореня репо** (не з ticket-saas-web):

```bash
docker compose -f docker-compose.prod.yml up -d db
```

Переконайся, що порт 5432 вільний. Після запуску Postgres доступний на `localhost:5432`.

## 2. Налаштувати .env

У папці `ticket-saas-web`:

```bash
cp .env.example .env
```

Відкрий `.env` і переконайся, що є рядок (для пароля `postgres`):

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tickets
```

Якщо в `docker-compose` задано інший `POSTGRES_PASSWORD` — підстав його в URL.

## 3. Застосувати міграції

У папці `ticket-saas-web`:

```bash
npx prisma migrate deploy
```

Це створить таблиці в БД.

## 4. Запустити dev-сервер

```bash
npm run dev
```

Відкрий http://localhost:3000.

---

## Капча і емейл без ключів

- **Капча (Turnstile):** якщо в `.env` немає `TURNSTILE_SECRET_KEY`, у режимі dev перевірка капчі пропускається — вхід працює.
- **Емейл (Brevo):** якщо немає `BREVO_API_KEY`, листи не відправляються, а **код входу виводиться в консоль** (термінал, де крутиться `npm run dev`). Подивись туди після натискання «Надіслати код».

Щоб листи реально летіли на пошту, додай у `.env` ключі Brevo та (опційно) тестові ключі Turnstile з [документації Cloudflare](https://developers.cloudflare.com/turnstile/troubleshooting/testing/).
