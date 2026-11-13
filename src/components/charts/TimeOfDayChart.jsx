/**
 * E. Time-of-day analysis (column chart): when urges were logged, grouped
 * into 1-, 3- or 6-hour blocks of the local day.
 */
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ChartCard from "./ChartCard.jsx";
import { TooltipBox } from "./chartParts.jsx";
import { AXIS_COLOR, AXIS_TICK, GRID_COLOR, NO_ANIMATION, SERIES_COLOR } from "./chartTheme.js";
import { SegmentedControl } from "../ui/controls.jsx";
import { formatPercent } from "../../utils/text.js";

const BLOCK_OPTIONS = [
  { value: 1, label: "Hourly" },
  { value: 3, label: "3 hours" },
  { value: 6, label: "6 hours" },
];

function TimeTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const block = payload[0].payload;
  return (
    <TooltipBox
      title={block.rangeLabel}
      rows={[
        { key: "count", label: "Urges", value: block.urgeEvents },
        { key: "share", label: "Share of urges", value: formatPercent(block.shareOfUrges) },
      ]}
    />
  );
}

/** @param {Array} blocks  result of buildTimeOfDayDistribution() */
export default function TimeOfDayChart({ blocks, blockHours, onBlockHoursChange }) {
  const total = blocks.reduce((sum, block) => sum + block.urgeEvents, 0);
  // Hourly blocks are labelled by their start ("5 PM"); wider ones by the range.
  const data = blocks.map((block) => ({
    ...block,
    rangeLabel: blockHours === 1 ? `${block.label} hour` : block.label,
  }));

  return (
    <ChartCard
      title="Time of day"
      subtitle="When the urges you logged happened, in your local time."
      isEmpty={total === 0}
      emptyMessage="Log an urge to see when urges tend to happen."
      controls={<SegmentedControl label="Block size" options={BLOCK_OPTIONS} value={blockHours} onChange={onBlockHoursChange} />}
      note="Based on the time recorded for each urge. If you often log later than the urge happened, adjust the time when logging."
      table={{
        caption: "Urges by time of day",
        columns: [
          { key: "label", label: "Time" },
          { key: "urgeEvents", label: "Urges", isNumber: true },
          { key: "share", label: "% of urges", isNumber: true },
        ],
        rows: data.map((block) => ({ key: block.startHour, label: block.rangeLabel, urgeEvents: block.urgeEvents, share: formatPercent(block.shareOfUrges) })),
      }}
    >
      <div className="chart-frame">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID_COLOR} />
            <XAxis
              dataKey="shortLabel"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: AXIS_COLOR }}
              // Hourly view: label every third hour so the axis stays readable.
              interval={blockHours === 1 ? 2 : 0}
            />
            <YAxis allowDecimals={false} width={30} tick={AXIS_TICK} tickLine={false} axisLine={false} />
            <Tooltip content={<TimeTooltip />} cursor={{ fill: "var(--surface-2)" }} />
            <Bar dataKey="urgeEvents" fill={SERIES_COLOR} radius={[4, 4, 0, 0]} maxBarSize={24} {...NO_ANIMATION} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
