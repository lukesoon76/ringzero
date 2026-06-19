/**
 * The demo agent is deliberately THIN — the point is that the kernel governs it,
 * not that it is clever. It can optionally use a live LLM (any provider via env)
 * to draft the memo prose, but that output is NON-BINDING: governance decisions
 * are made deterministically by the kernel regardless of what the agent says.
 *
 * Offline by default (canned). Set RING_ZERO_LLM=1 with ANTHROPIC_API_KEY to use
 * a live model for the (non-binding) draft text.
 */

export interface AgentDraft {
  readonly source: "llm" | "canned";
  readonly memo: string;
}

export async function draftCreditMemo(coverageRatio: number): Promise<AgentDraft> {
  const canned = `Borrower meets covenants; interest-coverage ratio ${coverageRatio.toFixed(
    2,
  )}. Recommend approval subject to authenticated sign-off.`;

  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (process.env["RING_ZERO_LLM"] !== "1" || !apiKey) {
    return { source: "canned", memo: canned };
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
        max_tokens: 200,
        messages: [
          {
            role: "user",
            content: `Draft a one-sentence credit-memo conclusion for an interest-coverage ratio of ${coverageRatio.toFixed(
              2,
            )}. Concise, neutral.`,
          },
        ],
      }),
    });
    const json = (await res.json()) as { content?: Array<{ text?: string }> };
    return { source: "llm", memo: json.content?.[0]?.text ?? canned };
  } catch {
    return { source: "canned", memo: canned };
  }
}
