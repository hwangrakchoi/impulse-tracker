/**
 * D. Trigger frequency over time (line chart): logged urges per day or week.
 */
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ChartCard from "./ChartCard.jsx";
import { TooltipBox } from "./chartParts.jsx";
import { AXIS_COLOR, AXIS_TICK, GRID_COLOR, NO_ANIMATION, SERIES_COLOR } from "./chartTheme.js";
import { SegmentedControl } from "../ui/controls.jsx";
import { pluralize } from "../../utils/text.js";

const GRANULARITY_OPTIONS = [
  { value: "day", label: "By day" },
  { value: "week", label: "By week" },
];

function FrequencyTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return <TooltipBox title={point.label} rows={[{ key: "count", label: "Urges logged", value: point.urgeEvents }]} />;
}

/**
 * @param {Array}  series       result of buildFrequencySeries()
 * @param {string} granularity  "day" | "week"
 * @param {string} color        line color (defaults to the neutral series color)
 */
export default function FrequencyChart({ series, granularity, onGranularityChange, color = SERIES_COLOR, title = "Logged urges over time" }) {
  const total = series.reduce((sum, point) => sum + point.urgeEvents, 0);
  // With many points the dots would crowd the line, so only show them for short
  // ranges. Hovering or tapping still highlights the nearest point.
  const showDots = series.length <= 14;

  return (
    <ChartCard
      title={title}
      subtitle={`${pluralize(total, "urge")} logged, ${granularity === "week" ? "per week" : "per day"}.`}
      isEmpty={total === 0}
      emptyMessage="Nothing logged in this period yet."
      controls={<SegmentedControl label="Group by" options={GRANULARITY_OPTIONS} value={granularity} onChange={onGranularityChange} />}
      note="This shows how often you logged, not how you are doing. A rise can simply mean you are noticing and recording urges more consistently."
      table={{
        caption: `Urges logged per ${granularity}`,
        columns: [
          { key: "label", label: granularity === "week" ? "Week" : "Day" },
          { key: "urgeEvents", label: "Urges logged", isNumber: true },
        ],
        // Only periods with entries – a long list of zeros helps nobody.
        rows: series.filter((point) => point.urgeEvents > 0).map((point) => ({ key: point.key, label: point.label, urgeEvents: point.urgeEvents })),
      }}
    >
      <div className="chart-frame">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID_COLOR} />
            <XAxis dataKey="shortLabel" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: AXIS_COLOR }} minTickGap={28} />
            <YAxis allowDecimals={false} width={30} tick={AXIS_TICK} tickLine={false} axisLine={false} />
            <Tooltip content={<FrequencyTooltip />} cursor={{ stroke: AXIS_COLOR }} />
            <Line
              type="linear"
              dataKey="urgeEvents"
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={showDots ? { r: 3, fill: color, stroke: "var(--surface)", strokeWidth: 1.5 } : false}
              activeDot={{ r: 5, fill: color, stroke: "var(--surface)", strokeWidth: 2 }}
              {...NO_ANIMATION}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
