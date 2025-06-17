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
- PostgreSQL Memory Node connected to your agents or memory managers
- n8n (for adding chat data)

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
- Update the NEXT_PUBLIC_API_URL with the URL of the backend server

3. Start the development server:

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

5. Start the backend server:

```bash
go run main.go
```

## Docker

### Frontend

To run the application using Docker, follow these steps:

1. Build the Docker image:

```bash
docker build -f Dockerfile.frontend -t n8n-chat-history:frontend . --build-arg NEXT_PUBLIC_API_URL=https://api.something.com
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

1. In your n8n workflows, make sure you have connected the PostgreSQL Memory Node to your Agents/Chat Memory Managers.
2. Configure the PostgreSQL connection:

   - Host: Your PostgreSQL host
   - Database: Your database name
   - Schema: public
   - User & Password: Your database credentials
   - SSL: According to your setup

3. Try running a workflow and see if the chat data is being added to the database.
4. Your chats can now be viewed in the frontend.
