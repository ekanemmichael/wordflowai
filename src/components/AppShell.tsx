"use client";

import { useEffect, useState } from "react";
import { DEFAULT_SETTINGS } from "@/lib/store";
import LandingPage from "./LandingPage";
import OperatorConsole from "./OperatorConsole";

const ONBOARDED_KEY = "wordflow:onboarded";
const SETTINGS_KEY = "wordflow:settings";

type OnboardData = { church_name: string; tagline: string; logo_url: string };

export default function AppShell() {
  // null = still reading from localStorage (avoid flash)
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    setOnboarded(localStorage.getItem(ONBOARDED_KEY) === "true");
  }, []);

  const handleEnter = (data: OnboardData) => {
    const settings = {
      ...DEFAULT_SETTINGS,
      church_name: data.church_name,
      tagline: data.tagline,
      logo_url: data.logo_url,
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    localStorage.setItem(ONBOARDED_KEY, "true");
    setOnboarded(true);
  };

  // Still hydrating — show nothing to avoid flash
  if (onboarded === null) {
    return <div className="min-h-screen bg-[#07070c]" />;
  }

  if (!onboarded) {
    return <LandingPage onEnter={handleEnter} />;
  }

  return <OperatorConsole />;
}
