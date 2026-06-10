"use client";

import { ArrowRight, Check, RefreshCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Answers = Record<string, unknown>;

interface SessionState {
  sessionId: string;
  version: number;
  currentStep: string;
  completedSteps: string[];
  status: "draft" | "completed";
}

const initialAnswers = {
  gender: "female",
  ageRange: "30_39",
  currentBodyShape: "mid_sized",
  goalType: "lose_weight",
  bodyZones: ["belly", "legs"],
  desiredBodyShape: "toned",
  age: 32,
  heightCm: 168,
  currentWeightKg: 74,
  targetWeightKg: 65,
  activityLevel: "moderate",
  exerciseFrequency: "3_4_week",
  typicalDay: "active_breaks",
  sleepHours: "7_8",
  waterIntake: "medium",
  dietPreference: "traditional",
  physicalLimitations: [] as string[],
  healthDataConsent: true
};

const steps = [
  { title: "基础画像", apiStep: "profile" },
  { title: "目标方向", apiStep: "goal" },
  { title: "关注区域", apiStep: "goal" },
  { title: "身体数据", apiStep: "body" },
  { title: "活动节奏", apiStep: "activity" },
  { title: "生活习惯", apiStep: "habits" },
  { title: "身体限制", apiStep: "habits" },
  { title: "确认提交", apiStep: "body" }
];

const apiStepToVisualIndex: Record<string, number> = {
  profile: 0,
  goal: 1,
  body: 3,
  activity: 4,
  habits: 5
};

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {})
    }
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.error?.message ?? "Request failed");
  }
  return json;
}

function optionClass(active: boolean) {
  return active ? "choice choiceActive" : "choice";
}

function compactAnswers(values: Answers) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => {
      if (value === null || value === undefined) return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    })
  );
}

