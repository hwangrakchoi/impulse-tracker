/**
 * A. Emotional category distribution (donut chart).
 *
 * Each slice = the number of urges that involved that category. An urge with
 * emotions from two categories appears in both slices, which is why the
 * "% of urges" figures can add up to more than 100% – the card says so.
 */
import { Pie, PieChart, ResponsiveContainer, Sector, Tooltip } from "recharts";
import ChartCard from "./ChartCard.jsx";
import { TooltipBox } from "./chartParts.jsx";
import { NO_ANIMATION } from "./chartTheme.js";
import { formatPercent, pluralize } from "../../utils/text.js";

function DonutTooltip({ active, payload, urgeEvents }) {
  if (!active || !payload?.length) return null;
  const slice = payload[0].payload;
  return (
    <TooltipBox
      title={slice.label}
      rows={[{ key: "events", label: `of ${pluralize(urgeEvents, "urge")}`, value: `${slice.events} · ${formatPercent(slice.shareOfUrges)}`, color: slice.fill }]}
    />
  );
}

// Draws one slice in its category color, with a thin gap in the card color
// separating it from its neighbours.
const renderSlice = (props) => <Sector {...props} fill={props.payload.fill} stroke="var(--surface)" strokeWidth={2} />;

/** @param {object} involvement  result of countCategoryInvolvement() */
export default function CategoryDonut({ involvement, title = "Emotion categories", subtitle }) {
  const { categories, urgeEvents } = involvement;
  const slices = categories
    .filter((category) => category.events > 0)
    .map((category) => ({ ...category, fill: `var(${category.colorVar})` }));

  return (
    <ChartCard
      title={title}
      subtitle={subtitle ?? "How many urges involved each primary emotion category."}
      isEmpty={urgeEvents === 0}
      emptyMessage="Log an urge to see which emotion categories come up."
      note="An urge with emotions from more than one category counts once in each of them, so the percentages can add up to more than 100%. Choosing several emotions from the same category still counts that category only once per urge."
      table={{
        caption: "Number and share of urges involving each emotion category",
        columns: [
          { key: "label", label: "Category" },
          { key: "events", label: "Urges involving it", isNumber: true },
          { key: "share", label: "% of urges", isNumber: true },
        ],
        rows: categories.map((category) => ({
          key: category.categoryId,
          label: category.label,
          events: category.events,
          share: formatPercent(category.shareOfUrges),
        })),
      }}
    >
      <div className="donut-layout">
        <div className="donut-wrap chart-frame">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={slices}
                dataKey="events"
                nameKey="label"
                innerRadius="64%"
                outerRadius="100%"
                startAngle={90}
                endAngle={-270}
                shape={renderSlice}
                {...NO_ANIMATION}
              />
              <Tooltip content={<DonutTooltip urgeEvents={urgeEvents} />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="donut-center" aria-hidden="true">
            <span className="donut-center__value">{urgeEvents}</span>
            <span className="donut-center__label">{urgeEvents === 1 ? "urge" : "urges"}</span>
          </div>
        </div>

        {/* The legend doubles as a readable list of the exact numbers. */}
        <ul className="category-legend">
          {categories.map((category) => (
            <li key={category.categoryId}>
              <span className="legend__swatch" style={{ "--swatch": `var(${category.colorVar})` }} aria-hidden="true" />
              <span>{category.label}</span>
              <span className="category-legend__value">
                {category.events} · {formatPercent(category.shareOfUrges)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </ChartCard>
  );
}
