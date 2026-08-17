import { memo } from "react";

function Logo({ size = 28 }) {
  return (
    <div className="flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <path d="M16 4c-3.2 0-4.8 1.6-8 1.6C5.4 5.6 4 7.6 4 11.2c0 4 1.4 7.6 2.6 11.6C7.4 25.4 8.2 28 10 28c1.7 0 2-2.4 2.6-4.4.5-1.7 1-3 3.4-3s2.9 1.3 3.4 3c.6 2 .9 4.4 2.6 4.4 1.8 0 2.6-2.6 3.4-5.2C28.6 18.8 30 15.2 30 11.2c0-3.6-1.4-5.6-4-5.6-3.2 0-4.8-1.6-8-1.6Z"
          className="fill-primary" />
        <circle cx="16" cy="12.5" r="3.4" fill="#fff" />
        <circle cx="16" cy="12.5" r="1.5" className="fill-amber" />
      </svg>
      <span className="ff-d text-lg font-bold tracking-tight text-ink">
        Instrumenta
      </span>
    </div>
  );
}

export default memo(Logo);
