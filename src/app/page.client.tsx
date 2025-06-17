"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Users,
  Search,
  Github,
} from "lucide-react";
import Link from "next/link";

// Message structure that matches the JSONB column
interface Message {
  type: "ai" | "human" | "system"; // or other message types
  content: string;
  tool_calls: unknown[]; // Array of tool calls
  additional_kwargs: Record<string, unknown>; // Additional metadata
  response_metadata: Record<string, unknown>; // Response metadata
  invalid_tool_calls: unknown[]; // Array of invalid tool calls
}

// Conversation structure when grouped by session
interface ChatConversation {
  sessionId: string;
  messages: Message[];
}

// Individual chat record from the database
interface Chat {
  id: number; // Changed from string to number since it's an integer in DB
  sessionId: string;
  message: Message;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  totalCount?: number;
  totalSessions?: number;
  totalPages: number;
  groupBy: "simple" | "session";
}

interface Response {
  data: Chat[] | ChatConversation[];
  pagination: PaginationInfo;
}

async function fetchChats({
  page,
  pageSize,
  groupBy,
  sortOrder,
  searchTerm,
}: {
  page: number;
  pageSize: number;
  groupBy: "simple" | "session";
  sortOrder: "asc" | "desc";
  searchTerm: string;
}) {
  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
    groupBy,
    sortOrder,
    search: searchTerm,
  });

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/chats?${params}`
  );
  const data = await response.json();

  if (!response.ok) throw new Error(data.error || "Failed to fetch chats");

  return data;
}

export default function ChatsUI() {
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    pageSize: 10,
    totalPages: 0,
    groupBy: "simple",
  });
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [searchTerm, setSearchTerm] = useState("");

  const { data, isLoading, isError, error, refetch } = useQuery<Response>({
    queryKey: [
      "chats",
      searchTerm,
      pagination.page,
      pagination.pageSize,
      pagination.groupBy,
      sortOrder,
    ],
    queryFn: () =>
      fetchChats({
        page: pagination.page,
        pageSize: pagination.pageSize,
        groupBy: pagination.groupBy,
        searchTerm: searchTerm,
        sortOrder,
      }),
  });

  useEffect(() => {
    if (data?.pagination) {
      setPagination((prev) => ({ ...prev, ...data.pagination }));
    }
  }, [data]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= (data?.pagination?.totalPages || 1)) {
      setPagination((prev) => ({ ...prev, page: newPage }));
    }
  };

  const handleGroupByChange = (value: "simple" | "session") => {
    setPagination((prev) => ({ ...prev, groupBy: value, page: 1 }));
  };

  const handleSortOrderChange = (value: "asc" | "desc") => {
    setSortOrder(value);
  };

  const filteredChats = useMemo(() => {
    if (!searchTerm || !data?.data) return data?.data;

    const lower = searchTerm.toLowerCase();

    if (pagination.groupBy === "simple" && Array.isArray(data.data)) {
      return (data.data as Chat[]).filter(
        (chat) =>
          chat.message.content.toLowerCase().includes(lower) ||
          chat.sessionId.toLowerCase().includes(lower)
      );
    }
    if (pagination.groupBy === "session" && typeof data.data === "object") {
      const result: Record<string, ChatConversation> = {};
      Object.entries(data.data).forEach(([sessionId, conversation]) => {
        const matchedMessages = conversation.messages.filter(
          (chat: Message) =>
            chat.content.toLowerCase().includes(lower) ||
            sessionId.toLowerCase().includes(lower)
        );
        if (matchedMessages.length > 0) {
          result[sessionId] = { ...conversation, messages: matchedMessages };
        }
      });
      return result;
    }

    return [];
  }, [searchTerm, data?.data, pagination.groupBy]);

  const renderSimpleView = () => {
    const chatArray = filteredChats as Chat[];

    return (
      <div className="space-y-4">
        {chatArray.map((chat) => (
          <Card key={chat.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="outline" className="text-xs">
                    {chat.sessionId}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {chat.message.type === "human" && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-blue-600">User:</div>
                  <p className="text-sm bg-blue-50 p-3 rounded-lg border-l-4 border-blue-200">
                    {chat.message.content}
                  </p>
                </div>
              )}

              {chat.message.type === "ai" && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-green-600">AI:</div>
                  <p className="text-sm bg-green-50 p-3 rounded-lg border-l-4 border-green-200">
                    {chat.message.content}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderSessionView = () => {
    const chatSessions = filteredChats as Record<string, ChatConversation>;

    if (!chatSessions || Object.keys(chatSessions).length === 0) {
      return <p className="text-muted-foreground">No messages found.</p>;
    }

    return (
      <div className="space-y-6">
        {Object.entries(chatSessions).map(([sessionId, conversation]) => {
          const sessionChats = conversation.messages;
          return (
            <Card key={sessionId} className="overflow-hidden pt-0">
              <CardHeader className="bg-muted/50 py-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Users className="h-5 w-5" />
                    Session: {sessionId}
                  </CardTitle>
                  <Badge variant="outline">
                    {sessionChats.length} messages
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-96">
                  <div className="p-4 space-y-4">
                    {sessionChats.map((chat, index) => (
                      <div key={index}>
                        <div className="space-y-3">
                          {chat.type === "human" && (
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-600">
                                U
                              </div>
                              <div className="flex-1 space-y-1">
                                <div className="bg-blue-50 p-3 rounded-lg border-l-4 border-blue-200">
                                  <p className="text-sm">{chat.content}</p>
                                </div>
                              </div>
                            </div>
                          )}

                          {chat.type === "ai" && (
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-xs font-medium text-green-600">
                                AI
                              </div>
                              <div className="flex-1">
                                <div className="bg-green-50 p-3 rounded-lg border-l-4 border-green-200">
                                  <p className="text-sm">{chat.content}</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {index < sessionChats.length - 1 && (
                          <Separator className="my-4" />
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  const renderPagination = () => (
    <div className="flex items-center justify-between mt-6">
      <div className="text-sm text-muted-foreground">
        Page {pagination.page} of {pagination.totalPages}
        {pagination.totalCount && ` • ${pagination.totalCount} total chats`}
        {pagination.totalSessions &&
          ` • ${pagination.totalSessions} total sessions`}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(pagination.page - 1)}
          disabled={pagination.page <= 1 || isLoading}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>

        <div className="flex items-center gap-1">
          {Array.from(
            { length: Math.min(5, pagination.totalPages) },
            (_, i) => {
              const page = Math.max(1, pagination.page - 2) + i;
              if (page > pagination.totalPages) return null;

              return (
                <Button
                  key={page}
                  variant={page === pagination.page ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePageChange(page)}
                  disabled={isLoading}
                  className="w-8 h-8 p-0"
                >
                  {page}
                </Button>
              );
            }
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(pagination.page + 1)}
          disabled={pagination.page >= pagination.totalPages || isLoading}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  if (isError) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-7xl w-full mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold flex flex-row gap-2 items-end">
            <span>n8n Chat History</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Browse and search through your n8n workflows history.
          </p>
        </div>
        <div className="">
          <Link
            target="_blank"
            rel="noopener noreferrer"
            href="https://github.com/dennypradipta/n8n-chat-history"
          >
            <Button className="rounded-full cursor-pointer" size="icon">
              <Github className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>
      {/* Controls */}
      <Card>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="space-y-2">
                <Label htmlFor="search" className="text-sm font-medium">
                  Search
                </Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Search messages..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 w-64"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">View</Label>
                <Select
                  value={pagination.groupBy}
                  onValueChange={handleGroupByChange}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simple">Simple List</SelectItem>
                    <SelectItem value="session">By Session</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Sort</Label>
                <Select value={sortOrder} onValueChange={handleSortOrderChange}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Newest</SelectItem>
                    <SelectItem value="asc">Oldest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={() => refetch()}
              disabled={isLoading}
              variant="outline"
            >
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {pagination.groupBy === "simple"
            ? renderSimpleView()
            : renderSessionView()}
          {renderPagination()}
        </>
      )}
      <div className="flex flex-row gap-1 text-center items-center justify-center w-full">
        <span>Vibe coded by </span>
        <span>
          <Link
            className="text-indigo-500"
            target="_blank"
            rel="noopener noreferrer"
            href="https://github.com/dennypradipta"
          >
            Denny Pradipta
          </Link>
        </span>
      </div>
    </div>
  );
}
