from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Any, Optional
from urllib.parse import urljoin

import httpx
from docx import Document as DocxDocument
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from pypdf import PdfReader
from sentence_transformers import SentenceTransformer

import os
import httpx


app = FastAPI(
    title="Contexto AI Service",
    description="AI microservice for document parsing, chunking, embeddings, and RAG ingestion.",
    version="0.2.0",
)

embedding_model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")


class IngestDocumentRequest(BaseModel):
    documentId: str
    organizationId: str
    workspaceId: Optional[str] = None
    uploadedByUserId: str
    filename: str
    storageUrl: Optional[str] = None
    mimeType: Optional[str] = None
    sizeBytes: Optional[int] = None
    checksumSha256: Optional[str] = None
    requestedAt: Optional[str] = None


class ExtractedChunk(BaseModel):
    chunkIndex: int
    content: str
    tokenCount: int
    embedding: list[float]
    metadata: dict[str, Any] = Field(default_factory=dict)


class IngestDocumentResponse(BaseModel):
    documentId: str
    organizationId: str
    status: str
    chunksCreated: int
    chunks: list[ExtractedChunk]
    
class EmbedQueryRequest(BaseModel):
    query: str


class EmbedQueryResponse(BaseModel):
    embedding: list[float]
    dimensions: int
    
class AnswerContext(BaseModel):
    chunkId: str
    documentId: str
    originalFileName: str
    chunkIndex: int
    content: str
    score: float


class AnswerRequest(BaseModel):
    query: str
    contexts: list[AnswerContext]


class AnswerCitation(BaseModel):
    chunkId: str
    documentId: str
    originalFileName: str
    chunkIndex: int
    score: float


class AnswerResponse(BaseModel):
    answer: str
    citations: list[AnswerCitation]
    
async def generate_llm_answer(query: str, contexts: list[AnswerContext]) -> str:
    api_key = os.getenv("LLM_API_KEY")
    base_url = os.getenv("LLM_BASE_URL")
    model = os.getenv("LLM_MODEL")
    timeout_seconds = int(os.getenv("LLM_TIMEOUT_SECONDS", "60"))

    if not api_key or not base_url or not model:
        raise HTTPException(
            status_code=500,
            detail="LLM is not configured. Set LLM_API_KEY, LLM_BASE_URL, and LLM_MODEL.",
        )

    context_blocks: list[str] = []

    for index, context in enumerate(contexts, start=1):
        context_blocks.append(
            f"""
SOURCE {index}
File: {context.originalFileName}
Chunk: {context.chunkIndex}
Score: {context.score}

{context.content}
""".strip()
        )

    context_text = "\n\n---\n\n".join(context_blocks)

    system_prompt = """
You are an AI assistant for a business knowledge-base platform.

Answer the user's question using ONLY the provided source context.

Rules:
- Give a clear, natural answer.
- Structure the answer with short paragraphs and bullet points where useful.
- Do not invent information.
- If the answer is not found in the sources, say: "I could not find that information in the uploaded documents."
- Do not mention internal chunk IDs.
- Do not say "based on the context" repeatedly.
- Keep the answer professional and easy to read.
""".strip()

    user_prompt = f"""
Question:
{query}

Source context:
{context_text}

Write the best possible answer using only the source context.
""".strip()

    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": system_prompt,
            },
            {
                "role": "user",
                "content": user_prompt,
            },
        ],
        "temperature": 0.2,
        "max_tokens": 900,
    }

    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        response = await client.post(
            f"{base_url.rstrip('/')}/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )

    if response.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail=f"LLM provider failed with status {response.status_code}: {response.text}",
        )

    data = response.json()

    try:
        answer = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        raise HTTPException(
            status_code=502,
            detail="LLM provider returned an invalid response shape.",
        )

    return answer.strip()
    
@app.post("/answer", response_model=AnswerResponse)
async def answer_question(payload: AnswerRequest) -> AnswerResponse:
    query = payload.query.strip()

    if not query:
        raise HTTPException(status_code=400, detail="Query is required.")

    if not payload.contexts:
        return AnswerResponse(
            answer="I could not find relevant information in the uploaded documents.",
            citations=[],
        )

    selected_contexts = payload.contexts[:5]

    answer = await generate_llm_answer(
        query=query,
        contexts=selected_contexts,
    )

    citations = [
        AnswerCitation(
            chunkId=context.chunkId,
            documentId=context.documentId,
            originalFileName=context.originalFileName,
            chunkIndex=context.chunkIndex,
            score=context.score,
        )
        for context in selected_contexts
    ]

    return AnswerResponse(
        answer=answer,
        citations=citations,
    )
    
@app.post("/embed/query", response_model=EmbedQueryResponse)
async def embed_query(payload: EmbedQueryRequest) -> EmbedQueryResponse:
    query = payload.query.strip()

    if not query:
        raise HTTPException(status_code=400, detail="Query is required.")

    embedding = embedding_model.encode(
        query,
        normalize_embeddings=True,
        show_progress_bar=False,
    )

    embedding_list = [float(value) for value in embedding.tolist()]

    return EmbedQueryResponse(
        embedding=embedding_list,
        dimensions=len(embedding_list),
    )

@app.get("/")
async def root() -> dict[str, str]:
    return {
        "service": "ai-service",
        "status": "running",
    }


@app.get("/health")
async def health() -> dict[str, str]:
    return {
        "service": "ai-service",
        "status": "ok",
    }


