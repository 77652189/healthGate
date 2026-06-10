import { Suspense } from "react";
import ResultClient from "./result-client";

export default function ResultPage() {
  return (
    <Suspense fallback={<main className="shell"><section className="workspace loading">正在读取结果...</section></main>}>
      <ResultClient />
    </Suspense>
  );
}

