import type { ChurchSettings } from "@/lib/store";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

type Props = {
  settings: ChurchSettings;
  update: (patch: Partial<ChurchSettings>) => void;
};

const FONT_OPTIONS = [
  "Cinzel",
  "Playfair Display",
  "Cormorant Garamond",
  "EB Garamond",
  "Inter",
  "Montserrat",
  "Lato",
  "Bebas Neue",
];

const TRANSLATIONS = ["KJV", "WEB"];

export function SettingsPanel({ settings: s, update }: Props) {
  return (
    <div className="space-y-6 text-sm">
      <Section title="Church Identity">
        <Field label="Church name">
          <Input
            value={s.church_name}
            onChange={(e) => update({ church_name: e.target.value })}
          />
        </Field>
        <Field label="Tagline">
          <Input
            value={s.tagline}
            onChange={(e) => update({ tagline: e.target.value })}
          />
        </Field>
        <Field label="Logo URL">
          <Input
            placeholder="https://…/logo.png"
            value={s.logo_url}
            onChange={(e) => update({ logo_url: e.target.value })}
          />
        </Field>
        <Toggle
          label="Show logo on verse"
          checked={s.show_logo}
          onChange={(v) => update({ show_logo: v })}
        />
        <Toggle
          label="Show church name"
          checked={s.show_church_name}
          onChange={(v) => update({ show_church_name: v })}
        />
      </Section>

      <Section title="Colors">
        <ColorField
          label="Background"
          value={s.background_color}
          onChange={(v) => update({ background_color: v })}
        />
        <Field label="Background type">
          <Select
            value={s.background_type}
            onValueChange={(v) =>
              update({ background_type: v as ChurchSettings["background_type"] })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="solid">Solid</SelectItem>
              <SelectItem value="gradient">Gradient</SelectItem>
              <SelectItem value="image">Image</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {s.background_type === "gradient" ? (
          <ColorField
            label="Gradient end"
            value={s.gradient_end}
            onChange={(v) => update({ gradient_end: v })}
          />
        ) : null}
        {s.background_type === "image" ? (
          <Field label="Background image URL">
            <Input
              value={s.background_image}
              onChange={(e) => update({ background_image: e.target.value })}
              placeholder="https://…/bg.jpg"
            />
          </Field>
        ) : null}
        <ColorField
          label="Verse text"
          value={s.text_color}
          onChange={(v) => update({ text_color: v })}
        />
        <ColorField
          label="Reference / accent"
          value={s.reference_color}
          onChange={(v) => update({ reference_color: v })}
        />
        <ColorField
          label="Secondary (Jesus' words, badge)"
          value={s.secondary_color}
          onChange={(v) => update({ secondary_color: v })}
        />
      </Section>

      <Section title="Typography">
        <Field label="Verse font">
          <Select
            value={s.verse_font}
            onValueChange={(v) => update({ verse_font: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_OPTIONS.map((f) => (
                <SelectItem key={f} value={f} style={{ fontFamily: f }}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Reference font">
          <Select
            value={s.reference_font}
            onValueChange={(v) => update({ reference_font: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_OPTIONS.map((f) => (
                <SelectItem key={f} value={f} style={{ fontFamily: f }}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={`Verse size — ${s.font_size_verse}px`}>
          <Slider
            value={[s.font_size_verse]}
            min={28}
            max={96}
            step={2}
            onValueChange={([v]) => update({ font_size_verse: v })}
          />
        </Field>
        <Field label="Text alignment">
          <Select
            value={s.text_alignment}
            onValueChange={(v) =>
              update({ text_alignment: v as ChurchSettings["text_alignment"] })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Left</SelectItem>
              <SelectItem value="center">Center</SelectItem>
              <SelectItem value="right">Right</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </Section>

      <Section title="Layout & motion">
        <Field label="Template">
          <Select
            value={s.template}
            onValueChange={(v) =>
              update({ template: v as ChurchSettings["template"] })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="centered-card">Centered card</SelectItem>
              <SelectItem value="full-bleed">Full bleed</SelectItem>
              <SelectItem value="lower-third">Lower third</SelectItem>
              <SelectItem value="cinematic">Cinematic</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Animation">
          <Select
            value={s.animation}
            onValueChange={(v) =>
              update({ animation: v as ChurchSettings["animation"] })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fade-up">Fade up</SelectItem>
              <SelectItem value="fade">Fade</SelectItem>
              <SelectItem value="zoom-soft">Soft zoom</SelectItem>
              <SelectItem value="instant">Instant</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Toggle
          label="Translation badge"
          checked={s.show_translation_badge}
          onChange={(v) => update({ show_translation_badge: v })}
        />
        <Toggle
          label="Red-letter mode (Jesus' words)"
          checked={s.red_letter_mode}
          onChange={(v) => update({ red_letter_mode: v })}
        />
        <Toggle
          label="Powered by WordFlow"
          checked={s.show_powered_by}
          onChange={(v) => update({ show_powered_by: v })}
        />
      </Section>

      <Section title="Translation">
        <Field label="Preferred translation">
          <Select
            value={s.translation}
            onValueChange={(v) => update({ translation: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRANSLATIONS.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <p className="text-xs text-muted-foreground">
          KJV and WEB are public-domain and fetched live. Premium translations
          (NLT, NIV, ESV) require a licensed Bible API — wire up later.
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="font-display text-gold text-xs uppercase tracking-[0.25em]">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-xs">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded-md border border-border bg-transparent"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono text-xs"
        />
      </div>
    </div>
  );
}
