"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { listDocumentChunks } from "@/lib/documents/api";
import { DocumentChunkListItem } from "@/lib/documents/types";

const demoUserId = process.env.NEXT_PUBLIC_DEMO_USER_ID;
const demoOrganizationId = process.env.NEXT_PUBLIC_DEMO_ORGANIZATION_ID;

export default function DocumentChunksPage() {
  const params = useParams<{ documentId: string }>();
  const documentId = params.documentId;

  const [chunks, setChunks] = useState<DocumentChunkListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function fetchChunks(): Promise<void> {
    if (!demoUserId || !demoOrganizationId) {
      setErrorMessage("Missing demo environment values.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await listDocumentChunks({
        userId: demoUserId,
        organizationId: demoOrganizationId,
        documentId,
      });

      setChunks(response.data);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void fetchChunks();
  }, [documentId]);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl space-y-8">
        <section>
          <Link
            href="/dashboard/documents"
            className="text-sm font-medium text-blue-400 hover:text-blue-300"
          >
            ← Back to documents
          </Link>

          <h1 className="mt-4 text-3xl font-bold tracking-tight">
            Extracted Chunks
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Preview the text chunks extracted from this document before adding
            embeddings and semantic search.
          </p>

          <p className="mt-2 break-all text-xs text-slate-500">
            Document ID: {documentId}
          </p>
        </section>

        {errorMessage && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {errorMessage}
          </div>
        )}

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">Chunk Preview</h2>

            <button
              type="button"
              onClick={() => void fetchChunks()}
              disabled={isLoading}
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
            >
              {isLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div className="mt-6 space-y-4">
            {chunks.length === 0 ? (
              <div className="rounded-xl border border-slate-800 p-6 text-sm text-slate-400">
                No chunks found for this document.
              </div>
            ) : (
              chunks.map((chunk) => (
                <article
                  key={chunk.id}
                  className="rounded-xl border border-slate-800 bg-slate-950 p-5"
                >
                  <div className="mb-3 flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold text-slate-200">
                      Chunk #{chunk.chunkIndex}
                    </p>

                    <p className="text-xs text-slate-500">
                      {chunk.tokenCount ?? 0} tokens
                    </p>
                  </div>

                  <p className="whitespace-pre-wrap text-sm leading-7 text-slate-300">
                    {chunk.content}
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