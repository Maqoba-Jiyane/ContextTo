# Contexto — Multi-Tenant B2B Knowledge Management Engine

Contexto is an enterprise-grade, multi-tenant Knowledge Management and Retrieval-Augmented Generation (RAG) platform purpose-built for remote companies. 

The platform enables organizations to upload internal documents, process them through an asynchronous ingestion pipeline, extract text, split content into optimized semantic chunks, and prepare data for advanced vector search.

---

## 🎯 Project Goal

This platform serves as an advanced, production-ready systems architecture portfolio project. It is designed to demonstrate high-level engineering skills in:
* **Microservices** and decoupled system boundaries.
* **Distributed asynchronous task queues** for heavy compute.
* **Multi-tenant database design** ensuring strict corporate data isolation.
* **Polyglot environments** mixing TypeScript (NestJS/Next.js) with Python (AI/ML processing).

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS

### Core Backend (API & Orchestration)
- **Framework**: NestJS
- **Language**: TypeScript
- **ORM**: Prisma ORM
- **Database**: PostgreSQL
- **Task Queue**: BullMQ
- **Message Broker**: Redis

### AI Service (Compute & Extraction)
- **Framework**: Python (FastAPI)
- **Libraries**: `pypdf`, `python-docx`, `sentence-transformers`
- **Roadmap**: Integration with LlamaIndex and LangChain

### Infrastructure
- **Containerization**: Docker Compose
- **Database Plugins**: PostgreSQL with `pgvector` extension
- **Cache**: Redis

---

## 📂 Monorepo Structure

```txt
contexto/
├── apps/
│   ├── frontend/         # Next.js UI application
│   ├── core-api/         # NestJS backend API & pipeline coordinator
│   └── ai-service/       # Python FastAPI AI document processing microservice
├── docker-compose.yml    # Infrastructure orchestration (Postgres, Redis)
├── package.json          # Root workspace configuration
├── README.md             # Project documentation
└── .env.example          # Root environment variables blueprint
```

---

## ⚡ Current Features

