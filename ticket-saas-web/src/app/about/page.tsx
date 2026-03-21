import Link from "next/link";

export const metadata = {
  title: "Про РЅР°СЃ | Lizard.red",
  description: "РљРѕРЅС‚Р°РєС‚Рё С‚Р° С–РЅС„РѕСЂРјР°С†С–я про Lizard.red вЂ” РєРІРёС‚РєРё РЅР° РїРѕРґС–С— Р±РµР· РїРµСЂРµРїР»Р°С‚",
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
          РќР° РіРѕР»овну
        </Link>

        <header className="about-header">
          <h1 className="about-title">Про РЅР°СЃ</h1>
          <p className="about-lead">
            Lizard.red вЂ” РїР»Р°С‚С„РѕСЂРјР° РґР»я РїСЂРѕРґР°Р¶Сѓ РєРІРёС‚РєС–РІ РЅР° РїРѕРґС–С—. РљСѓРїСѓР№ РѕРЅР»Р°Р№РЅ, С€РІРёРґРєРѕ С‚Р° Р±РµР·РїРµС‡РЅРѕ.
          </p>
        </header>

        <section className="about-section">
          <h2 className="about-section-title">РљРѕРЅС‚Р°РєС‚Рё</h2>
          <p className="about-text">
            РџРёС€Рё РЅР°Рј Р· Р±удь-СЏРєРёС… РїРёС‚Р°нь: Р·Р°РјРѕРІР»Рµння РєРІРёС‚РєС–РІ, СЃРїС–РІРїСЂР°С†я, С‚РµС…РЅС–С‡РЅС– РїРёС‚Р°ння.
          </p>
          <a href="mailto:hello@lizard.red" className="about-email">
            hello@lizard.red
          </a>
        </section>

        <section className="about-section">
          <h2 className="about-section-title">Ми РІ СЃРѕС†РјРµСЂРµР¶Р°С…</h2>
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
          <h2 className="about-section-title">РЇРє С†Рµ РїСЂР°С†СЋС”</h2>
          <ul className="about-list">
            <li>РћР±РёСЂР°Р№ РїРѕРґС–СЋ РЅР° <Link href="/">Р°С„С–С€С–</Link> С‚Р° РЅР°С‚РёСЃРєР°Р№ В«РљРІРёС‚РєРёВ».</li>
            <li>Р’РєР°Р¶Рё email вЂ” РЅР° нього РЅР°РґС–Р№РґРµ РїРѕСЃРёР»Р°ння РЅР° РѕРїР»Р°С‚Сѓ С‚Р° РєРІРёС‚РѕРє РїС–СЃР»я РѕРїР»Р°С‚Рё.</li>
            <li>РћРїР»Р°С‡СѓР№ С‡РµСЂРµР· Monobank (Р±Р°РЅРєР° РѕСЂРіР°РЅС–Р·Р°С‚РѕСЂР°). Р‘РµР· РєРѕРјС–СЃС–Р№ С‚Р° РїРµСЂРµРїР»Р°С‚.</li>
            <li>РљРІРёС‚РѕРє Р· QR-РєРѕРґРѕРј Р·КјСЏРІРёС‚ься Сѓ Р»РёСЃС‚С– С‚Р° РІ СЂРѕР·РґС–Р»С– <Link href="/my-tickets">РњРѕС— РєРІРёС‚РєРё</Link> РїС–СЃР»я РІС…оду.</li>
          </ul>
        </section>
      </div>
      </div>
    </div>
  );
}

