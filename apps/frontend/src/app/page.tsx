import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-20">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-400">
            Contexto
          </p>

          <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-6xl">
            Multi-tenant knowledge base powered by document intelligence.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-400">
            Upload company documents, extract chunks, generate embeddings,
            search semantically, and ask questions with source-backed answers.
          </p>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link
              href="/dashboard/documents"
              className="rounded-xl bg-blue-600 px-6 py-3 text-center text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              Open dashboard
            </Link>

            <Link
              href="/dashboard/ask"
              className="rounded-xl border border-slate-700 px-6 py-3 text-center text-sm font-semibold text-slate-200 transition hover:bg-slate-900"
            >
              Ask knowledge base
            </Link>
          </div>
        </div>

        <div className="mt-16 grid gap-4 md:grid-cols-3">
          <FeatureCard
            title="Document ingestion"
            description="Upload PDFs, DOCX, and text files, then track ingestion status from pending to completed."
          />

          <FeatureCard
            title="Semantic search"
            description="Store document chunks with pgvector embeddings and retrieve the most relevant context."
          />

          <FeatureCard
            title="Grounded Q&A"
            description="Ask questions against your organization knowledge base and view citations from source chunks."
          />
        </div>
      </section>
    </main>
  );
}

function FeatureCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
      <h2 className="text-lg font-semibold text-slate-100">{title}</h2>

      <p className="mt-3 text-sm leading-6 text-slate-400">{description}</p>
    </article>
  );
}