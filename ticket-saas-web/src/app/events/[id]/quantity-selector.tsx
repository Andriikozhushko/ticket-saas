"use client";

import { useState, useEffect, useRef } from "react";

type Props = {
  value: number;
  min?: number;
  max?: number;
  onChange: (n: number) => void;
};

export default function QuantitySelector({ value, min = 1, max = 20, onChange }: Props) {
  const canDecrease = value > min;
  const canIncrease = value < max;
  const [bump, setBump] = useState(false);

  const prevValue = useRef(value);
  useEffect(() => {
    if (prevValue.current !== value) {
      prevValue.current = value;
      setBump(true);
      const t = setTimeout(() => setBump(false), 260);
      return () => clearTimeout(t);
    }
  }, [value]);

  return (
    <div className="event-qty-wrap">
      <button
        type="button"
        aria-label="Зменшити"
        disabled={!canDecrease}
        onClick={() => canDecrease && onChange(value - 1)}
        className="event-qty-btn"
      >
        −
      </button>
      <span className={`event-qty-value ${bump ? "bump" : ""}`}>{value}</span>
      <button
        type="button"
        aria-label="Збільшити"
        disabled={!canIncrease}
        onClick={() => canIncrease && onChange(value + 1)}
        className="event-qty-btn"
      >
        +
      </button>
    </div>
  );
}
