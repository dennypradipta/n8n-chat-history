"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Calendar,
  Search,
} from "lucide-react";

interface Chat {
  id: string;
  userMessage: string;
  aiMessage: string | null;
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  workflow: string | null;
}

interface SessionChat {
  [sessionId: string]: Chat[];
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
  data: Chat[] | SessionChat;
  pagination: PaginationInfo;
}

async function fetchChats({
  page,
  pageSize,
  groupBy,
  sortOrder,
}: {
  page: number;
  pageSize: number;
  groupBy: "simple" | "session";
  sortOrder: "asc" | "desc";
}) {
  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
    groupBy,
    sortOrder,
  });

  const response = await fetch(`/api/chats?${params}`);
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filteredChats = useMemo(() => {
    if (!searchTerm || !data?.data) return data?.data;

    const lower = searchTerm.toLowerCase();

    if (pagination.groupBy === "simple" && Array.isArray(data.data)) {
      return (data.data as Chat[]).filter(
        (chat) =>
          chat.userMessage.toLowerCase().includes(lower) ||
          chat.aiMessage?.toLowerCase().includes(lower) ||
          chat.sessionId.toLowerCase().includes(lower)
      );
    }

    if (pagination.groupBy === "session" && !Array.isArray(data.data)) {
      const result: Record<string, Chat[]> = {};
      Object.entries(data.data).forEach(([sessionId, sessionChats]) => {
        const matched = sessionChats.filter(
          (chat) =>
            chat.userMessage.toLowerCase().includes(lower) ||
            chat.aiMessage?.toLowerCase().includes(lower) ||
            sessionId.toLowerCase().includes(lower)
        );
        if (matched.length > 0) result[sessionId] = matched;
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
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {formatDate(chat.createdAt)}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="text-sm font-medium text-blue-600">User:</div>
                <p className="text-sm bg-blue-50 p-3 rounded-lg border-l-4 border-blue-200">
                  {chat.userMessage}
                </p>
              </div>

              {chat.aiMessage && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-green-600">AI:</div>
                  <p className="text-sm bg-green-50 p-3 rounded-lg border-l-4 border-green-200">
                    {chat.aiMessage}
                  </p>
                </div>
              )}

              {chat.workflow && (
                <div className="pt-2">
                  <Badge variant="secondary" className="text-xs">
                    Workflow: {chat.workflow}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderSessionView = () => {
    const sessionData = filteredChats as Record<string, Chat[]>;

    return (
      <div className="space-y-6">
        {Object.entries(sessionData).map(([sessionId, sessionChats]) => (
          <Card key={sessionId} className="overflow-hidden pt-0">
            <CardHeader className="bg-muted/50 py-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5" />
                  Session: {sessionId}
                </CardTitle>
                <Badge variant="outline">{sessionChats.length} messages</Badge>
              </div>
              <CardDescription>
                {sessionChats.length > 0 && (
                  <>Started {formatDate(sessionChats[0].createdAt)}</>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-96">
                <div className="p-4 space-y-4">
                  {sessionChats.map((chat, index) => (
                    <div key={chat.id}>
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-600">
                            U
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="text-xs text-muted-foreground">
                              {formatDate(chat.createdAt)}
                            </div>
                            <div className="bg-blue-50 p-3 rounded-lg border-l-4 border-blue-200">
                              <p className="text-sm">{chat.userMessage}</p>
                            </div>
                          </div>
                        </div>

                        {chat.aiMessage && (
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-xs font-medium text-green-600">
                              AI
                            </div>
                            <div className="flex-1">
                              <div className="bg-green-50 p-3 rounded-lg border-l-4 border-green-200">
                                <p className="text-sm">{chat.aiMessage}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {chat.workflow && (
                          <div className="ml-11">
                            <Badge variant="secondary" className="text-xs">
                              Workflow: {chat.workflow}
                            </Badge>
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
        ))}
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Chat History</h1>
          <p className="text-muted-foreground mt-1">
            Browse and search through your conversation history
          </p>
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
    </div>
  );
}
