import { compactText } from "@/lib/utils";

interface DuckResult {
  AbstractText?: string;
  Heading?: string;
  RelatedTopics?: Array<{ Text?: string } | { Topics?: Array<{ Text?: string }> }>;
}

async function fetchDuckDuckGoSnippet(query: string) {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "JARVIS-2.0/1.0",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return [] as string[];
    }

    const data = (await response.json()) as DuckResult;
    const snippets: string[] = [];

    if (data.AbstractText) {
      const label = data.Heading ? `${data.Heading}: ` : "";
      snippets.push(compactText(`${label}${data.AbstractText}`, 280));
    }

    for (const entry of data.RelatedTopics ?? []) {
      if ("Text" in entry && entry.Text) {
        snippets.push(compactText(entry.Text, 200));
      }

      if ("Topics" in entry) {
        for (const topic of entry.Topics ?? []) {
          if (topic.Text) {
            snippets.push(compactText(topic.Text, 200));
          }
        }
      }

      if (snippets.length >= 3) {
        break;
      }
    }

    return snippets;
  } catch {
    return [] as string[];
  }
}

async function fetchWikipediaSnippet(query: string) {
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=1&namespace=0&format=json`;
    const searchResponse = await fetch(searchUrl, { cache: "no-store" });

    if (!searchResponse.ok) {
      return null;
    }

    const searchData = (await searchResponse.json()) as [
      string,
      string[],
      string[],
      string[],
    ];

    const title = searchData?.[1]?.[0];

    if (!title) {
      return null;
    }

    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const summaryResponse = await fetch(summaryUrl, {
      headers: {
        "User-Agent": "JARVIS-2.0/1.0",
      },
      cache: "no-store",
    });

    if (!summaryResponse.ok) {
      return null;
    }

    const summaryData = (await summaryResponse.json()) as {
      extract?: string;
      title?: string;
    };

    if (!summaryData.extract) {
      return null;
    }

    return compactText(
      `${summaryData.title ?? title}: ${summaryData.extract}`,
      320,
    );
  } catch {
    return null;
  }
}

export async function fetchKnowledgeSnippets(query: string) {
  const cleaned = compactText(query, 200);
  if (cleaned.length < 4) {
    return [];
  }

  const [duck, wiki] = await Promise.all([
    fetchDuckDuckGoSnippet(cleaned),
    fetchWikipediaSnippet(cleaned),
  ]);

  const combined = [...(wiki ? [wiki] : []), ...duck];
  const unique = Array.from(new Set(combined));

  return unique.slice(0, 4);
}
