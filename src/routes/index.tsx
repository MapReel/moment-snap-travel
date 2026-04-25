import { createFileRoute } from "@tanstack/react-router";
import { TravelMoment } from "@/components/TravelMoment";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Travel Moment — 여행의 순간을 기록하세요" },
      {
        name: "description",
        content: "장소를 검색하고 3초 영상으로 여행의 순간을 기록·합쳐보세요.",
      },
    ],
  }),
});

function Index() {
  return <TravelMoment />;
}
