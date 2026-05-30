"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { ManageMonthGrid } from "@/components/facilities/manage-month-grid";
import { ManageDayPanel } from "@/components/facilities/manage-day-panel";
import { SlotFormDialog } from "@/components/facilities/slot-form-dialog";
import { VenueFilter } from "@/components/facilities/venue-filter";
import { TypeFilter } from "@/components/facilities/type-filter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FacilityBooking, BookingType } from "@/types/facilities";
import { toast } from "sonner";
import { Shield, Plus, Calendar } from "lucide-react";

export type ManagedSlot = FacilityBooking & { claim_count: number };

function getMonthRange(year: number, month: number) {
  const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

export default function FacilitiesManagePage() {
  const { user } = useAuth();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(
    today.toISOString().split("T")[0],
  );
  const [slots, setSlots] = useState<ManagedSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [venueFilter, setVenueFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<BookingType[]>([]);

  const fetchSlots = useCallback(async () => {
    const { start, end } = getMonthRange(year, month);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/facilities/manage?start=${start}&end=${end}`,
      );
      if (res.ok) {
        const json = await res.json();
        setSlots(json.data ?? []);
      }
    } catch {
      toast.error("Failed to load slots");
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

  const existingVenues = useMemo(
    () => [...new Set(slots.map((s) => s.venue))],
    [slots],
  );
  const existingSubVenues = useMemo(
    () => [...new Set(slots.map((s) => s.sub_venue))],
    [slots],
  );

  function handleChangeMonth(y: number, m: number) {
    setYear(y);
    setMonth(m);
  }

  async function handleDelete(id: number) {
    try {
      const res = await fetch(`/api/facilities/manage/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to delete");
        return;
      }
      toast.success("Slot deleted");
      fetchSlots();
    } catch {
      toast.error("Failed to delete slot");
    }
  }

  async function handleBatchDelete(ids: number[]) {
    try {
      const res = await fetch("/api/facilities/manage/batch", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to delete");
        return;
      }
      const { deleted, skipped } = json.data;
      if (skipped > 0) {
        toast.warning(
          `Deleted ${deleted} slot${deleted !== 1 ? "s" : ""}. ${skipped} skipped (active claims).`,
        );
      } else {
        toast.success(`Deleted ${deleted} slot${deleted !== 1 ? "s" : ""}`);
      }
      fetchSlots();
    } catch {
      toast.error("Failed to delete slots");
    }
  }

  if (user && !user.is_jcrc && !user.is_admin) {
    return (
      <div className="flex flex-col space-y-6 p-4 md:p-6">
        <PageHeader title="Manage Facilities" />
        <EmptyState
          icon={Shield}
          title="Access Denied"
          description="Only JCRC members and admins can manage facilities."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-6 p-4 md:p-6">
      <PageHeader
        title="Manage Facilities"
        description="Add, view, and remove facility time slots for CCA booking"
        actions={
          <Button onClick={() => setShowForm(true)} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add Slot
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <VenueFilter
          venues={allVenues}
          selected={venueFilter}
          onChange={setVenueFilter}
        />
        <TypeFilter selected={typeFilter} onChange={setTypeFilter} />
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="w-full lg:w-[320px] shrink-0">
          {loading ? (
            <Skeleton className="h-[320px] w-full rounded-lg" />
          ) : (
            <ManageMonthGrid
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
            daySlots.length === 0 ? (
              <div>
                <h3 className="mb-3 text-lg font-semibold">
                  {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </h3>
                <EmptyState
                  icon={Calendar}
                  title="No slots on this day"
                  description="Add a slot to make it available for CCA booking."
                  action={
                    <Button
                      onClick={() => setShowForm(true)}
                      size="sm"
                      className="gap-1.5"
                    >
                      <Plus className="h-4 w-4" />
                      Add Slot
                    </Button>
                  }
                />
              </div>
            ) : (
              <ManageDayPanel
                date={selectedDate}
                slots={daySlots}
                onDelete={handleDelete}
                onBatchDelete={handleBatchDelete}
              />
            )
          ) : (
            <p className="text-sm text-muted-foreground">
              Select a day to view and manage slots.
            </p>
          )}
        </div>
      </div>

      <SlotFormDialog
        open={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={fetchSlots}
        existingVenues={existingVenues}
        existingSubVenues={existingSubVenues}
      />
    </div>
  );
}
