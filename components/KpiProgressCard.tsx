import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { colors, radius, space, type } from "@/lib/theme";
import { getMyKpiProgress } from "@/lib/tasks";
import type { KpiPeriod, KpiProgressRow } from "@/lib/types";
import Card from "@/components/ui/Card";

const PERIOD_LABEL: Record<KpiPeriod, string> = {
  daily: "today",
  weekly: "this week",
  monthly: "this month",
};

function Bar({ pct }: { pct: number }) {
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: "hidden" }}>
      <View
        style={{
          width: `${Math.min(100, pct)}%`,
          height: "100%",
          borderRadius: 3,
          backgroundColor: pct >= 100 ? colors.success : colors.steel,
        }}
      />
    </View>
  );
}

function MetricRow({
  label,
  achieved,
  target,
  bonus,
  unit,
  period,
}: {
  label: string;
  achieved: number;
  target: number | null;
  bonus: number;
  unit: "pts" | "RM" | "hrs";
  period: KpiPeriod;
}) {
  if (target == null) return null;
  const pct = target > 0 ? Math.round((achieved / target) * 100) : 0;
  const achievedLabel = unit === "RM" ? `RM${achieved.toFixed(0)}` : unit === "hrs" ? achieved.toFixed(1) : achieved;
  const targetLabel = unit === "RM" ? `RM${target}` : unit === "hrs" ? `${target}h` : `${target} pts`;
  return (
    <View style={{ marginTop: space.sm + 2 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
        <Text style={{ fontSize: 12, color: colors.muted, fontWeight: "600" }}>
          {label} · {PERIOD_LABEL[period]}
        </Text>
        <Text style={{ ...type.mono, color: colors.ink }}>
          {achievedLabel} / {targetLabel}
        </Text>
      </View>
      <Bar pct={pct} />
      {bonus > 0 && (
        <Text style={{ fontSize: 11.5, color: colors.successFg, fontWeight: "700", marginTop: 4 }}>
          🎉 RM{bonus.toFixed(0)} bonus unlocked
        </Text>
      )}
    </View>
  );
}

// A worker's own KPI progress, shown on the home screen when their org has
// KPI tracking on and at least one metric has a target. See supabase/kpi.sql
// (kpi_progress RPC) — a worker's session only ever gets their own row back.
export default function KpiProgressCard() {
  const [row, setRow] = useState<KpiProgressRow | null>(null);

  useEffect(() => {
    getMyKpiProgress().then(setRow).catch(() => {});
  }, []);

  if (!row) return null;
  const showTask = row.task_enabled && row.task_target != null;
  const showMoney = row.money_enabled && row.money_target != null;
  const showHours = row.hours_enabled && row.hours_target != null;
  if (!showTask && !showMoney && !showHours) return null;

  return (
    <Card variant="flat" padding="md" style={{ marginHorizontal: space.lg, marginBottom: space.lg, borderRadius: radius.md }}>
      <Text style={{ ...type.label, color: colors.muted }}>Your KPI</Text>
      {showTask && (
        <MetricRow
          label="Tasks"
          achieved={row.task_achieved}
          target={row.task_target}
          bonus={row.task_bonus}
          unit="pts"
          period={row.task_period}
        />
      )}
      {showMoney && (
        <MetricRow
          label="Money collected"
          achieved={row.money_achieved}
          target={row.money_target}
          bonus={row.money_bonus}
          unit="RM"
          period={row.money_period}
        />
      )}
      {showHours && (
        <MetricRow
          label="Hours worked"
          achieved={row.hours_achieved}
          target={row.hours_target}
          bonus={row.hours_bonus}
          unit="hrs"
          period={row.hours_period}
        />
      )}
    </Card>
  );
}
