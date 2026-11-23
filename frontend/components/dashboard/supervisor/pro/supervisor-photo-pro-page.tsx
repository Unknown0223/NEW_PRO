"use client";

import {
  SupervisorPhotoProAgentList,
  type SupervisorPhotoAgentRow
} from "@/components/dashboard/supervisor/pro/supervisor-photo-pro-agents";
import { SupervisorPhotoProGrid } from "@/components/dashboard/supervisor/pro/supervisor-photo-pro-grid";
import {
  SupervisorPhotoProLightbox,
  formatSupervisorPhotoProTime,
  type SupervisorPhotoProItem
} from "@/components/dashboard/supervisor/pro/supervisor-photo-pro-lightbox";
import "@/components/dashboard/supervisor/pro/supervisor-pro-theme.css";
import "@/components/dashboard/supervisor/pro/supervisor-photo-pro-theme.css";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell } from "@/components/dashboard/page-shell";
import { DatePickerPopover, formatRuDateButton, localYmd } from "@/components/ui/date-picker-popover";
import { api } from "@/lib/api";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { STALE } from "@/lib/query-stale";
import { useQuery } from "@tanstack/react-query";
import { Camera, CalendarDays, ChevronLeft, Download, Loader2, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type FeedPhoto = {
  id: number;
  caption: string | null;
  created_at: string;
  client_id: number;
  client_name: string;
  client_city: string | null;
  category: string;
  agent_id: number;
  agent_name: string;
};

type FeedApi = {
  date: string;
  summary: { outlets: number; photo_count: number; agent_count: number };
  photos: FeedPhoto[];
};

const LIMIT_OPTIONS = [10, 20, 50, 100] as const;
const DEFAULT_LIMIT = 20;

function formatModalDate(isoYmd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoYmd);
  if (!m) return isoYmd;
  return `${m[3]}/${m[2]}/${m[1].slice(2)}`;
}

function contentUrl(tenantSlug: string, photoId: number): string {
  return `/api/${tenantSlug}/dashboard/supervisor/photo-reports/${photoId}/content`;
}

