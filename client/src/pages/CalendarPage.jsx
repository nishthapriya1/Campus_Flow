import React, { useEffect, useState } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import client from '../api/client';
import EventModal from '../components/EventModal';

import 'react-big-calendar/lib/css/react-big-calendar.css';

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

export const CalendarPage = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Modal control states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [defaultSlotData, setDefaultSlotData] = useState(null);

  // Client-side conflict detection: O(n²) overlap check (Property 6)
  const detectConflicts = (eventList) => {
    // Reset flags
    eventList.forEach((e) => {
      e.hasConflict = false;
    });

    for (let i = 0; i < eventList.length; i++) {
      for (let j = i + 1; j < eventList.length; j++) {
        const a = eventList[i];
        const b = eventList[j];

        // Conflict overlap check: A.startTime < B.endTime && A.endTime > B.startTime
        if (a.start < b.end && a.end > b.start) {
          a.hasConflict = true;
          b.hasConflict = true;
        }
      }
    }

    setEvents([...eventList]);
  };

  const fetchEvents = async (date) => {
    setLoading(true);
    try {
      // Fetch events for a 3-month window surrounding the current view date to optimize speed
      const fromDate = new Date(date.getFullYear(), date.getMonth() - 1, 1);
      const toDate = new Date(date.getFullYear(), date.getMonth() + 2, 0);

      const response = await client.get(
        `/events?from=${fromDate.toISOString()}&to=${toDate.toISOString()}`
      );

      // Convert date strings to Javascript Date objects
      const parsedEvents = (response.data || []).map((evt) => ({
        ...evt,
        start: new Date(evt.startTime),
        end: new Date(evt.endTime),
      }));

      detectConflicts(parsedEvents);
    } catch (err) {
      console.error('Failed to load events:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents(currentDate);
  }, [currentDate]);

  const handleSelectSlot = (slotInfo) => {
    setSelectedEvent(null);
    setDefaultSlotData({
      start: slotInfo.start,
      end: slotInfo.end,
      title: '',
    });
    setIsModalOpen(true);
  };

  const handleSelectEvent = (event) => {
    setDefaultSlotData(null);
    setSelectedEvent(event);
    setIsModalOpen(true);
  };

  // Custom event styles using curated HSL highlights (Requirement 5.3)
  const eventStyleGetter = (event) => {
    if (event.hasConflict) {
      return {
        className: 'bg-rose-950/40 border border-rose-800/80 text-rose-200 border-l-4 border-l-rose-500 shadow-md',
      };
    }

    // Default highlights for standard event categories
    switch (event.type) {
      case 'exam':
        return {
          className: 'bg-rose-500/10 border border-rose-500/30 text-rose-300 border-l-4 border-l-rose-500',
        };
      case 'assignment':
        return {
          className: 'bg-amber-500/10 border border-amber-500/30 text-amber-300 border-l-4 border-l-amber-500',
        };
      case 'class':
        return {
          className: 'bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 border-l-4 border-l-indigo-500',
        };
      case 'extracurricular':
        return {
          className: 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 border-l-4 border-l-emerald-500',
        };
      default:
        return {
          className: 'bg-slate-500/10 border border-slate-500/30 text-slate-300 border-l-4 border-l-slate-500',
        };
    }
  };

  // Inject conflict warning icon into the event label inside calendar grid
  const customComponents = {
    event: ({ event }) => (
      <div className="flex items-center gap-1.5 truncate h-full px-1">
        {event.hasConflict && (
          <span className="text-rose-500 font-bold animate-pulse" title="Time slot conflict detected! ⚠️">
            ⚠️
          </span>
        )}
        <span className="font-semibold truncate text-[11px] leading-tight">{event.title}</span>
      </div>
    ),
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0 h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Calendar Scheduler</h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage your schedule and resolve timing conflicts.
          </p>
        </div>
        <button
          onClick={() => {
            setSelectedEvent(null);
            setDefaultSlotData(null);
            setIsModalOpen(true);
          }}
          className="glass-btn-primary flex items-center gap-2 self-start sm:self-auto"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Event
        </button>
      </div>

      {/* Main Calendar Panel */}
      <div className="flex-1 glass-panel p-4 md:p-6 min-h-[500px] relative">
        {loading && (
          <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm flex items-center justify-center z-10 rounded-2xl">
            <svg className="animate-spin h-10 w-10 text-indigo-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        )}

        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: 'calc(100vh - 280px)', minHeight: '450px' }}
          selectable
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          eventPropGetter={eventStyleGetter}
          components={customComponents}
          onNavigate={(date) => setCurrentDate(date)}
          date={currentDate}
          views={['month', 'week', 'day']}
          defaultView="week"
        />
      </div>

      {/* Event Details and Creation Overlay Dialog */}
      <EventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedEvent={selectedEvent}
        defaultSlotData={defaultSlotData}
        onSaveSuccess={() => fetchEvents(currentDate)}
      />
    </div>
  );
};

export default CalendarPage;
