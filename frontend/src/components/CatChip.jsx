import { memo } from "react";

function CatChip({ cat }) {
  const isInstr = cat === "Instrumental";
  return (
    <span className={`ff-b text-xs font-medium px-2 py-0.5 rounded-full ${isInstr ? "bg-chip-instr text-ink-soft" : "bg-amber-soft text-amber-dk"}`}>
      {cat}
    </span>
  );
}

export default memo(CatChip);