export function SupervisorPhotoProPage({
  initialDate,
  initialAgentId
}: {
  initialDate?: string;
  initialAgentId?: string;
}) {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const [date, setDate] = useState(() => initialDate || localYmd(new Date()));
  const [dateOpen, setDateOpen] = useState(false);
  const dateAnchorRef = useRef<HTMLButtonElement | null>(null);
  const [query, setQuery] = useState("");
  const [queryDebounced, setQueryDebounced] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [viewLimit, setViewLimit] = useState(DEFAULT_LIMIT);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(initialAgentId ?? null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate)) setDate(initialDate);
  }, [initialDate]);
  useEffect(() => {
    if (initialAgentId) setSelectedAgentId(initialAgentId);
  }, [initialAgentId]);
  useEffect(() => {
    const t = window.setTimeout(() => setQueryDebounced(query.trim()), 300);
    return () => window.clearTimeout(t);
  }, [query]);

  const feedQ = useQuery({
    queryKey: ["dashboard-supervisor", "photo-feed", tenantSlug, date, queryDebounced],
    enabled: Boolean(tenantSlug) && hydrated,
    staleTime: STALE.report,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const q = new URLSearchParams({ date, limit: "500" });
      if (queryDebounced) q.set("search", queryDebounced);
      const { data } = await api.get<FeedApi>(
        `/api/${tenantSlug}/dashboard/supervisor/photo-reports/feed?${q.toString()}`
      );
      return data;
    }
  });

  const filteredFeed = useMemo(() => {
    let rows = feedQ.data?.photos ?? [];
    if (cityFilter) rows = rows.filter((p) => (p.client_city ?? "") === cityFilter);
    if (categoryFilter) rows = rows.filter((p) => p.category === categoryFilter);
    return rows;
  }, [feedQ.data?.photos, cityFilter, categoryFilter]);

  const cities = useMemo(() => {
    const set = new Set<string>();
    for (const p of feedQ.data?.photos ?? []) if (p.client_city?.trim()) set.add(p.client_city.trim());
    return [...set].sort((a, b) => a.localeCompare(b, "ru"));
  }, [feedQ.data?.photos]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of feedQ.data?.photos ?? []) set.add(p.category);
    return [...set].sort((a, b) => a.localeCompare(b, "ru"));
  }, [feedQ.data?.photos]);

  const agentRows: SupervisorPhotoAgentRow[] = useMemo(() => {
    const map = new Map<
      string,
      { name: string; outlets: Set<number>; cities: Set<string>; cats: Set<string>; count: number }
    >();
    for (const p of filteredFeed) {
      const id = String(p.agent_id);
      let b = map.get(id);
      if (!b) {
        b = { name: p.agent_name, outlets: new Set(), cities: new Set(), cats: new Set(), count: 0 };
        map.set(id, b);
      }
      b.count += 1;
      b.outlets.add(p.client_id);
      if (p.client_city?.trim()) b.cities.add(p.client_city.trim());
      b.cats.add(p.category);
    }
    return [...map.entries()]
      .map(([id, b]) => ({
        id,
        name: b.name,
        photoCount: b.count,
        outlets: b.outlets.size,
        cities: [...b.cities].sort((a, c) => a.localeCompare(c, "ru")),
        categories: [...b.cats].sort((a, c) => a.localeCompare(c, "ru"))
      }))
      .sort((a, b) => b.photoCount - a.photoCount || a.name.localeCompare(b.name, "ru"));
  }, [filteredFeed]);

  const selectedAgent = agentRows.find((a) => a.id === selectedAgentId) ?? null;

  const photos: SupervisorPhotoProItem[] = useMemo(() => {
    if (!selectedAgentId) return [];
    return filteredFeed
      .filter((p) => String(p.agent_id) === selectedAgentId)
      .slice(0, viewLimit)
      .map((p) => ({
        id: p.id,
        caption: p.caption?.trim() || p.category,
        clientName: p.client_name,
        category: p.category,
        createdAt: p.created_at,
        imageUrl: contentUrl(tenantSlug ?? "", p.id),
        agentName: p.agent_name,
        city: p.client_city
      }));
  }, [filteredFeed, selectedAgentId, viewLimit, tenantSlug]);

  const selectedAgentTotal = useMemo(() => {
    if (!selectedAgentId) return 0;
    return filteredFeed.filter((p) => String(p.agent_id) === selectedAgentId).length;
  }, [filteredFeed, selectedAgentId]);

  const exportCsv = async () => {
    const XLSX = await import("xlsx");
    const source = selectedAgentId
      ? filteredFeed.filter((p) => String(p.agent_id) === selectedAgentId)
      : filteredFeed;
    const flat = source.map((p) => ({
      Агент: p.agent_name,
      Клиент: p.client_name,
      Город: p.client_city ?? "",
      Категория: p.category,
      Подпись: p.caption ?? "",
      Время: formatSupervisorPhotoProTime(p.created_at),
      ID: p.id
    }));
    const ws = XLSX.utils.json_to_sheet(flat);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Фотоотчёты");
    XLSX.writeFile(wb, `foto-otchety-${date}.xlsx`);
  };

  const summary = feedQ.data?.summary;
  const dateLabel = formatModalDate(date);

  return (
    <PageShell>
      <PageHeader title="Фото отчёты" description="Сначала список агентов · затем лента снимков" />
      <div className="supervisor-pro supervisor-photo-pro" style={{ display: "grid", gap: 12 }}>
        <div className="panel photo-page-toolbar">
          <div className="photo-page-toolbar-left">
            <div className="photo-pro-header-icon">
              <Camera size={20} />
            </div>
            <div>
              <Link href="/dashboard" className="text-link photo-back">
                <ChevronLeft size={14} aria-hidden />
                Дашборд супервайзера
              </Link>
              <div className="photo-pro-eyebrow">КОНТРОЛЬ ТОРГОВЫХ ТОЧЕК</div>
              <b className="photo-page-toolbar-title">
                {selectedAgent ? selectedAgent.name : "Агенты со снимками"} · {dateLabel}
              </b>
              <p className="photo-page-toolbar-sub">Список агентов, затем лента снимков по выбранному агенту</p>
            </div>
          </div>
          <div className="photo-page-toolbar-right">
            <button
              ref={dateAnchorRef}
              type="button"
              className="sv-date"
              onClick={() => setDateOpen(true)}
            >
              <CalendarDays size={14} />
              <span>{formatRuDateButton(date)}</span>
            </button>
            <DatePickerPopover
              open={dateOpen}
              onOpenChange={setDateOpen}
              value={date}
              onChange={(ymd) => {
                setDate(ymd);
                setSelectedAgentId(null);
                setLightboxIndex(null);
              }}
              anchorRef={dateAnchorRef}
            />
            <button type="button" className="photo-pro-btn" onClick={() => void exportCsv()}>
              <Download size={14} /> Экспорт
            </button>
          </div>
        </div>

        <div className="photo-pro-summary" style={{ margin: 0 }}>
          <div>
            <span>Всего снимков</span>
            <b>{summary?.photo_count ?? 0}</b>
          </div>
          <div>
            <span>Точек</span>
            <b>{summary?.outlets ?? 0}</b>
          </div>
          <div>
            <span>Агентов</span>
            <b>{summary?.agent_count ?? agentRows.length}</b>
          </div>
        </div>

        <div className="panel photo-page-controls">
          <div className="photo-page-filters">
            <label className="photo-filter-field">
              <span>Город</span>
              <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
                <option value="">Все города</option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="photo-filter-field">
              <span>Тип / подпись</span>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="">Все типы</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="photo-filter-field">
              <span>Число снимков на экране</span>
              <select
                value={String(viewLimit)}
                onChange={(e) => setViewLimit(Number.parseInt(e.target.value, 10) || DEFAULT_LIMIT)}
              >
                {LIMIT_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="photo-pro-search photo-filter-search">
              <Search size={15} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по точке, агенту или подписи..."
                aria-label="Поиск"
              />
            </label>
            <button
              type="button"
              className="photo-pro-btn"
              onClick={() => void feedQ.refetch()}
              disabled={feedQ.isFetching}
            >
              {feedQ.isFetching ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Обновить
            </button>
            <button
              type="button"
              className="photo-clear"
              onClick={() => {
                setCityFilter("");
                setCategoryFilter("");
                setQuery("");
                setViewLimit(DEFAULT_LIMIT);
              }}
            >
              Сбросить
            </button>
          </div>
        </div>

        {!hydrated || !tenantSlug || feedQ.isLoading ? (
          <div className="panel photo-empty">
            <Loader2 size={22} className="animate-spin" />
            <b>Загрузка…</b>
          </div>
        ) : feedQ.isError ? (
          <div className="panel photo-empty">
            <Camera size={26} />
            <b>Не удалось загрузить фотоотчёты</b>
            <p>Обновите страницу или перезапустите API (маршрут /feed)</p>
            <button
              type="button"
              className="photo-pro-btn"
              onClick={() => void feedQ.refetch()}
              disabled={feedQ.isFetching}
            >
              {feedQ.isFetching ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Повторить
            </button>
          </div>
        ) : !selectedAgentId ? (
          <section className="panel photo-results">
            <div className="panel-head">
              <div>
                <h2>Агенты</h2>
                <p>Выберите агента, чтобы открыть его снимки</p>
              </div>
              <span className="photo-result-count">{agentRows.length} агентов</span>
            </div>
            <SupervisorPhotoProAgentList
              rows={agentRows}
              onSelect={(id) => {
                setSelectedAgentId(id);
                setLightboxIndex(null);
              }}
            />
          </section>
        ) : (
          <SupervisorPhotoProGrid
            agentName={selectedAgent?.name ?? "Агент"}
            photos={photos}
            total={selectedAgentTotal}
            viewLimit={viewLimit}
            onBack={() => {
              setSelectedAgentId(null);
              setLightboxIndex(null);
            }}
            onOpen={setLightboxIndex}
          />
        )}
      </div>

      {lightboxIndex != null && photos.length ? (
        <div className="supervisor-pro supervisor-photo-pro">
          <SupervisorPhotoProLightbox
            photos={photos}
            index={lightboxIndex}
            agentName={photos[lightboxIndex]?.agentName ?? selectedAgent?.name ?? "—"}
            dateLabel={dateLabel}
            onClose={() => setLightboxIndex(null)}
            onNavigate={setLightboxIndex}
          />
        </div>
      ) : null}
    </PageShell>
  );
}
