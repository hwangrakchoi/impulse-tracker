/**
 * C. Most frequently recorded emotions (ranked horizontal bars).
 * Counts INDIVIDUAL emotion selections; each bar is tinted with the color of
 * the emotion's category.
 */
import { Bar, BarChart, LabelList, Rectangle, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ChartCard from "./ChartCard.jsx";
import { ChartLegend, TooltipBox } from "./chartParts.jsx";
import { AXIS_COLOR, AXIS_TICK, NO_ANIMATION, estimateAxisWidth, truncateLabel } from "./chartTheme.js";
import { CHART_CATEGORY_ORDER, getCategory } from "../../data/emotionTaxonomy.js";
import { formatPercent, pluralize } from "../../utils/text.js";

const MAX_BARS = 10;

function EmotionTooltip({ active, payload, urgeEvents }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <TooltipBox
      title={item.displayName}
      rows={[
        { key: "count", label: "Times selected", value: item.count, color: item.fill },
        { key: "share", label: `Share of ${pluralize(urgeEvents, "urge")}`, value: formatPercent(item.shareOfUrges) },
      ]}
      footer={getCategory(item.categoryId)?.label}
    />
  );
}

// Each bar takes the color stored on its own data row.
const renderBar = (props) => <Rectangle {...props} fill={props.payload.fill} />;

/** @param {object} selections  result of countEmotionSelections() */
export default function TopEmotionsChart({ selections, title = "Most recorded emotions" }) {
  const { emotions, urgeEvents, emotionSelections } = selections;
  const top = emotions.slice(0, MAX_BARS).map((item) => ({
    ...item,
    fill: `var(${item.colorVar})`,
    // Text printed at the end of the bar, e.g. "7 · 58%".
    valueLabel: `${item.count} · ${formatPercent(item.shareOfUrges)}`,
  }));
  const categoriesShown = CHART_CATEGORY_ORDER.filter((categoryId) => top.some((item) => item.categoryId === categoryId));

  return (
    <ChartCard
      title={title}
      subtitle={
        emotions.length > MAX_BARS
          ? `The ${MAX_BARS} emotions you selected most often, out of ${emotions.length}.`
          : "The individual emotions you selected most often."
      }
      isEmpty={emotions.length === 0}
      emptyMessage="Log an urge to see which emotions you select most."
      note={`Counts emotion selections (${emotionSelections} in total). The percentage is the share of urges (${urgeEvents}) that included the emotion.`}
      table={{
        caption: "How often each emotion was selected",
        columns: [
          { key: "displayName", label: "Emotion" },
          { key: "category", label: "Category" },
          { key: "count", label: "Times selected", isNumber: true },
          { key: "share", label: "% of urges", isNumber: true },
        ],
        rows: emotions.map((item) => ({
          key: item.emotionId,
          displayName: item.displayName,
          category: getCategory(item.categoryId)?.label ?? "–",
          count: item.count,
          share: formatPercent(item.shareOfUrges),
        })),
      }}
    >
      <div className="chart-frame">
        <ResponsiveContainer width="100%" height={top.length * 36 + 16}>
          {/* The right margin leaves room for the "15 · 43%" label after the longest bar. */}
          <BarChart data={top} layout="vertical" margin={{ top: 0, right: 84, bottom: 0, left: 0 }} barSize={16}>
            <XAxis type="number" hide domain={[0, "dataMax"]} />
            <YAxis
              type="category"
              dataKey="displayName"
              width={estimateAxisWidth(top.map((item) => truncateLabel(item.displayName, 20)))}
              tick={{ ...AXIS_TICK, fill: "var(--text-secondary)" }}
              tickFormatter={(name) => truncateLabel(name, 20)}
              tickLine={false}
              axisLine={{ stroke: AXIS_COLOR }}
              interval={0}
            />
            <Tooltip content={<EmotionTooltip urgeEvents={urgeEvents} />} cursor={{ fill: "var(--surface-2)" }} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} shape={renderBar} {...NO_ANIMATION}>
              <LabelList dataKey="valueLabel" position="right" fill="var(--text-secondary)" fontSize={12} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend
        items={categoriesShown.map((categoryId) => {
          const category = getCategory(categoryId);
          return { key: categoryId, label: category.label, color: `var(${category.colorVar})` };
        })}
      />
    </ChartCard>
  );
}