export default function HomePage() {
  const [session, setSession] = useState<SessionState | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState(initialAnswers);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const step = steps[stepIndex];
  const progress = useMemo(() => Math.round(((stepIndex + 1) / steps.length) * 100), [stepIndex]);

  useEffect(() => {
    async function boot() {
      try {
        setLoading(true);
        const created = await apiFetch<SessionState>("/api/sessions", {
          method: "POST",
          body: JSON.stringify({ flowTopic: "healthgate_weight_management_v1", resumeExisting: true })
        });
        if (created.status === "completed") {
          window.location.href = `/result?sessionId=${created.sessionId}`;
          return;
        }
        setSession(created);
        const restored = await apiFetch<{
          session: { currentStep: string; answers: { required: Answers; extra: Answers } };
        }>(
          `/api/sessions/${created.sessionId}`
        );
        setAnswers((current) => ({
          ...current,
          ...compactAnswers(restored.session.answers.required),
          ...compactAnswers(restored.session.answers.extra)
        }));
        setStepIndex(apiStepToVisualIndex[restored.session.currentStep] ?? 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : "初始化失败");
      } finally {
        setLoading(false);
      }
    }
    void boot();
  }, []);

  function patchAnswer(next: Partial<typeof initialAnswers>) {
    setAnswers((current) => ({ ...current, ...next }));
  }

  function payloadForCurrentStep() {
    if (stepIndex === 0) {
      return {
        gender: answers.gender,
        ageRange: answers.ageRange,
        currentBodyShape: answers.currentBodyShape
      };
    }
    if (stepIndex === 1) return { goalType: answers.goalType };
    if (stepIndex === 2) return { bodyZones: answers.bodyZones, desiredBodyShape: answers.desiredBodyShape };
    if (stepIndex === 3) {
      return {
        age: Number(answers.age),
        heightCm: Number(answers.heightCm),
        currentWeightKg: Number(answers.currentWeightKg),
        targetWeightKg: Number(answers.targetWeightKg)
      };
    }
    if (stepIndex === 4) {
      return {
        activityLevel: answers.activityLevel,
        exerciseFrequency: answers.exerciseFrequency,
        typicalDay: answers.typicalDay
      };
    }
    if (stepIndex === 5) {
      return {
        sleepHours: answers.sleepHours,
        waterIntake: answers.waterIntake,
        dietPreference: answers.dietPreference
      };
    }
    if (stepIndex === 6) return { physicalLimitations: answers.physicalLimitations };
    return { healthDataConsent: true };
  }

  async function saveAndNext() {
    if (!session) return;
    try {
      setSaving(true);
      setError(null);
      const saved = await apiFetch<SessionState>(`/api/sessions/${session.sessionId}/steps/${step.apiStep}`, {
        method: "PATCH",
        body: JSON.stringify({ expectedVersion: session.version, answers: payloadForCurrentStep() })
      });
      setSession(saved);
      if (stepIndex < steps.length - 1) {
        setStepIndex((current) => current + 1);
      } else {
        const submitted = await apiFetch<{ next: string }>(`/api/sessions/${session.sessionId}/submit`, {
          method: "POST",
          body: JSON.stringify({ expectedVersion: saved.version })
        });
        window.location.href = submitted.next;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="shell">
        <section className="workspace loading">正在恢复测评进度...</section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="workspace">
        <div className="visualPanel" aria-hidden="true">
          <div className="imageWash" />
          <div className="visualCopy">
            <span>HealthGate</span>
            <strong>把身体数据变成可执行的健康计划</strong>
          </div>
        </div>

        <div className="funnelPanel">
          <div className="topbar">
            <div>
              <p className="eyebrow">第 {stepIndex + 1} 步 / {steps.length}</p>
              <h1>{step.title}</h1>
            </div>
            <div className="progressRing">{progress}%</div>
          </div>
          <div className="progressTrack">
            <span style={{ width: `${progress}%` }} />
          </div>

          {stepIndex === 0 && (
            <div className="gridTwo">
              {[
                ["female", "女性"],
                ["male", "男性"],
                ["non_binary", "非二元"],
                ["prefer_not_to_say", "暂不说明"]
              ].map(([value, label]) => (
                <button
                  className={optionClass(answers.gender === value)}
                  key={value}
                  onClick={() => patchAnswer({ gender: value })}
                >
                  <Check size={18} /> {label}
                </button>
              ))}
            </div>
          )}

          {stepIndex === 1 && (
            <div className="gridOne">
              {[
                ["lose_weight", "减重并建立稳定节奏"],
                ["build_strength", "提升力量和线条"],
                ["improve_flexibility", "改善柔韧和活动度"],
                ["reduce_stress", "降低压力并睡得更好"],
                ["improve_posture", "改善体态和久坐不适"]
              ].map(([value, label]) => (
                <button
                  className={optionClass(answers.goalType === value)}
                  key={value}
                  onClick={() => patchAnswer({ goalType: value })}
                >
                  <Check size={18} /> {label}
                </button>
              ))}
            </div>
          )}

          {stepIndex === 2 && (
            <div className="gridTwo">
              {["belly", "butt", "legs", "arms", "back", "chest"].map((zone) => {
                const selected = (answers.bodyZones as string[]).includes(zone);
                return (
                  <button
                    className={optionClass(selected)}
                    key={zone}
                    onClick={() => {
                      const current = answers.bodyZones as string[];
                      patchAnswer({
                        bodyZones: selected ? current.filter((item) => item !== zone) : [...current, zone]
                      });
                    }}
                  >
                    <Check size={18} /> {zone}
                  </button>
                );
              })}
            </div>
          )}

          {stepIndex === 3 && (
            <div className="formGrid">
              {[
                ["age", "年龄"],
                ["heightCm", "身高 cm"],
                ["currentWeightKg", "当前体重 kg"],
                ["targetWeightKg", "目标体重 kg"]
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    type="number"
                    value={answers[key as keyof typeof answers] as number}
                    onChange={(event) => patchAnswer({ [key]: Number(event.target.value) })}
                  />
                </label>
              ))}
            </div>
          )}

          {stepIndex === 4 && (
            <div className="gridOne">
              {[
                ["sedentary", "久坐为主"],
                ["light", "轻度活动"],
                ["moderate", "每周规律运动"],
                ["active", "高活动量"],
                ["very_active", "非常活跃"]
              ].map(([value, label]) => (
                <button
                  className={optionClass(answers.activityLevel === value)}
                  key={value}
                  onClick={() => patchAnswer({ activityLevel: value })}
                >
                  <Check size={18} /> {label}
                </button>
              ))}
            </div>
          )}

          {stepIndex === 5 && (
            <div className="gridTwo">
              {[
                ["sleepHours", "7_8", "睡眠 7-8 小时"],
                ["waterIntake", "medium", "饮水中等"],
                ["dietPreference", "traditional", "常规饮食"]
              ].map(([key, value, label]) => (
                <button className="choice choiceActive" key={key} onClick={() => patchAnswer({ [key]: value })}>
                  <Check size={18} /> {label}
                </button>
              ))}
            </div>
          )}

          {stepIndex === 6 && (
            <div className="gridOne">
              <button
                className={optionClass((answers.physicalLimitations as string[]).length === 0)}
                onClick={() => patchAnswer({ physicalLimitations: [] })}
              >
                <Check size={18} /> 暂无运动限制
              </button>
              <button
                className={optionClass((answers.physicalLimitations as string[]).includes("knee"))}
                onClick={() => patchAnswer({ physicalLimitations: ["knee"] })}
              >
                <Check size={18} /> 膝盖需要低冲击安排
              </button>
            </div>
          )}

          {stepIndex === 7 && (
            <div className="review">
              <Check size={24} />
              <p>我同意使用这些健康数据生成本次演示评估结果。</p>
            </div>
          )}

          {error && <p className="error">{error}</p>}

          <div className="actions">
            <button className="ghost" disabled={stepIndex === 0 || saving} onClick={() => setStepIndex(stepIndex - 1)}>
              <RefreshCcw size={17} /> 返回
            </button>
            <button className="primary" disabled={saving} onClick={saveAndNext}>
              {stepIndex === steps.length - 1 ? "生成结果" : "保存并继续"} <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