* **Enterprise Multi-Tenancy**: Complete schema-level isolation separating Organizations, Members, and Workspaces.
* **Asynchronous Pipeline**: Decoupled ingestion worker system using an enterprise Redis-backed BullMQ queue.
* **Polyglot Data Processing**: NestJS-driven ingestion handoff to a custom Python FastAPI text-extraction engine.
* **Deep Document Parsing**: Native extraction and token-based chunking for `.pdf`, `.docx`, and `.txt` files.
* **Relational Persistence**: Structural tracking of processing states (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`).
* **Interactive UI**: Frontend features for direct file uploads and real-time visualization of extracted semantic text chunks.

---

## 🔄 Current Ingestion Flow

```txt
[User Upload] ──> [Next.js Frontend] ──> [NestJS Core API]
                                               │
                                       (Save Meta & File)
                                               │
                                               ▼
[Python Extraction] <── [NestJS Worker] <── [BullMQ / Redis]
       │
 (Extract & Chunk)
       │
       ▼
[Save Chunks to Postgres] ──> Status: COMPLETED
```

1. **Upload**: User uploads a document via the Next.js UI.
2. **Registration**: NestJS accepts the file, writes it to disk, and tracks it in PostgreSQL with a `PENDING` status.
3. **Queue**: NestJS dispatches an extraction job containing document metadata onto the BullMQ queue.
4. **Handoff**: A specialized NestJS worker pulls the job and forwards the workload to the Python FastAPI microservice.
5. **Processing**: Python extracts the text dynamically, applies chunking algorithms, and returns structural text blocks.
6. **Persistence**: NestJS receives the processed chunks, commits them to PostgreSQL, and updates the status to `COMPLETED`.

---

## 🌐 Network Topology & Services

| Service | Port / URL | Description |
| :--- | :--- | :--- |
| **Frontend** | `http://localhost:3000` | Next.js Client Portal |
| **Core API** | `http://localhost:4000` | NestJS Core Orchestrator |
| **AI Service** | `http://127.0.0.1:8000` | Python Extraction Engine |
| **Prisma Studio** | `http://localhost:5555` | Database Visual GUI |

---

## 🚀 Local Development Setup

Follow these steps to run the complete microservice architecture locally.

### 1. Install Dependencies
Run from the monorepo root folder:
```bash
npm install
```

### 2. Start Infrastructure
Launch the database and cache broker containers via Docker:
```bash
docker compose up -d postgres redis
```

### 3. Run Database Migrations & Client Generation
```bash
npm run prisma:migrate -w apps/core-api
npm run prisma:generate -w apps/core-api
```

### 4. Seed Demo Data
```bash
npm run prisma:seed -w apps/core-api
```

### 5. Start the AI Microservice
```bash
cd apps/ai-service
.\.venv\Scripts\Activate.ps1
\$env:CORE_API_URL="http://127.0.0.1:4000"
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### 6. Start the Core NestJS API
Open a new terminal window at the root and run:
```bash
npm run start:dev -w apps/core-api
```

### 7. Start the Next.js Frontend
Open a new terminal window at the root and run:
```bash
npm run dev:frontend
```

---

## 🔐 Environment Variables

### Root Configuration
Create a `.env` file in the root project folder:
```env
# Database Configuration
POSTGRES_USER=contexto
POSTGRES_PASSWORD=contexto_password
POSTGRES_DB=contexto_db
DATABASE_URL="postgresql://contexto:contexto_password@localhost:5432/contexto_db?schema=public"

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_TLS=false

# Core Networking
PORT=4000
FRONTEND_URL=http://localhost:3000
AI_SERVICE_URL=http://127.0.0.1:8000
```

### Frontend Configuration
Create an environment file at `apps/frontend/.env.local`:
```env
NEXT_PUBLIC_CORE_API_URL=http://localhost:4000

# Local Testing Anchors
NEXT_PUBLIC_DEMO_USER_ID=
NEXT_PUBLIC_DEMO_ORGANIZATION_ID=
NEXT_PUBLIC_DEMO_WORKSPACE_ID=
```

---

## 🛠️ Shortcuts & Scripts Reference

| Command | Action |
| :--- | :--- |
| `npm run dev:frontend` | Boots Next.js hot-reloading web environment |
| `npm run start:dev -w apps/core-api` | Boots NestJS app in development watch mode |
| `npm run prisma:studio -w apps/core-api` | Launches Prisma database viewer browser UI |
| `npm run prisma:migrate -w apps/core-api`| Synchs PostgreSQL schema changes |
| `npm run prisma:generate -w apps/core-api`| Re-compiles typesafe Prisma Node client modules |
| `npm run prisma:seed -w apps/core-api` | Hydrates tables with mockup company profiles |

---

## 📡 Key REST API Endpoints

### 🩺 System Core
* **`GET /health`**: Microservice health-check confirmation.

### 📑 Document Pipeline
* **`POST /documents/ingestion/upload`**: Primary file multipart ingest handler.
* **`GET /documents?organizationId=:id`**: Fetches document manifests filtered by company tenancy.
* **`GET /documents/:id?organizationId=:id`**: Inspects processing metadata status for a single target file.
* **`GET /documents/:id/chunks?organizationId=:id`**: Pulls extracted sub-text segments generated by the AI engine.

---

## 🗺️ Roadmap / Planned Features

* [ ] **Vector Embedding Engine**: Generate embeddings via `pgvector` models.
* [ ] **Semantic Vector Search**: Build low-latency retrieval indexes across multi-tenant contexts.
* [ ] **RAG Question-Answering**: Build context-aware conversation endpoints with LangChain.
* [ ] **Traceable Citations**: Deliver highlighting schemas leading back to original document chunks.
* [ ] **Workspace Security**: Apply fine-grained RBAC access control across directories.
* [ ] **Cloud Storage Integration**: Move from local filesystem disk writes to AWS S3/Cloudflare R2 blocks.
* [ ] **System Observability**: Standardize structural logging outputs and platform observability metrics.

## ⚡ Recent Activity

<!--START_SECTION:activity-->
<!--END_SECTION:activity-->
