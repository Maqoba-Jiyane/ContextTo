"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { semanticSearch } from "@/lib/search/api";
import { SemanticSearchMatch } from "@/lib/search/types";

const demoUserId = process.env.NEXT_PUBLIC_DEMO_USER_ID;
const demoOrganizationId = process.env.NEXT_PUBLIC_DEMO_ORGANIZATION_ID;
const demoWorkspaceId = process.env.NEXT_PUBLIC_DEMO_WORKSPACE_ID;

export default function SemanticSearchPage() {
  const [query, setQuery] = useState(
    "What are the requirements for administrative clerk roles?",
  );
  const [limit, setLimit] = useState(5);
  const [matches, setMatches] = useState<SemanticSearchMatch[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState<string | null>(null);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!demoUserId || !demoOrganizationId) {
      setErrorMessage("Missing demo environment values.");
      return;
    }

    if (!query.trim()) {
      setErrorMessage("Search query is required.");
      return;
    }

    setIsSearching(true);
    setErrorMessage(null);

    try {
      const response = await semanticSearch({
        userId: demoUserId,
        payload: {
          organizationId: demoOrganizationId,
          workspaceId: demoWorkspaceId || undefined,
          query,
          limit,
        },
      });

      setMatches(response.matches);
      setLastQuery(response.query);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <section>
          <Link
            href="/dashboard/documents"
            className="text-sm font-medium text-blue-400 hover:text-blue-300"
          >
            ← Back to documents
          </Link>

          <p className="mt-6 text-sm font-medium text-blue-400">Contexto</p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Semantic Search
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Search across extracted document chunks using vector similarity.
            This is the retrieval layer of the RAG engine.
          </p>
        </section>

        {errorMessage && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {errorMessage}
          </div>
        )}

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
          <form onSubmit={handleSearch} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300">
                Search query
              </label>

              <textarea
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                rows={4}
                className="mt-2 w-full resize-none rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-blue-500"
                placeholder="Ask something from your uploaded documents..."
              />
            </div>

            <div className="max-w-xs">
              <label className="block text-sm font-medium text-slate-300">
                Number of matches
              </label>

              <input
                type="number"
                min={1}
                max={20}
                value={limit}
                onChange={(event) => setLimit(Number(event.target.value))}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={isSearching}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSearching ? "Searching..." : "Run semantic search"}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Search results</h2>

              {lastQuery && (
                <p className="mt-1 text-sm text-slate-400">
                  Results for:{" "}
                  <span className="text-slate-200">&quot;{lastQuery}&quot;</span>
                </p>
              )}
            </div>

            <p className="text-sm text-slate-500">
              {matches.length} match{matches.length === 1 ? "" : "es"}
            </p>
          </div>

          <div className="mt-6 space-y-4">
            {matches.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-sm text-slate-400">
                No matches yet. Run a search to retrieve relevant chunks.
              </div>
            ) : (
              matches.map((match, index) => (
                <article
                  key={match.chunkId}
                  className="rounded-xl border border-slate-800 bg-slate-950 p-5"
                >
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">
                        #{index + 1} · {match.originalFileName}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Chunk #{match.chunkIndex} · Score:{" "}
                        {(match.score * 100).toFixed(2)}% · Distance:{" "}
                        {match.cosineDistance.toFixed(4)}
                      </p>
                    </div>

                    <Link
                      href={`/dashboard/documents/${match.documentId}`}
                      className="text-sm font-medium text-emerald-400 hover:text-emerald-300"
                    >
                      View document chunks
                    </Link>
                  </div>

                  <p className="line-clamp-6 whitespace-pre-wrap text-sm leading-7 text-slate-300">
                    {match.content}
                  </p>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong.";
}