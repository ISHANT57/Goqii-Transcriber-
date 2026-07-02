/**
 * Decorative, non-interactive background for the auth screen — medical-themed
 * motifs (ECG line, hexagons, crosses, dotted grids, soft blobs) rendered in
 * the brand color at low opacity. Purely visual; pointer-events disabled.
 */
export function LoginBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden text-primary"
    >
      {/* Soft brand blobs */}
      <div className="absolute -bottom-24 -left-24 size-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -top-24 right-1/3 size-80 rounded-full bg-primary/5 blur-3xl" />

      {/* Dotted grid — top left */}
      <DotGrid className="left-8 top-12 hidden sm:block" cols={6} rows={5} />
      {/* Dotted grid — bottom right */}
      <DotGrid className="bottom-24 right-16 hidden lg:block" cols={6} rows={5} />

      {/* Wavy lines — top right */}
      <svg
        className="absolute -right-10 top-0 h-72 w-96 opacity-30"
        viewBox="0 0 400 300"
        fill="none"
      >
        {[0, 14, 28, 42, 56, 70].map((o) => (
          <path
            key={o}
            d={`M ${400} ${20 + o} C 300 ${80 + o}, 240 ${-10 + o}, 120 ${70 + o} S -20 ${120 + o}, -40 ${90 + o}`}
            stroke="currentColor"
            strokeWidth="1"
          />
        ))}
      </svg>

      {/* ECG heartbeat line — left/center */}
      <svg
        className="absolute left-8 top-1/2 hidden h-24 w-96 -translate-y-1/2 opacity-40 lg:block"
        viewBox="0 0 500 100"
        fill="none"
      >
        <path
          d="M0 50 H120 L140 50 L155 20 L175 80 L195 35 L210 50 H300"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M300 50 c 8 -18 34 -18 42 0 c 8 -18 34 -18 42 0 c 0 16 -30 34 -42 44 c -12 -10 -42 -28 -42 -44 z"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
        />
      </svg>

      {/* Hexagon cluster — left */}
      <svg
        className="absolute -left-6 top-24 hidden h-64 w-64 opacity-[0.15] md:block"
        viewBox="0 0 200 200"
        fill="none"
      >
        {[
          [40, 40],
          [90, 40],
          [65, 84],
          [115, 84],
          [40, 128],
          [90, 128],
        ].map(([x, y], i) => (
          <Hexagon key={i} cx={x} cy={y} r={24} />
        ))}
      </svg>

      {/* Medical crosses — scattered right/bottom */}
      <Cross className="right-24 top-1/3 opacity-20" size={40} />
      <Cross className="bottom-16 right-1/4 opacity-[0.12]" size={64} />
      <Cross className="left-1/4 bottom-10 hidden opacity-10 md:block" size={28} />
    </div>
  );
}

function DotGrid({
  className,
  cols,
  rows,
}: {
  className?: string;
  cols: number;
  rows: number;
}) {
  const gap = 16;
  return (
    <svg
      className={`absolute opacity-30 ${className ?? ""}`}
      width={cols * gap}
      height={rows * gap}
    >
      {Array.from({ length: rows }).map((_, r) =>
        Array.from({ length: cols }).map((_, c) => (
          <circle
            key={`${r}-${c}`}
            cx={c * gap + 3}
            cy={r * gap + 3}
            r={2}
            fill="currentColor"
          />
        )),
      )}
    </svg>
  );
}

function Hexagon({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const pts = Array.from({ length: 6 }).map((_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  });
  return (
    <polygon points={pts.join(" ")} stroke="currentColor" strokeWidth="1.5" fill="none" />
  );
}

function Cross({ className, size }: { className?: string; size: number }) {
  return (
    <svg
      className={`absolute ${className ?? ""}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" />
    </svg>
  );
}
