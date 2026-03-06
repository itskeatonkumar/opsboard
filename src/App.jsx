import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const N8N_WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL || "";

const COMPANIES = [
  { id: "all", name: "All Companies", color: "#F97316", short: "ALL" },
  { id: "fcg", name: "Foundation Construction Group", color: "#3B82F6", short: "FCG" },
  { id: "brc", name: "BR Concrete", color: "#F59E0B", short: "BRC" },
];

const PRIORITIES = [
  { id: "high", label: "High", color: "#EF4444" },
  { id: "med",  label: "Med",  color: "#F59E0B" },
  { id: "low",  label: "Low",  color: "#10B981" },
];

const STATUSES = [
  { id: "todo",       label: "To Do",       icon: "○" },
  { id: "inprogress", label: "In Progress", icon: "◑" },
  { id: "review",     label: "Review",      icon: "◕" },
  { id: "done",       label: "Done",        icon: "●" },
];

const TEAM_COLORS = [
  "#F97316","#3B82F6","#10B981","#8B5CF6","#EC4899",
  "#EF4444","#F59E0B","#06B6D4","#84CC16","#6366F1"
];

const getCompany  = (id, team) => COMPANIES.find(c => c.id === id) || COMPANIES[1];
const getMember   = (id, team) => (team || []).find(t => t.id === id) || { id, name: id, initials: id[0]?.toUpperCase(), color: "#555" };
const getPriority = (id) => PRIORITIES.find(p => p.id === id) || PRIORITIES[1];

const labelStyle = {
  display: "block", fontSize: 10.5, fontFamily: "'DM Mono', monospace",
  color: "#555", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 5
};
const inputStyle = {
  width: "100%", background: "#0e0e0e", border: "1px solid #252525",
  borderRadius: 6, padding: "8px 10px", color: "#e0e0e0", fontSize: 13,
  fontFamily: "'Syne', sans-serif", outline: "none", boxSizing: "border-box",
};

// ─────────────────────────────────────────────
// Shared UI
// ─────────────────────────────────────────────

function Avatar({ member, size = 28 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: (member?.color || "#555") + "22",
      border: `1.5px solid ${(member?.color || "#555")}55`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 700, color: member?.color || "#555",
      fontFamily: "'DM Mono', monospace", flexShrink: 0
    }}>
      {member?.initials || "?"}
    </div>
  );
}

function CompanyBadge({ companyId, small }) {
  const co = getCompany(companyId);
  return (
    <span style={{
      background: co.color + "18", border: `1px solid ${co.color}40`,
      color: co.color, padding: small ? "2px 6px" : "3px 8px",
      borderRadius: 4, fontSize: small ? 10 : 11, fontWeight: 700,
      fontFamily: "'DM Mono', monospace", letterSpacing: 0.5, flexShrink: 0
    }}>{co.short}</span>
  );
}

function PriorityDot({ priorityId }) {
  const p = getPriority(priorityId);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: p.color, fontSize: 11, fontFamily: "'DM Mono', monospace" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: p.color, display: "inline-block" }} />
      {p.label}
    </span>
  );
}

// ─────────────────────────────────────────────
// Drag Ghost
// ─────────────────────────────────────────────

