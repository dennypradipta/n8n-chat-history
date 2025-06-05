import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";

type Response = {
  data: {
    allTime: number;
    yearly: number;
    monthly: number;
    daily: number;
  };
};

export default function Stats() {
  const { data, isLoading } = useQuery<Response>({
    queryKey: ["chats"],
    queryFn: () => fetch("/api/stats").then((res) => res.json()),
  });

  return (
    <Card>
      <CardContent className="flex flex-col gap-2">
        <h2 className="text-xl font-bold">Statistics</h2>
        <div className="flex items-center gap-4 w-full">
          <NumberCard
            isLoading={isLoading}
            count={data?.data.daily || 0}
            context="Daily"
          />
          <Separator orientation="vertical" className="!h-[60px]" />
          <NumberCard
            isLoading={isLoading}
            count={data?.data.monthly || 0}
            context="Monthly"
          />
          <Separator orientation="vertical" className="!h-[60px]" />
          <NumberCard
            isLoading={isLoading}
            count={data?.data.yearly || 0}
            context="Yearly"
          />
          <Separator orientation="vertical" className="!h-[60px]" />
          <NumberCard
            isLoading={isLoading}
            count={data?.data.allTime || 0}
            context="All Time"
          />
        </div>
      </CardContent>
    </Card>
  );
}

const NumberCard = ({
  isLoading,
  count,
  context,
}: {
  isLoading: boolean;
  count: number;
  context: string;
}) => {
  return (
    <div className="flex flex-col gap-1 w-full items-center">
      {isLoading ? (
        <Skeleton className="h-9 w-full" />
      ) : (
        <p className="text-3xl font-bold">
          {new Intl.NumberFormat("id", {
            notation: "compact",
          }).format(count)}
        </p>
      )}

      <p className="text-sm font-medium">{context}</p>
    </div>
  );
};
