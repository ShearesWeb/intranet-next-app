"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { MonthGrid } from "@/components/facilities/month-grid";
import { DayDetailPanel } from "@/components/facilities/day-detail-panel";
import { VenueFilter } from "@/components/facilities/venue-filter";
import { TypeFilter } from "@/components/facilities/type-filter";
import { ClaimDialog } from "@/components/facilities/claim-dialog";
import { FacilitySlotWithClaims, BookingType } from "@/types/facilities";
import { Skeleton } from "@/components/ui/skeleton";

function getMonthRange(year: number, month: number) {
  const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

export default function FacilitiesPage() {
  const { user } = useAuth();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(
    today.toISOString().split("T")[0],
  );
  const [slots, setSlots] = useState<FacilitySlotWithClaims[]>([]);
  const [loading, setLoading] = useState(true);
  const [venueFilter, setVenueFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<BookingType[]>([]);
  const [claimSlot, setClaimSlot] = useState<FacilitySlotWithClaims | null>(null);

  const isChair = useMemo(() => {
    if (!user) return false;
    if (user.is_admin) return true;
    return user.appointments.some(
      (a) => a.position_type === "lead" || a.position_type === "vice",
    );
  }, [user]);

  const chairCca = useMemo(() => {
    if (!user) return null;
    const appointment = user.appointments.find(
      (a) => a.position_type === "lead" || a.position_type === "vice",
    );
    return appointment ? { id: appointment.cca_id, name: appointment.cca_name } : null;
  }, [user]);

  const fetchSlots = useCallback(async () => {
    const { start, end } = getMonthRange(year, month);
    setLoading(true);
    try {
      const res = await fetch(`/api/facilities/slots?start=${start}&end=${end}`);
      if (res.ok) {
        const json = await res.json();
        setSlots(json.data ?? []);
      }
    } catch {
      // silent — calendar shows empty
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  const allVenues = useMemo(() => {
    const set = new Set<string>();
    for (const s of slots) set.add(s.sub_venue);
    return [...set].sort();
  }, [slots]);

  const filteredSlots = useMemo(() => {
    return slots.filter((s) => {
      if (venueFilter.length > 0 && !venueFilter.includes(s.sub_venue)) return false;
      if (typeFilter.length > 0 && !typeFilter.includes(s.type)) return false;
      return true;
    });
  }, [slots, venueFilter, typeFilter]);

  const daySlots = useMemo(() => {
    if (!selectedDate) return [];
    return filteredSlots.filter((s) => s.booked_date === selectedDate);
  }, [filteredSlots, selectedDate]);

  function handleChangeMonth(y: number, m: number) {
    setYear(y);
    setMonth(m);
  }

  return (
    <AppLayout>
      <PageHeader title="Facilities" description="Browse and claim venue slots for your CCA" />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <VenueFilter
          venues={allVenues}
          selected={venueFilter}
          onChange={setVenueFilter}
        />
        <div className="mx-2 h-6 w-px bg-border" />
        <TypeFilter selected={typeFilter} onChange={setTypeFilter} />
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="w-full lg:w-[320px] shrink-0">
          {loading ? (
            <Skeleton className="h-[320px] w-full rounded-lg" />
          ) : (
            <MonthGrid
              year={year}
              month={month}
              selectedDate={selectedDate}
              slots={filteredSlots}
              onSelectDate={setSelectedDate}
              onChangeMonth={handleChangeMonth}
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : selectedDate ? (
            <DayDetailPanel
              date={selectedDate}
              slots={daySlots}
              isChair={isChair}
              onClaim={setClaimSlot}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Select a day to view available slots.</p>
          )}
        </div>
      </div>

      {chairCca && (
        <ClaimDialog
          slot={claimSlot}
          ccaId={chairCca.id}
          ccaName={chairCca.name}
          onClose={() => setClaimSlot(null)}
          onSuccess={fetchSlots}
        />
      )}
    </AppLayout>
  );
}
