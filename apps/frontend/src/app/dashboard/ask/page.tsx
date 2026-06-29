"use client";

import Link from "next/link";
import { askQuestion, listRagHistory } from "@/lib/rag/api";
import { RagAnswerResponse, RagHistoryItem } from "@/lib/rag/types";
import { FormEvent, useEffect, useState } from "react";

const demoUserId = process.env.NEXT_PUBLIC_DEMO_USER_ID;
const demoOrganizationId = process.env.NEXT_PUBLIC_DEMO_ORGANIZATION_ID;
const demoWorkspaceId = process.env.NEXT_PUBLIC_DEMO_WORKSPACE_ID;

export default function AskPage() {
  const [question, setQuestion] = useState(
    "What are the requirements for administrative clerk roles?",
  );
  const [limit, setLimit] = useState(5);
  const [response, setResponse] = useState<RagAnswerResponse | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<RagHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    void loadHistory();
  }, []);

  async function loadHistory() {
    if (!demoUserId || !demoOrganizationId) {
      return;
    }

    setIsLoadingHistory(true);

    try {
      const result = await listRagHistory({
        userId: demoUserId,
        organizationId: demoOrganizationId,
        workspaceId: demoWorkspaceId || undefined,
        limit: 10,
      });

      setHistory(result.items);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoadingHistory(false);
    }
  }

  async function handleAsk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!demoUserId || !demoOrganizationId) {
      setErrorMessage("Missing demo environment values.");
      return;
    }

    if (!question.trim()) {
      setErrorMessage("Question is required.");
      return;
    }

    setIsAsking(true);
    setErrorMessage(null);
    setResponse(null);

    try {
      const result = await askQuestion({
        userId: demoUserId,
        payload: {
          organizationId: demoOrganizationId,
          workspaceId: demoWorkspaceId || undefined,
          question,
          limit,
        },
      });

      setResponse(result);
      await loadHistory();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsAsking(false);
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
            Ask Your Knowledge Base
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Ask a question against uploaded documents. The system retrieves
            relevant chunks and returns an answer with source citations.
          </p>
        </section>

        {errorMessage && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {errorMessage}
          </div>
        )}

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
          <form onSubmit={handleAsk} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300">
                Question
              </label>

              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                rows={4}
                className="mt-2 w-full resize-none rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-blue-500"
                placeholder="Ask something from your uploaded documents..."
              />
            </div>

            <div className="max-w-xs">
              <label className="block text-sm font-medium text-slate-300">
                Retrieved chunks
              </label>

              <input
                type="number"
                min={1}
                max={10}
                value={limit}
                onChange={(event) => setLimit(Number(event.target.value))}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={isAsking}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isAsking ? "Thinking..." : "Ask question"}
            </button>
          </form>
        </section>

        {response && (
          <>
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
              <h2 className="text-xl font-semibold">Answer</h2>

              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-300">
                {response.answer}
              </p>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
              <h2 className="text-xl font-semibold">Citations</h2>

              <div className="mt-6 space-y-3">
                {response.citations.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    No citations returned.
                  </p>
                ) : (
                  response.citations.map((citation) => (
                    <article
                      key={citation.chunkId}
                      className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                    >
                      <p className="text-sm font-semibold text-slate-100">
                        {citation.originalFileName}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Chunk #{citation.chunkIndex} · Score:{" "}
                        {(citation.score * 100).toFixed(2)}%
                      </p>

                      <Link
                        href={`/dashboard/documents/${citation.documentId}`}
                        className="mt-2 inline-block text-xs font-medium text-emerald-400 hover:text-emerald-300"
                      >
                        View source chunks
                      </Link>
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
              <h2 className="text-xl font-semibold">Retrieved Chunks</h2>

              <div className="mt-6 space-y-4">
                {response.retrievedChunks.map((chunk, index) => (
                  <article
                    key={chunk.chunkId}
                    className="rounded-xl border border-slate-800 bg-slate-950 p-5"
                  >
                    <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">
                          #{index + 1} · {chunk.originalFileName}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Chunk #{chunk.chunkIndex} · Score:{" "}
                          {(chunk.score * 100).toFixed(2)}% · Distance:{" "}
                          {chunk.cosineDistance.toFixed(4)}
                        </p>
                      </div>

                      <Link
                        href={`/dashboard/documents/${chunk.documentId}`}
                        className="text-sm font-medium text-blue-400 hover:text-blue-300"
                      >
                        Open document chunks
                      </Link>
                    </div>

                    <p className="line-clamp-6 whitespace-pre-wrap text-sm leading-7 text-slate-300">
                      {chunk.content}
                    </p>
                  </article>
                ))}
              </div>
            </section>
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Recent Questions</h2>

                <button
                  type="button"
                  onClick={loadHistory}
                  disabled={isLoadingHistory}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
                >
                  {isLoadingHistory ? "Loading..." : "Refresh"}
                </button>
              </div>

              <div className="mt-6 space-y-3">
                {history.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    No saved questions yet.
                  </p>
                ) : (
                  history.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setQuestion(item.question);
                        setResponse({
                          historyId: item.id,
                          question: item.question,
                          answer: item.answer,
                          citations: [],
                          retrievedChunks: [],
                        });
                      }}
                      className="block w-full rounded-xl border border-slate-800 bg-slate-950 p-4 text-left transition hover:border-blue-500/60"
                    >
                      <p className="text-sm font-medium text-slate-100">
                        {item.question}
                      </p>

                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">
                        {item.answer}
                      </p>

                      <p className="mt-2 text-xs text-slate-600">
                        {new Date(item.createdAt).toLocaleString()}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </section>
          </>
        )}
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
