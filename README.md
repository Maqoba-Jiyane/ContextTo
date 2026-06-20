# Contexto — Multi-Tenant B2B Knowledge Management Engine

Contexto is an enterprise-grade, multi-tenant Knowledge Management and RAG platform built for remote companies.

The platform allows organizations to upload internal documents, process them through an ingestion pipeline, extract text, split content into chunks, and prepare the data for semantic search and retrieval-augmented generation.

## Project Goal

This project is built as an advanced system architecture portfolio project to demonstrate production-level backend, microservice, queue, database, and AI integration skills.

## Tech Stack

### Frontend
- Next.js App Router
- TypeScript
- Tailwind CSS

### Core Backend
- NestJS
- TypeScript
- Prisma ORM
- PostgreSQL
- BullMQ
- Redis

### AI Service
- Python
- FastAPI
- pypdf
- python-docx
- sentence-transformers
- Planned: LlamaIndex / LangChain

### Infrastructure
- Docker Compose
- PostgreSQL with pgvector
- Redis

## Monorepo Structure

```txt
contexto/
├── apps/
│   ├── frontend/
│   │   └── Next.js frontend
│   │
│   ├── core-api/
│   │   └── NestJS backend API
│   │
│   └── ai-service/
│       └── Python FastAPI AI ingestion service
│
├── docker-compose.yml
├── package.json
├── README.md
└── .env.example

Current Features
Multi-tenant database structure
Organizations / tenants
Organization members
Workspaces
Document metadata tracking
Local document uploads
PostgreSQL persistence
Redis-backed BullMQ ingestion queue
NestJS ingestion worker
Python FastAPI document processing service
PDF text extraction
DOCX text extraction
TXT text extraction
Text chunking
Document chunk storage
Frontend document upload page
Frontend extracted chunk preview page
# Current Ingestion Flow

User uploads document
        ↓
Next.js sends file to NestJS
        ↓
NestJS saves file locally
        ↓
NestJS creates Document record in PostgreSQL
        ↓
NestJS queues ingestion job in BullMQ / Redis
        ↓
NestJS worker picks up the job
        ↓
Worker calls Python FastAPI service
        ↓
Python downloads document from Core API
        ↓
Python extracts text
        ↓
Python chunks text
        ↓
NestJS stores chunks in PostgreSQL
        ↓
Document status becomes COMPLETED

# Services

| Service       | URL                                            |
| ------------- | ---------------------------------------------- |
| Frontend      | [http://localhost:3000](http://localhost:3000) |
| Core API      | [http://localhost:4000](http://localhost:4000) |
| AI Service    | [http://127.0.0.1:8000](http://127.0.0.1:8000) |
| Prisma Studio | [http://localhost:5555](http://localhost:5555) |

Local Development Setup
1. Install dependencies