@app.post("/ingest/document", response_model=IngestDocumentResponse)
async def ingest_document(payload: IngestDocumentRequest) -> IngestDocumentResponse:
    if not payload.storageUrl:
        raise HTTPException(status_code=400, detail="storageUrl is required for ingestion.")

    source_url = build_source_url(payload.storageUrl)

    try:
        file_bytes = await download_file(source_url)
        extracted_text = extract_text(
            file_bytes=file_bytes,
            filename=payload.filename,
            mime_type=payload.mimeType,
        )
        chunks = chunk_text(extracted_text)
        chunks_with_embeddings = add_embeddings_to_chunks(chunks)

        return IngestDocumentResponse(
            documentId=payload.documentId,
            organizationId=payload.organizationId,
            status="COMPLETED",
            chunksCreated=len(chunks_with_embeddings),
            chunks=chunks_with_embeddings,
        )
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Document ingestion failed: {str(error)}",
        ) from error


def build_source_url(storage_url: str) -> str:
    if storage_url.startswith("http://") or storage_url.startswith("https://"):
        return storage_url

    core_api_url = os.getenv("CORE_API_URL", "http://127.0.0.1:4000")

    return urljoin(core_api_url, storage_url)


async def download_file(source_url: str) -> bytes:
    timeout = httpx.Timeout(30.0)

    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.get(source_url)

    if response.status_code >= 400:
        raise HTTPException(
            status_code=400,
            detail=f"Could not download source document. Status: {response.status_code}",
        )

    return response.content


def extract_text(file_bytes: bytes, filename: str, mime_type: Optional[str]) -> str:
    normalized_filename = filename.lower()
    normalized_mime_type = (mime_type or "").lower()

    if normalized_mime_type == "application/pdf" or normalized_filename.endswith(".pdf"):
        return extract_pdf_text(file_bytes)

    if normalized_mime_type == "text/plain" or normalized_filename.endswith(".txt"):
        return extract_txt_text(file_bytes)

    if (
        normalized_mime_type
        == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        or normalized_filename.endswith(".docx")
    ):
        return extract_docx_text(file_bytes)

    raise HTTPException(
        status_code=400,
        detail=f"Unsupported document type: {mime_type or filename}",
    )


def extract_pdf_text(file_bytes: bytes) -> str:
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as temp_file:
        temp_file.write(file_bytes)
        temp_path = temp_file.name

    try:
        reader = PdfReader(temp_path)

        page_texts: list[str] = []

        for page_number, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ""

            if text.strip():
                page_texts.append(f"\n\n[Page {page_number}]\n{text.strip()}")

        combined_text = "\n".join(page_texts).strip()

        if not combined_text:
            raise HTTPException(
                status_code=422,
                detail="No readable text found in PDF. It may be scanned or image-based.",
            )

        return combined_text
    finally:
        Path(temp_path).unlink(missing_ok=True)


def extract_txt_text(file_bytes: bytes) -> str:
    for encoding in ("utf-8", "utf-16", "latin-1"):
        try:
            text = file_bytes.decode(encoding).strip()

            if text:
                return text
        except UnicodeDecodeError:
            continue

    raise HTTPException(status_code=422, detail="Could not decode text file.")


def extract_docx_text(file_bytes: bytes) -> str:
    with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as temp_file:
        temp_file.write(file_bytes)
        temp_path = temp_file.name

    try:
        doc = DocxDocument(temp_path)

        paragraphs = [
            paragraph.text.strip()
            for paragraph in doc.paragraphs
            if paragraph.text.strip()
        ]

        text = "\n\n".join(paragraphs).strip()

        if not text:
            raise HTTPException(status_code=422, detail="No readable text found in DOCX.")

        return text
    finally:
        Path(temp_path).unlink(missing_ok=True)


def chunk_text(text: str, max_words: int = 350, overlap_words: int = 60) -> list[dict[str, Any]]:
    words = text.split()

    if not words:
        raise HTTPException(status_code=422, detail="No text available for chunking.")

    chunks: list[dict[str, Any]] = []
    start = 0
    chunk_index = 0

    while start < len(words):
        end = min(start + max_words, len(words))
        chunk_words = words[start:end]
        chunk_content = " ".join(chunk_words).strip()

        if chunk_content:
            chunks.append(
                {
                    "chunkIndex": chunk_index,
                    "content": chunk_content,
                    "tokenCount": estimate_token_count(chunk_content),
                    "metadata": {
                        "wordStart": start,
                        "wordEnd": end,
                        "wordCount": len(chunk_words),
                    },
                }
            )

        if end >= len(words):
            break

        start = max(0, end - overlap_words)
        chunk_index += 1

    return chunks

def add_embeddings_to_chunks(chunks: list[dict[str, Any]]) -> list[ExtractedChunk]:
    texts = [chunk["content"] for chunk in chunks]

    embeddings = embedding_model.encode(
        texts,
        normalize_embeddings=True,
        show_progress_bar=False,
    )

    chunks_with_embeddings: list[ExtractedChunk] = []

    for chunk, embedding in zip(chunks, embeddings):
        chunks_with_embeddings.append(
            ExtractedChunk(
                chunkIndex=chunk["chunkIndex"],
                content=chunk["content"],
                tokenCount=chunk["tokenCount"],
                metadata=chunk["metadata"],
                embedding=[float(value) for value in embedding.tolist()],
            )
        )

    return chunks_with_embeddings


def estimate_token_count(text: str) -> int:
    return max(1, int(len(text.split()) * 1.3))

def split_into_sentences(text: str) -> list[str]:
    normalized = text.replace("\n", " ").strip()

    if not normalized:
        return []

    sentence_endings = [". ", "? ", "! "]
    sentences: list[str] = []
    current = ""

    index = 0

    while index < len(normalized):
        current += normalized[index]

        if any(current.endswith(ending) for ending in sentence_endings):
            sentences.append(current.strip())
            current = ""

        index += 1

    if current.strip:
        sentences.append(current.strip())

    return sentences