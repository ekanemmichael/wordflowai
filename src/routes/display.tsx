import { createFileRoute } from "@tanstack/react-router";
import { VerseSlide } from "@/components/VerseSlide";
import { useActiveVerse, useSettings } from "@/lib/store";

export const Route = createFileRoute("/display")({
  head: () => ({
    meta: [
      { title: "WordFlow — Live Display" },
      { name: "description", content: "Live verse display for the sanctuary screen." },
    ],
  }),
  component: DisplayPage,
});

function DisplayPage() {
  const { settings } = useSettings();
  const verse = useActiveVerse();
  return (
    <div className="fixed inset-0 h-screen w-screen">
      <VerseSlide settings={settings} verse={verse} />
    </div>
  );
}
