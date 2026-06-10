"use client";

import { CreditCard, RefreshCcw } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

interface ResultResponse {
  access: "preview" | "full";
  subscriptionStatus: string;
  paywall?: { message: string };
  result: Record<string, unknown>;
}

async function readJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {})
    }
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error?.message ?? "请求失败");
  return json;
}

export default function ResultClient() {
  const params = useSearchParams();
  const sessionId = params.get("sessionId");
  const [data, setData] = useState<ResultResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  async function load() {
    if (!sessionId) {
      setError("缺少 sessionId");
      return;
    }
    try {
      setError(null);
      setData(await readJson<ResultResponse>(`/api/sessions/${sessionId}/result`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "结果读取失败");
    }
  }

  useEffect(() => {
    void load();
  }, [sessionId]);

  async function pay() {
    if (!sessionId) return;
    try {
      setPaying(true);
      await readJson("/pay", {
        method: "POST",
        body: JSON.stringify({
          sessionId,
          idempotencyKey: `browser-${sessionId}`,
          status: "succeeded"
        })
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "支付失败");
    } finally {
      setPaying(false);
    }
  }

  return (
    <main className="shell">
      <section className="resultWorkspace">
        <div className="resultHeader">
          <p className="eyebrow">HealthGate Result</p>
          <h1>{data?.access === "full" ? "完整计划已解锁" : "你的健康评估预览"}</h1>
          <button className="ghost" onClick={load}>
            <RefreshCcw size={17} /> 刷新
          </button>
        </div>

        {error && <p className="error">{error}</p>}
        {!data && !error && <p>正在计算结果...</p>}

        {data && (
          <>
            <div className="metricBand">
              <div>
                <span>BMI</span>
                <strong>{String(data.result.bmi)}</strong>
              </div>
              <div>
                <span>分类</span>
                <strong>{String(data.result.bmiCategory)}</strong>
              </div>
              <div>
                <span>访问级别</span>
                <strong>{data.access}</strong>
              </div>
            </div>

            <section className="summaryBlock">
              <h2>评估摘要</h2>
              <p>{String(data.result.publicSummary)}</p>
              <ul>
                {Array.isArray(data.result.publicRecommendations) &&
                  data.result.publicRecommendations.map((item) => <li key={String(item)}>{String(item)}</li>)}
              </ul>
            </section>

            {data.access === "preview" && (
              <section className="paywall">
                <h2>解锁完整计划</h2>
                <p>{data.paywall?.message}</p>
                <button className="primary" disabled={paying} onClick={pay}>
                  <CreditCard size={18} /> {paying ? "处理中..." : "模拟支付并解锁"}
                </button>
              </section>
            )}

            {data.access === "full" && (
              <section className="fullGrid">
                <div>
                  <span>每日建议摄入</span>
                  <strong>{String(data.result.recommendedCalories)} kcal</strong>
                </div>
                <div>
                  <span>目标日期</span>
                  <strong>{String(data.result.targetDate).slice(0, 10)}</strong>
                </div>
                <div>
                  <span>TDEE</span>
                  <strong>{String(data.result.tdee)}</strong>
                </div>
                <pre>{JSON.stringify(data.result.caloriePlan, null, 2)}</pre>
              </section>
            )}
          </>
        )}
      </section>
    </main>
  );
}

