"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { listDocuments, uploadDocument } from "@/lib/documents/api";
import { DocumentListItem } from "@/lib/documents/types";
import Link from "next/link";

const demoUserId = process.env.NEXT_PUBLIC_DEMO_USER_ID;
const demoOrganizationId = process.env.NEXT_PUBLIC_DEMO_ORGANIZATION_ID;
const demoWorkspaceId = process.env.NEXT_PUBLIC_DEMO_WORKSPACE_ID;

export default function DocumentsPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const configIsReady = useMemo(() => {
    return Boolean(demoUserId && demoOrganizationId && demoWorkspaceId);
  }, []);

  async function fetchDocuments(): Promise<void> {
    if (!demoUserId || !demoOrganizationId) {
      setErrorMessage("Missing demo user or organization environment values.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await listDocuments({
        userId: demoUserId,
        organizationId: demoOrganizationId,
      });

      setDocuments(response.data);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!demoUserId || !demoOrganizationId || !demoWorkspaceId) {
      setErrorMessage("Missing demo environment values.");
      return;
    }

    if (!selectedFile) {
      setErrorMessage("Please select a file first.");
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await uploadDocument({
        userId: demoUserId,
        organizationId: demoOrganizationId,
        workspaceId: demoWorkspaceId,
        file: selectedFile,
      });

      setSuccessMessage(
        `File uploaded and queued successfully. Document ID: ${response.documentId}`,
      );

      setSelectedFile(null);
      await fetchDocuments();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsUploading(false);
    }
  }

  useEffect(() => {
    void fetchDocuments();
  }, []);

  useEffect(() => {
    const hasActiveDocuments = documents.some((document) =>
      ["PENDING", "PROCESSING"].includes(document.ingestionStatus),
    );

    if (!hasActiveDocuments) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void fetchDocuments();
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [documents]);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl space-y-8">
        <section>
          <p className="text-sm font-medium text-blue-400">Contexto</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Documents</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Upload company documents, queue ingestion, and track processing
            status through the full RAG ingestion pipeline.
          </p>
        </section>

        <Link
          href="/dashboard/search"
          className="mt-4 inline-block rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
        >
          Open semantic search
        </Link>

        {!configIsReady && (
          <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-200">
            Missing demo environment variables. Add your seeded IDs to{" "}
            <code>apps/frontend/.env.local</code>.
          </div>
        )}

        {errorMessage && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            {successMessage}
          </div>
        )}

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
          <h2 className="text-xl font-semibold">Upload a document</h2>

          <form onSubmit={handleUpload} className="mt-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300">
                Document file
              </label>

              <input
                type="file"
                accept=".pdf,.txt,.doc,.docx,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(event) => {
                  setSelectedFile(event.target.files?.[0] ?? null);
                }}
                className="mt-2 block w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-500"
              />

              {selectedFile && (
                <p className="mt-2 text-xs text-slate-500">
                  Selected: {selectedFile.name} ·{" "}
                  {formatBytes(selectedFile.size)}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isUploading || !configIsReady}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isUploading ? "Uploading..." : "Upload and queue ingestion"}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">Document list</h2>

            <button
              type="button"
              onClick={() => void fetchDocuments()}
              disabled={isLoading}
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
            >
              {isLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div className="mt-6 overflow-hidden rounded-xl border border-slate-800">
            {documents.length === 0 ? (
              <div className="p-6 text-sm text-slate-400">
                No documents found yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {documents.map((document) => (
                  <article
                    key={document.id}
                    className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <h3 className="font-medium text-slate-100">
                        {document.originalFileName}
                      </h3>

                      <p className="mt-1 text-xs text-slate-500">
                        {document.id}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {document.mimeType ?? "Unknown type"} ·{" "}
                        {document.sizeBytes
                          ? formatBytes(document.sizeBytes)
                          : "Unknown size"}
                      </p>

                      {document.storageUrl && (
                        <a
                          href={`${process.env.NEXT_PUBLIC_CORE_API_URL}${document.storageUrl}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-block text-xs font-medium text-blue-400 hover:text-blue-300"
                        >
                          Open uploaded file
                        </a>
                      )}

                      <Link
                        href={`/dashboard/documents/${document.id}`}
                        className="mt-2 block text-xs font-medium text-emerald-400 hover:text-emerald-300"
                      >
                        View extracted chunks
                      </Link>

                      {document.ingestionError && (
                        <p className="mt-2 text-sm text-red-300">
                          {document.ingestionError}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <StatusBadge status={document.ingestionStatus} />

                      <p className="text-xs text-slate-500">
                        {new Date(document.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function StatusBadge({
  status,
}: {
  status: DocumentListItem["ingestionStatus"];
}) {
  const labelMap: Record<DocumentListItem["ingestionStatus"], string> = {
    PENDING: "Pending",
    PROCESSING: "Processing",
    COMPLETED: "Completed",
    FAILED: "Failed",
  };

  const classMap: Record<DocumentListItem["ingestionStatus"], string> = {
    PENDING: "border-yellow-500/30 bg-yellow-500/10 text-yellow-200",
    PROCESSING: "border-blue-500/30 bg-blue-500/10 text-blue-200",
    COMPLETED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    FAILED: "border-red-500/30 bg-red-500/10 text-red-200",
  };

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${classMap[status]}`}
    >
      {labelMap[status]}
    </span>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const sizeIndex = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, sizeIndex);

  return `${size.toFixed(1)} ${units[sizeIndex]}`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong.";
}
