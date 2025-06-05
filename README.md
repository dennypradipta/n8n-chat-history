# n8n Chat History

A project to view and manage n8n workflow chat history using modern web technologies.

## Tech Stack

- Bun - JavaScript runtime & package manager
- Next.js - React framework
- Shadcn/ui - UI component library
- Tailwind CSS - Utility-first CSS framework
- Drizzle ORM - TypeScript ORM
- PostgreSQL - Database

## Prerequisites

- Bun installed on your system
- PostgreSQL database instance
- n8n instance (for adding chat data)

## Setup

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

## Running the Project

Start the development server:

```bash
bun dev
```

The application will be available at http://localhost:3000

## Docker

To run the application using Docker, follow these steps:

1. Build the Docker image:

```bash
docker build -t n8n-chat-history .
```

2. Run the Docker container:

```bash
# Replace the environment variables with your actual value

docker run -p 3000:3000 -e DATABASE_URL=postgresql://user:password@host:port/database -e N8N_URL=http://localhost:5678 n8n-chat-history

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
