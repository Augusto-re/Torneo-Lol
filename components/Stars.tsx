export default function Stars({ value }: { value: number }) {
  const pct = (Math.max(0, Math.min(5, value)) / 5) * 100;
  return (
    <span className="stars" title={`${value} estrellas`}>
      <span className="stars-track">
        <span className="stars-bg">★★★★★</span>
        <span className="stars-fg" style={{ width: `${pct}%` }}>
          ★★★★★
        </span>
      </span>
      <span className="stars-num">{value.toFixed(1)}</span>
    </span>
  );
}
