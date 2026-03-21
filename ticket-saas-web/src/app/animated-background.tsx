"use client";

/**
 * РђРЅС–РјРѕРІР°РЅРёР№ С„РѕРЅ: Р±Р»СѓРєР°СЋС‡С– Р±Р»РѕР±Рё (СЂРѕР·РјРёС‚С– РїР»ями) + РѕСЂР±Рё (СЃРІС–С‚Р»РѕРІС– С‚РѕС‡РєРё).
 * Р’РёРєРѕСЂРёСЃС‚РѕРІСѓС”С‚ься РІ Shell вЂ” РѕРґРЅР°РєРѕРІРѕ РЅР° РІСЃС–С… СЃС‚РѕСЂС–РЅРєР°С… (РіРѕР»РѕРІРЅР°, РїРѕРґС–С—, РјРѕС— РєРІРёС‚РєРё, про РЅР°СЃ, Р·Р°РјРѕРІР»Рµння).
 */
export function AnimatedBackground() {
  return (
    <div className="app-animated-bg" aria-hidden>
      {/* 3 РІРµР»РёРєС– СЂРѕР·РјРёС‚С– Р±Р»РѕР±Рё */}
      <div className="app-bg-blob-wrap">
        <div className="app-bg-blob" />
      </div>
      <div className="app-bg-blob-wrap">
        <div className="app-bg-blob" />
      </div>
      <div className="app-bg-blob-wrap">
        <div className="app-bg-blob" />
      </div>
      {/* 6 РѕСЂР±С–РІ, С‰Рѕ СЂСѓС…Р°СЋС‚ься РїРѕ РµРєСЂР°ну */}
      <div className="app-bg-orb" />
      <div className="app-bg-orb" />
      <div className="app-bg-orb" />
      <div className="app-bg-orb" />
      <div className="app-bg-orb" />
      <div className="app-bg-orb" />
    </div>
  );
}

