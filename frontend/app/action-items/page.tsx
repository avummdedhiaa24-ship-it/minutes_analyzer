"use client";

import React, { useState, useEffect } from "react";
import { 
  CheckSquare, Clock, AlertTriangle, CheckCircle2, User, 
  ArrowRight, ShieldCheck, Play, Sparkles, Filter, Plus, Calendar, Tag
} from "lucide-react";
import { actionItemsApi } from "../lib/api";

interface ActionItem {
  id: number;
  meeting_id: number;
  title: string;
  description?: string;
  responsible_person?: string;
  department?: string;
  deadline?: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  status: "TO_DO" | "IN_PROGRESS" | "COMPLETED" | "OVERDUE";
  source_timestamp: number;
  source_speaker?: string;
  evidence_text?: string;
  confidence: number;
}

export default function ActionItemsDashboard() {
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPriority, setFilterPriority] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");

  useEffect(() => {
    loadActionItems();
  }, []);

  const loadActionItems = async () => {
    setLoading(true);
    try {
      const items = await actionItemsApi.list();
      setActionItems(items);
    } catch (err) {
      console.error("Failed to load action items", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      await actionItemsApi.update(id, { status: newStatus });
      setActionItems(prev => prev.map(item => item.id === id ? { ...item, status: newStatus as any } : item));
    } catch (err) {
      console.error("Failed to update status", err);
    }
  };

  const formatTimestamp = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const filteredItems = actionItems.filter(item => {
    if (filterPriority !== "ALL" && item.priority !== filterPriority) return false;
    if (filterStatus !== "ALL" && item.status !== filterStatus) return false;
    if (searchTerm && !item.title.toLowerCase().includes(searchTerm.toLowerCase()) && !item.responsible_person?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const todoItems = filteredItems.filter(i => i.status === "TO_DO");
  const inProgressItems = filteredItems.filter(i => i.status === "IN_PROGRESS");
  const completedItems = filteredItems.filter(i => i.status === "COMPLETED");
  const overdueItems = filteredItems.filter(i => i.status === "OVERDUE");

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2.5 bg-rose-600/20 text-rose-400 rounded-xl border border-rose-500/30">
              <CheckSquare className="h-6 w-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Action Items & Execution Matrix</h1>
          </div>
          <p className="text-slate-400 text-sm max-w-2xl">
            Real-time execution dashboard tracking corporate decisions into actionable deliverables with grounded audio evidence jumping.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={loadActionItems}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition"
          >
            Refresh Status
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">To Do</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-2">{todoItems.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">In Progress</span>
            <Play className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-2">{inProgressItems.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">{completedItems.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">Overdue</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-2">{overdueItems.length}</p>
        </div>
      </div>

      {/* Filter & Search Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Search task or owner..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 w-full sm:w-64"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300"
          >
            <option value="ALL">All Priorities</option>
            <option value="HIGH">High Priority</option>
            <option value="MEDIUM">Medium Priority</option>
            <option value="LOW">Low Priority</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300"
          >
            <option value="ALL">All Statuses</option>
            <option value="TO_DO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="OVERDUE">Overdue</option>
          </select>
        </div>
      </div>

      {/* Kanban Board View */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 animate-pulse text-sm font-semibold">
          Loading Action Items & Evidence Logs...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* TO DO Column */}
          <ActionColumn 
            title="To Do" 
            badgeColor="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
            items={todoItems} 
            onStatusChange={handleStatusChange} 
            formatTimestamp={formatTimestamp}
          />
          {/* IN PROGRESS Column */}
          <ActionColumn 
            title="In Progress" 
            badgeColor="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20"
            items={inProgressItems} 
            onStatusChange={handleStatusChange} 
            formatTimestamp={formatTimestamp}
          />
          {/* OVERDUE Column */}
          <ActionColumn 
            title="Overdue" 
            badgeColor="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
            items={overdueItems} 
            onStatusChange={handleStatusChange} 
            formatTimestamp={formatTimestamp}
          />
          {/* COMPLETED Column */}
          <ActionColumn 
            title="Completed" 
            badgeColor="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
            items={completedItems} 
            onStatusChange={handleStatusChange} 
            formatTimestamp={formatTimestamp}
          />
        </div>
      )}
    </div>
  );
}

function ActionColumn({ 
  title, 
  badgeColor, 
  items, 
  onStatusChange,
  formatTimestamp
}: { 
  title: string; 
  badgeColor: string; 
  items: ActionItem[]; 
  onStatusChange: (id: number, status: string) => void;
  formatTimestamp: (s: number) => string;
}) {
  return (
    <div className="bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col space-y-3 min-h-[450px]">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${badgeColor}`}>
          {title} ({items.length})
        </span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto max-h-[650px] pr-1">
        {items.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400 italic">No tasks</div>
        ) : (
          items.map(item => (
            <div 
              key={item.id}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl p-4 shadow-sm hover:shadow-md transition-all space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <span className={`px-2 py-0.5 text-[10px] font-black rounded-md uppercase tracking-wider ${
                  item.priority === "HIGH" 
                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20" 
                    : item.priority === "MEDIUM" 
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                    : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                }`}>
                  {item.priority}
                </span>

                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-indigo-400" />
                  {Math.round(item.confidence * 100)}% Match
                </span>
              </div>

              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-snug">
                {item.title}
              </h4>

              {item.description && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                  {item.description}
                </p>
              )}

              {/* Owner & Department */}
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-700/50">
                <div className="flex items-center space-x-1.5 font-medium">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>{item.responsible_person || "Unassigned"}</span>
                </div>
                <span className="text-[10px] bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500">
                  {item.department || "Engineering"}
                </span>
              </div>

              {/* Grounded Evidence Box */}
              {item.evidence_text && (
                <div className="bg-slate-50 dark:bg-slate-900/80 rounded-lg p-2 text-[10px] text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-800">
                  <span className="font-bold text-rose-500">Evidence: </span>
                  "{item.evidence_text}"
                </div>
              )}

              {/* Action Toolbar */}
              <div className="flex items-center justify-between pt-1">
                <a 
                  href={`/verify?meeting_id=${item.meeting_id}#t=${item.source_timestamp}`}
                  className="text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1"
                >
                  🔍 View Source ({formatTimestamp(item.source_timestamp)})
                </a>

                <div className="flex items-center gap-1">
                  {item.status !== "COMPLETED" && (
                    <button 
                      onClick={() => onStatusChange(item.id, "COMPLETED")}
                      className="p-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded hover:bg-emerald-100 transition"
                      title="Mark Completed"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {item.status !== "IN_PROGRESS" && item.status !== "COMPLETED" && (
                    <button 
                      onClick={() => onStatusChange(item.id, "IN_PROGRESS")}
                      className="p-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded hover:bg-indigo-100 transition"
                      title="Mark In Progress"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
