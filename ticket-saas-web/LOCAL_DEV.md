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

Відкрий `.env` і переконайся, що є рядок (пароль з `docker-compose.yml`):

```
DATABASE_URL=postgresql://postgres:Tk7mN2xQ4wR9pL5@localhost:5432/tickets
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

---

## Оплата (Monobank)

Щоб перевірка оплати працювала локально:

1. **Увійди в адмінку** (email з `ADMIN_EMAIL` у `.env` або організатор).
2. **Підключи Monobank:** організація → кнопка «Monobank» / «Підключити» → встав токен з [api.monobank.ua](https://api.monobank.ua) (розділ «Персональний токен»).
3. **Прив’яжи банку до події:** у списку подій обери подію → вкажи **Jar** (банку) для цієї події.
4. Після цього кнопка «Я оплатив — оновити статус» і автоматична перевірка будуть ходити в API Monobank. Якщо токен прострочений або банка не прив’язана до події, у консолі сервера з’явиться попередження.

### Фонова перевірка оплат (cron)

Щоб оплати підтверджувались **навіть коли ніхто не на сайті**, викликай ендпоінт періодично (наприклад кожні 1–2 хв):

- **URL:** `GET` або `POST` `/api/cron/check-payments`
- **Захист:** якщо в `.env` задано `CRON_SECRET`, обов’язковий заголовок: `Authorization: Bearer <CRON_SECRET>`
- **Приклад (cron на сервері):**  
  `*/2 * * * * curl -s -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-domain.com/api/cron/check-payments`

Без `CRON_SECRET` ендпоінт відкритий (зручно для локальної перевірки); у проді обов’язково задай секрет.
