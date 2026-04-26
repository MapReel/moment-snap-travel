import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  searchPlaces,
  getPlaceDetails,
  type PlaceSearchResult,
  type PlaceDetails,
} from "@/server/places.functions";

type Place = {
  name: string;
  sub: string;
  hasVid: boolean;
  fill: string;
};
type Trip = {
  name: string;
  date: string;
  color: string;
  places: Place[];
};

const initialTrips: Trip[] = [
  {
    name: "도쿄 여행",
    date: "2024.11.08 – 11.12",
    color: "#1D9E75",
    places: [
      { name: "Senso-ji Temple", sub: "11.08 · 신사", hasVid: true, fill: "#5DCAA5" },
      { name: "Nakamise Shopping Street", sub: "11.08 · 쇼핑", hasVid: true, fill: "#7F77DD" },
      { name: "Kinefuku Asakusa Sweets", sub: "11.09 · 디저트", hasVid: true, fill: "#533483" },
      { name: "Tokyo Skytree", sub: "11.09 · 전망대", hasVid: false, fill: "#888780" },
    ],
  },
  {
    name: "오사카·교토 여행",
    date: "2024.08.20 – 08.25",
    color: "#7F77DD",
    places: [
      { name: "Fushimi Inari", sub: "08.21 · 신사", hasVid: true, fill: "#E24B4A" },
      { name: "Dotonbori", sub: "08.22 · 관광", hasVid: false, fill: "#EF9F27" },
    ],
  },
];

type Tab = "search" | "detail" | "trip";
type TripView = "list" | "new" | "detail";
type RecState = 0 | 1 | 2;

