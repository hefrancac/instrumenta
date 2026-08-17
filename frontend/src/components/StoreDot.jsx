import { memo } from "react";

function StoreDot({ store, size = 22 }) {
  return (
    <div className="rounded-lg flex items-center justify-center ff-d font-bold text-white shrink-0"
      style={{ background: store.color, width: size, height: size, fontSize: size * 0.5 }}>
      {store.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
    </div>
  );
}

export default memo(StoreDot);
