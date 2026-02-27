import Link from "next/link";

export const metadata = {
  title: "Про нас | Lizard.red",
  description: "Контакти та інформація про Lizard.red — квитки на події без переплат",
};

export default function AboutPage() {
  return (
    <div className="about-page">
      <div className="about-glass">
      <div className="about-container">
        <Link href="/" className="about-back">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          На головну
        </Link>

        <header className="about-header">
          <h1 className="about-title">Про нас</h1>
          <p className="about-lead">
            Lizard.red — платформа для продажу квитків на події. Купуй онлайн, швидко та безпечно.
          </p>
        </header>

        <section className="about-section">
          <h2 className="about-section-title">Контакти</h2>
          <p className="about-text">
            Пиши нам з будь-яких питань: замовлення квитків, співпраця, технічні питання.
          </p>
          <a href="mailto:hello@lizard.red" className="about-email">
            hello@lizard.red
          </a>
        </section>

        <section className="about-section">
          <h2 className="about-section-title">Ми в соцмережах</h2>
          <div className="about-social">
            <a href="https://www.instagram.com/lizard.red.ua" target="_blank" rel="noopener noreferrer" className="about-social-link" aria-label="Instagram">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
              Instagram
            </a>
          </div>
        </section>

        <section className="about-section">
          <h2 className="about-section-title">Як це працює</h2>
          <ul className="about-list">
            <li>Обирай подію на <Link href="/">афіші</Link> та натискай «Квитки».</li>
            <li>Вкажи email — на нього надійде посилання на оплату та квиток після оплати.</li>
            <li>Оплачуй через Monobank (банка організатора). Без комісій та переплат.</li>
            <li>Квиток з QR-кодом зʼявиться у листі та в розділі <Link href="/my-tickets">Мої квитки</Link> після входу.</li>
          </ul>
        </section>
      </div>
      </div>
    </div>
  );
}
