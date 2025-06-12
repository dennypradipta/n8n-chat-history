# n8n Chat History

A project to view and manage n8n workflow chat history using modern web technologies.

## Tech Stack

- Golang - Backend programming language
- Bun - JavaScript runtime & package manager
- Next.js - React framework
- Shadcn/ui - UI component library
- Tailwind CSS - Utility-first CSS framework
- Drizzle ORM - TypeScript ORM
- PostgreSQL - Database

## Prerequisites

- Golang installed on your system
- Bun installed on your system
- PostgreSQL database instance
- n8n instance (for adding chat data)

## Setup

1. Clone the repository:

```bash
git clone https://github.com/dennypradipta/n8n-chat-history.git
```

### Frontend

1. Install dependencies:

```
bun install
```

2. Configure environment variables:

- Copy the .env.example file to .env
- Update the DATABASE_URL with your PostgreSQL connection string
- Update the N8N_URL with your n8n base url (e.g https://n8n.something.com)

3. Migrate the database schema:

```bash
bunx --bun drizzle-kit migrate
```

4. Start the development server:

```bash
bun run dev
```

### Backend

1. Navigate to the backend directory:

```bash
cd backend
```

2. Install dependencies:

```bash
go mod tidy
```

3. Configure environment variables:

- Copy the .env.example file to .env
- Update the DATABASE_URL with your PostgreSQL connection string

4. Migrate the database schema by running the SQL file in the `migrations` directory into your PostgreSQL database

5. Start the backend server:

```bash
go run main.go
```

## Docker

### Frontend

To run the application using Docker, follow these steps:

1. Build the Docker image:

```bash
docker build -f Dockerfile.frontend -t n8n-chat-history:frontend . --build-arg NEXT_PUBLIC_N8N_URL=https://n8n.something.com --build-arg NEXT_PUBLIC_API_URL=https://api.something.com
```

2. Run the Docker container:

```bash
# Replace the environment variables with your actual value

docker run -p 3000:80 n8n-chat-history:frontend

```

## Backend

To run the application using Docker, follow these steps:

1. Build the Docker image:

```bash
docker build . -t n8n-chat-history:backend -f Dockerfile.backend
```

2. Run the Docker container:

```bash
# Replace the environment variables with your actual value
docker run -p 8080:8080 -e DATABASE_URL=postgresql://user:password@host:port/database -e CHAT_URL=http://localhost:3000 n8n-chat-history:backend
```

## Adding Chat Data via n8n

1. In your n8n instance, add a new PostgreSQL node
2. Configure the PostgreSQL connection:

   - Host: Your PostgreSQL host
   - Database: Your database name
   - Schema: public
   - User & Password: Your database credentials
   - SSL: According to your setup

3. In the PostgreSQL node, set up an INSERT query with the following fields:

   - user_message: The message sent by the user
   - ai_message: The response from the AI
   - session_id: Unique identifier for the chat session
   - workflow_id: ID of the n8n workflow
   - workflow_name: Name of the n8n workflow

4. Connect the PostgreSQL node to your workflow and activate it
   Now your chat history will be stored in the database and viewable through this application.
