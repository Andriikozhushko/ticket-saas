"use client";

type Props = {
  value: number;
  min?: number;
  max?: number;
  onChange: (n: number) => void;
};

export default function QuantitySelector({ value, min = 1, max = 20, onChange }: Props) {
  const canDecrease = value > min;
  const canIncrease = value < max;

  return (
    <div className="event-qty-wrap">
      <button
        type="button"
        aria-label="Зменшити"
        disabled={!canDecrease}
        onClick={() => canDecrease && onChange(value - 1)}
        className="event-qty-btn"
      >
        -
      </button>
      <span key={value} className="event-qty-value bump">
        {value}
      </span>
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