function DragGhost({ task, pos, team }) {
  if (!task || !pos) return null;
  const member = getMember(task.assignee, team);
  return (
    <div style={{ position: "fixed", left: pos.x - 130, top: pos.y - 30, width: 260, pointerEvents: "none", zIndex: 9999, transform: "rotate(2deg) scale(1.03)", opacity: 0.9, filter: "drop-shadow(0 16px 40px rgba(0,0,0,0.8))" }}>
      <div style={{ background: "#1e1e1e", border: "1px solid #F9731660", borderRadius: 8, padding: "12px 14px" }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
          <CompanyBadge companyId={task.company} small />
          <PriorityDot priorityId={task.priority} />
        </div>
        <div style={{ fontSize: 13, color: "#e5e5e5", fontWeight: 500, lineHeight: 1.4, fontFamily: "'Syne', sans-serif" }}>{task.title}</div>
        <div style={{ marginTop: 8 }}><Avatar member={member} size={22} /></div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Task Card
// ─────────────────────────────────────────────

function TaskCard({ task, onEdit, onMouseDownDrag, isDragging, team }) {
  const member = getMember(task.assignee, team);
  const isOverdue = task.status !== "done" && task.due && new Date(task.due) < new Date();
  return (
    <div
      onMouseDown={(e) => onMouseDownDrag(e, task)}
      onClick={() => onEdit(task)}
      style={{ background: "#161616", border: `1px solid ${isDragging ? "#F9731440" : "#262626"}`, borderRadius: 8, padding: "12px 14px", cursor: isDragging ? "grabbing" : "grab", opacity: isDragging ? 0.25 : 1, transition: "opacity 0.12s, border-color 0.12s", userSelect: "none" }}
    >
      <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
        <CompanyBadge companyId={task.company} small />
        <PriorityDot priorityId={task.priority} />
      </div>
      <div style={{ fontSize: 13.5, color: "#e5e5e5", fontWeight: 500, lineHeight: 1.4, marginBottom: 10, fontFamily: "'Syne', sans-serif" }}>{task.title}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Avatar member={member} size={24} />
        {task.due && (
          <span style={{ fontSize: 10.5, fontFamily: "'DM Mono', monospace", color: isOverdue ? "#EF4444" : "#555" }}>
            {isOverdue ? "⚠ " : ""}{new Date(task.due + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Task Modal
// ─────────────────────────────────────────────

function TaskModal({ task, onClose, onSave, onDelete, isNew, team }) {
  const [form, setForm] = useState(task && task.id ? { ...task } : {
    title: "", company: "fcg", assignee: team[0]?.id || "keaton",
    priority: "med", status: "todo", due: "", description: ""
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true); await onSave(form); setSaving(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 12, padding: 28, width: "100%", maxWidth: 520, boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 17, fontWeight: 700, color: "#e5e5e5" }}>{isNew ? "New Task" : "Edit Task"}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 20 }}>×</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Task Title</label>
            <input value={form.title} onChange={e => set("title", e.target.value)} placeholder="What needs to get done?" style={inputStyle} autoFocus />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Company</label>
              <select value={form.company} onChange={e => set("company", e.target.value)} style={inputStyle}>
                {COMPANIES.filter(c => c.id !== "all").map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Assignee</label>
              <select value={form.assignee} onChange={e => set("assignee", e.target.value)} style={inputStyle}>
                {team.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Priority</label>
              <select value={form.priority} onChange={e => set("priority", e.target.value)} style={inputStyle}>
                {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select value={form.status} onChange={e => set("status", e.target.value)} style={inputStyle}>
                {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Due Date</label>
              <input type="date" value={form.due} onChange={e => set("due", e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Notes</label>
            <textarea value={form.description} onChange={e => set("description", e.target.value)} placeholder="Any context..." style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "space-between" }}>
          {!isNew && <button onClick={() => onDelete(form.id)} style={{ background: "#1a0a0a", border: "1px solid #3a1a1a", color: "#ef4444", padding: "8px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "'DM Mono', monospace" }}>Delete</button>}
          <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
            <button onClick={onClose} style={{ background: "none", border: "1px solid #2a2a2a", color: "#777", padding: "8px 18px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontFamily: "'Syne', sans-serif" }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{ background: "#F97316", border: "none", color: "#000", padding: "8px 22px", borderRadius: 6, cursor: saving ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 700, fontFamily: "'Syne', sans-serif", opacity: form.title.trim() && !saving ? 1 : 0.5 }}>
              {saving ? "Saving..." : isNew ? "Add Task" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Member Modal (Settings)
// ─────────────────────────────────────────────

function MemberModal({ member, onClose, onSave, onDelete, isNew }) {
  const [form, setForm] = useState(member && member.id ? { ...member } : {
    id: "", name: "", initials: "", color: TEAM_COLORS[0], email: "", role: ""
  });
  const [saving, setSaving] = useState(false);
  const [idError, setIdError] = useState("");
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Auto-generate initials from name
  const handleNameChange = (v) => {
    set("name", v);
    if (!form.initials || isNew) {
      const parts = v.trim().split(" ");
      const initials = parts.length >= 2
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : v.slice(0, 2).toUpperCase();
      set("initials", initials);
    }
    if (isNew && !form.id) {
      set("id", v.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""));
    }
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.id.trim()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 12, padding: 28, width: "100%", maxWidth: 460, boxShadow: "0 24px 80px rgba(0,0,0,0.7)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 17, fontWeight: 700, color: "#e5e5e5" }}>{isNew ? "Add Team Member" : "Edit Member"}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 20 }}>×</button>
        </div>

        {/* Avatar preview */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 22 }}>
          <Avatar member={form} size={56} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Full Name</label>
              <input value={form.name} onChange={e => handleNameChange(e.target.value)} placeholder="John Smith" style={inputStyle} autoFocus />
            </div>
            <div>
              <label style={labelStyle}>Role / Title</label>
              <input value={form.role} onChange={e => set("role", e.target.value)} placeholder="e.g. Estimator" style={inputStyle} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Initials</label>
              <input value={form.initials} onChange={e => set("initials", e.target.value.slice(0, 2).toUpperCase())} placeholder="JS" maxLength={2} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Username / ID</label>
              <input
                value={form.id}
                onChange={e => { if (isNew) set("id", e.target.value.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")); }}
                placeholder="john_smith"
                style={{ ...inputStyle, opacity: isNew ? 1 : 0.4, cursor: isNew ? "text" : "not-allowed" }}
                disabled={!isNew}
              />
              {isNew && <div style={{ fontSize: 10, color: "#444", fontFamily: "'DM Mono', monospace", marginTop: 3 }}>lowercase, no spaces — used internally</div>}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Email Address</label>
            <input value={form.email} onChange={e => set("email", e.target.value)} placeholder="john@example.com" type="email" style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Color</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
              {TEAM_COLORS.map(c => (
                <button key={c} onClick={() => set("color", c)} style={{
                  width: 28, height: 28, borderRadius: "50%", background: c, border: form.color === c ? `3px solid #fff` : "3px solid transparent",
                  cursor: "pointer", transition: "border-color 0.1s", outline: "none"
                }} />
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type="color" value={form.color} onChange={e => set("color", e.target.value)}
                  style={{ width: 28, height: 28, borderRadius: "50%", border: "none", background: "none", cursor: "pointer", padding: 0 }} />
                <span style={{ fontSize: 10, color: "#444", fontFamily: "'DM Mono', monospace" }}>custom</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "space-between" }}>
          {!isNew && (
            <button onClick={() => onDelete(form.id)} style={{ background: "#1a0a0a", border: "1px solid #3a1a1a", color: "#ef4444", padding: "8px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "'DM Mono', monospace" }}>
              Remove
            </button>
          )}
          <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
            <button onClick={onClose} style={{ background: "none", border: "1px solid #2a2a2a", color: "#777", padding: "8px 18px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontFamily: "'Syne', sans-serif" }}>Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.name.trim() || !form.id.trim()} style={{ background: "#F97316", border: "none", color: "#000", padding: "8px 22px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "'Syne', sans-serif", opacity: form.name.trim() && form.id.trim() && !saving ? 1 : 0.4 }}>
              {saving ? "Saving..." : isNew ? "Add Member" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Settings Page
// ─────────────────────────────────────────────

function SettingsPage({ team, onTeamChange }) {
  const [editMember, setEditMember] = useState(null);
  const [isNewMember, setIsNewMember] = useState(false);
  const [saving, setSaving] = useState(false);

  const openNew = () => { setIsNewMember(true); setEditMember({}); };
  const openEdit = (m) => { setIsNewMember(false); setEditMember(m); };
  const closeModal = () => { setEditMember(null); setIsNewMember(false); };

  const handleSave = async (form) => {
    setSaving(true);
    if (isNewMember) {
      const { data, error } = await supabase.from("team").insert([form]).select().single();
      if (!error) onTeamChange([...team, data]);
    } else {
      const { id, ...fields } = form;
      await supabase.from("team").update(fields).eq("id", id);
      onTeamChange(team.map(m => m.id === id ? { ...m, ...fields } : m));
    }
    setSaving(false);
    closeModal();
  };

  const handleDelete = async (id) => {
    await supabase.from("team").delete().eq("id", id);
    onTeamChange(team.filter(m => m.id !== id));
    closeModal();
  };

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 32 }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#e5e5e5", fontFamily: "'Syne', sans-serif", marginBottom: 6 }}>Settings</h1>
          <p style={{ fontSize: 12, color: "#444", fontFamily: "'DM Mono', monospace" }}>Manage your team, contact info, and preferences</p>
        </div>

        {/* Team section */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#aaa", fontFamily: "'Syne', sans-serif", letterSpacing: 0.3 }}>Team Members</div>
              <div style={{ fontSize: 10.5, color: "#333", fontFamily: "'DM Mono', monospace", marginTop: 2 }}>{team.length} members · emails used for digest notifications</div>
            </div>
            <button onClick={openNew} style={{ background: "#F97316", border: "none", color: "#000", padding: "7px 14px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "'Syne', sans-serif", display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: 15 }}>+</span> Add Member
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {team.map(member => (
              <div key={member.id} onClick={() => openEdit(member)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: "#111", border: "1px solid #1a1a1a", borderRadius: 10, cursor: "pointer", transition: "border-color 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "#2a2a2a"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "#1a1a1a"}
              >
                <Avatar member={member} size={40} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#e5e5e5", fontFamily: "'Syne', sans-serif" }}>{member.name}</span>
                    {member.role && <span style={{ fontSize: 10, color: "#444", fontFamily: "'DM Mono', monospace", background: "#1a1a1a", padding: "2px 6px", borderRadius: 4 }}>{member.role}</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: member.email ? "#555" : "#2a2a2a", fontFamily: "'DM Mono', monospace", marginTop: 3 }}>
                    {member.email || "no email set — click to add"}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: member.color }} />
                  <span style={{ fontSize: 10, color: "#333", fontFamily: "'DM Mono', monospace" }}>@{member.id}</span>
                  <span style={{ fontSize: 16, color: "#333" }}>›</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Companies section — read only for now */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#aaa", fontFamily: "'Syne', sans-serif" }}>Companies</div>
            <div style={{ fontSize: 10.5, color: "#333", fontFamily: "'DM Mono', monospace", marginTop: 2 }}>To add or rename companies, contact your developer</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {COMPANIES.filter(c => c.id !== "all").map(co => (
              <div key={co.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#111", border: "1px solid #1a1a1a", borderRadius: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: co.color }} />
                <span style={{ fontSize: 13, color: "#bbb", fontFamily: "'Syne', sans-serif", flex: 1 }}>{co.name}</span>
                <span style={{ fontSize: 10, color: "#333", fontFamily: "'DM Mono', monospace", background: "#1a1a1a", padding: "2px 6px", borderRadius: 4 }}>{co.short}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Digest section */}
        <div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#aaa", fontFamily: "'Syne', sans-serif" }}>Email Digest</div>
            <div style={{ fontSize: 10.5, color: "#333", fontFamily: "'DM Mono', monospace", marginTop: 2 }}>Sends automatically every weekday at 8am via n8n</div>
          </div>
          <div style={{ padding: "14px 16px", background: "#111", border: "1px solid #1a1a1a", borderRadius: 8, display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              ["Schedule", "Weekdays 8:00 AM"],
              ["Individual emails", "Each member gets their own open tasks"],
              ["Summary email", "Keaton receives full team overview"],
              ["Manual trigger", "Use the Send Digest button in the sidebar"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11.5, color: "#555", fontFamily: "'DM Mono', monospace" }}>{k}</span>
                <span style={{ fontSize: 11.5, color: "#888", fontFamily: "'Syne', sans-serif" }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {editMember !== null && (
        <MemberModal member={editMember} isNew={isNewMember} onClose={closeModal} onSave={handleSave} onDelete={handleDelete} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// AI Modal
// ─────────────────────────────────────────────

const TODAY = new Date().toISOString().split("T")[0];

function AIModal({ onClose, onAdd, team }) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef();
  useEffect(() => { inputRef.current?.focus(); }, []);

  const teamContext = team.map(m => `${m.id}=${m.name}${m.role ? ` (${m.role})` : ""}`).join(", ");

  const parse = async () => {
    if (!prompt.trim()) return;
    setLoading(true); setError(""); setPreview(null);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `You parse natural language task descriptions into structured JSON for a task tracker.
Today's date is ${TODAY}.
Return ONLY valid JSON, no markdown, no explanation:
{"title":"short action-oriented task title","company":"fcg or brc","assignee":"one of the team IDs","priority":"high/med/low","status":"todo/inprogress/review/done","due":"YYYY-MM-DD or empty string","description":"brief context note"}
Companies: FCG=Foundation Construction Group (concrete/masonry/licensing), BRC=BR Concrete.
Team members: ${teamContext}.
Interpret relative dates like "friday" "next week" relative to today (${TODAY}).`,
          messages: [{ role: "user", content: prompt }]
        })
      });
      const data = await res.json();
      const text = data.content?.find(b => b.type === "text")?.text || "";
      setPreview(JSON.parse(text.replace(/```json|```/g, "").trim()));
    } catch (e) {
      setError("Couldn't parse that — try being more specific.");
    }
    setLoading(false);
  };

  const handleAdd = async () => {
    setSaving(true); await onAdd(preview); setSaving(false); onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 14, padding: 28, width: "100%", maxWidth: 540, boxShadow: "0 24px 80px rgba(0,0,0,0.7)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #a855f7, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>✦</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#e5e5e5", fontFamily: "'Syne', sans-serif" }}>AI Task Add</div>
              <div style={{ fontSize: 10, color: "#444", fontFamily: "'DM Mono', monospace" }}>describe it, we'll structure it</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 20 }}>×</button>
        </div>
        <textarea ref={inputRef} value={prompt} onChange={e => { setPrompt(e.target.value); setPreview(null); setError(""); }}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); parse(); } }}
          placeholder={`e.g. "Keaton needs to follow up with FMGI, high priority FCG, due Friday"`}
          style={{ width: "100%", background: "#0c0c0c", border: "1px solid #2a2a2a", borderRadius: 8, padding: "12px 14px", color: "#e0e0e0", fontSize: 13, fontFamily: "'Syne', sans-serif", outline: "none", resize: "none", minHeight: 80, boxSizing: "border-box", lineHeight: 1.5 }}
        />
        <div style={{ fontSize: 10, color: "#333", fontFamily: "'DM Mono', monospace", marginTop: 5 }}>Press Enter to parse · Shift+Enter for new line</div>
        {!preview && (
          <button onClick={parse} disabled={loading || !prompt.trim()} style={{ marginTop: 14, width: "100%", background: loading ? "#1a1228" : "linear-gradient(135deg, #7c3aed, #a855f7)", border: "none", borderRadius: 8, padding: "10px 0", color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "'Syne', sans-serif", cursor: loading || !prompt.trim() ? "not-allowed" : "pointer", opacity: !prompt.trim() ? 0.4 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {loading ? <><span style={{ display: "inline-block", animation: "spin 0.8s linear infinite" }}>◌</span> Parsing...</> : "✦ Parse Task"}
          </button>
        )}
        {error && <div style={{ marginTop: 12, color: "#ef4444", fontSize: 12, fontFamily: "'DM Mono', monospace" }}>⚠ {error}</div>}
        {preview && (
          <div style={{ marginTop: 16, background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 10, color: "#555", fontFamily: "'DM Mono', monospace", letterSpacing: 0.8, marginBottom: 12 }}>PARSED TASK — LOOKS GOOD?</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#e5e5e5", fontFamily: "'Syne', sans-serif", marginBottom: 12, lineHeight: 1.4 }}>{preview.title}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
              {[
                ["Company", getCompany(preview.company)?.short],
                ["Assignee", team.find(t => t.id === preview.assignee)?.name || preview.assignee],
                ["Priority", getPriority(preview.priority)?.label],
                ["Status", STATUSES.find(s => s.id === preview.status)?.label],
                ["Due", preview.due ? new Date(preview.due + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"],
              ].map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: 9.5, color: "#3a3a3a", fontFamily: "'DM Mono', monospace", letterSpacing: 0.6 }}>{k.toUpperCase()}</div>
                  <div style={{ fontSize: 12, color: "#bbb", fontFamily: "'Syne', sans-serif", marginTop: 2 }}>{v}</div>
                </div>
              ))}
            </div>
            {preview.description && <div style={{ fontSize: 11, color: "#555", fontFamily: "'DM Mono', monospace", borderTop: "1px solid #1a1a1a", paddingTop: 10 }}>{preview.description}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={() => setPreview(null)} style={{ flex: 1, background: "none", border: "1px solid #2a2a2a", color: "#777", padding: "8px 0", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "'Syne', sans-serif" }}>← Re-parse</button>
              <button onClick={handleAdd} disabled={saving} style={{ flex: 2, background: "linear-gradient(135deg, #7c3aed, #a855f7)", border: "none", color: "#fff", padding: "8px 0", borderRadius: 6, cursor: saving ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 700, fontFamily: "'Syne', sans-serif", opacity: saving ? 0.6 : 1 }}>
                {saving ? "Adding..." : "✦ Add Task"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Digest Modal
// ─────────────────────────────────────────────

function DigestModal({ tasks, team, onClose }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const openTasks = tasks.filter(t => t.status !== "done");
  const perPerson = team.map(member => ({
    ...member,
    tasks: openTasks.filter(t => t.assignee === member.id)
      .sort((a,b) => ({ high:0, med:1, low:2 })[a.priority] - ({ high:0, med:1, low:2 })[b.priority])
  })).filter(m => m.tasks.length > 0);

  const handleSend = async () => {
    if (!N8N_WEBHOOK_URL) { setError("Add VITE_N8N_WEBHOOK_URL to your Vercel environment variables."); return; }
    setSending(true);
    try {
      await fetch(N8N_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger: "manual", sentAt: new Date().toISOString(), summary: perPerson.map(m => ({ name: m.name, email: m.email, taskCount: m.tasks.length, tasks: m.tasks })), allOpenTasks: openTasks })
      });
      setSent(true);
    } catch (e) { setError("Failed to reach n8n — check your webhook URL."); }
    setSending(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 14, padding: 28, width: "100%", maxWidth: 560, boxShadow: "0 24px 80px rgba(0,0,0,0.7)", maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #10B981, #059669)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>✉</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#e5e5e5", fontFamily: "'Syne', sans-serif" }}>Send Daily Digest</div>
              <div style={{ fontSize: 10, color: "#444", fontFamily: "'DM Mono', monospace" }}>{openTasks.length} open tasks across {perPerson.length} team members</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 20 }}>×</button>
        </div>
        {sent ? (
          <div style={{ textAlign: "center", padding: "30px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#10B981", fontFamily: "'Syne', sans-serif" }}>Digest sent!</div>
            <div style={{ fontSize: 12, color: "#555", fontFamily: "'DM Mono', monospace", marginTop: 6 }}>n8n is handling delivery</div>
            <button onClick={onClose} style={{ marginTop: 20, background: "#10B981", border: "none", color: "#000", padding: "8px 24px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>Done</button>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: "#3a3a3a", fontFamily: "'DM Mono', monospace", letterSpacing: 0.8, marginBottom: 12 }}>WHAT EACH PERSON WILL RECEIVE</div>
              {perPerson.map(member => (
                <div key={member.id} style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 8, padding: "12px 14px", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <Avatar member={member} size={24} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#ddd", fontFamily: "'Syne', sans-serif" }}>{member.name}</span>
                    {member.email && <span style={{ fontSize: 10, color: "#444", fontFamily: "'DM Mono', monospace" }}>{member.email}</span>}
                    <span style={{ marginLeft: "auto", fontSize: 10, fontFamily: "'DM Mono', monospace", color: "#444" }}>{member.tasks.length} task{member.tasks.length !== 1 ? "s" : ""}</span>
                  </div>
                  {member.tasks.map(t => (
                    <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderTop: "1px solid #1a1a1a" }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: getPriority(t.priority).color, flexShrink: 0 }} />
                      <span style={{ fontSize: 11.5, color: "#bbb", fontFamily: "'Syne', sans-serif", flex: 1 }}>{t.title}</span>
                      <CompanyBadge companyId={t.company} small />
                    </div>
                  ))}
                </div>
              ))}
              {perPerson.length === 0 && <div style={{ textAlign: "center", padding: 30, color: "#333", fontFamily: "'DM Mono', monospace", fontSize: 12 }}>No open tasks to send</div>}
            </div>
            {error && <div style={{ marginBottom: 14, color: "#ef4444", fontSize: 12, fontFamily: "'DM Mono', monospace", background: "#1a0a0a", border: "1px solid #3a1a1a", borderRadius: 6, padding: "10px 12px" }}>⚠ {error}</div>}
            <button onClick={handleSend} disabled={sending || perPerson.length === 0} style={{ width: "100%", background: sending ? "#0a1a12" : "linear-gradient(135deg, #10B981, #059669)", border: "none", borderRadius: 8, padding: "11px 0", color: sending ? "#10B981" : "#000", fontSize: 13, fontWeight: 700, fontFamily: "'Syne', sans-serif", cursor: sending || perPerson.length === 0 ? "not-allowed" : "pointer", opacity: perPerson.length === 0 ? 0.4 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {sending ? <><span style={{ display: "inline-block", animation: "spin 0.8s linear infinite" }}>◌</span> Sending...</> : "✉ Send Digest Now"}
            </button>
            <div style={{ textAlign: "center", fontSize: 10, color: "#333", fontFamily: "'DM Mono', monospace", marginTop: 8 }}>Also runs automatically every weekday morning via n8n</div>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────

export default function TaskTracker() {
  const [tasks, setTasks] = useState([]);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState("tasks"); // "tasks" | "settings"
  const [activeCompany, setActiveCompany] = useState("all");
  const [editTask, setEditTask] = useState(null);
  const [isNew, setIsNew] = useState(false);
  const [search, setSearch] = useState("");
  const [view, setView] = useState("kanban");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [aiOpen, setAiOpen] = useState(false);
  const [digestOpen, setDigestOpen] = useState(false);

  const dragState = useRef({ active: false, task: null, startX: 0, startY: 0, moved: false });
  const [ghostPos, setGhostPos] = useState(null);
  const [ghostTask, setGhostTask] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [overColumn, setOverColumn] = useState(null);
  const columnRefs = useRef({});

  useEffect(() => {
    const loadAll = async () => {
      const [tasksRes, teamRes] = await Promise.all([
        supabase.from("tasks").select("*").order("created_at", { ascending: true }),
        supabase.from("team").select("*").order("created_at", { ascending: true }),
      ]);
      if (!tasksRes.error) setTasks(tasksRes.data || []);
      if (!teamRes.error) setTeam(teamRes.data || []);
      setLoading(false);
    };
    loadAll();
    const channel = supabase.channel("db-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
        supabase.from("tasks").select("*").order("created_at", { ascending: true }).then(r => { if (!r.error) setTasks(r.data); });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "team" }, () => {
        supabase.from("team").select("*").order("created_at", { ascending: true }).then(r => { if (!r.error) setTeam(r.data); });
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const filtered = tasks.filter(t => {
    const matchCo = activeCompany === "all" || t.company === activeCompany;
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase());
    return matchCo && matchSearch;
  });

  const stats = {
    total: filtered.length,
    overdue: filtered.filter(t => t.status !== "done" && t.due && new Date(t.due) < new Date()).length,
    done: filtered.filter(t => t.status === "done").length,
    inprogress: filtered.filter(t => t.status === "inprogress").length,
  };

  const getColumnAt = useCallback((x, y) => {
    for (const [colId, el] of Object.entries(columnRefs.current)) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return colId;
    }
    return null;
  }, []);

  const handleMouseDownDrag = useCallback((e, task) => {
    if (e.button !== 0) return;
    e.preventDefault();
    dragState.current = { active: true, task, startX: e.clientX, startY: e.clientY, moved: false };
  }, []);

  useEffect(() => {
    const onMouseMove = (e) => {
      const ds = dragState.current;
      if (!ds.active) return;
      if (!ds.moved && (Math.abs(e.clientX - ds.startX) > 6 || Math.abs(e.clientY - ds.startY) > 6)) {
        ds.moved = true; setDraggingId(ds.task.id); setGhostTask(ds.task);
      }
      if (ds.moved) { setGhostPos({ x: e.clientX, y: e.clientY }); setOverColumn(getColumnAt(e.clientX, e.clientY)); }
    };
    const onMouseUp = async (e) => {
      const ds = dragState.current;
      if (!ds.active) return;
      if (ds.moved) {
        const col = getColumnAt(e.clientX, e.clientY);
        if (col && col !== ds.task.status) {
          setTasks(ts => ts.map(t => t.id === ds.task.id ? { ...t, status: col } : t));
          await supabase.from("tasks").update({ status: col }).eq("id", ds.task.id);
        }
      }
      dragState.current = { active: false, task: null, startX: 0, startY: 0, moved: false };
      setDraggingId(null); setGhostPos(null); setGhostTask(null); setOverColumn(null);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => { window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onMouseUp); };
  }, [getColumnAt]);

  const openNew = () => { setIsNew(true); setEditTask({}); };
  const openEdit = (task) => { if (!dragState.current.moved) { setIsNew(false); setEditTask(task); } };
  const closeModal = () => { setEditTask(null); setIsNew(false); };

  const handleSave = async (form) => {
    const { id, ...fields } = form;
    if (isNew) {
      const { data, error } = await supabase.from("tasks").insert([fields]).select().single();
      if (!error) setTasks(ts => [...ts, data]);
    } else {
      await supabase.from("tasks").update(fields).eq("id", id);
      setTasks(ts => ts.map(t => t.id === id ? { ...t, ...fields } : t));
    }
    closeModal();
  };

  const handleDelete = async (id) => {
    await supabase.from("tasks").delete().eq("id", id);
    setTasks(ts => ts.filter(t => t.id !== id));
    closeModal();
  };

  const handleAiAdd = async (parsed) => {
    const { data, error } = await supabase.from("tasks").insert([parsed]).select().single();
    if (!error) setTasks(ts => [...ts, data]);
  };

  const navBtn = (id, label, icon) => (
    <button onClick={() => setPage(id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "7px 8px", borderRadius: 6, cursor: "pointer", background: page === id ? "#F9731615" : "none", border: page === id ? "1px solid #F9731630" : "1px solid transparent", marginBottom: 2, textAlign: "left", transition: "all 0.15s" }}>
      <span style={{ fontSize: 13, color: page === id ? "#F97316" : "#444" }}>{icon}</span>
      <span style={{ fontSize: 12, color: page === id ? "#e5e5e5" : "#555", fontFamily: "'Syne', sans-serif" }}>{label}</span>
    </button>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0a0a; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #111; }
        ::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 2px; }
        select option { background: #111; color: #e5e5e5; }
        @keyframes slideIn { from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)} }
        @keyframes spin { from{transform:rotate(0deg)}to{transform:rotate(360deg)} }
      `}</style>

      {ghostTask && ghostPos && <DragGhost task={ghostTask} pos={ghostPos} team={team} />}

      <div style={{ display: "flex", height: "100vh", background: "#0a0a0a", fontFamily: "'Syne', sans-serif", overflow: "hidden", cursor: draggingId ? "grabbing" : "default" }}>

        {/* SIDEBAR */}
        <div style={{ width: sidebarOpen ? 220 : 0, minWidth: sidebarOpen ? 220 : 0, background: "#0d0d0d", borderRight: "1px solid #1a1a1a", display: "flex", flexDirection: "column", overflow: "hidden", transition: "width 0.2s, min-width 0.2s", flexShrink: 0 }}>
          {/* Logo */}
          <div style={{ padding: "20px 18px 16px", borderBottom: "1px solid #1a1a1a" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: "linear-gradient(135deg, #F97316, #ea580c)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 14 }}>⬡</span>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#e5e5e5", letterSpacing: -0.3 }}>OpsBoard</div>
                <div style={{ fontSize: 9.5, color: "#444", fontFamily: "'DM Mono', monospace", letterSpacing: 0.5 }}>FCG PORTFOLIO</div>
              </div>
            </div>
          </div>

          <div style={{ padding: "14px 10px", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
            {/* Nav */}
            <div style={{ marginBottom: 16 }}>
              {navBtn("tasks", "Tasks", "⊞")}
              {navBtn("settings", "Settings", "⚙")}
            </div>

            {page === "tasks" && (
              <>
                <div style={{ fontSize: 9.5, color: "#3a3a3a", letterSpacing: 1.2, fontFamily: "'DM Mono', monospace", padding: "0 8px", marginBottom: 8 }}>COMPANIES</div>
                {COMPANIES.map(co => {
                  const count = co.id === "all" ? tasks.length : tasks.filter(t => t.company === co.id).length;
                  const active = activeCompany === co.id;
                  return (
                    <button key={co.id} onClick={() => setActiveCompany(co.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "7px 8px", borderRadius: 6, cursor: "pointer", background: active ? co.color + "15" : "none", border: active ? `1px solid ${co.color}30` : "1px solid transparent", marginBottom: 2, textAlign: "left", transition: "all 0.15s" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: co.id === "all" ? "#F97316" : co.color, flexShrink: 0, opacity: active ? 1 : 0.4 }} />
                      <span style={{ fontSize: 12, color: active ? "#e5e5e5" : "#555", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{co.id === "all" ? "All Companies" : co.name}</span>
                      <span style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: active ? co.color : "#333" }}>{count}</span>
                    </button>
                  );
                })}

                <div style={{ fontSize: 9.5, color: "#3a3a3a", letterSpacing: 1.2, fontFamily: "'DM Mono', monospace", padding: "0 8px", marginBottom: 8, marginTop: 18 }}>TEAM</div>
                {team.map(m => (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", marginBottom: 2 }}>
                    <Avatar member={m} size={22} />
                    <span style={{ fontSize: 12, color: "#555" }}>{m.name}</span>
                    <span style={{ fontSize: 10, color: "#333", marginLeft: "auto", fontFamily: "'DM Mono', monospace" }}>{tasks.filter(t => t.assignee === m.id && t.status !== "done").length}</span>
                  </div>
                ))}
              </>
            )}

            {/* Send Digest */}
            <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid #1a1a1a" }}>
              <button onClick={() => setDigestOpen(true)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 6, cursor: "pointer", background: "#0a1a12", border: "1px solid #10B98130", color: "#10B981", fontSize: 12, fontWeight: 600, fontFamily: "'Syne', sans-serif" }}
                onMouseEnter={e => e.currentTarget.style.background = "#0d2218"}
                onMouseLeave={e => e.currentTarget.style.background = "#0a1a12"}
              >
                <span style={{ fontSize: 14 }}>✉</span> Send Digest
              </button>
            </div>
          </div>
        </div>

        {/* MAIN */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* TOPBAR */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 20px", height: 56, borderBottom: "1px solid #1a1a1a", flexShrink: 0 }}>
            <button onClick={() => setSidebarOpen(s => !s)} style={{ background: "none", border: "none", cursor: "pointer", color: "#444", fontSize: 16, padding: "4px 6px" }}>☰</button>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 13, color: "#555", fontFamily: "'DM Mono', monospace" }}>
                {page === "settings" ? "Settings" : "Tasks"}
              </span>
              {page === "tasks" && activeCompany !== "all" && (
                <><span style={{ color: "#2a2a2a", margin: "0 6px" }}>/</span><CompanyBadge companyId={activeCompany} /></>
              )}
            </div>
            {page === "tasks" && (
              <>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#333", fontSize: 13 }}>⌕</span>
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks..." style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 6, padding: "6px 12px 6px 30px", color: "#aaa", fontSize: 12, fontFamily: "'DM Mono', monospace", outline: "none", width: 190 }} />
                </div>
                <div style={{ display: "flex", background: "#111", border: "1px solid #1e1e1e", borderRadius: 6, overflow: "hidden" }}>
                  {[["kanban", "⊞"], ["list", "≡"]].map(([v, icon]) => (
                    <button key={v} onClick={() => setView(v)} style={{ padding: "6px 12px", background: view === v ? "#1e1e1e" : "none", border: "none", cursor: "pointer", color: view === v ? "#e5e5e5" : "#444", fontSize: 14 }}>{icon}</button>
                  ))}
                </div>
                <button onClick={() => setAiOpen(true)} style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)", border: "none", color: "#fff", padding: "7px 14px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                  <span>✦</span> AI Add
                </button>
                <button onClick={openNew} style={{ background: "#F97316", border: "none", color: "#000", padding: "7px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> New Task
                </button>
              </>
            )}
          </div>

          {/* STATS (tasks only) */}
          {page === "tasks" && (
            <div style={{ display: "flex", borderBottom: "1px solid #1a1a1a", flexShrink: 0 }}>
              {[
                { label: "Total", val: stats.total, color: "#555" },
                { label: "In Progress", val: stats.inprogress, color: "#F59E0B" },
                { label: "Overdue", val: stats.overdue, color: "#EF4444" },
                { label: "Done", val: stats.done, color: "#10B981" },
              ].map((s, i) => (
                <div key={i} style={{ padding: "10px 20px", borderRight: "1px solid #1a1a1a", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: s.color, fontFamily: "'DM Mono', monospace" }}>{s.val}</span>
                  <span style={{ fontSize: 10.5, color: "#3a3a3a", fontFamily: "'DM Mono', monospace", letterSpacing: 0.5 }}>{s.label.toUpperCase()}</span>
                </div>
              ))}
            </div>
          )}

          {/* PAGE CONTENT */}
          {page === "settings" ? (
            <SettingsPage team={team} onTeamChange={setTeam} />
          ) : (
            <div style={{ flex: 1, overflow: "auto", padding: 20, height: 0 }}>
              {loading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#333", fontFamily: "'DM Mono', monospace", fontSize: 12, gap: 10 }}>
                  <span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>◌</span> Loading...
                </div>
              ) : view === "kanban" ? (
                <div style={{ display: "flex", gap: 16, minWidth: "max-content", alignItems: "stretch", minHeight: "100%" }}>
                  {STATUSES.map(status => {
                    const colTasks = filtered.filter(t => t.status === status.id);
                    const isOver = overColumn === status.id && draggingId !== null;
                    return (
                      <div key={status.id} ref={el => { columnRefs.current[status.id] = el; }} style={{ width: 260, flexShrink: 0, display: "flex", flexDirection: "column", minHeight: "100%" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, paddingBottom: 10, borderBottom: `1.5px solid ${isOver ? "#F97316" : "#1e1e1e"}`, transition: "border-color 0.12s" }}>
                          <span style={{ fontSize: 14, color: isOver ? "#F97316" : "#666" }}>{status.icon}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: isOver ? "#F97316" : "#888", letterSpacing: 1, fontFamily: "'DM Mono', monospace", textTransform: "uppercase" }}>{status.label}</span>
                          <span style={{ marginLeft: "auto", background: "#1a1a1a", color: "#555", borderRadius: 10, padding: "2px 7px", fontSize: 11, fontFamily: "'DM Mono', monospace" }}>{colTasks.length}</span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minHeight: 200, borderRadius: 8, padding: isOver ? "6px" : "0", background: isOver ? "#F9731610" : "transparent", border: isOver ? "1.5px dashed #F9731650" : "1.5px solid transparent", transition: "all 0.12s" }}>
                          {colTasks.map(t => <TaskCard key={t.id} task={t} onEdit={openEdit} onMouseDownDrag={handleMouseDownDrag} isDragging={draggingId === t.id} team={team} />)}
                          {colTasks.length === 0 && !isOver && <div style={{ border: "1px dashed #1e1e1e", borderRadius: 8, padding: "18px 0", textAlign: "center", color: "#2a2a2a", fontSize: 11, fontFamily: "'DM Mono', monospace" }}>empty</div>}
                          {isOver && <div style={{ border: "1.5px dashed #F9731680", borderRadius: 8, padding: "14px 0", textAlign: "center", color: "#F97316", fontSize: 11, fontFamily: "'DM Mono', monospace" }}>↓ drop here</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ maxWidth: 900 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 110px 80px 100px 90px", gap: 10, padding: "8px 14px", marginBottom: 6, fontSize: 9.5, fontFamily: "'DM Mono', monospace", color: "#3a3a3a", letterSpacing: 0.8, textTransform: "uppercase" }}>
                    <span>Task</span><span>Company</span><span>Assignee</span><span>Priority</span><span>Status</span><span>Due</span>
                  </div>
                  {filtered.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#333", fontFamily: "'DM Mono', monospace", fontSize: 12 }}>No tasks found</div>}
                  {filtered.map(task => {
                    const member = getMember(task.assignee, team);
                    const isOverdue = task.status !== "done" && task.due && new Date(task.due) < new Date();
                    return (
                      <div key={task.id} onClick={() => openEdit(task)} style={{ display: "grid", gridTemplateColumns: "1fr 80px 110px 80px 100px 90px", gap: 10, padding: "11px 14px", borderRadius: 7, cursor: "pointer", background: "#111", border: "1px solid #1a1a1a", marginBottom: 4, alignItems: "center", animation: "slideIn 0.15s ease-out" }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = "#2a2a2a"}
                        onMouseLeave={e => e.currentTarget.style.borderColor = "#1a1a1a"}
                      >
                        <span style={{ fontSize: 13, color: "#ddd", fontFamily: "'Syne', sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{task.title}</span>
                        <CompanyBadge companyId={task.company} small />
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}><Avatar member={member} size={20} /><span style={{ fontSize: 11, color: "#555" }}>{member.name}</span></div>
                        <PriorityDot priorityId={task.priority} />
                        <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: task.status === "done" ? "#10B981" : task.status === "inprogress" ? "#F59E0B" : "#555" }}>{STATUSES.find(s => s.id === task.status)?.label}</span>
                        <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: isOverdue ? "#EF4444" : "#444" }}>
                          {task.due ? new Date(task.due + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {editTask !== null && <TaskModal task={editTask} isNew={isNew} onClose={closeModal} onSave={handleSave} onDelete={handleDelete} team={team} />}
      {aiOpen && <AIModal onClose={() => setAiOpen(false)} onAdd={handleAiAdd} team={team} />}
      {digestOpen && <DigestModal tasks={tasks} team={team} onClose={() => setDigestOpen(false)} />}
    </>
  );
}
