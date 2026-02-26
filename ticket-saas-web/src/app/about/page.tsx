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
            <a href="https://t.me/lizard_red" target="_blank" rel="noopener noreferrer" className="about-social-link" aria-label="Telegram">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.692-1.653-1.123-2.678-1.799-1.185-.781-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.009-1.252-.242-1.865-.44-.752-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.333-1.386 4.025-1.627 4.477-1.635.099-.002.321.023.465.141.121.1.154.234.17.331.015.098.034.321.019.496z"/>
              </svg>
              Telegram
            </a>
            <a href="https://instagram.com/lizard.red" target="_blank" rel="noopener noreferrer" className="about-social-link" aria-label="Instagram">
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
