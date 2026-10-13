import type { FallacyFlag } from "./types";

interface FallacyRule {
  type: string;
  label: string;
  patterns: RegExp[];
  explanation: string;
  severity: "low" | "medium" | "high";
}

const RULES: FallacyRule[] = [
  {
    type: "ad_hominem",
    label: "Ad Hominem",
    patterns: [/you('re| are) (stupid|dumb|ignorant|an idiot|a fool)/i, /\bidiot\b|\bmoron\b|\bclueless\b/i, /attack.*person/i],
    explanation: "Attacks the person instead of the argument. Focus on claims and evidence, not character.",
    severity: "high",
  },
  {
    type: "strawman",
    label: "Strawman",
    patterns: [/so you('re| are) saying/i, /everyone knows/i, /nobody (really )?believes/i],
    explanation: "Possible strawman: restating the opponent's position in an exaggerated way. Steelman instead.",
    severity: "medium",
  },
  {
    type: "slippery_slope",
    label: "Slippery Slope",
    patterns: [/will (inevitably|definitely) lead to/i, /slippery slope/i, /then.*then.*then.*(collapse|disaster|chaos)/i, /open the floodgates/i],
    explanation: "Assumes one step inevitably causes extreme outcomes without showing the causal chain.",
    severity: "medium",
  },
  {
    type: "false_dilemma",
    label: "False Dilemma",
    patterns: [/either.*or.*no (other|middle)/i, /only two (choices|options)/i, /you('re| are) either with us or against/i],
    explanation: "Presents only two options when more exist. Acknowledge the spectrum of alternatives.",
    severity: "medium",
  },
  {
    type: "appeal_to_authority",
    label: "Appeal to Authority",
    patterns: [/(scientists|experts|studies) (say|show|prove) (it|this) without/i, /trust me/i, /because I said so/i, /my (teacher|coach|uncle) says/i],
    explanation: "Cites authority without verifiable evidence. Add a source, data point, or mechanism.",
    severity: "low",
  },
  {
    type: "hasty_generalization",
    label: "Hasty Generalization",
    patterns: [/all (politicians|teens|people|students|immigrants)/i, /always\b.*\bnever\b/i, /my friend.*so (all|everyone)/i],
    explanation: "Generalizes from a small sample. Qualify the claim or add representative data.",
    severity: "medium",
  },
  {
    type: "appeal_to_emotion",
    label: "Appeal to Emotion",
    patterns: [/think of the children/i, /how (dare|could) you/i, /disgusting|outrageous|shameful/i],
    explanation: "Relies on emotional language instead of reasons. Pair emotion with evidence.",
    severity: "low",
  },
  {
    type: "circular",
    label: "Circular Reasoning",
    patterns: [/because it('s| is) (true|right|correct) because/i, /it('s| is) true because it('s| is) true/i],
    explanation: "The conclusion restates the premise. Provide an independent reason.",
    severity: "medium",
  },
  {
    type: "bandwagon",
    label: "Bandwagon",
    patterns: [/everyone (agrees|thinks|knows|does)/i, /most people/i, /popular opinion/i],
    explanation: "Claims truth from popularity. Popularity is not proof — add evidence.",
    severity: "low",
  },
  {
    type: "no_evidence",
    label: "Unevidenced Assertion",
    patterns: [/^.{0,40}(is|are) (obviously|clearly) (true|better|worse)/i],
    explanation: "Strong claim without evidence. Add a statistic, example, or mechanism.",
    severity: "low",
  },
];

/** Deterministic, offline fallacy detector. Runs instantly; AI route can augment it. */
export function detectFallacies(text: string): FallacyFlag[] {
  const flags: FallacyFlag[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  for (const rule of RULES) {
    for (const re of rule.patterns) {
      const m = text.match(re);
      if (m) {
        // find the sentence containing the match for a useful span
        const span = sentences.find((s) => re.test(s))?.slice(0, 180);
        flags.push({
          type: rule.type,
          label: rule.label,
          explanation: rule.explanation,
          span,
          severity: rule.severity,
        });
        break; // one flag per rule max
      }
    }
  }
  // Heuristic: very short arguments with absolute language
  if (text.split(/\s+/).length < 20 && /\b(always|never|all|none|everyone|nobody)\b/i.test(text)) {
    if (!flags.some((f) => f.type === "hasty_generalization")) {
      flags.push({
        type: "hasty_generalization",
        label: "Hasty Generalization",
        explanation: "Short argument with absolute language. Qualify with scope and evidence.",
        severity: "low",
      });
    }
  }
  return flags;
}

export const FALLACY_LABELS = RULES.map((r) => ({ type: r.type, label: r.label, explanation: r.explanation }));
