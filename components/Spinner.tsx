export function Spinner({ texto }: { texto?: string }) {
  return (
    <div className="spin-wrap">
      <div className="spin" />
      {texto && <div className="spin-txt">{texto}</div>}
    </div>
  );
}
