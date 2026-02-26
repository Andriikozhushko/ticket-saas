"use client";

/**
 * Анімований фон: блукаючі блоби (розмиті плями) + орби (світлові точки).
 * Використовується в Shell — однаково на всіх сторінках (головна, події, мої квитки, про нас, замовлення).
 */
export function AnimatedBackground() {
  return (
    <div className="app-animated-bg" aria-hidden>
      {/* 3 великі розмиті блоби */}
      <div className="app-bg-blob-wrap">
        <div className="app-bg-blob" />
      </div>
      <div className="app-bg-blob-wrap">
        <div className="app-bg-blob" />
      </div>
      <div className="app-bg-blob-wrap">
        <div className="app-bg-blob" />
      </div>
      {/* 6 орбів, що рухаються по екрану */}
      <div className="app-bg-orb" />
      <div className="app-bg-orb" />
      <div className="app-bg-orb" />
      <div className="app-bg-orb" />
      <div className="app-bg-orb" />
      <div className="app-bg-orb" />
    </div>
  );
}
