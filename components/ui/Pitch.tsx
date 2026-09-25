import { COMPANY_BY_ID, type CompanyId } from "@/lib/companies";
import { direction, pct } from "@/lib/format";
import { Icon } from "./Icon";

export type Slot = {
  id: CompanyId | null;
  /** Plate bottom line: a return (number, fraction) or a label like "33.3%". */
  value?: number | string;
};

type Props = {
  slots: Slot[];
  height: number;
  mini?: boolean;
  tag?: React.ReactNode;
  rowGap?: number;
  colGap?: number;
  padTop?: number;
  pop?: boolean;
  onRemove?: (id: CompanyId) => void;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
  /** "row": all three side by side, centre pick raised (compact mobile pitch). */
  layout?: "formation" | "row";
};

/** Your squad on the pitch: one pick up top, two below. */
export function Pitch({ slots, height, mini, tag, rowGap, colGap, padTop, pop, onRemove, label, className, style, layout }: Props) {
  const [top, ...bottom] = slots;
  const aria =
    label ??
    "Squad: " +
      slots
        .filter((s) => s.id)
        .map((s) => `${COMPANY_BY_ID[s.id!].name}${typeof s.value === "number" ? ` ${pct(s.value)}` : ""}`)
        .join(", ");
  return (
    <div className={["pitch", className ?? ""].join(" ")} style={{ height, ...style }} role={onRemove ? "group" : "img"} aria-label={aria}>
      <span className="pitch-circle" aria-hidden="true" />
      {tag && <div className="pitch-tag">{tag}</div>}
      <div
        className="formation"
        style={
          {
            "--row-gap": `${rowGap ?? (mini ? 10 : 20)}px`,
            "--col-gap": `${colGap ?? (mini ? 80 : 110)}px`,
            "--pad-top": `${padTop ?? (tag ? 40 : 0)}px`,
          } as React.CSSProperties
        }
      >
        {layout === "row" ? (
          <div className="line" style={{ alignItems: "flex-start" }}>
            {[1, 0, 2].map((i) =>
              slots[i] ? (
                <div key={i} style={{ paddingTop: i === 0 ? 0 : 24 }}>
                  <Kit slot={slots[i]} n={i + 1} mini={mini} pop={pop} onRemove={onRemove} />
                </div>
              ) : null,
            )}
          </div>
        ) : (
          <>
            <div className="line">{top && <Kit slot={top} n={1} mini={mini} pop={pop} onRemove={onRemove} />}</div>
            <div className="line">
              {bottom.map((s, i) => (
                <Kit key={i} slot={s} n={i + 2} mini={mini} pop={pop} onRemove={onRemove} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function Kit({
  slot,
  n,
  mini,
  pop,
  onRemove,
}: {
  slot: Slot;
  n: number;
  mini?: boolean;
  pop?: boolean;
  onRemove?: (id: CompanyId) => void;
}) {
  if (!slot.id) {
    return (
      <div className={["kit", "kit-empty", mini ? "kit-mini" : ""].join(" ")}>
        <div className="kit-shirt">
          <span className="mono-mark" style={{ color: "#fff" }}>
            {n}
          </span>
        </div>
        <div className="plate">
          <div className="n">Pick</div>
          <div className="p">{typeof slot.value === "string" ? slot.value : "Open"}</div>
        </div>
      </div>
    );
  }
  const c = COMPANY_BY_ID[slot.id];
  const v = slot.value;
  const dir = typeof v === "number" ? direction(v) : null;
  return (
    <div className={["kit", mini ? "kit-mini" : "", pop ? "pop" : ""].join(" ")}>
      <div className="kit-shirt" style={{ background: c.fill }}>
        <span className="mono-mark" style={{ color: c.ink }}>
          {c.mono}
        </span>
      </div>
      <div className="plate">
        <div className="n">{c.name}</div>
        <div className={["p", dir === "up" ? "up" : dir === "down" ? "down" : ""].join(" ")}>
          {typeof v === "number" ? pct(v) : v ?? "33.3%"}
        </div>
      </div>
      {onRemove && (
        <button type="button" className="kit-x" aria-label={`Remove ${c.name} from squad`} onClick={() => onRemove(slot.id!)}>
          <Icon name="close" size="sm" strokeWidth={2.6} />
        </button>
      )}
    </div>
  );
}