export function TravelMoment() {
  const [tab, setTab] = useState<Tab>("search");
  const [trips, setTrips] = useState<Trip[]>(initialTrips);
  const [tripView, setTripView] = useState<TripView>("list");
  const [currentTripIdx, setCurrentTripIdx] = useState(0);
  const [checked, setChecked] = useState<boolean[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Recording
  const [recState, setRecState] = useState<RecState>(0);
  const [recRemain, setRecRemain] = useState(3);
  const [recProgress, setRecProgress] = useState(0);
  const [blink, setBlink] = useState(true);
  const [clips, setClips] = useState<string[]>([]); // object URLs of recorded videos
  const [activeClipIdx, setActiveClipIdx] = useState<number>(0);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedThumbs = clips.length;

  // New trip form
  const [newTripName, setNewTripName] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");

  // Google Places state
  const [searchQuery, setSearchQuery] = useState("Asakusa");
  const [searchResults, setSearchResults] = useState<PlaceSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<PlaceDetails | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const searchPlacesFn = useServerFn(searchPlaces);
  const getPlaceDetailsFn = useServerFn(getPlaceDetails);

  // Debounced search
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }
    setSearchLoading(true);
    const t = setTimeout(async () => {
      try {
        const { results, error } = await searchPlacesFn({ data: { query: q } });
        setSearchResults(results);
        setSearchError(error);
      } catch (e) {
        console.error(e);
        setSearchError("검색 중 오류가 발생했어요");
      } finally {
        setSearchLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [searchQuery, searchPlacesFn]);

  const openPlaceDetail = async (placeId: string) => {
    setTab("detail");
    setDetailLoading(true);
    setSelectedPlace(null);
    try {
      const { place, error } = await getPlaceDetailsFn({ data: { placeId } });
      if (error) showToast(error);
      setSelectedPlace(place);
    } catch (e) {
      console.error(e);
      showToast("상세 조회 중 오류가 발생했어요");
    } finally {
      setDetailLoading(false);
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  const showTripDetail = (idx: number) => {
    setCurrentTripIdx(idx);
    setChecked(trips[idx].places.map(() => false));
    setTripView("detail");
  };

  const toggleCheck = (i: number) =>
    setChecked((c) => c.map((v, idx) => (idx === i ? !v : v)));
  const toggleAll = () => {
    const all = checked.every(Boolean);
    setChecked(checked.map(() => !all));
  };
  const selectedCount = checked.filter(Boolean).length;

  const exportIndiv = () => {
    if (!selectedCount) return;
    showToast(`${selectedCount}개 장소 영상 개별 저장 완료`);
  };
  const exportMerge = () => {
    if (!selectedCount) return;
    showToast(`${selectedCount}개 클립 합치는 중...`);
    setTimeout(() => showToast("여행 영상 저장 완료!"), 1800);
  };

  const createTrip = () => {
    const name = newTripName.trim();
    if (!name) {
      showToast("여행 이름을 입력해주세요");
      return;
    }
    const colors = ["#D4537E", "#BA7517", "#378ADD", "#E24B4A", "#533483"];
    const date =
      dateStart && dateEnd
        ? `${dateStart.replace(/-/g, ".")} – ${dateEnd.replace(/-/g, ".")}`
        : "기간 미설정";
    setTrips((t) => [
      ...t,
      { name, date, color: colors[t.length % colors.length], places: [] },
    ]);
    setNewTripName("");
    setDateStart("");
    setDateEnd("");
    showToast(`"${name}" 여행이 만들어졌어요`);
    setTripView("list");
  };

  // Sheet
  const openSheet = () => {
    setSheetOpen(true);
    requestAnimationFrame(() => setSheetVisible(true));
  };
  const closeSheet = () => {
    setSheetVisible(false);
    setTimeout(() => setSheetOpen(false), 280);
  };
  const addToTrip = (idx: number) => {
    const placeName = selectedPlace?.name ?? "장소";
    const subType = selectedPlace?.primaryType ?? "장소";
    let already = false;
    setTrips((curr) =>
      curr.map((t, i) => {
        if (i !== idx) return t;
        if (t.places.some((p) => p.name === placeName)) {
          already = true;
          return t;
        }
        return {
          ...t,
          places: [
            ...t.places,
            {
              name: placeName,
              sub: `추가됨 · ${subType}`,
              hasVid: recState === 2,
              fill: "#533483",
            },
          ],
        };
      })
    );
    closeSheet();
    setTimeout(
      () => showToast(already ? "이미 추가된 장소예요" : `"${trips[idx].name}"에 추가됐어요`),
      0
    );
  };

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      clips.forEach((u) => URL.revokeObjectURL(u));
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopStream = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try {
        recorderRef.current.stop();
      } catch {}
    }
    recorderRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const pickMimeType = (): string | undefined => {
    if (typeof MediaRecorder === "undefined") return undefined;
    const candidates = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4",
    ];
    return candidates.find((c) => MediaRecorder.isTypeSupported(c));
  };

  const startRec = async () => {
    if (recState !== 0) return;

    // Try real camera; fall back to simulation
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      runSimulatedRec();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      setRecState(1);

      // Attach to preview
      requestAnimationFrame(() => {
        const v = videoPreviewRef.current;
        if (v) {
          v.srcObject = stream;
          v.muted = true;
          v.playsInline = true;
          v.play().catch(() => {});
        }
      });

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType || "video/webm" });
        const url = URL.createObjectURL(blob);
        setClips((c) => {
          setActiveClipIdx(c.length);
          return [...c, url];
        });
        setRecState(2);
        // stop tracks
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        recorderRef.current = null;
      };

      recorder.start();

      // 3-second progress
      let elapsed = 0;
      setRecProgress(0);
      setRecRemain(3);
      const blinkI = setInterval(() => setBlink((b) => !b), 500);
      const recI = setInterval(() => {
        elapsed += 100;
        setRecProgress((elapsed / 3000) * 100);
        setRecRemain(Math.max(0, Math.ceil((3000 - elapsed) / 1000)));
        if (elapsed >= 3000) {
          clearInterval(recI);
          clearInterval(blinkI);
          if (recorder.state === "recording") {
            try {
              recorder.stop();
            } catch {}
          }
        }
      }, 100);
    } catch (err) {
      console.warn("Camera unavailable, falling back to simulation", err);
      showToast("카메라 권한이 없어 시뮬레이션으로 진행해요");
      runSimulatedRec();
    }
  };

  const runSimulatedRec = () => {
    setRecState(1);
    let elapsed = 0;
    setRecProgress(0);
    setRecRemain(3);
    const blinkI = setInterval(() => setBlink((b) => !b), 500);
    const recI = setInterval(() => {
      elapsed += 100;
      setRecProgress((elapsed / 3000) * 100);
      setRecRemain(Math.max(0, Math.ceil((3000 - elapsed) / 1000)));
      if (elapsed >= 3000) {
        clearInterval(recI);
        clearInterval(blinkI);
        setRecState(2);
        setClips((c) => {
          setActiveClipIdx(c.length);
          return [...c, ""]; // empty url = simulated
        });
      }
    }, 100);
  };

  const resetRec = () => {
    setRecState(0);
    setRecProgress(0);
    setRecRemain(3);
  };

  const trip = trips[currentTripIdx];

  return (
    <div className="flex min-h-screen items-start justify-center bg-phone-bg px-0 py-6 pb-12">
      <div className="w-[360px] rounded-[44px] border border-border bg-phone-bezel p-3 shadow-[0_20px_60px_rgba(0,0,0,0.15)]">
        <div className="relative min-h-[640px] overflow-hidden rounded-[34px] bg-card">
          {/* Status bar */}
          <div className="flex justify-between bg-card px-[18px] pb-1 pt-[10px]">
            <span className="text-[11px] text-muted-foreground">12:52</span>
            <span className="text-[11px] text-muted-foreground">Seoul</span>
          </div>
          {/* Tabs */}
          <div className="flex border-b border-border bg-card">
            {(["search", "detail", "trip"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 border-b-2 py-[9px] text-[12px] font-medium transition-all ${
                  tab === t
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground"
                }`}
              >
                {t === "search" ? "장소 검색" : t === "detail" ? "장소 상세" : "내 여행"}
              </button>
            ))}
          </div>

          {tab === "search" && <SearchView onOpenDetail={() => setTab("detail")} />}
          {tab === "detail" && (
            <DetailView
              recState={recState}
              recRemain={recRemain}
              recProgress={recProgress}
              blink={blink}
              clips={clips}
              activeClipIdx={activeClipIdx}
              setActiveClipIdx={setActiveClipIdx}
              videoPreviewRef={videoPreviewRef}
              onStartRec={startRec}
              onResetRec={resetRec}
              onAdd={openSheet}
            />
          )}
          {tab === "trip" && (
            <TripTab
              tripView={tripView}
              setTripView={setTripView}
              trips={trips}
              showTripDetail={showTripDetail}
              currentTrip={trip}
              checked={checked}
              toggleCheck={toggleCheck}
              toggleAll={toggleAll}
              selectedCount={selectedCount}
              exportIndiv={exportIndiv}
              exportMerge={exportMerge}
              newTripName={newTripName}
              setNewTripName={setNewTripName}
              dateStart={dateStart}
              setDateStart={setDateStart}
              dateEnd={dateEnd}
              setDateEnd={setDateEnd}
              createTrip={createTrip}
            />
          )}

          {/* Bottom sheet */}
          {sheetOpen && (
            <div
              className={`absolute inset-0 z-10 rounded-[34px] bg-black/35 ${
                sheetVisible ? "block" : "block"
              }`}
              onClick={closeSheet}
            >
              <div
                className={`absolute inset-x-0 bottom-0 rounded-t-[20px] bg-card pb-5 transition-transform duration-300 ${
                  sheetVisible ? "translate-y-0" : "translate-y-full"
                }`}
                style={{ transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)" }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mx-auto mb-[14px] mt-[10px] h-1 w-9 rounded bg-border" />
                <div className="border-b border-border px-4 pb-[10px] text-[13px] font-bold text-foreground">
                  어느 여행에 추가할까요?
                </div>
                {trips.map((t, i) => (
                  <div
                    key={i}
                    className="flex cursor-pointer items-center gap-[10px] border-b border-border px-4 py-3 transition-colors hover:bg-muted"
                    onClick={() => addToTrip(i)}
                  >
                    <div
                      className="h-[10px] w-[10px] flex-shrink-0 rounded-full"
                      style={{ background: t.color }}
                    />
                    <div>
                      <div className="text-[13px] font-semibold text-foreground">{t.name}</div>
                      <div className="text-[11px] text-muted-foreground">{t.date}</div>
                    </div>
                  </div>
                ))}
                <div
                  className="flex cursor-pointer items-center gap-2 px-4 py-3 text-primary transition-colors hover:bg-primary-soft"
                  onClick={() => {
                    closeSheet();
                    setTab("trip");
                    setTripView("new");
                  }}
                >
                  <PlusCircleIcon />
                  <span className="text-[13px] font-semibold">새 여행 만들기</span>
                </div>
              </div>
            </div>
          )}

          {/* Toast */}
          <div
            className={`pointer-events-none absolute bottom-5 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/90 px-4 py-[7px] text-[12px] font-medium text-white backdrop-blur transition-opacity duration-300 ${
              toast ? "opacity-100" : "opacity-0"
            }`}
          >
            {toast ?? ""}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Subviews ---------------- */

function SearchView({ onOpenDetail }: { onOpenDetail: () => void }) {
  const items = [
    {
      name: "Kinefuku Asakusa Sweets",
      sub: "杵福 · Asakusa, Taito City, Tokyo",
      badge: "영업중 · 17:00 마감",
      closed: false,
      onClick: onOpenDetail,
    },
    {
      name: "Senso-ji Temple",
      sub: "浅草寺 · 2-3-1 Asakusa, Taito",
      badge: "영업중",
      closed: false,
    },
    {
      name: "Nakamise Shopping Street",
      sub: "仲見世通り · Asakusa, Taito",
      badge: "영업종료",
      closed: true,
    },
  ];
  return (
    <div>
      <div className="flex items-center gap-2 border-b border-border px-3 py-[10px]">
        <input
          className="flex-1 rounded-full border border-border bg-muted px-[14px] py-2 text-[13px] text-foreground outline-none"
          placeholder="장소 검색... (Google Places 연동)"
          defaultValue="Asakusa"
        />
        <button
          onClick={onOpenDetail}
          className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full bg-primary"
          aria-label="검색"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </button>
      </div>
      {items.map((it, i) => (
        <div
          key={i}
          className="flex cursor-pointer items-center gap-[10px] border-b border-border px-[14px] py-3 transition-colors hover:bg-muted"
          onClick={it.onClick}
        >
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary-soft">
            <PinIcon />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-foreground">{it.name}</div>
            <div className="mt-px text-[11px] text-muted-foreground">{it.sub}</div>
            <span
              className={`mt-[3px] inline-block rounded-full px-[7px] py-[2px] text-[10px] ${
                it.closed
                  ? "bg-destructive/10 text-destructive"
                  : "bg-primary-soft text-primary-strong"
              }`}
            >
              {it.badge}
            </span>
          </div>
          <div className="ml-auto text-[16px] text-border">›</div>
        </div>
      ))}
      <div className="px-[14px] pb-[14px] pt-[10px] text-center text-[11px] text-muted-foreground">
        Google Places API 연동 · 실시간 장소 정보
      </div>
    </div>
  );
}

function DetailView({
  recState,
  recRemain,
  recProgress,
  blink,
  clips,
  activeClipIdx,
  setActiveClipIdx,
  videoPreviewRef,
  onStartRec,
  onResetRec,
  onAdd,
}: {
  recState: RecState;
  recRemain: number;
  recProgress: number;
  blink: boolean;
  clips: string[];
  activeClipIdx: number;
  setActiveClipIdx: (i: number) => void;
  videoPreviewRef: React.RefObject<HTMLVideoElement | null>;
  onStartRec: () => void;
  onResetRec: () => void;
  onAdd: () => void;
}) {
  const recordedThumbs = clips.length;
  const activeClipUrl = clips[activeClipIdx];
  const playbackRef = useRef<HTMLVideoElement | null>(null);

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-border px-[14px] pb-2 pt-[10px]">
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-border bg-muted">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </div>
        <span className="flex-1 text-[13px] font-semibold text-foreground">장소 상세</span>
      </div>

      {/* Map */}
      <div className="relative h-[110px] w-full overflow-hidden bg-[#C8E6C9]">
        <svg viewBox="0 0 360 110" className="absolute h-full w-full" preserveAspectRatio="xMidYMid slice">
          <rect width="360" height="110" fill="#C8E6C9" />
          <rect x="80" y="15" width="60" height="30" rx="2" fill="#A5D6A7" opacity="0.7" />
          <rect x="155" y="40" width="80" height="25" rx="2" fill="#A5D6A7" opacity="0.6" />
          <rect x="40" y="60" width="50" height="35" rx="2" fill="#A5D6A7" opacity="0.6" />
          <rect x="220" y="20" width="70" height="40" rx="2" fill="#A5D6A7" opacity="0.5" />
          <rect x="100" y="55" width="110" height="8" rx="2" fill="white" opacity="0.7" />
          <line x1="0" y1="37" x2="360" y2="37" stroke="white" strokeWidth="0.5" opacity="0.5" />
          <line x1="0" y1="74" x2="360" y2="74" stroke="white" strokeWidth="0.5" opacity="0.5" />
          <circle cx="175" cy="58" r="9" fill="#E24B4A" />
          <circle cx="175" cy="58" r="4" fill="white" />
        </svg>
        <div className="absolute bottom-[6px] right-2 rounded bg-white/85 px-[7px] py-[2px] text-[10px] font-semibold text-[#1B5E20]">
          Google Maps
        </div>
      </div>

      <div className="px-[14px] pb-2 pt-3">
        <div className="mb-[3px] text-[17px] font-bold text-foreground">Kinefuku Asakusa Sweets</div>
        <div className="mb-1 text-[12px] text-muted-foreground">
          ★★★★☆ 4.4 (107) · 디저트 · ¥1–1,000 ·{" "}
          <span className="font-semibold text-primary">영업중</span>
        </div>
        <div className="text-[11px] text-muted-foreground/70">
          1 Chome-30-12 Asakusa, Taito City, Tokyo
        </div>
      </div>

      <div className="flex gap-[6px] px-[14px] pb-3 pt-2">
        <button className="flex-1 rounded-full border border-border bg-card px-1 py-[7px] text-[11px] font-medium text-foreground hover:bg-muted">
          길찾기
        </button>
        <button className="flex-1 rounded-full border border-border bg-card px-1 py-[7px] text-[11px] font-medium text-foreground hover:bg-muted">
          공유
        </button>
        <button
          onClick={onAdd}
          className="flex-1 rounded-full border border-primary bg-primary px-1 py-[7px] text-[11px] font-medium text-primary-foreground hover:bg-primary-strong"
        >
          여행에 추가 +
        </button>
      </div>

      {/* Video */}
      <div className="px-[14px] pb-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12px] font-semibold text-muted-foreground">내 순간 기록</span>
          <span className="text-[11px] text-primary">
            {recordedThumbs > 0 ? `영상 ${recordedThumbs}개` : "영상 없음"}
          </span>
        </div>
        <div className="relative w-full overflow-hidden rounded-[10px] border border-border bg-black aspect-video">
          {recState === 0 && !activeClipUrl && (
            <div
              onClick={onStartRec}
              className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-[10px] bg-muted"
            >
              <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full border-2 border-primary transition-colors hover:border-primary-strong">
                <div className="h-[18px] w-[18px] rounded-full bg-rec" />
              </div>
              <span className="text-[11px] text-muted-foreground">눌러서 3초 영상 촬영</span>
            </div>
          )}

          {recState === 1 && (
            <>
              <video
                ref={videoPreviewRef}
                className="absolute inset-0 h-full w-full object-cover"
                autoPlay
                muted
                playsInline
              />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2">
                <div
                  className="absolute left-[10px] top-[10px] h-2 w-2 rounded-full bg-rec transition-opacity"
                  style={{ opacity: blink ? 1 : 0 }}
                />
                <div className="absolute left-6 top-[10px] text-[10px] font-semibold text-white drop-shadow">
                  REC
                </div>
                <div className="text-[48px] font-bold text-white drop-shadow-lg">
                  {recRemain > 0 ? recRemain : ""}
                </div>
                <div className="absolute bottom-3 h-[3px] w-[65%] overflow-hidden rounded bg-white/30">
                  <div
                    className="h-full bg-rec transition-all"
                    style={{ width: `${recProgress}%` }}
                  />
                </div>
              </div>
            </>
          )}

          {recState === 2 && activeClipUrl && (
            <>
              <video
                ref={playbackRef}
                key={activeClipUrl}
                src={activeClipUrl}
                className="absolute inset-0 h-full w-full object-cover"
                controls
                playsInline
                onClick={(e) => {
                  const v = e.currentTarget;
                  if (v.paused) v.play();
                  else v.pause();
                }}
              />
              <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/50 to-transparent p-2">
                <span className="rounded-full bg-primary/90 px-2 py-[3px] text-[10px] text-white">
                  REC · 3초
                </span>
                <span className="text-[11px] font-semibold text-white drop-shadow">
                  Kinefuku
                </span>
              </div>
            </>
          )}

          {recState === 2 && !activeClipUrl && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#1a1a2e] text-[11px] text-white/60">
              (시뮬레이션 영상)
            </div>
          )}
        </div>

        <div className="mt-2 flex gap-[6px]">
          {clips.map((url, i) => (
            <button
              key={i}
              onClick={() => {
                if (recState === 1) return;
                setActiveClipIdx(i);
                if (recState !== 2) onResetRec();
              }}
              className={`h-[54px] w-[54px] flex-shrink-0 overflow-hidden rounded-[7px] ${
                i === activeClipIdx && recState === 2
                  ? "border-[1.5px] border-primary"
                  : "border border-border"
              }`}
            >
              {url ? (
                <video
                  src={url}
                  className="h-full w-full object-cover"
                  muted
                  playsInline
                  preload="metadata"
                />
              ) : (
                <svg viewBox="0 0 54 54" className="h-full w-full">
                  <rect width="54" height="54" fill="#1a1a2e" />
                  <polygon points="21,15 41,27 21,39" fill="rgba(255,255,255,0.7)" />
                </svg>
              )}
            </button>
          ))}
          <div
            onClick={() => {
              if (recState !== 0) onResetRec();
              setTimeout(onStartRec, 0);
            }}
            className="flex h-[54px] w-[54px] flex-shrink-0 cursor-pointer items-center justify-center rounded-[7px] border border-dashed border-border text-[20px] text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            +
          </div>
        </div>
      </div>
    </div>
  );
}

function TripTab(props: {
  tripView: TripView;
  setTripView: (v: TripView) => void;
  trips: Trip[];
  showTripDetail: (i: number) => void;
  currentTrip: Trip;
  checked: boolean[];
  toggleCheck: (i: number) => void;
  toggleAll: () => void;
  selectedCount: number;
  exportIndiv: () => void;
  exportMerge: () => void;
  newTripName: string;
  setNewTripName: (s: string) => void;
  dateStart: string;
  setDateStart: (s: string) => void;
  dateEnd: string;
  setDateEnd: (s: string) => void;
  createTrip: () => void;
}) {
  const {
    tripView,
    setTripView,
    trips,
    showTripDetail,
    currentTrip,
    checked,
    toggleCheck,
    toggleAll,
    selectedCount,
    exportIndiv,
    exportMerge,
    newTripName,
    setNewTripName,
    dateStart,
    setDateStart,
    dateEnd,
    setDateEnd,
    createTrip,
  } = props;

  if (tripView === "list") {
    return (
      <div>
        <div className="flex items-center justify-between border-b border-border px-[14px] pb-2 pt-[10px]">
          <span className="text-[14px] font-semibold text-foreground">내 여행</span>
          <div
            onClick={() => setTripView("new")}
            className="cursor-pointer text-[12px] font-semibold text-primary"
          >
            + 새 여행
          </div>
        </div>
        {trips.map((t, i) => (
          <div
            key={i}
            className="flex cursor-pointer items-center gap-[10px] border-b border-border px-[14px] py-[13px] transition-colors hover:bg-muted"
            onClick={() => showTripDetail(i)}
          >
            <div
              className="h-[10px] w-[10px] flex-shrink-0 rounded-full"
              style={{ background: t.color }}
            />
            <div className="flex-1">
              <div className="text-[13px] font-semibold text-foreground">{t.name}</div>
              <div className="mt-px text-[11px] text-muted-foreground">{t.date}</div>
            </div>
            <div className="mr-1 text-[11px] text-muted-foreground">
              {t.places.length}곳 · 영상 {t.places.filter((p) => p.hasVid).length}
            </div>
            <div className="text-[16px] text-border">›</div>
          </div>
        ))}
        <div
          onClick={() => setTripView("new")}
          className="flex cursor-pointer items-center gap-2 border-b border-border px-[14px] py-[13px] text-primary transition-colors hover:bg-primary-soft"
        >
          <PlusCircleIcon />
          <span className="text-[13px] font-semibold">새 여행 만들기</span>
        </div>
      </div>
    );
  }

  if (tripView === "new") {
    return (
      <div>
        <div className="flex items-center gap-2 border-b border-border px-[14px] pb-2 pt-[10px]">
          <button
            onClick={() => setTripView("list")}
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-border bg-muted"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <span className="flex-1 text-[13px] font-semibold text-foreground">새 여행 만들기</span>
        </div>
        <div className="p-4">
          <div className="mb-[5px] text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            여행 이름
          </div>
          <input
            value={newTripName}
            onChange={(e) => setNewTripName(e.target.value)}
            placeholder="예) 도쿄 여행, 유럽 한달살기"
            className="mb-4 w-full rounded-[10px] border border-border bg-card px-[13px] py-[10px] text-[14px] text-foreground outline-none transition-colors focus:border-primary"
          />
          <div className="mb-[5px] text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            기간
          </div>
          <div className="mb-5 flex gap-2">
            <input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="flex-1 rounded-[10px] border border-border bg-card px-[10px] py-[9px] text-[12px] text-foreground outline-none transition-colors focus:border-primary"
            />
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="flex-1 rounded-[10px] border border-border bg-card px-[10px] py-[9px] text-[12px] text-foreground outline-none transition-colors focus:border-primary"
            />
          </div>
          <button
            onClick={createTrip}
            className="w-full rounded-xl bg-primary px-3 py-3 text-[14px] font-semibold text-primary-foreground transition-colors hover:bg-primary-strong"
          >
            여행 만들기
          </button>
        </div>
      </div>
    );
  }

  // detail
  return (
    <div>
      <div className="flex items-center gap-2 border-b border-border px-[14px] pb-2 pt-[10px]">
        <button
          onClick={() => setTripView("list")}
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-border bg-muted"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="text-[13px] font-semibold text-foreground">{currentTrip.name}</span>
        <div className="ml-auto text-[11px] text-muted-foreground">{currentTrip.date}</div>
      </div>
      <div className="flex items-center justify-between border-b border-border bg-muted/60 px-[14px] py-2">
        <div className="text-[11px] text-muted-foreground">
          {selectedCount > 0 ? `${selectedCount}개 선택됨` : "0개 선택됨"}
        </div>
        <div onClick={toggleAll} className="cursor-pointer text-[11px] font-semibold text-primary">
          전체 선택
        </div>
      </div>
      <div>
        {currentTrip.places.map((p, i) => (
          <div
            key={i}
            className="flex items-center gap-[10px] border-b border-border px-[14px] py-[11px] transition-colors hover:bg-muted"
          >
            <div
              onClick={() => toggleCheck(i)}
              className={`flex h-[22px] w-[22px] flex-shrink-0 cursor-pointer items-center justify-center rounded-md border-[1.5px] transition-all ${
                checked[i] ? "border-primary bg-primary" : "border-border"
              }`}
            >
              {checked[i] && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            <div className="h-[46px] w-[46px] flex-shrink-0 overflow-hidden rounded-[7px]">
              <svg viewBox="0 0 46 46" className="h-full w-full">
                <rect width="46" height="46" fill={p.fill} />
                {p.hasVid ? (
                  <polygon points="18,13 34,23 18,33" fill="rgba(255,255,255,0.75)" />
                ) : (
                  <rect
                    x="14"
                    y="14"
                    width="18"
                    height="18"
                    rx="2"
                    fill="rgba(255,255,255,0.15)"
                    stroke="rgba(255,255,255,0.35)"
                    strokeWidth="1"
                  />
                )}
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-[13px] font-semibold text-foreground">{p.name}</div>
              <div className="text-[11px] text-muted-foreground">{p.sub}</div>
              <span
                className={`mt-[3px] inline-block rounded-full px-[6px] py-[2px] text-[10px] ${
                  p.hasVid
                    ? "bg-primary-soft text-primary-strong"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {p.hasVid ? "영상 있음" : "영상 없음"}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 border-t border-border bg-card px-[14px] pb-[14px] pt-[10px]">
        <button
          onClick={exportIndiv}
          disabled={selectedCount === 0}
          className="flex-1 rounded-[11px] border border-border bg-card py-[9px] text-[12px] font-semibold text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-35"
        >
          개별 저장
        </button>
        <button
          onClick={exportMerge}
          disabled={selectedCount === 0}
          className="flex-1 rounded-[11px] border border-primary bg-primary py-[9px] text-[12px] font-semibold text-primary-foreground transition-colors hover:bg-primary-strong disabled:pointer-events-none disabled:opacity-35"
        >
          선택 영상 합치기
        </button>
      </div>
    </div>
  );
}

function PinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
function PlusCircleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}
