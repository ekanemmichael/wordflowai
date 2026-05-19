import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const OperatorConsole = lazy(() => import("@/components/OperatorConsole"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WordFlow — Live Scripture" },
      { name: "description", content: "Live Bible verse display for worship." },
    ],
  }),
  component: () => (
    <Suspense fallback={<div className="min-h-screen bg-[#07070c]" />}>
      <OperatorConsole />
    </Suspense>
  ),
});
