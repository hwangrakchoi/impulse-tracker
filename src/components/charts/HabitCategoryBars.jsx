/**
 * B. Habit and emotion comparison (stacked horizontal bars).
 * One bar per habit; each colored segment = urges for that habit that
 * involved the category.
 */
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ChartCard from "./ChartCard.jsx";
import { ChartLegend, TooltipBox } from "./chartParts.jsx";
import { AXIS_COLOR, AXIS_TICK, GRID_COLOR, NO_ANIMATION, estimateAxisWidth, truncateLabel } from "./chartTheme.js";
import { CHART_CATEGORY_ORDER, getCategory } from "../../data/emotionTaxonomy.js";
import { formatPercent, pluralize, ratio } from "../../utils/text.js";

const CATEGORIES = CHART_CATEGORY_ORDER.map((categoryId) => {
  const category = getCategory(categoryId);
  return { id: categoryId, label: category.label, color: `var(${category.colorVar})` };
});

function HabitTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <TooltipBox
      title={`${row.habitName} · ${pluralize(row.urgeEvents, "urge")}`}
      rows={CATEGORIES.filter((category) => row[category.id] > 0).map((category) => ({
        key: category.id,
        label: category.label,
        value: `${row[category.id]} · ${formatPercent(ratio(row[category.id], row.urgeEvents))}`,
        color: category.color,
      }))}
    />
  );
}

/** @param {Array} rows  result of buildHabitCategoryMatrix() */
export default function HabitCategoryBars({ rows }) {
  const labels = rows.map((row) => truncateLabel(row.habitName));
  return (
    <ChartCard
      title="Emotions by habit"
      subtitle="Which emotion categories were recorded with each habit."
      isEmpty={rows.length === 0}
      emptyMessage="Log urges for your habits to compare them here."
      note="Segments count urges involving a category. Because one urge can involve several categories, a bar can be longer than that habit's number of urges."
      table={{
        caption: "Urges involving each emotion category, per habit",
        columns: [
          { key: "habitName", label: "Habit" },
          { key: "urgeEvents", label: "Urges", isNumber: true },
          ...CATEGORIES.map((category) => ({ key: category.id, label: category.label, isNumber: true })),
        ],
        rows: rows.map((row) => ({ key: row.habitId, ...row, habitName: row.isArchived ? `${row.habitName} (archived)` : row.habitName })),
      }}
    >
      <div className="chart-frame">
        {/* Height grows with the number of habits so bars never get squashed. */}
        <ResponsiveContainer width="100%" height={rows.length * 44 + 44}>
          <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 0 }} barSize={20}>
            <CartesianGrid horizontal={false} stroke={GRID_COLOR} />
            <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} />
            <YAxis
              type="category"
              dataKey="habitName"
              width={estimateAxisWidth(labels)}
              tick={AXIS_TICK}
              tickFormatter={(name) => truncateLabel(name)}
              tickLine={false}
              axisLine={{ stroke: AXIS_COLOR }}
            />
            <Tooltip content={<HabitTooltip />} cursor={{ fill: "var(--surface-2)" }} />
            {CATEGORIES.map((category) => (
              <Bar
                key={category.id}
                dataKey={category.id}
                name={category.label}
                stackId="categories"
                fill={category.color}
                // A 2px outline in the card color leaves a small gap between segments.
                stroke="var(--surface)"
                strokeWidth={2}
                {...NO_ANIMATION}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend items={CATEGORIES.map((category) => ({ key: category.id, label: category.label, color: category.color }))} />
    </ChartCard>
  );
}
