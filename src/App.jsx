import React, { useState, useRef, useEffect, useCallback, useContext } from "react";
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


// ── Theme Context ──────────────────────────────────────
const ThemeContext = React.createContext({ dark: true, toggle: () => {} });
function useTheme() { return React.useContext(ThemeContext); }

function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => {
    try { const s = localStorage.getItem("theme"); return s ? s === "dark" : true; } catch { return true; }
  });
  const toggle = () => setDark(d => { const n = !d; try { localStorage.setItem("theme", n?"dark":"light"); } catch{} return n; });
  const t = dark ? {
    bg:"#0a0a0a", bg2:"#0d0d0d", bg3:"#111", bg4:"#151515", bg5:"#1a1a1a",
    border:"#1a1a1a", border2:"#2a2a2a", border3:"#252525",
    text:"#e5e5e5", text2:"#888", text3:"#555", text4:"#444", text5:"#333",
    input:"#0e0e0e", inputBorder:"#252525", inputText:"#e0e0e0",
    label:"#555", accent:"#F97316",
  } : {
    bg:"#f4f4f5", bg2:"#ffffff", bg3:"#ffffff", bg4:"#f9f9f9", bg5:"#f0f0f0",
    border:"#e4e4e7", border2:"#d4d4d8", border3:"#e0e0e0",
    text:"#18181b", text2:"#52525b", text3:"#71717a", text4:"#a1a1aa", text5:"#d4d4d8",
    input:"#ffffff", inputBorder:"#d4d4d8", inputText:"#18181b",
    label:"#71717a", accent:"#F97316",
  };
  return <ThemeContext.Provider value={{ dark, toggle, t }}>{children}</ThemeContext.Provider>;
}

const getCompany  = (id) => COMPANIES.find(c => c.id === id) || COMPANIES[1];
const getMember   = (id, team) => (team || []).find(t => t.id === id) || { id, name: id, initials: (id||"?")[0]?.toUpperCase(), color: "#555" };
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

function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return mobile;
}

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
// Drag Ghost (desktop only)
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
// Attachment component
// ─────────────────────────────────────────────

function AttachmentRow({ att, onDelete }) {
  const isImage = att.file_type?.startsWith("image/");
  const isPdf = att.file_type === "application/pdf";
  const icon = isPdf ? "📄" : isImage ? "🖼" : "📎";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "#0e0e0e", border: "1px solid #1e1e1e", borderRadius: 6 }}>
      {isImage ? (
        <img src={att.file_url} alt={att.file_name} style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
      ) : (
        <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
      )}
      <a href={att.file_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#aaa", fontFamily: "'DM Mono', monospace", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none" }}>
        {att.file_name}
      </a>
      {onDelete && (
        <button onClick={() => onDelete(att)} style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 16, padding: "0 4px", flexShrink: 0 }}>×</button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Task Card
// ─────────────────────────────────────────────

function TaskCard({ task, onEdit, onMouseDownDrag, isDragging, team, attachmentCounts }) {
  const member = getMember(task.assignee, team);
  const isOverdue = task.status !== "done" && task.due && new Date(task.due) < new Date();
  const attachCount = attachmentCounts?.[task.id] || 0;
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
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Avatar member={member} size={24} />
          {attachCount > 0 && (
            <span style={{ fontSize: 10, color: "#444", fontFamily: "'DM Mono', monospace" }}>📎 {attachCount}</span>
          )}
        </div>
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
  const isMobile = useIsMobile();
  const [form, setForm] = useState(task && task.id ? { ...task } : {
    title: "", company: "fcg", assignee: team[0]?.id || "keaton",
    priority: "med", status: "todo", due: "", description: ""
  });
  const [saving, setSaving] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();
  const cameraRef = useRef();
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Load attachments for existing task
  useEffect(() => {
    if (task?.id) {
      supabase.from("task_attachments").select("*").eq("task_id", task.id).order("created_at").then(({ data }) => {
        if (data) setAttachments(data);
      });
    }
  }, [task?.id]);

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length || !task?.id) return;
    setUploading(true);
    for (const file of files) {
      const ext = file.name.split(".").pop();
      const path = `${task.id}/${Date.now()}_${file.name}`;
      const { data, error } = await supabase.storage.from("attachments").upload(path, file, { upsert: true });
      if (!error) {
        const { data: urlData } = supabase.storage.from("attachments").getPublicUrl(path);
        const row = { task_id: task.id, file_name: file.name, file_url: urlData.publicUrl, file_type: file.type };
        const { data: att } = await supabase.from("task_attachments").insert([row]).select().single();
        if (att) setAttachments(a => [...a, att]);
      }
    }
    setUploading(false);
    e.target.value = "";
  };

  const handleDeleteAttachment = async (att) => {
    const path = att.file_url.split("/attachments/")[1];
    await supabase.storage.from("attachments").remove([path]);
    await supabase.from("task_attachments").delete().eq("id", att.id);
    setAttachments(a => a.filter(x => x.id !== att.id));
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true); await onSave(form); setSaving(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", zIndex: 1000, padding: isMobile ? 0 : 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: isMobile ? "16px 16px 0 0" : 12, padding: isMobile ? "24px 20px 32px" : 28, width: "100%", maxWidth: isMobile ? "100%" : 540, boxShadow: "0 24px 80px rgba(0,0,0,0.7)", maxHeight: isMobile ? "92vh" : "88vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 17, fontWeight: 700, color: "#e5e5e5" }}>{isNew ? "New Task" : "Edit Task"}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 22, padding: "0 4px" }}>×</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Task Title</label>
            <input value={form.title} onChange={e => set("title", e.target.value)} placeholder="What needs to get done?" style={{ ...inputStyle, fontSize: 15 }} autoFocus />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Company</label>
              <select value={form.company} onChange={e => set("company", e.target.value)} style={{ ...inputStyle, fontSize: 14 }}>
                {COMPANIES.filter(c => c.id !== "all").map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Assignee</label>
              <select value={form.assignee} onChange={e => set("assignee", e.target.value)} style={{ ...inputStyle, fontSize: 14 }}>
                {team.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Priority</label>
              <select value={form.priority} onChange={e => set("priority", e.target.value)} style={{ ...inputStyle, fontSize: 14 }}>
                {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select value={form.status} onChange={e => set("status", e.target.value)} style={{ ...inputStyle, fontSize: 14 }}>
                {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Due Date</label>
              <input type="date" value={form.due} onChange={e => set("due", e.target.value)} style={{ ...inputStyle, fontSize: 14 }} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Notes</label>
            <textarea value={form.description} onChange={e => set("description", e.target.value)} placeholder="Any context..." style={{ ...inputStyle, minHeight: 70, resize: "vertical", fontSize: 14 }} />
          </div>
          <div>
            <label style={labelStyle}>Project</label>
            <input value={form.project || ""} onChange={e => set("project", e.target.value)} placeholder="e.g. Belmont, Walmart Reno, LongHorn..." style={{ ...inputStyle, fontSize: 14 }} list="project-suggestions" />
            <datalist id="project-suggestions">
              {[...new Set(allProjects)].filter(Boolean).map(p => <option key={p} value={p} />)}
            </datalist>
          </div>

          {/* Attachments */}
          <div>
            <label style={labelStyle}>Attachments</label>
            {attachments.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
                {attachments.map(att => <AttachmentRow key={att.id} att={att} onDelete={!isNew ? handleDeleteAttachment : null} />)}
              </div>
            )}
            {isNew ? (
              <div style={{ padding: "10px 12px", background: "#0e0e0e", border: "1px dashed #252525", borderRadius: 6, fontSize: 11, color: "#444", fontFamily: "'DM Mono', monospace" }}>
                Save the task first, then reopen it to add attachments
              </div>
            ) : (
              <>
                <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" onChange={handleFileUpload} style={{ display: "none" }} />
                <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleFileUpload} style={{ display: "none" }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ flex: 1, padding: "10px 0", background: "#0e0e0e", border: "1px dashed #2a2a2a", borderRadius: 6, color: uploading ? "#555" : "#888", cursor: uploading ? "not-allowed" : "pointer", fontSize: 12, fontFamily: "'DM Mono', monospace", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    {uploading ? <><span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>◌</span> Uploading...</> : "📎 Files"}
                  </button>
                  <button onClick={() => cameraRef.current?.click()} disabled={uploading} style={{ padding: "10px 16px", background: "#0e0e0e", border: "1px dashed #2a2a2a", borderRadius: 6, color: uploading ? "#555" : "#888", cursor: uploading ? "not-allowed" : "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    📷
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "space-between", flexWrap: "wrap" }}>
          {!isNew && <button onClick={() => onDelete(form.id)} style={{ background: "#1a0a0a", border: "1px solid #3a1a1a", color: "#ef4444", padding: "10px 16px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>Delete</button>}
          <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
            <button onClick={onClose} style={{ background: "none", border: "1px solid #2a2a2a", color: "#777", padding: "10px 18px", borderRadius: 6, cursor: "pointer", fontSize: 14, fontFamily: "'Syne', sans-serif" }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{ background: "#F97316", border: "none", color: "#000", padding: "10px 22px", borderRadius: 6, cursor: saving ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 700, fontFamily: "'Syne', sans-serif", opacity: form.title.trim() && !saving ? 1 : 0.5 }}>
              {saving ? "Saving..." : isNew ? "Add Task" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Member Modal
// ─────────────────────────────────────────────

function MemberModal({ member, onClose, onSave, onDelete, isNew }) {
  const isMobile = useIsMobile();
  const [form, setForm] = useState(member && member.id ? { ...member } : {
    id: "", name: "", initials: "", color: TEAM_COLORS[0], email: "", role: ""
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleNameChange = (v) => {
    set("name", v);
    const parts = v.trim().split(" ");
    const initials = parts.length >= 2 ? (parts[0][0] + parts[parts.length-1][0]).toUpperCase() : v.slice(0,2).toUpperCase();
    set("initials", initials);
    if (isNew) set("id", v.toLowerCase().replace(/\s+/g,"_").replace(/[^a-z0-9_]/g,""));
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.id.trim()) return;
    setSaving(true); await onSave(form); setSaving(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", zIndex: 1100, padding: isMobile ? 0 : 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: isMobile ? "16px 16px 0 0" : 12, padding: isMobile ? "24px 20px 32px" : 28, width: "100%", maxWidth: isMobile ? "100%" : 460, boxShadow: "0 24px 80px rgba(0,0,0,0.7)", maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 17, fontWeight: 700, color: "#e5e5e5" }}>{isNew ? "Add Team Member" : "Edit Member"}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 22 }}>×</button>
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 22 }}>
          <Avatar member={form} size={56} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Full Name</label>
              <input value={form.name} onChange={e => handleNameChange(e.target.value)} placeholder="John Smith" style={{ ...inputStyle, fontSize: 15 }} autoFocus />
            </div>
            <div>
              <label style={labelStyle}>Role / Title</label>
              <input value={form.role} onChange={e => set("role", e.target.value)} placeholder="e.g. Estimator" style={{ ...inputStyle, fontSize: 15 }} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Initials</label>
              <input value={form.initials} onChange={e => set("initials", e.target.value.slice(0,2).toUpperCase())} placeholder="JS" maxLength={2} style={{ ...inputStyle, fontSize: 15 }} />
            </div>
            <div>
              <label style={labelStyle}>Username / ID</label>
              <input value={form.id} onChange={e => { if (isNew) set("id", e.target.value.toLowerCase().replace(/\s+/g,"_").replace(/[^a-z0-9_]/g,"")); }} placeholder="john_smith" style={{ ...inputStyle, fontSize: 15, opacity: isNew ? 1 : 0.4, cursor: isNew ? "text" : "not-allowed" }} disabled={!isNew} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Email Address</label>
            <input value={form.email} onChange={e => set("email", e.target.value)} placeholder="john@example.com" type="email" style={{ ...inputStyle, fontSize: 15 }} />
          </div>
          <div>
            <label style={labelStyle}>Color</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
              {TEAM_COLORS.map(c => (
                <button key={c} onClick={() => set("color", c)} style={{ width: 32, height: 32, borderRadius: "50%", background: c, border: form.color === c ? "3px solid #fff" : "3px solid transparent", cursor: "pointer", outline: "none" }} />
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type="color" value={form.color} onChange={e => set("color", e.target.value)} style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: "none", cursor: "pointer", padding: 0 }} />
                <span style={{ fontSize: 10, color: "#444", fontFamily: "'DM Mono', monospace" }}>custom</span>
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "space-between" }}>
          {!isNew && <button onClick={() => onDelete(form.id)} style={{ background: "#1a0a0a", border: "1px solid #3a1a1a", color: "#ef4444", padding: "10px 16px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>Remove</button>}
          <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
            <button onClick={onClose} style={{ background: "none", border: "1px solid #2a2a2a", color: "#777", padding: "10px 18px", borderRadius: 6, cursor: "pointer", fontSize: 14, fontFamily: "'Syne', sans-serif" }}>Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.name.trim() || !form.id.trim()} style={{ background: "#F97316", border: "none", color: "#000", padding: "10px 22px", borderRadius: 6, cursor: "pointer", fontSize: 14, fontWeight: 700, fontFamily: "'Syne', sans-serif", opacity: form.name.trim() && form.id.trim() && !saving ? 1 : 0.4 }}>
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

  const openNew = () => { setIsNewMember(true); setEditMember({}); };
  const openEdit = (m) => { setIsNewMember(false); setEditMember(m); };
  const closeModal = () => { setEditMember(null); setIsNewMember(false); };

  const handleSave = async (form) => {
    if (isNewMember) {
      const { data } = await supabase.from("team").insert([form]).select().single();
      if (data) onTeamChange([...team, data]);
    } else {
      const { id, ...fields } = form;
      await supabase.from("team").update(fields).eq("id", id);
      onTeamChange(team.map(m => m.id === id ? { ...m, ...fields } : m));
    }
    closeModal();
  };

  const handleDelete = async (id) => {
    await supabase.from("team").delete().eq("id", id);
    onTeamChange(team.filter(m => m.id !== id));
    closeModal();
  };

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "24px 20px 40px" }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#e5e5e5", fontFamily: "'Syne', sans-serif", marginBottom: 4 }}>Settings</h1>
          <p style={{ fontSize: 12, color: "#444", fontFamily: "'DM Mono', monospace" }}>Manage your team, contact info, and preferences</p>
        </div>

        {/* Team */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#aaa", fontFamily: "'Syne', sans-serif" }}>Team Members</div>
              <div style={{ fontSize: 10.5, color: "#333", fontFamily: "'DM Mono', monospace", marginTop: 2 }}>{team.length} members · emails used for digest</div>
            </div>
            <button onClick={openNew} style={{ background: "#F97316", border: "none", color: "#000", padding: "8px 14px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "'Syne', sans-serif", display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: 15 }}>+</span> Add
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {team.map(member => (
              <div key={member.id} onClick={() => openEdit(member)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: "#111", border: "1px solid #1a1a1a", borderRadius: 10, cursor: "pointer" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "#2a2a2a"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "#1a1a1a"}
              >
                <Avatar member={member} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#e5e5e5", fontFamily: "'Syne', sans-serif" }}>{member.name}</span>
                    {member.role && <span style={{ fontSize: 10, color: "#444", fontFamily: "'DM Mono', monospace", background: "#1a1a1a", padding: "2px 6px", borderRadius: 4 }}>{member.role}</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: member.email ? "#555" : "#2a2a2a", fontFamily: "'DM Mono', monospace", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {member.email || "no email — tap to add"}
                  </div>
                </div>
                <span style={{ fontSize: 18, color: "#333" }}>›</span>
              </div>
            ))}
          </div>
        </div>

        {/* Companies */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#aaa", fontFamily: "'Syne', sans-serif", marginBottom: 6 }}>Companies</div>
          <div style={{ fontSize: 10.5, color: "#333", fontFamily: "'DM Mono', monospace", marginBottom: 12 }}>Contact your developer to add or rename companies</div>
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

        {/* Digest */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#aaa", fontFamily: "'Syne', sans-serif", marginBottom: 6 }}>Email Digest</div>
          <div style={{ padding: "14px 16px", background: "#111", border: "1px solid #1a1a1a", borderRadius: 8, display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              ["Schedule", "Weekdays 8:00 AM"],
              ["Individual emails", "Each member gets their own open tasks"],
              ["Summary email", "Keaton receives full team overview"],
              ["Manual trigger", "Send Digest button in sidebar"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 11.5, color: "#555", fontFamily: "'DM Mono', monospace" }}>{k}</span>
                <span style={{ fontSize: 11.5, color: "#888", fontFamily: "'Syne', sans-serif", textAlign: "right" }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {editMember !== null && <MemberModal member={editMember} isNew={isNewMember} onClose={closeModal} onSave={handleSave} onDelete={handleDelete} />}
    </div>
  );
}

// ─────────────────────────────────────────────
// AI Modal
// ─────────────────────────────────────────────

const TODAY = new Date().toISOString().split("T")[0];

function AIModal({ onClose, onAdd, team }) {
  const isMobile = useIsMobile();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef();
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []);

  const startVoice = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4" });
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setListening(false);
        setTranscribing(true);
        try {
          const blob = new Blob(chunksRef.current, { type: mr.mimeType });
          const fd = new FormData();
          fd.append("audio", blob, "audio.webm");
          const res = await fetch("/api/whisper", { method: "POST", body: fd });
          const data = await res.json();
          if (data.text) {
            setPrompt(prev => (prev ? prev + " " + data.text : data.text));
            setPreview(null); setError("");
          } else {
            setError("Couldn't transcribe — try again.");
          }
        } catch { setError("Transcription failed."); }
        setTranscribing(false);
      };
      mediaRef.current = mr;
      mr.start();
      setListening(true);
    } catch { setError("Mic access denied."); }
  };

  const stopVoice = () => { mediaRef.current?.stop(); };

  const teamContext = team.map(m => `${m.id}=${m.name}${m.role ? ` (${m.role})` : ""}`).join(", ");

  const parse = async () => {
    if (!prompt.trim()) return;
    setLoading(true); setError(""); setPreview(null);
    try {
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `You parse natural language task descriptions into structured JSON.
Today: ${TODAY}.
Return ONLY valid JSON, no markdown:
{"title":"action-oriented task title","company":"fcg or brc","assignee":"team member ID","priority":"high/med/low","status":"todo/inprogress/review/done","due":"YYYY-MM-DD or empty","description":"brief note"}
Companies: FCG=Foundation Construction Group, BRC=BR Concrete.
Team: ${teamContext}.
Interpret relative dates relative to today (${TODAY}).`,
          messages: [{ role: "user", content: prompt }]
        })
      });
      const data = await res.json();
      const text = data.content?.find(b => b.type === "text")?.text || "";
      setPreview(JSON.parse(text.replace(/```json|```/g,"").trim()));
    } catch (e) { setError("Couldn't parse — try being more specific."); }
    setLoading(false);
  };

  const handleAdd = async () => { setSaving(true); await onAdd(preview); setSaving(false); onClose(); };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", zIndex: 1000, padding: isMobile ? 0 : 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: isMobile ? "16px 16px 0 0" : 14, padding: isMobile ? "24px 20px 32px" : 28, width: "100%", maxWidth: isMobile ? "100%" : 540, boxShadow: "0 24px 80px rgba(0,0,0,0.7)", maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #a855f7, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>✦</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#e5e5e5", fontFamily: "'Syne', sans-serif" }}>AI Task Add</div>
              <div style={{ fontSize: 10, color: "#444", fontFamily: "'DM Mono', monospace" }}>describe it, we'll structure it</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 22 }}>×</button>
        </div>
        <div style={{ position: "relative" }}>
          <textarea ref={inputRef} value={prompt} onChange={e => { setPrompt(e.target.value); setPreview(null); setError(""); }}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !isMobile) { e.preventDefault(); parse(); } }}
            placeholder={`e.g. "Keaton follow up with FMGI, high priority FCG, due Friday"`}
            style={{ width: "100%", background: "#0c0c0c", border: `1px solid ${listening ? "#a855f7" : "#2a2a2a"}`, borderRadius: 8, padding: "12px 44px 12px 14px", color: "#e0e0e0", fontSize: 14, fontFamily: "'Syne', sans-serif", outline: "none", resize: "none", minHeight: 90, boxSizing: "border-box", lineHeight: 1.5, transition: "border-color 0.2s" }}
          />
          <button onClick={listening ? stopVoice : startVoice} disabled={transcribing} title={listening ? "Stop" : transcribing ? "Transcribing..." : "Speak"}
            style={{ position: "absolute", right: 10, top: 10, background: listening ? "linear-gradient(135deg,#7c3aed,#a855f7)" : "#1a1a1a", border: `1px solid ${listening ? "#a855f7" : "#333"}`, borderRadius: 7, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: transcribing ? "not-allowed" : "pointer", fontSize: 15, transition: "all 0.2s", boxShadow: listening ? "0 0 12px rgba(168,85,247,0.5)" : "none", opacity: transcribing ? 0.4 : 1 }}>
            {listening ? "⏹" : transcribing ? "◌" : "🎤"}
          </button>
        </div>
        {listening && <div style={{ fontSize: 10, color: "#a855f7", fontFamily: "'DM Mono', monospace", marginTop: 5, display: "flex", alignItems: "center", gap: 5 }}><span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>◌</span> Listening — tap ⏹ when done</div>}
        {transcribing && <div style={{ fontSize: 10, color: "#a855f7", fontFamily: "'DM Mono', monospace", marginTop: 5, display: "flex", alignItems: "center", gap: 5 }}><span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>◌</span> Transcribing...</div>}
        {!isMobile && !listening && !transcribing && <div style={{ fontSize: 10, color: "#333", fontFamily: "'DM Mono', monospace", marginTop: 5 }}>Enter to parse · Shift+Enter for new line · 🎤 to speak</div>}
        {!preview && (
          <button onClick={parse} disabled={loading || !prompt.trim()} style={{ marginTop: 14, width: "100%", background: loading ? "#1a1228" : "linear-gradient(135deg, #7c3aed, #a855f7)", border: "none", borderRadius: 8, padding: "12px 0", color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "'Syne', sans-serif", cursor: loading || !prompt.trim() ? "not-allowed" : "pointer", opacity: !prompt.trim() ? 0.4 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {loading ? <><span style={{ display: "inline-block", animation: "spin 0.8s linear infinite" }}>◌</span> Parsing...</> : "✦ Parse Task"}
          </button>
        )}
        {error && <div style={{ marginTop: 12, color: "#ef4444", fontSize: 12, fontFamily: "'DM Mono', monospace" }}>⚠ {error}</div>}
        {preview && (
          <div style={{ marginTop: 16, background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 10, color: "#555", fontFamily: "'DM Mono', monospace", letterSpacing: 0.8, marginBottom: 12 }}>PARSED — LOOKS GOOD?</div>
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
              <button onClick={() => setPreview(null)} style={{ flex: 1, background: "none", border: "1px solid #2a2a2a", color: "#777", padding: "10px 0", borderRadius: 6, cursor: "pointer", fontSize: 13, fontFamily: "'Syne', sans-serif" }}>← Re-parse</button>
              <button onClick={handleAdd} disabled={saving} style={{ flex: 2, background: "linear-gradient(135deg, #7c3aed, #a855f7)", border: "none", color: "#fff", padding: "10px 0", borderRadius: 6, cursor: saving ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 700, fontFamily: "'Syne', sans-serif", opacity: saving ? 0.6 : 1 }}>
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
  const isMobile = useIsMobile();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const openTasks = tasks.filter(t => t.status !== "done");
  const perPerson = team.map(m => ({
    ...m,
    tasks: openTasks.filter(t => t.assignee === m.id).sort((a,b) => ({high:0,med:1,low:2})[a.priority] - ({high:0,med:1,low:2})[b.priority])
  })).filter(m => m.tasks.length > 0);

  const handleSend = async () => {
    if (!N8N_WEBHOOK_URL) { setError("Add VITE_N8N_WEBHOOK_URL to Vercel env vars."); return; }
    setSending(true);
    try {
      await fetch(N8N_WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trigger: "manual", sentAt: new Date().toISOString(), summary: perPerson.map(m => ({ name: m.name, email: m.email, taskCount: m.tasks.length, tasks: m.tasks })), allOpenTasks: openTasks }) });
      setSent(true);
    } catch { setError("Failed to reach n8n — check your webhook URL."); }
    setSending(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", zIndex: 1000, padding: isMobile ? 0 : 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: isMobile ? "16px 16px 0 0" : 14, padding: isMobile ? "24px 20px 32px" : 28, width: "100%", maxWidth: isMobile ? "100%" : 560, boxShadow: "0 24px 80px rgba(0,0,0,0.7)", maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #10B981, #059669)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>✉</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#e5e5e5", fontFamily: "'Syne', sans-serif" }}>Send Daily Digest</div>
              <div style={{ fontSize: 10, color: "#444", fontFamily: "'DM Mono', monospace" }}>{openTasks.length} open tasks · {perPerson.length} members</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 22 }}>×</button>
        </div>
        {sent ? (
          <div style={{ textAlign: "center", padding: "30px 0" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>✓</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#10B981", fontFamily: "'Syne', sans-serif" }}>Digest sent!</div>
            <button onClick={onClose} style={{ marginTop: 20, background: "#10B981", border: "none", color: "#000", padding: "10px 28px", borderRadius: 6, cursor: "pointer", fontSize: 14, fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>Done</button>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 20 }}>
              {perPerson.map(member => (
                <div key={member.id} style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 8, padding: "12px 14px", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <Avatar member={member} size={24} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#ddd", fontFamily: "'Syne', sans-serif" }}>{member.name}</span>
                    {member.email && <span style={{ fontSize: 10, color: "#444", fontFamily: "'DM Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{member.email}</span>}
                    <span style={{ marginLeft: "auto", fontSize: 10, color: "#444", fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>{member.tasks.length} task{member.tasks.length !== 1 ? "s" : ""}</span>
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
              {perPerson.length === 0 && <div style={{ textAlign: "center", padding: 30, color: "#333", fontFamily: "'DM Mono', monospace", fontSize: 12 }}>No open tasks</div>}
            </div>
            {error && <div style={{ marginBottom: 14, color: "#ef4444", fontSize: 12, fontFamily: "'DM Mono', monospace", background: "#1a0a0a", border: "1px solid #3a1a1a", borderRadius: 6, padding: "10px 12px" }}>⚠ {error}</div>}
            <button onClick={handleSend} disabled={sending || perPerson.length === 0} style={{ width: "100%", background: sending ? "#0a1a12" : "linear-gradient(135deg, #10B981, #059669)", border: "none", borderRadius: 8, padding: "13px 0", color: sending ? "#10B981" : "#000", fontSize: 14, fontWeight: 700, fontFamily: "'Syne', sans-serif", cursor: sending || perPerson.length === 0 ? "not-allowed" : "pointer", opacity: perPerson.length === 0 ? 0.4 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {sending ? <><span style={{ display: "inline-block", animation: "spin 0.8s linear infinite" }}>◌</span> Sending...</> : "✉ Send Digest Now"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Mobile Task List
// ─────────────────────────────────────────────

function MobileKanban({ filtered, team, onEdit, onStatusChange, attachmentCounts }) {
  const dragRef = useRef({ active: false, task: null, moved: false, clone: null });
  const colRefs = useRef({});
  const [dragOver, setDragOver] = useState(null);
  const [draggingId, setDraggingId] = useState(null);

  const getColAt = (x, y) => {
    for (const [col, el] of Object.entries(colRefs.current)) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return col;
    }
    return null;
  };

  const handleTouchStart = (e, task) => {
    const t = e.touches[0];
    dragRef.current = { active: true, task, startX: t.clientX, startY: t.clientY, moved: false, clone: null };
  };

  useEffect(() => {
    const handleTouchMove = (e) => {
      const dr = dragRef.current;
      if (!dr.active) return;
      const t = e.touches[0];
      const dx = Math.abs(t.clientX - dr.startX);
      const dy = Math.abs(t.clientY - dr.startY);
      if (!dr.moved && (dx > 8 || dy > 8)) {
        dr.moved = true;
        setDraggingId(dr.task.id);
        const clone = document.createElement('div');
        clone.innerText = dr.task.title;
        clone.style.cssText = 'position:fixed;z-index:9999;background:#1e1e1e;border:1.5px solid #F97316;border-radius:8px;padding:10px 14px;font-size:12px;color:#e5e5e5;font-family:Syne,sans-serif;pointer-events:none;max-width:150px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 8px 32px rgba(0,0,0,0.8);opacity:0.9;transform:rotate(2deg) scale(1.05)';
        document.body.appendChild(clone);
        dr.clone = clone;
      }
      if (dr.moved && dr.clone) {
        dr.clone.style.left = (t.clientX - 75) + 'px';
        dr.clone.style.top = (t.clientY - 18) + 'px';
        setDragOver(getColAt(t.clientX, t.clientY));
      }
      if (dr.moved) e.preventDefault();
    };

    const handleTouchEnd = async (e) => {
      const dr = dragRef.current;
      if (!dr.active) return;
      if (dr.clone) { dr.clone.remove(); dr.clone = null; }
      if (dr.moved) {
        const t = e.changedTouches[0];
        const col = getColAt(t.clientX, t.clientY);
        if (col && col !== dr.task.status) onStatusChange(dr.task, col);
      } else {
        onEdit(dr.task);
      }
      dragRef.current = { active: false, task: null, moved: false, clone: null };
      setDraggingId(null);
      setDragOver(null);
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  return (
    <div style={{ display: 'flex', overflowX: 'auto', height: '100%', padding: '8px 8px 80px', gap: 6, scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}>
      {STATUSES.map(status => {
        const colTasks = filtered.filter(t => t.status === status.id);
        const isOver = dragOver === status.id;
        return (
          <div key={status.id} ref={el => colRefs.current[status.id] = el}
            style={{ minWidth: 'calc(50vw - 12px)', width: 'calc(50vw - 12px)', flexShrink: 0, display: 'flex', flexDirection: 'column', scrollSnapAlign: 'start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6, paddingBottom: 6, borderBottom: `1.5px solid ${isOver ? '#F97316' : '#1e1e1e'}`, transition: 'border-color 0.1s' }}>
              <span style={{ fontSize: 11 }}>{status.icon}</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: isOver ? '#F97316' : '#555', letterSpacing: 1, fontFamily: "'DM Mono', monospace", textTransform: 'uppercase' }}>{status.label}</span>
              <span style={{ marginLeft: 'auto', background: '#1a1a1a', color: '#444', borderRadius: 8, padding: '1px 5px', fontSize: 9, fontFamily: "'DM Mono', monospace" }}>{colTasks.length}</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', borderRadius: 8, background: isOver ? 'rgba(249,115,22,0.05)' : 'transparent', border: isOver ? '1.5px dashed rgba(249,115,22,0.4)' : '1.5px solid transparent', transition: 'all 0.15s', padding: isOver ? 4 : 0, minHeight: 60 }}>
              {colTasks.map(task => {
                const member = getMember(task.assignee, team);
                const isOverdue = task.status !== 'done' && task.due && new Date(task.due) < new Date();
                const attachCount = attachmentCounts?.[task.id] || 0;
                return (
                  <div key={task.id}
                    onTouchStart={e => handleTouchStart(e, task)}
                    style={{ background: '#161616', border: `1px solid ${draggingId === task.id ? 'rgba(249,115,22,0.3)' : '#222'}`, borderRadius: 7, padding: '8px 9px', marginBottom: 5, opacity: draggingId === task.id ? 0.25 : 1, transition: 'opacity 0.1s', userSelect: 'none', touchAction: 'none' }}>
                    <div style={{ display: 'flex', gap: 3, marginBottom: 4, alignItems: 'center' }}>
                      <CompanyBadge companyId={task.company} small />
                      <PriorityDot priorityId={task.priority} />
                      {isOverdue && <span style={{ fontSize: 8, color: '#EF4444', fontFamily: "'DM Mono', monospace" }}>OVR</span>}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#e5e5e5', fontWeight: 500, lineHeight: 1.35, marginBottom: 5, fontFamily: "'Syne', sans-serif", overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{task.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Avatar member={member} size={15} />
                        {attachCount > 0 && <span style={{ fontSize: 9, color: '#444' }}>📎</span>}
                      </div>
                      {task.due && <span style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", color: isOverdue ? '#EF4444' : '#3a3a3a' }}>{new Date(task.due + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                    </div>
                  </div>
                );
              })}
              {colTasks.length === 0 && (
                <div style={{ border: '1px dashed #1a1a1a', borderRadius: 7, padding: '14px 0', textAlign: 'center', color: '#252525', fontSize: 10, fontFamily: "'DM Mono', monospace" }}>empty</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}



// ─────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────

function DashboardPage({ tasks, team }) {
  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const sevenDays = new Date(today); sevenDays.setDate(sevenDays.getDate() + 7);

  const open = tasks.filter(t => t.status !== "done");
  const overdue = tasks.filter(t => t.status !== "done" && t.due && new Date(t.due+"T12:00:00") < today);
  const dueToday = tasks.filter(t => t.status !== "done" && t.due && new Date(t.due+"T12:00:00") >= today && new Date(t.due+"T12:00:00") < tomorrow);
  const dueWeek = tasks.filter(t => t.status !== "done" && t.due && new Date(t.due+"T12:00:00") >= tomorrow && new Date(t.due+"T12:00:00") < sevenDays);
  const done = tasks.filter(t => t.status === "done");

  const byPerson = team.map(m => ({
    ...m,
    total: tasks.filter(t => t.assignee === m.id).length,
    open: tasks.filter(t => t.assignee === m.id && t.status !== "done").length,
    overdue: tasks.filter(t => t.assignee === m.id && t.status !== "done" && t.due && new Date(t.due+"T12:00:00") < today).length,
    done: tasks.filter(t => t.assignee === m.id && t.status === "done").length,
  })).filter(m => m.total > 0).sort((a,b) => b.open - a.open);

  const projects = [...new Set(tasks.map(t => t.project).filter(Boolean))];
  const byProject = projects.map(p => ({
    name: p,
    total: tasks.filter(t => t.project === p).length,
    open: tasks.filter(t => t.project === p && t.status !== "done").length,
    done: tasks.filter(t => t.project === p && t.status === "done").length,
    overdue: tasks.filter(t => t.project === p && t.status !== "done" && t.due && new Date(t.due+"T12:00:00") < today).length,
  })).sort((a,b) => b.open - a.open);

  const statCard = (label, val, color, sub) => (
    <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 10, padding: "16px 18px", flex: 1, minWidth: 100 }}>
      <div style={{ fontSize: 28, fontWeight: 800, color, fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>{val}</div>
      <div style={{ fontSize: 10, color: "#555", fontFamily: "'DM Mono', monospace", letterSpacing: 0.8, marginTop: 5, textTransform: "uppercase" }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: "#333", fontFamily: "'DM Mono', monospace", marginTop: 2 }}>{sub}</div>}
    </div>
  );

  const maxOpen = Math.max(...byPerson.map(m => m.open), 1);

  return (
    <div style={{ padding: "20px 20px 80px", overflowY: "auto", height: "100%", fontFamily: "'Syne', sans-serif" }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#e5e5e5", marginBottom: 16 }}>Overview</div>

      {/* Stat cards */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {statCard("Total Open", open.length, "#e5e5e5")}
        {statCard("Overdue", overdue.length, "#EF4444")}
        {statCard("Due Today", dueToday.length, "#F59E0B")}
        {statCard("This Week", dueWeek.length, "#3B82F6")}
        {statCard("Completed", done.length, "#10B981")}
      </div>

      {/* Overdue alert */}
      {overdue.length > 0 && (
        <div style={{ background: "#1a0a0a", border: "1px solid #3a1a1a", borderRadius: 8, padding: "12px 16px", marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#ef4444", fontFamily: "'DM Mono', monospace", marginBottom: 8 }}>⚠ OVERDUE TASKS</div>
          {overdue.slice(0, 5).map(t => (
            <div key={t.id} style={{ fontSize: 12, color: "#e5e5e5", padding: "4px 0", borderBottom: "1px solid #1e1e1e", display: "flex", justifyContent: "space-between" }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{t.title}</span>
              <span style={{ color: "#ef4444", fontSize: 10, fontFamily: "'DM Mono', monospace", flexShrink: 0, marginLeft: 8 }}>{new Date(t.due+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>
            </div>
          ))}
          {overdue.length > 5 && <div style={{ fontSize: 10, color: "#555", marginTop: 6, fontFamily: "'DM Mono', monospace" }}>+{overdue.length - 5} more</div>}
        </div>
      )}

      {/* Workload by person */}
      {byPerson.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#555", fontFamily: "'DM Mono', monospace", letterSpacing: 1, marginBottom: 10, textTransform: "uppercase" }}>Workload by Person</div>
          {byPerson.map(m => (
            <div key={m.id} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: m.color || "#555", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#000", flexShrink: 0 }}>{m.initials || m.name[0]}</div>
                <span style={{ fontSize: 12, color: "#ccc", flex: 1 }}>{m.name}</span>
                <span style={{ fontSize: 10, color: "#555", fontFamily: "'DM Mono', monospace" }}>{m.open} open{m.overdue > 0 ? ` · ${m.overdue} overdue` : ""}</span>
              </div>
              <div style={{ background: "#1a1a1a", borderRadius: 3, height: 5, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 3, background: m.overdue > 0 ? "#EF4444" : (m.color || "#F97316"), width: `${(m.open / maxOpen) * 100}%`, transition: "width 0.3s" }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* By project */}
      {byProject.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#555", fontFamily: "'DM Mono', monospace", letterSpacing: 1, marginBottom: 10, textTransform: "uppercase" }}>By Project</div>
          {byProject.map(p => (
            <div key={p.name} style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 8, padding: "10px 14px", marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 12, color: "#e5e5e5", marginBottom: 2 }}>{p.name}</div>
                <div style={{ fontSize: 10, color: "#444", fontFamily: "'DM Mono', monospace" }}>{p.total} total · {p.done} done</div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {p.overdue > 0 && <span style={{ background: "#1a0a0a", color: "#ef4444", borderRadius: 5, padding: "2px 7px", fontSize: 10, fontFamily: "'DM Mono', monospace" }}>{p.overdue} overdue</span>}
                <span style={{ background: "#1a1a1a", color: "#555", borderRadius: 5, padding: "2px 7px", fontSize: 10, fontFamily: "'DM Mono', monospace" }}>{p.open} open</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════
// APM — ASSISTANT PROJECT MANAGER
// ═══════════════════════════════════════════════════════

const APM_STATUSES = {
  project: ["active","on_hold","complete","cancelled"],
  rfi: ["open","answered","closed"],
  submittal: ["pending","submitted","approved","rejected","revise_resubmit"],
  co: ["pending","approved","rejected","void"],
  material: ["pending","ordered","partial","delivered","cancelled"],
};

const STATUS_COLORS = {
  active:"#10B981", on_hold:"#F59E0B", complete:"#3B82F6", cancelled:"#555",
  open:"#F59E0B", answered:"#10B981", closed:"#555",
  pending:"#F59E0B", submitted:"#3B82F6", approved:"#10B981", rejected:"#EF4444", revise_resubmit:"#F97316",
  ordered:"#3B82F6", partial:"#F59E0B", delivered:"#10B981",
  void:"#555",
};

const fmtDate = d => d ? new Date(d+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"2-digit"}) : "—";
const fmtMoney = v => v != null ? "$"+Number(v).toLocaleString("en-US",{minimumFractionDigits:0}) : "—";

function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] || "#555";
  return <span style={{ background: color+"20", color, border:`1px solid ${color}40`, borderRadius:5, padding:"2px 7px", fontSize:10, fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:0.5, whiteSpace:"nowrap" }}>{(status||"").replace(/_/g," ")}</span>;
}

function APMModal({ title, children, onClose, width=540 }) {
  const isMobile = useIsMobile();
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", display:"flex", alignItems:isMobile?"flex-end":"center", justifyContent:"center", zIndex:1000, padding:isMobile?0:20 }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:"#111", border:"1px solid #2a2a2a", borderRadius:isMobile?"16px 16px 0 0":12, padding:isMobile?"24px 20px 32px":28, width:"100%", maxWidth:isMobile?"100%":width, boxShadow:"0 24px 80px rgba(0,0,0,0.7)", maxHeight:isMobile?"92vh":"88vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <span style={{ fontSize:16, fontWeight:700, color:"#e5e5e5", fontFamily:"'Syne',sans-serif" }}>{title}</span>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#555", cursor:"pointer", fontSize:22 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function APMField({ label, children }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

// ── Project Modal ──────────────────────────────────────
function ProjectModal({ project, onSave, onClose }) {
  const isNew = !project?.id;
  const [form, setForm] = useState({
    name:"", address:"", company:"fcg", gc_name:"", gc_contact:"", gc_email:"", gc_phone:"",
    contract_value:"", start_date:"", end_date:"", status:"active",
    ...(project||{})
  });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = { ...form, contract_value: form.contract_value ? Number(form.contract_value) : null };
    delete payload.id; delete payload.created_at;
    if (isNew) {
      const { data } = await supabase.from("projects").insert([payload]).select().single();
      if (data) onSave(data, true);
    } else {
      await supabase.from("projects").update(payload).eq("id", project.id);
      onSave({...project,...payload}, false);
    }
    setSaving(false);
  };

  return (
    <APMModal title={isNew?"New Project":"Edit Project"} onClose={onClose} width={600}>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <APMField label="Project Name"><input value={form.name} onChange={e=>set("name",e.target.value)} placeholder="Project name" style={{...inputStyle,fontSize:15}} autoFocus /></APMField>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <APMField label="Company">
            <select value={form.company} onChange={e=>set("company",e.target.value)} style={{...inputStyle,fontSize:14}}>
              {COMPANIES.filter(c=>c.id!=="all").map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </APMField>
          <APMField label="Status">
            <select value={form.status} onChange={e=>set("status",e.target.value)} style={{...inputStyle,fontSize:14}}>
              {APM_STATUSES.project.map(s=><option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
            </select>
          </APMField>
        </div>
        <APMField label="Address"><input value={form.address||""} onChange={e=>set("address",e.target.value)} placeholder="Job site address" style={{...inputStyle,fontSize:14}} /></APMField>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
          <APMField label="Contract Value"><input value={form.contract_value||""} onChange={e=>set("contract_value",e.target.value)} placeholder="0" type="number" style={{...inputStyle,fontSize:14}} /></APMField>
          <APMField label="Start Date"><input type="date" value={form.start_date||""} onChange={e=>set("start_date",e.target.value)} style={{...inputStyle,fontSize:14}} /></APMField>
          <APMField label="End Date"><input type="date" value={form.end_date||""} onChange={e=>set("end_date",e.target.value)} style={{...inputStyle,fontSize:14}} /></APMField>
        </div>
        <div style={{ borderTop:"1px solid #1e1e1e", paddingTop:14, marginTop:2 }}>
          <div style={{ fontSize:10, color:"#555", fontFamily:"'DM Mono',monospace", letterSpacing:0.8, marginBottom:10 }}>GC / OWNER CONTACT</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <APMField label="GC / Owner"><input value={form.gc_name||""} onChange={e=>set("gc_name",e.target.value)} placeholder="Company name" style={{...inputStyle,fontSize:14}} /></APMField>
            <APMField label="Contact Name"><input value={form.gc_contact||""} onChange={e=>set("gc_contact",e.target.value)} placeholder="Name" style={{...inputStyle,fontSize:14}} /></APMField>
            <APMField label="Email"><input value={form.gc_email||""} onChange={e=>set("gc_email",e.target.value)} placeholder="email@co.com" type="email" style={{...inputStyle,fontSize:14}} /></APMField>
            <APMField label="Phone"><input value={form.gc_phone||""} onChange={e=>set("gc_phone",e.target.value)} placeholder="(555) 000-0000" style={{...inputStyle,fontSize:14}} /></APMField>
          </div>
        </div>
      </div>
      <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:20 }}>
        <button onClick={onClose} style={{ background:"none", border:"1px solid #2a2a2a", color:"#777", padding:"9px 18px", borderRadius:6, cursor:"pointer", fontSize:13 }}>Cancel</button>
        <button onClick={handleSave} disabled={saving||!form.name.trim()} style={{ background:"#F97316", border:"none", color:"#000", padding:"9px 22px", borderRadius:6, cursor:"pointer", fontSize:13, fontWeight:700, opacity:form.name.trim()&&!saving?1:0.5 }}>{saving?"Saving...":isNew?"Create Project":"Save"}</button>
      </div>
    </APMModal>
  );
}

// ── Daily Log Modal ────────────────────────────────────
function DailyLogModal({ log, projectId, onSave, onClose }) {
  const isNew = !log?.id;
  const [form, setForm] = useState({ log_date:new Date().toISOString().slice(0,10), weather:"", crew_count:"", work_performed:"", issues:"", ...(log||{}), project_id:projectId });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const handleSave = async () => {
    setSaving(true);
    const payload = { ...form, crew_count: form.crew_count ? Number(form.crew_count) : null };
    delete payload.id; delete payload.created_at;
    if (isNew) {
      const { data } = await supabase.from("daily_logs").insert([payload]).select().single();
      if (data) onSave(data);
    } else {
      await supabase.from("daily_logs").update(payload).eq("id", log.id);
      onSave({...log,...payload});
    }
    setSaving(false);
  };

  return (
    <APMModal title={isNew?"New Daily Log":"Edit Daily Log"} onClose={onClose} width={560}>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
          <APMField label="Date"><input type="date" value={form.log_date} onChange={e=>set("log_date",e.target.value)} style={{...inputStyle,fontSize:14}} /></APMField>
          <APMField label="Weather"><input value={form.weather||""} onChange={e=>set("weather",e.target.value)} placeholder="Sunny, 72°F" style={{...inputStyle,fontSize:14}} /></APMField>
          <APMField label="Crew on Site"><input type="number" value={form.crew_count||""} onChange={e=>set("crew_count",e.target.value)} placeholder="0" style={{...inputStyle,fontSize:14}} /></APMField>
        </div>
        <APMField label="Work Performed">
          <textarea value={form.work_performed||""} onChange={e=>set("work_performed",e.target.value)} placeholder="Describe work completed today..." style={{...inputStyle, minHeight:100, resize:"vertical", fontSize:14}} />
        </APMField>
        <APMField label="Issues / Notes">
          <textarea value={form.issues||""} onChange={e=>set("issues",e.target.value)} placeholder="Any issues, delays, or notes..." style={{...inputStyle, minHeight:70, resize:"vertical", fontSize:14}} />
        </APMField>
      </div>
      <div style={{ display:"flex", gap:8, marginTop:20, justifyContent:"space-between" }}>
        {!isNew && <button onClick={async()=>{ await supabase.from("daily_logs").delete().eq("id",log.id); onSave(null,true); }} style={{ background:"#1a0a0a", border:"1px solid #3a1a1a", color:"#ef4444", padding:"9px 14px", borderRadius:6, cursor:"pointer", fontSize:12 }}>Delete</button>}
        <div style={{ display:"flex", gap:8, marginLeft:"auto" }}>
          <button onClick={onClose} style={{ background:"none", border:"1px solid #2a2a2a", color:"#777", padding:"9px 18px", borderRadius:6, cursor:"pointer", fontSize:13 }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ background:"#F97316", border:"none", color:"#000", padding:"9px 22px", borderRadius:6, cursor:"pointer", fontSize:13, fontWeight:700 }}>{saving?"Saving...":isNew?"Add Log":"Save"}</button>
        </div>
      </div>
    </APMModal>
  );
}

// ── RFI Modal ──────────────────────────────────────────
function RFIModal({ rfi, projectId, onSave, onClose }) {
  const isNew = !rfi?.id;
  const [form, setForm] = useState({ rfi_number:"", subject:"", sent_to:"", date_sent:new Date().toISOString().slice(0,10), date_due:"", status:"open", response:"", ...(rfi||{}), project_id:projectId });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const handleSave = async () => {
    if (!form.subject.trim()) return;
    setSaving(true);
    const payload = {...form}; delete payload.id; delete payload.created_at;
    if (isNew) { const {data} = await supabase.from("rfis").insert([payload]).select().single(); if (data) onSave(data); }
    else { await supabase.from("rfis").update(payload).eq("id",rfi.id); onSave({...rfi,...payload}); }
    setSaving(false);
  };

  return (
    <APMModal title={isNew?"New RFI":"Edit RFI"} onClose={onClose}>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr", gap:12 }}>
          <APMField label="RFI #"><input value={form.rfi_number||""} onChange={e=>set("rfi_number",e.target.value)} placeholder="RFI-001" style={{...inputStyle,fontSize:14}} /></APMField>
          <APMField label="Status">
            <select value={form.status} onChange={e=>set("status",e.target.value)} style={{...inputStyle,fontSize:14}}>
              {APM_STATUSES.rfi.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </APMField>
        </div>
        <APMField label="Subject"><input value={form.subject} onChange={e=>set("subject",e.target.value)} placeholder="RFI subject" style={{...inputStyle,fontSize:15}} autoFocus /></APMField>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
          <APMField label="Sent To"><input value={form.sent_to||""} onChange={e=>set("sent_to",e.target.value)} placeholder="GC / Architect" style={{...inputStyle,fontSize:14}} /></APMField>
          <APMField label="Date Sent"><input type="date" value={form.date_sent||""} onChange={e=>set("date_sent",e.target.value)} style={{...inputStyle,fontSize:14}} /></APMField>
          <APMField label="Due Date"><input type="date" value={form.date_due||""} onChange={e=>set("date_due",e.target.value)} style={{...inputStyle,fontSize:14}} /></APMField>
        </div>
        <APMField label="Response / Notes">
          <textarea value={form.response||""} onChange={e=>set("response",e.target.value)} placeholder="Response or notes..." style={{...inputStyle,minHeight:80,resize:"vertical",fontSize:14}} />
        </APMField>
      </div>
      <div style={{ display:"flex", gap:8, marginTop:20, justifyContent:"space-between" }}>
        {!isNew && <button onClick={async()=>{ await supabase.from("rfis").delete().eq("id",rfi.id); onSave(null,true); }} style={{ background:"#1a0a0a", border:"1px solid #3a1a1a", color:"#ef4444", padding:"9px 14px", borderRadius:6, cursor:"pointer", fontSize:12 }}>Delete</button>}
        <div style={{ display:"flex", gap:8, marginLeft:"auto" }}>
          <button onClick={onClose} style={{ background:"none", border:"1px solid #2a2a2a", color:"#777", padding:"9px 18px", borderRadius:6, cursor:"pointer", fontSize:13 }}>Cancel</button>
          <button onClick={handleSave} disabled={saving||!form.subject.trim()} style={{ background:"#F97316", border:"none", color:"#000", padding:"9px 22px", borderRadius:6, cursor:"pointer", fontSize:13, fontWeight:700, opacity:form.subject.trim()&&!saving?1:0.5 }}>{saving?"Saving...":isNew?"Add RFI":"Save"}</button>
        </div>
      </div>
    </APMModal>
  );
}

// ── Submittal Modal ────────────────────────────────────
function SubmittalModal({ submittal, projectId, onSave, onClose }) {
  const isNew = !submittal?.id;
  const [form, setForm] = useState({ submittal_number:"", description:"", sent_to:"", date_sent:new Date().toISOString().slice(0,10), date_due:"", status:"pending", ...(submittal||{}), project_id:projectId });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const handleSave = async () => {
    if (!form.description.trim()) return;
    setSaving(true);
    const payload = {...form}; delete payload.id; delete payload.created_at;
    if (isNew) { const {data} = await supabase.from("submittals").insert([payload]).select().single(); if (data) onSave(data); }
    else { await supabase.from("submittals").update(payload).eq("id",submittal.id); onSave({...submittal,...payload}); }
    setSaving(false);
  };

  return (
    <APMModal title={isNew?"New Submittal":"Edit Submittal"} onClose={onClose}>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr", gap:12 }}>
          <APMField label="Submittal #"><input value={form.submittal_number||""} onChange={e=>set("submittal_number",e.target.value)} placeholder="SUB-001" style={{...inputStyle,fontSize:14}} /></APMField>
          <APMField label="Status">
            <select value={form.status} onChange={e=>set("status",e.target.value)} style={{...inputStyle,fontSize:14}}>
              {APM_STATUSES.submittal.map(s=><option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
            </select>
          </APMField>
        </div>
        <APMField label="Description"><input value={form.description} onChange={e=>set("description",e.target.value)} placeholder="Submittal description" style={{...inputStyle,fontSize:15}} autoFocus /></APMField>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
          <APMField label="Sent To"><input value={form.sent_to||""} onChange={e=>set("sent_to",e.target.value)} placeholder="Architect / GC" style={{...inputStyle,fontSize:14}} /></APMField>
          <APMField label="Date Sent"><input type="date" value={form.date_sent||""} onChange={e=>set("date_sent",e.target.value)} style={{...inputStyle,fontSize:14}} /></APMField>
          <APMField label="Due Date"><input type="date" value={form.date_due||""} onChange={e=>set("date_due",e.target.value)} style={{...inputStyle,fontSize:14}} /></APMField>
        </div>
      </div>
      <div style={{ display:"flex", gap:8, marginTop:20, justifyContent:"space-between" }}>
        {!isNew && <button onClick={async()=>{ await supabase.from("submittals").delete().eq("id",submittal.id); onSave(null,true); }} style={{ background:"#1a0a0a", border:"1px solid #3a1a1a", color:"#ef4444", padding:"9px 14px", borderRadius:6, cursor:"pointer", fontSize:12 }}>Delete</button>}
        <div style={{ display:"flex", gap:8, marginLeft:"auto" }}>
          <button onClick={onClose} style={{ background:"none", border:"1px solid #2a2a2a", color:"#777", padding:"9px 18px", borderRadius:6, cursor:"pointer", fontSize:13 }}>Cancel</button>
          <button onClick={handleSave} disabled={saving||!form.description.trim()} style={{ background:"#F97316", border:"none", color:"#000", padding:"9px 22px", borderRadius:6, cursor:"pointer", fontSize:13, fontWeight:700, opacity:form.description.trim()&&!saving?1:0.5 }}>{saving?"Saving...":isNew?"Add Submittal":"Save"}</button>
        </div>
      </div>
    </APMModal>
  );
}

// ── Change Order Modal ─────────────────────────────────
function COModal({ co, projectId, onSave, onClose }) {
  const isNew = !co?.id;
  const [form, setForm] = useState({ co_number:"", description:"", amount:"", status:"pending", date_submitted:new Date().toISOString().slice(0,10), date_approved:"", ...(co||{}), project_id:projectId });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const handleSave = async () => {
    if (!form.description.trim()) return;
    setSaving(true);
    const payload = {...form, amount:form.amount?Number(form.amount):null}; delete payload.id; delete payload.created_at;
    if (isNew) { const {data} = await supabase.from("change_orders").insert([payload]).select().single(); if (data) onSave(data); }
    else { await supabase.from("change_orders").update(payload).eq("id",co.id); onSave({...co,...payload}); }
    setSaving(false);
  };

  return (
    <APMModal title={isNew?"New Change Order":"Edit Change Order"} onClose={onClose}>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
          <APMField label="CO #"><input value={form.co_number||""} onChange={e=>set("co_number",e.target.value)} placeholder="CO-001" style={{...inputStyle,fontSize:14}} /></APMField>
          <APMField label="Amount ($)"><input type="number" value={form.amount||""} onChange={e=>set("amount",e.target.value)} placeholder="0.00" style={{...inputStyle,fontSize:14}} /></APMField>
          <APMField label="Status">
            <select value={form.status} onChange={e=>set("status",e.target.value)} style={{...inputStyle,fontSize:14}}>
              {APM_STATUSES.co.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </APMField>
        </div>
        <APMField label="Description"><textarea value={form.description} onChange={e=>set("description",e.target.value)} placeholder="Describe the change order..." style={{...inputStyle,minHeight:80,resize:"vertical",fontSize:14}} autoFocus /></APMField>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <APMField label="Date Submitted"><input type="date" value={form.date_submitted||""} onChange={e=>set("date_submitted",e.target.value)} style={{...inputStyle,fontSize:14}} /></APMField>
          <APMField label="Date Approved"><input type="date" value={form.date_approved||""} onChange={e=>set("date_approved",e.target.value)} style={{...inputStyle,fontSize:14}} /></APMField>
        </div>
      </div>
      <div style={{ display:"flex", gap:8, marginTop:20, justifyContent:"space-between" }}>
        {!isNew && <button onClick={async()=>{ await supabase.from("change_orders").delete().eq("id",co.id); onSave(null,true); }} style={{ background:"#1a0a0a", border:"1px solid #3a1a1a", color:"#ef4444", padding:"9px 14px", borderRadius:6, cursor:"pointer", fontSize:12 }}>Delete</button>}
        <div style={{ display:"flex", gap:8, marginLeft:"auto" }}>
          <button onClick={onClose} style={{ background:"none", border:"1px solid #2a2a2a", color:"#777", padding:"9px 18px", borderRadius:6, cursor:"pointer", fontSize:13 }}>Cancel</button>
          <button onClick={handleSave} disabled={saving||!form.description.trim()} style={{ background:"#F97316", border:"none", color:"#000", padding:"9px 22px", borderRadius:6, cursor:"pointer", fontSize:13, fontWeight:700, opacity:form.description.trim()&&!saving?1:0.5 }}>{saving?"Saving...":isNew?"Add CO":"Save"}</button>
        </div>
      </div>
    </APMModal>
  );
}

// ── Material Order Modal ───────────────────────────────
function MaterialModal({ material, projectId, onSave, onClose }) {
  const isNew = !material?.id;
  const [form, setForm] = useState({ item:"", supplier:"", quantity:"", unit_cost:"", total_cost:"", order_date:new Date().toISOString().slice(0,10), eta:"", status:"pending", notes:"", ...(material||{}), project_id:projectId });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const handleSave = async () => {
    if (!form.item.trim()) return;
    setSaving(true);
    const payload = {...form, unit_cost:form.unit_cost?Number(form.unit_cost):null, total_cost:form.total_cost?Number(form.total_cost):null};
    delete payload.id; delete payload.created_at;
    if (isNew) { const {data} = await supabase.from("material_orders").insert([payload]).select().single(); if (data) onSave(data); }
    else { await supabase.from("material_orders").update(payload).eq("id",material.id); onSave({...material,...payload}); }
    setSaving(false);
  };

  return (
    <APMModal title={isNew?"New Material Order":"Edit Material Order"} onClose={onClose}>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <APMField label="Item / Material"><input value={form.item} onChange={e=>set("item",e.target.value)} placeholder="Concrete, Rebar, CMU block..." style={{...inputStyle,fontSize:15}} autoFocus /></APMField>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <APMField label="Supplier"><input value={form.supplier||""} onChange={e=>set("supplier",e.target.value)} placeholder="Supplier name" style={{...inputStyle,fontSize:14}} /></APMField>
          <APMField label="Quantity"><input value={form.quantity||""} onChange={e=>set("quantity",e.target.value)} placeholder="e.g. 50 CY, 200 LF" style={{...inputStyle,fontSize:14}} /></APMField>
          <APMField label="Unit Cost ($)"><input type="number" value={form.unit_cost||""} onChange={e=>set("unit_cost",e.target.value)} placeholder="0.00" style={{...inputStyle,fontSize:14}} /></APMField>
          <APMField label="Total Cost ($)"><input type="number" value={form.total_cost||""} onChange={e=>set("total_cost",e.target.value)} placeholder="0.00" style={{...inputStyle,fontSize:14}} /></APMField>
          <APMField label="Order Date"><input type="date" value={form.order_date||""} onChange={e=>set("order_date",e.target.value)} style={{...inputStyle,fontSize:14}} /></APMField>
          <APMField label="ETA"><input type="date" value={form.eta||""} onChange={e=>set("eta",e.target.value)} style={{...inputStyle,fontSize:14}} /></APMField>
        </div>
        <APMField label="Status">
          <select value={form.status} onChange={e=>set("status",e.target.value)} style={{...inputStyle,fontSize:14}}>
            {APM_STATUSES.material.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </APMField>
        <APMField label="Notes"><textarea value={form.notes||""} onChange={e=>set("notes",e.target.value)} placeholder="Any notes..." style={{...inputStyle,minHeight:60,resize:"vertical",fontSize:14}} /></APMField>
      </div>
      <div style={{ display:"flex", gap:8, marginTop:20, justifyContent:"space-between" }}>
        {!isNew && <button onClick={async()=>{ await supabase.from("material_orders").delete().eq("id",material.id); onSave(null,true); }} style={{ background:"#1a0a0a", border:"1px solid #3a1a1a", color:"#ef4444", padding:"9px 14px", borderRadius:6, cursor:"pointer", fontSize:12 }}>Delete</button>}
        <div style={{ display:"flex", gap:8, marginLeft:"auto" }}>
          <button onClick={onClose} style={{ background:"none", border:"1px solid #2a2a2a", color:"#777", padding:"9px 18px", borderRadius:6, cursor:"pointer", fontSize:13 }}>Cancel</button>
          <button onClick={handleSave} disabled={saving||!form.item.trim()} style={{ background:"#F97316", border:"none", color:"#000", padding:"9px 22px", borderRadius:6, cursor:"pointer", fontSize:13, fontWeight:700, opacity:form.item.trim()&&!saving?1:0.5 }}>{saving?"Saving...":isNew?"Add Order":"Save"}</button>
        </div>
      </div>
    </APMModal>
  );
}


// ── Receipt / Financials ───────────────────────────────
const RECEIPT_CATEGORIES = ["Labor","Concrete","Rebar/Steel","Formwork","Equipment Rental","Subcontractor","Fuel","Tools/Supplies","Permits/Fees","Other"];

function ReceiptModal({ receipt, projectId, onSave, onClose }) {
  const isNew = !receipt?.id;
  const [form, setForm] = useState({ vendor:"", amount:"", category:"Other", receipt_date:new Date().toISOString().slice(0,10), notes:"", file_url:"", file_name:"", ...(receipt||{}), project_id:projectId });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [preview, setPreview] = useState(receipt?.file_url||null);
  const fileRef = useRef();
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    // Upload to Supabase storage
    const ext = file.name.split('.').pop();
    const path = `receipts/${projectId}/${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage.from("attachments").upload(path, file, { upsert: true });
    if (error) { setUploading(false); alert("Upload failed: " + error.message); return; }
    const { data: urlData } = supabase.storage.from("attachments").getPublicUrl(path);
    const url = urlData.publicUrl;
    set("file_url", url);
    set("file_name", file.name);
    setPreview(url);
    setUploading(false);

    // Auto-extract via Claude vision
    setExtracting(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target.result.split(",")[1];
        const mediaType = file.type || "image/jpeg";
        const res = await fetch("/api/claude", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 300,
            system: `You extract receipt data. Respond ONLY with valid JSON, no markdown, no explanation. Format: {"vendor":"string","amount":number_or_null,"date":"YYYY-MM-DD_or_null","category":"one of: Labor,Concrete,Rebar/Steel,Formwork,Equipment Rental,Subcontractor,Fuel,Tools/Supplies,Permits/Fees,Other"}`,
            messages: [{ role:"user", content:[
              { type:"image", source:{ type:"base64", media_type:mediaType, data:base64 }},
              { type:"text", text:"Extract the vendor name, total amount, date, and best-fit category from this receipt." }
            ]}]
          })
        });
        const json = await res.json();
        const text = json?.content?.[0]?.text || "";
        try {
          const extracted = JSON.parse(text.replace(/```json|```/g,"").trim());
          setForm(f => ({
            ...f,
            vendor: extracted.vendor || f.vendor,
            amount: extracted.amount != null ? String(extracted.amount) : f.amount,
            receipt_date: extracted.date || f.receipt_date,
            category: extracted.category || f.category,
          }));
        } catch(e) {}
        setExtracting(false);
      };
      reader.readAsDataURL(file);
    } catch(e) { setExtracting(false); }
  };

  const handleSave = async () => {
    if (!form.vendor.trim() && !form.amount) return;
    setSaving(true);
    const payload = { ...form, amount: form.amount ? Number(form.amount) : null };
    delete payload.id; delete payload.created_at;
    if (isNew) {
      const { data } = await supabase.from("receipts").insert([payload]).select().single();
      if (data) onSave(data);
    } else {
      await supabase.from("receipts").update(payload).eq("id", receipt.id);
      onSave({...receipt,...payload});
    }
    setSaving(false);
  };

  return (
    <APMModal title={isNew ? "Add Receipt" : "Edit Receipt"} onClose={onClose} width={560}>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        {/* Upload zone */}
        <div
          onClick={() => fileRef.current?.click()}
          style={{ border:"2px dashed #2a2a2a", borderRadius:10, padding:preview?"8px":"28px 20px", textAlign:"center", cursor:"pointer", background:"#0d0d0d", position:"relative", transition:"border-color 0.15s" }}
          onMouseEnter={e=>e.currentTarget.style.borderColor="#F97316"}
          onMouseLeave={e=>e.currentTarget.style.borderColor="#2a2a2a"}
          onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor="#F97316"}}
          onDragLeave={e=>e.currentTarget.style.borderColor="#2a2a2a"}
          onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)handleFile(f);}}
        >
          <input ref={fileRef} type="file" accept="image/*,application/pdf" capture="environment" style={{ display:"none" }} onChange={e=>handleFile(e.target.files[0])} />
          {preview ? (
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              {preview.match(/\.(jpg|jpeg|png|gif|webp)/i) ? (
                <img src={preview} style={{ width:80, height:60, objectFit:"cover", borderRadius:6, border:"1px solid #2a2a2a" }} />
              ) : (
                <div style={{ width:80, height:60, background:"#1a1a1a", borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24 }}>📄</div>
              )}
              <div style={{ textAlign:"left" }}>
                <div style={{ fontSize:12, color:"#e5e5e5" }}>{form.file_name}</div>
                {extracting && <div style={{ fontSize:11, color:"#F97316", marginTop:4 }}>⚡ Extracting data...</div>}
                {!extracting && <div style={{ fontSize:11, color:"#555", marginTop:4 }}>Click to replace</div>}
              </div>
            </div>
          ) : (
            <>
              {uploading ? (
                <div style={{ fontSize:12, color:"#F97316" }}>Uploading...</div>
              ) : (
                <>
                  <div style={{ fontSize:28, marginBottom:8 }}>📷</div>
                  <div style={{ fontSize:13, color:"#888" }}>Tap to upload receipt</div>
                  <div style={{ fontSize:11, color:"#444", marginTop:4 }}>Photo, image, or PDF · Auto-extracts data</div>
                </>
              )}
            </>
          )}
        </div>

        {extracting && (
          <div style={{ background:"#0d1a0d", border:"1px solid #10B98130", borderRadius:8, padding:"10px 14px", fontSize:12, color:"#10B981", display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ animation:"spin 0.8s linear infinite", display:"inline-block" }}>◌</span>
            Claude is reading your receipt...
          </div>
        )}

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <APMField label="Vendor / Payee"><input value={form.vendor} onChange={e=>set("vendor",e.target.value)} placeholder="Home Depot, Vulcan..." style={{...inputStyle,fontSize:14}} /></APMField>
          <APMField label="Amount ($)"><input type="number" value={form.amount} onChange={e=>set("amount",e.target.value)} placeholder="0.00" style={{...inputStyle,fontSize:14}} /></APMField>
          <APMField label="Date"><input type="date" value={form.receipt_date||""} onChange={e=>set("receipt_date",e.target.value)} style={{...inputStyle,fontSize:14}} /></APMField>
          <APMField label="Category">
            <select value={form.category} onChange={e=>set("category",e.target.value)} style={{...inputStyle,fontSize:14}}>
              {RECEIPT_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </APMField>
        </div>
        <APMField label="Notes"><textarea value={form.notes||""} onChange={e=>set("notes",e.target.value)} placeholder="Optional notes..." style={{...inputStyle,minHeight:50,resize:"vertical",fontSize:13}} /></APMField>
      </div>

      <div style={{ display:"flex", gap:8, marginTop:20, justifyContent:"space-between" }}>
        {!isNew && (
          <button onClick={async()=>{ await supabase.from("receipts").delete().eq("id",receipt.id); onSave(null,true); }}
            style={{ background:"#1a0a0a", border:"1px solid #3a1a1a", color:"#ef4444", padding:"9px 14px", borderRadius:6, cursor:"pointer", fontSize:12 }}>Delete</button>
        )}
        <div style={{ display:"flex", gap:8, marginLeft:"auto" }}>
          <button onClick={onClose} style={{ background:"none", border:"1px solid #2a2a2a", color:"#777", padding:"9px 18px", borderRadius:6, cursor:"pointer", fontSize:13 }}>Cancel</button>
          <button onClick={handleSave} disabled={saving||uploading||extracting} style={{ background:"#F97316", border:"none", color:"#000", padding:"9px 22px", borderRadius:6, cursor:"pointer", fontSize:13, fontWeight:700, opacity:!saving&&!uploading&&!extracting?1:0.5 }}>
            {saving?"Saving...":isNew?"Add Receipt":"Save"}
          </button>
        </div>
      </div>
    </APMModal>
  );
}


// ── Subcontracts ───────────────────────────────────────
const SUB_STATUSES = ["active","complete","terminated","on_hold"];

function SubcontractModal({ sub, projectId, onSave, onClose }) {
  const { t } = useTheme();
  const isNew = !sub?.id;
  const [form, setForm] = useState({
    sub_name:"", scope:"", contract_amount:"", start_date:"", end_date:"",
    status:"active", percent_complete:"0", billed_to_date:"0", paid_to_date:"0",
    retainage_pct:"10", file_url:"", file_name:"", notes:"",
    ...(sub||{}), project_id: projectId
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const fileRef = useRef();
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const dynInput = { ...inputStyle, background: t.input, borderColor: t.inputBorder, color: t.inputText };
  const dynLabel = { ...labelStyle, color: t.label };

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `subcontracts/${projectId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("attachments").upload(path, file, { upsert: true });
    if (error) { setUploading(false); alert("Upload failed: " + error.message); return; }
    const { data: urlData } = supabase.storage.from("attachments").getPublicUrl(path);
    set("file_url", urlData.publicUrl);
    set("file_name", file.name);
    setUploading(false);

    // Extract from PDF/image via Claude
    if (file.type === "application/pdf" || file.type.startsWith("image/")) {
      setExtracting(true);
      try {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64 = e.target.result.split(",")[1];
          const isImg = file.type.startsWith("image/");
          const msgContent = isImg
            ? [{ type:"image", source:{ type:"base64", media_type:file.type, data:base64 }},
               { type:"text", text:"Extract subcontract data from this document." }]
            : [{ type:"document", source:{ type:"base64", media_type:"application/pdf", data:base64 }},
               { type:"text", text:"Extract subcontract data from this document." }];
          const res = await fetch("/api/claude", {
            method:"POST", headers:{"Content-Type":"application/json"},
            body: JSON.stringify({
              model:"claude-sonnet-4-20250514", max_tokens:400,
              system:`Extract subcontract data. Return ONLY valid JSON, no markdown. Format: {"sub_name":"string","scope":"string","contract_amount":number_or_null,"start_date":"YYYY-MM-DD_or_null","end_date":"YYYY-MM-DD_or_null","retainage_pct":number_default_10}`,
              messages:[{ role:"user", content: msgContent }]
            })
          });
          const json = await res.json();
          const text = json?.content?.find(b=>b.type==="text")?.text || "";
          try {
            const ex = JSON.parse(text.replace(/```json|```/g,"").trim());
            setForm(f => ({
              ...f,
              sub_name: ex.sub_name || f.sub_name,
              scope: ex.scope || f.scope,
              contract_amount: ex.contract_amount != null ? String(ex.contract_amount) : f.contract_amount,
              start_date: ex.start_date || f.start_date,
              end_date: ex.end_date || f.end_date,
              retainage_pct: ex.retainage_pct != null ? String(ex.retainage_pct) : f.retainage_pct,
            }));
          } catch(e) {}
          setExtracting(false);
        };
        reader.readAsDataURL(file);
      } catch(e) { setExtracting(false); }
    }
  };

  const handleSave = async () => {
    if (!form.sub_name.trim()) return;
    setSaving(true);
    const payload = {
      ...form,
      contract_amount: form.contract_amount ? Number(form.contract_amount) : null,
      percent_complete: form.percent_complete ? Number(form.percent_complete) : 0,
      billed_to_date: form.billed_to_date ? Number(form.billed_to_date) : 0,
      paid_to_date: form.paid_to_date ? Number(form.paid_to_date) : 0,
      retainage_pct: form.retainage_pct ? Number(form.retainage_pct) : 10,
    };
    delete payload.id; delete payload.created_at;
    if (isNew) {
      const { data } = await supabase.from("subcontracts").insert([payload]).select().single();
      if (data) onSave(data, true);
    } else {
      await supabase.from("subcontracts").update(payload).eq("id", sub.id);
      onSave({...sub,...payload}, false);
    }
    setSaving(false);
  };

  return (
    <APMModal title={isNew ? "New Subcontract / PO" : "Edit Subcontract"} onClose={onClose} width={600}>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        {/* Upload zone */}
        <div onClick={()=>fileRef.current?.click()}
          style={{ border:`2px dashed ${t.border2}`, borderRadius:10, padding:"16px 20px", textAlign:"center", cursor:"pointer", background:t.bg4, transition:"border-color 0.15s" }}
          onMouseEnter={e=>e.currentTarget.style.borderColor="#F97316"}
          onMouseLeave={e=>e.currentTarget.style.borderColor=t.border2}
          onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor="#F97316"}}
          onDragLeave={e=>e.currentTarget.style.borderColor=t.border2}
          onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)handleFile(f);}}>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display:"none" }} onChange={e=>handleFile(e.target.files[0])} />
          {form.file_name ? (
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:22 }}>📄</span>
              <div style={{ textAlign:"left" }}>
                <div style={{ fontSize:12, color:t.text }}>{form.file_name}</div>
                {extracting && <div style={{ fontSize:11, color:"#F97316", marginTop:3 }}>⚡ Extracting contract data...</div>}
                {!extracting && <div style={{ fontSize:11, color:t.text3, marginTop:3 }}>Click to replace</div>}
              </div>
            </div>
          ) : uploading ? (
            <div style={{ fontSize:12, color:"#F97316" }}>Uploading...</div>
          ) : (
            <>
              <div style={{ fontSize:24, marginBottom:6 }}>📎</div>
              <div style={{ fontSize:13, color:t.text2 }}>Upload subcontract PDF or image</div>
              <div style={{ fontSize:11, color:t.text3, marginTop:3 }}>Claude will auto-extract the details</div>
            </>
          )}
        </div>
        {extracting && (
          <div style={{ background:"#0d1a0d", border:"1px solid #10B98130", borderRadius:8, padding:"10px 14px", fontSize:12, color:"#10B981", display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ animation:"spin 0.8s linear infinite", display:"inline-block" }}>◌</span>
            Reading contract document...
          </div>
        )}
        <APMField label="Subcontractor / Vendor Name">
          <input value={form.sub_name} onChange={e=>set("sub_name",e.target.value)} placeholder="ABC Pumping, Jones Rebar Supply..." style={{...dynInput,fontSize:15}} autoFocus />
        </APMField>
        <APMField label="Scope of Work">
          <textarea value={form.scope||""} onChange={e=>set("scope",e.target.value)} placeholder="Concrete pumping, all floors..." style={{...dynInput,minHeight:60,resize:"vertical",fontSize:14}} />
        </APMField>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
          <APMField label="Contract Amount ($)"><input type="number" value={form.contract_amount||""} onChange={e=>set("contract_amount",e.target.value)} placeholder="0.00" style={{...dynInput,fontSize:14}} /></APMField>
          <APMField label="Start Date"><input type="date" value={form.start_date||""} onChange={e=>set("start_date",e.target.value)} style={{...dynInput,fontSize:14}} /></APMField>
          <APMField label="End Date"><input type="date" value={form.end_date||""} onChange={e=>set("end_date",e.target.value)} style={{...dynInput,fontSize:14}} /></APMField>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12 }}>
          <APMField label="% Complete"><input type="number" min="0" max="100" value={form.percent_complete||"0"} onChange={e=>set("percent_complete",e.target.value)} style={{...dynInput,fontSize:14}} /></APMField>
          <APMField label="Billed to Date ($)"><input type="number" value={form.billed_to_date||"0"} onChange={e=>set("billed_to_date",e.target.value)} style={{...dynInput,fontSize:14}} /></APMField>
          <APMField label="Paid to Date ($)"><input type="number" value={form.paid_to_date||"0"} onChange={e=>set("paid_to_date",e.target.value)} style={{...dynInput,fontSize:14}} /></APMField>
          <APMField label="Retainage %"><input type="number" value={form.retainage_pct||"10"} onChange={e=>set("retainage_pct",e.target.value)} style={{...dynInput,fontSize:14}} /></APMField>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:12 }}>
          <APMField label="Notes"><input value={form.notes||""} onChange={e=>set("notes",e.target.value)} placeholder="Any notes..." style={{...dynInput,fontSize:14}} /></APMField>
          <APMField label="Status">
            <select value={form.status} onChange={e=>set("status",e.target.value)} style={{...dynInput,fontSize:14}}>
              {SUB_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </APMField>
        </div>
      </div>
      <div style={{ display:"flex", gap:8, marginTop:20, justifyContent:"space-between" }}>
        {!isNew && <button onClick={async()=>{ await supabase.from("subcontracts").delete().eq("id",sub.id); onSave(null,true); }} style={{ background:"#1a0a0a", border:"1px solid #3a1a1a", color:"#ef4444", padding:"9px 14px", borderRadius:6, cursor:"pointer", fontSize:12 }}>Delete</button>}
        <div style={{ display:"flex", gap:8, marginLeft:"auto" }}>
          <button onClick={onClose} style={{ background:"none", border:`1px solid ${t.border2}`, color:t.text3, padding:"9px 18px", borderRadius:6, cursor:"pointer", fontSize:13 }}>Cancel</button>
          <button onClick={handleSave} disabled={saving||uploading||extracting||!form.sub_name.trim()} style={{ background:"#F97316", border:"none", color:"#000", padding:"9px 22px", borderRadius:6, cursor:"pointer", fontSize:13, fontWeight:700, opacity:form.sub_name.trim()&&!saving?1:0.5 }}>{saving?"Saving...":isNew?"Add Sub/PO":"Save"}</button>
        </div>
      </div>
    </APMModal>
  );
}

function SubcontractsTab({ project }) {
  const { t } = useTheme();
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);

  useEffect(() => {
    supabase.from("subcontracts").select("*").eq("project_id",project.id).order("created_at",{ascending:false})
      .then(({data,error})=>{ if(!error) setSubs(data||[]); setLoading(false); });
  }, [project.id]);

  const handleSave = (data, isNew) => {
    if (!data) setSubs(prev=>prev.filter(s=>s.id!==modal?.item?.id));
    else if (isNew) setSubs(prev=>[data,...prev]);
    else setSubs(prev=>prev.map(s=>s.id===data.id?data:s));
    setModal(null);
  };

  const totalCommitted = subs.reduce((s,sub)=>s+(sub.contract_amount||0),0);
  const totalBilled = subs.reduce((s,sub)=>s+(sub.billed_to_date||0),0);
  const totalPaid = subs.reduce((s,sub)=>s+(sub.paid_to_date||0),0);
  const totalRetainage = subs.reduce((s,sub)=>s+((sub.billed_to_date||0)*(sub.retainage_pct||10)/100),0);

  const rowStyle = { display:"flex", alignItems:"center", gap:12, padding:"12px 14px", borderRadius:8, background:t.bg3, border:`1px solid ${t.border}`, marginBottom:6, cursor:"pointer", transition:"border-color 0.1s" };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:14 }}>
        <button onClick={()=>setModal({item:null})} style={{ background:"#F97316", border:"none", color:"#000", padding:"7px 16px", borderRadius:6, cursor:"pointer", fontSize:12, fontWeight:700 }}>+ Add Sub / PO</button>
      </div>
      {subs.length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:10, marginBottom:16 }}>
          {[
            { label:"COMMITTED", val:fmtMoney(totalCommitted), color:"#3B82F6" },
            { label:"BILLED", val:fmtMoney(totalBilled), color:"#F59E0B" },
            { label:"PAID", val:fmtMoney(totalPaid), color:"#10B981" },
            { label:"RETAINAGE HELD", val:fmtMoney(totalRetainage), color:"#EF4444" },
          ].map(card=>(
            <div key={card.label} style={{ background:t.bg3, border:`1px solid ${t.border}`, borderRadius:8, padding:"10px 14px" }}>
              <div style={{ fontSize:9, color:t.text4, fontFamily:"'DM Mono',monospace", letterSpacing:0.8, marginBottom:4 }}>{card.label}</div>
              <div style={{ fontSize:15, fontWeight:700, color:card.color, fontFamily:"'DM Mono',monospace" }}>{card.val}</div>
            </div>
          ))}
        </div>
      )}
      {loading && <div style={{ textAlign:"center", padding:40, color:t.text4, fontFamily:"'DM Mono',monospace", fontSize:12 }}>Loading...</div>}
      {!loading && subs.length===0 && <div style={{ textAlign:"center", padding:40, color:t.text4, fontFamily:"'DM Mono',monospace", fontSize:12 }}>No subcontracts yet</div>}
      {subs.map(sub=>{
        const retAmt = (sub.billed_to_date||0)*(sub.retainage_pct||10)/100;
        const balance = (sub.contract_amount||0)-(sub.paid_to_date||0);
        return (
          <div key={sub.id} onClick={()=>setModal({item:sub})} style={rowStyle}
            onMouseEnter={e=>e.currentTarget.style.borderColor=t.border2}
            onMouseLeave={e=>e.currentTarget.style.borderColor=t.border}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                <span style={{ fontSize:13, fontWeight:700, color:t.text }}>{sub.sub_name}</span>
                <StatusBadge status={sub.status} />
                {sub.file_url && <span style={{ fontSize:11 }}>📄</span>}
              </div>
              {sub.scope && <div style={{ fontSize:11, color:t.text2, marginBottom:5, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{sub.scope}</div>}
              {/* Progress bar */}
              {sub.contract_amount > 0 && (
                <div>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                    <span style={{ fontSize:10, color:t.text3, fontFamily:"'DM Mono',monospace" }}>{sub.percent_complete||0}% complete</span>
                    <span style={{ fontSize:10, color:t.text3, fontFamily:"'DM Mono',monospace" }}>Bal: {fmtMoney(balance)}</span>
                  </div>
                  <div style={{ background:t.bg5, borderRadius:3, height:4 }}>
                    <div style={{ height:"100%", width:`${Math.min(sub.percent_complete||0,100)}%`, background:"#10B981", borderRadius:3 }} />
                  </div>
                </div>
              )}
            </div>
            <div style={{ textAlign:"right", flexShrink:0 }}>
              <div style={{ fontSize:14, fontWeight:700, color:t.text, fontFamily:"'DM Mono',monospace" }}>{fmtMoney(sub.contract_amount)}</div>
              {retAmt > 0 && <div style={{ fontSize:10, color:"#EF4444", fontFamily:"'DM Mono',monospace" }}>-{fmtMoney(retAmt)} ret.</div>}
            </div>
          </div>
        );
      })}
      {modal && <SubcontractModal sub={modal.item} projectId={project.id} onSave={handleSave} onClose={()=>setModal(null)} />}
    </div>
  );
}

// ── Pay Applications / SOV ─────────────────────────────
function SOVModal({ project, sovItems, onSave, onClose }) {
  const { t } = useTheme();
  const [items, setItems] = useState(sovItems.length > 0 ? sovItems.map(i=>({...i})) : [{ item_no:"1", description:"", scheduled_value:"", sort_order:0 }]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const addRow = () => setItems(prev=>[...prev, { item_no:String(prev.length+1), description:"", scheduled_value:"", sort_order:prev.length }]);
  const removeRow = (idx) => setItems(prev=>prev.filter((_,i)=>i!==idx));
  const updateRow = (idx, k, v) => setItems(prev=>prev.map((item,i)=>i===idx?{...item,[k]:v}:item));

  const suggestSOV = async () => {
    setGenerating(true);
    const res = await fetch("/api/claude", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        model:"claude-sonnet-4-20250514", max_tokens:800,
        system:`You are a construction PM. Generate a Schedule of Values for an AIA G702 pay application. Return ONLY a JSON array, no markdown. Each item: {"item_no":"string","description":"string","scheduled_value":number}. Values must sum to the contract amount. Use realistic construction cost breakdowns.`,
        messages:[{ role:"user", content:`Project: ${project.name}. Contract value: ${project.contract_value}. Company: ${getCompany(project.company).name}. Generate 8-12 SOV line items with realistic cost allocations for concrete/masonry construction work.` }]
      })
    });
    const json = await res.json();
    const text = json?.content?.find(b=>b.type==="text")?.text || "";
    try {
      const suggested = JSON.parse(text.replace(/```json|```/g,"").trim());
      setItems(suggested.map((s,i)=>({...s, scheduled_value:String(s.scheduled_value), sort_order:i})));
    } catch(e) {}
    setGenerating(false);
  };

  const handleSave = async () => {
    setSaving(true);
    // Delete existing, reinsert all
    await supabase.from("sov_items").delete().eq("project_id", project.id);
    const toInsert = items.filter(i=>i.description.trim()).map((item,idx)=>({
      project_id: project.id,
      item_no: item.item_no || String(idx+1),
      description: item.description,
      scheduled_value: item.scheduled_value ? Number(item.scheduled_value) : 0,
      sort_order: idx,
    }));
    const { data } = await supabase.from("sov_items").insert(toInsert).select();
    onSave(data||[]);
    setSaving(false);
  };

  const total = items.reduce((s,i)=>s+(Number(i.scheduled_value)||0),0);
  const contractVal = project.contract_value || 0;
  const diff = contractVal - total;
  const dynInput = { ...inputStyle, background: t.input, borderColor: t.inputBorder, color: t.inputText };

  return (
    <APMModal title="Schedule of Values" onClose={onClose} width={700}>
      <div style={{ marginBottom:14, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
        <div style={{ fontSize:12, color:t.text2 }}>
          Contract: <span style={{ color:t.text, fontWeight:700 }}>{fmtMoney(contractVal)}</span>
          {" · "}SOV Total: <span style={{ color: Math.abs(diff)<1?"#10B981":"#F59E0B", fontWeight:700 }}>{fmtMoney(total)}</span>
          {Math.abs(diff)>1 && <span style={{ color:"#F59E0B", fontSize:11, marginLeft:6 }}>({diff>0?"under":"over"} by {fmtMoney(Math.abs(diff))})</span>}
        </div>
        <button onClick={suggestSOV} disabled={generating||!contractVal} style={{ background:"linear-gradient(135deg,#7c3aed,#a855f7)", border:"none", color:"#fff", padding:"7px 14px", borderRadius:6, cursor:"pointer", fontSize:12, fontWeight:700, display:"flex", alignItems:"center", gap:5, opacity:contractVal?1:0.5 }}>
          {generating ? <><span style={{ animation:"spin 0.8s linear infinite", display:"inline-block" }}>◌</span> Generating...</> : <><span>✦</span> AI Suggest SOV</>}
        </button>
      </div>
      <div style={{ maxHeight:400, overflowY:"auto" }}>
        <div style={{ display:"grid", gridTemplateColumns:"50px 1fr 130px 36px", gap:6, marginBottom:6 }}>
          {["#","Description","Value ($)",""].map(h=><div key={h} style={{ fontSize:9, color:t.text4, fontFamily:"'DM Mono',monospace", letterSpacing:0.8 }}>{h}</div>)}
        </div>
        {items.map((item,idx)=>(
          <div key={idx} style={{ display:"grid", gridTemplateColumns:"50px 1fr 130px 36px", gap:6, marginBottom:6 }}>
            <input value={item.item_no} onChange={e=>updateRow(idx,"item_no",e.target.value)} style={{...dynInput,fontSize:12,padding:"6px 8px"}} />
            <input value={item.description} onChange={e=>updateRow(idx,"description",e.target.value)} placeholder="Description of work..." style={{...dynInput,fontSize:13,padding:"6px 8px"}} />
            <input type="number" value={item.scheduled_value} onChange={e=>updateRow(idx,"scheduled_value",e.target.value)} placeholder="0" style={{...dynInput,fontSize:13,padding:"6px 8px"}} />
            <button onClick={()=>removeRow(idx)} style={{ background:"#1a0a0a", border:"1px solid #3a1a1a", color:"#ef4444", borderRadius:5, cursor:"pointer", fontSize:14, padding:"0 6px" }}>×</button>
          </div>
        ))}
        <button onClick={addRow} style={{ background:"none", border:`1px dashed ${t.border2}`, color:t.text3, padding:"6px 14px", borderRadius:6, cursor:"pointer", fontSize:12, width:"100%", marginTop:4 }}>+ Add Line Item</button>
      </div>
      <div style={{ display:"flex", gap:8, marginTop:20, justifyContent:"flex-end" }}>
        <button onClick={onClose} style={{ background:"none", border:`1px solid ${t.border2}`, color:t.text3, padding:"9px 18px", borderRadius:6, cursor:"pointer", fontSize:13 }}>Cancel</button>
        <button onClick={handleSave} disabled={saving} style={{ background:"#F97316", border:"none", color:"#000", padding:"9px 22px", borderRadius:6, cursor:"pointer", fontSize:13, fontWeight:700 }}>{saving?"Saving...":"Save SOV"}</button>
      </div>
    </APMModal>
  );
}

function PayAppModal({ payApp, project, sovItems, onSave, onClose }) {
  const { t } = useTheme();
  const isNew = !payApp?.id;
  const [form, setForm] = useState({
    app_number:"", period_from:"", period_to:new Date().toISOString().slice(0,10),
    status:"draft", payment_received:"", notes:"",
    ...(payApp||{}), project_id:project.id
  });
  const [lineItems, setLineItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const dynInput = { ...inputStyle, background: t.input, borderColor: t.inputBorder, color: t.inputText };

  useEffect(()=>{
    if (payApp?.id) {
      supabase.from("pay_app_items").select("*").eq("pay_app_id",payApp.id)
        .then(({data})=>{
          const merged = sovItems.map(sov=>{
            const existing = (data||[]).find(li=>li.sov_item_id===sov.id);
            return existing || { sov_item_id:sov.id, work_completed_from_prev:0, work_completed_this_period:0, materials_stored:0, retainage_pct:10 };
          });
          setLineItems(merged);
        });
    } else {
      setLineItems(sovItems.map(sov=>({ sov_item_id:sov.id, work_completed_from_prev:0, work_completed_this_period:0, materials_stored:0, retainage_pct:10 })));
    }
  }, [payApp?.id, sovItems]);

  const updateLine = (idx,k,v) => setLineItems(prev=>prev.map((li,i)=>i===idx?{...li,[k]:v}:li));

  const totals = lineItems.reduce((acc,li,idx)=>{
    const sov = sovItems[idx];
    const scheduledVal = sov?.scheduled_value||0;
    const completedPrev = Number(li.work_completed_from_prev)||0;
    const completedThis = Number(li.work_completed_this_period)||0;
    const stored = Number(li.materials_stored)||0;
    const retPct = Number(li.retainage_pct)||10;
    const totalCompleted = completedPrev + completedThis + stored;
    const retainage = totalCompleted * retPct / 100;
    acc.scheduled += scheduledVal;
    acc.completedPrev += completedPrev;
    acc.completedThis += completedThis;
    acc.stored += stored;
    acc.totalCompleted += totalCompleted;
    acc.retainage += retainage;
    acc.netDue += totalCompleted - retainage;
    return acc;
  }, { scheduled:0, completedPrev:0, completedThis:0, stored:0, totalCompleted:0, retainage:0, netDue:0 });

  const handleSave = async () => {
    setSaving(true);
    const payload = {...form}; delete payload.id; delete payload.created_at;
    let appId = payApp?.id;
    if (isNew) {
      const { data } = await supabase.from("pay_applications").insert([payload]).select().single();
      appId = data?.id;
    } else {
      await supabase.from("pay_applications").update(payload).eq("id", payApp.id);
    }
    if (appId) {
      await supabase.from("pay_app_items").delete().eq("pay_app_id", appId);
      const itemsToInsert = lineItems.map(li=>({
        pay_app_id: appId,
        sov_item_id: li.sov_item_id,
        work_completed_from_prev: Number(li.work_completed_from_prev)||0,
        work_completed_this_period: Number(li.work_completed_this_period)||0,
        materials_stored: Number(li.materials_stored)||0,
        retainage_pct: Number(li.retainage_pct)||10,
      }));
      await supabase.from("pay_app_items").insert(itemsToInsert);
    }
    onSave({ ...form, id: appId });
    setSaving(false);
  };

  return (
    <APMModal title={isNew?"New Pay Application":"Edit Pay Application"} onClose={onClose} width={820}>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12 }}>
          <APMField label="App #"><input type="number" value={form.app_number||""} onChange={e=>set("app_number",e.target.value)} placeholder="1" style={{...dynInput,fontSize:14}} /></APMField>
          <APMField label="Period From"><input type="date" value={form.period_from||""} onChange={e=>set("period_from",e.target.value)} style={{...dynInput,fontSize:14}} /></APMField>
          <APMField label="Period To"><input type="date" value={form.period_to||""} onChange={e=>set("period_to",e.target.value)} style={{...dynInput,fontSize:14}} /></APMField>
          <APMField label="Status">
            <select value={form.status} onChange={e=>set("status",e.target.value)} style={{...dynInput,fontSize:14}}>
              {["draft","submitted","approved","paid"].map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </APMField>
        </div>

        {sovItems.length === 0 ? (
          <div style={{ background:t.bg4, border:`1px solid ${t.border}`, borderRadius:8, padding:"20px", textAlign:"center", color:t.text3, fontSize:12, fontFamily:"'DM Mono',monospace" }}>
            No SOV set up yet. Go back and set up your Schedule of Values first.
          </div>
        ) : (
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11, fontFamily:"'DM Mono',monospace" }}>
              <thead>
                <tr style={{ borderBottom:`1px solid ${t.border}` }}>
                  {["#","Description","Sched. Value","Prev Completed","This Period","Stored","Total Completed","Retainage%","Net Due"].map(h=>(
                    <th key={h} style={{ padding:"6px 8px", color:t.text4, textAlign:"left", whiteSpace:"nowrap", fontWeight:600, letterSpacing:0.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sovItems.map((sov,idx)=>{
                  const li = lineItems[idx] || {};
                  const completedPrev = Number(li.work_completed_from_prev)||0;
                  const completedThis = Number(li.work_completed_this_period)||0;
                  const stored = Number(li.materials_stored)||0;
                  const total = completedPrev + completedThis + stored;
                  const retAmt = total * (Number(li.retainage_pct)||10) / 100;
                  const net = total - retAmt;
                  return (
                    <tr key={sov.id} style={{ borderBottom:`1px solid ${t.border}` }}>
                      <td style={{ padding:"6px 8px", color:t.text3 }}>{sov.item_no}</td>
                      <td style={{ padding:"6px 8px", color:t.text, maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{sov.description}</td>
                      <td style={{ padding:"6px 8px", color:t.text }}>{fmtMoney(sov.scheduled_value)}</td>
                      <td style={{ padding:"6px 8px" }}><input type="number" value={li.work_completed_from_prev||""} onChange={e=>updateLine(idx,"work_completed_from_prev",e.target.value)} style={{...dynInput,padding:"4px 6px",fontSize:11,width:90}} /></td>
                      <td style={{ padding:"6px 8px" }}><input type="number" value={li.work_completed_this_period||""} onChange={e=>updateLine(idx,"work_completed_this_period",e.target.value)} style={{...dynInput,padding:"4px 6px",fontSize:11,width:90}} /></td>
                      <td style={{ padding:"6px 8px" }}><input type="number" value={li.materials_stored||""} onChange={e=>updateLine(idx,"materials_stored",e.target.value)} style={{...dynInput,padding:"4px 6px",fontSize:11,width:70}} /></td>
                      <td style={{ padding:"6px 8px", color:t.text, fontWeight:700 }}>{fmtMoney(total)}</td>
                      <td style={{ padding:"6px 8px" }}><input type="number" value={li.retainage_pct||"10"} onChange={e=>updateLine(idx,"retainage_pct",e.target.value)} style={{...dynInput,padding:"4px 6px",fontSize:11,width:50}} /></td>
                      <td style={{ padding:"6px 8px", color:"#10B981", fontWeight:700 }}>{fmtMoney(net)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop:`2px solid ${t.border2}`, fontWeight:700 }}>
                  <td colSpan={2} style={{ padding:"8px 8px", color:t.text, fontSize:12 }}>TOTALS</td>
                  <td style={{ padding:"8px 8px", color:t.text }}>{fmtMoney(totals.scheduled)}</td>
                  <td style={{ padding:"8px 8px", color:t.text }}>{fmtMoney(totals.completedPrev)}</td>
                  <td style={{ padding:"8px 8px", color:t.text }}>{fmtMoney(totals.completedThis)}</td>
                  <td style={{ padding:"8px 8px", color:t.text }}>{fmtMoney(totals.stored)}</td>
                  <td style={{ padding:"8px 8px", color:t.text }}>{fmtMoney(totals.totalCompleted)}</td>
                  <td></td>
                  <td style={{ padding:"8px 8px", color:"#10B981", fontSize:13 }}>{fmtMoney(totals.netDue)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <APMField label="Payment Received Date"><input type="date" value={form.payment_received||""} onChange={e=>set("payment_received",e.target.value)} style={{...dynInput,fontSize:14}} /></APMField>
          <APMField label="Notes"><input value={form.notes||""} onChange={e=>set("notes",e.target.value)} placeholder="Notes..." style={{...dynInput,fontSize:14}} /></APMField>
        </div>

        {/* Summary */}
        <div style={{ background:t.bg4, border:`1px solid ${t.border}`, borderRadius:8, padding:"12px 16px", display:"flex", gap:20, flexWrap:"wrap" }}>
          <div><span style={{ fontSize:10, color:t.text4, fontFamily:"'DM Mono',monospace" }}>THIS PERIOD </span><span style={{ fontSize:15, fontWeight:700, color:t.text, fontFamily:"'DM Mono',monospace" }}>{fmtMoney(totals.completedThis)}</span></div>
          <div><span style={{ fontSize:10, color:t.text4, fontFamily:"'DM Mono',monospace" }}>RETAINAGE </span><span style={{ fontSize:15, fontWeight:700, color:"#EF4444", fontFamily:"'DM Mono',monospace" }}>{fmtMoney(totals.retainage)}</span></div>
          <div><span style={{ fontSize:10, color:t.text4, fontFamily:"'DM Mono',monospace" }}>NET DUE </span><span style={{ fontSize:15, fontWeight:700, color:"#10B981", fontFamily:"'DM Mono',monospace" }}>{fmtMoney(totals.netDue)}</span></div>
        </div>
      </div>
      <div style={{ display:"flex", gap:8, marginTop:20, justifyContent:"space-between" }}>
        {!isNew && <button onClick={async()=>{ await supabase.from("pay_applications").delete().eq("id",payApp.id); onSave(null,true); }} style={{ background:"#1a0a0a", border:"1px solid #3a1a1a", color:"#ef4444", padding:"9px 14px", borderRadius:6, cursor:"pointer", fontSize:12 }}>Delete</button>}
        <div style={{ display:"flex", gap:8, marginLeft:"auto" }}>
          <button onClick={onClose} style={{ background:"none", border:`1px solid ${t.border2}`, color:t.text3, padding:"9px 18px", borderRadius:6, cursor:"pointer", fontSize:13 }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ background:"#F97316", border:"none", color:"#000", padding:"9px 22px", borderRadius:6, cursor:"pointer", fontSize:13, fontWeight:700 }}>{saving?"Saving...":isNew?"Create Pay App":"Save"}</button>
        </div>
      </div>
    </APMModal>
  );
}

function PayAppTab({ project }) {
  const { t } = useTheme();
  const [sovItems, setSovItems] = useState([]);
  const [payApps, setPayApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // "sov" | {payApp}
  const [appLineItems, setAppLineItems] = useState({});

  useEffect(()=>{
    Promise.all([
      supabase.from("sov_items").select("*").eq("project_id",project.id).order("sort_order"),
      supabase.from("pay_applications").select("*").eq("project_id",project.id).order("app_number"),
    ]).then(([sov,apps])=>{
      if (!sov.error) setSovItems(sov.data||[]);
      if (!apps.error) setPayApps(apps.data||[]);
      setLoading(false);
    });
  }, [project.id]);

  const handlePayAppSave = (data, isDelete) => {
    if (isDelete || !data) setPayApps(prev=>prev.filter(p=>p.id!==modal?.payApp?.id));
    else if (modal?.payApp?.id) setPayApps(prev=>prev.map(p=>p.id===data.id?data:p));
    else setPayApps(prev=>[...prev,data]);
    setModal(null);
  };

  const totalBilled = payApps.filter(p=>p.status!=="draft").length;
  const rowStyle = { display:"flex", alignItems:"center", gap:12, padding:"12px 14px", borderRadius:8, background:t.bg3, border:`1px solid ${t.border}`, marginBottom:6, cursor:"pointer", transition:"border-color 0.1s" };

  return (
    <div>
      <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginBottom:14 }}>
        <button onClick={()=>setModal("sov")} style={{ background:t.bg3, border:`1px solid ${t.border2}`, color:t.text2, padding:"7px 14px", borderRadius:6, cursor:"pointer", fontSize:12, fontWeight:600 }}>
          {sovItems.length>0?"Edit SOV":"Setup SOV"}
        </button>
        <button onClick={()=>setModal({payApp:null})} disabled={sovItems.length===0} style={{ background:"#F97316", border:"none", color:"#000", padding:"7px 16px", borderRadius:6, cursor:"pointer", fontSize:12, fontWeight:700, opacity:sovItems.length>0?1:0.5 }}>+ New Pay App</button>
      </div>

      {sovItems.length===0 && (
        <div style={{ background:t.bg4, border:`1px dashed ${t.border2}`, borderRadius:8, padding:"24px", textAlign:"center", marginBottom:16 }}>
          <div style={{ fontSize:14, color:t.text2, marginBottom:6 }}>No Schedule of Values yet</div>
          <div style={{ fontSize:11, color:t.text3, fontFamily:"'DM Mono',monospace", marginBottom:12 }}>Set up your SOV first — Claude can suggest line items based on your contract value</div>
          <button onClick={()=>setModal("sov")} style={{ background:"linear-gradient(135deg,#7c3aed,#a855f7)", border:"none", color:"#fff", padding:"8px 18px", borderRadius:6, cursor:"pointer", fontSize:12, fontWeight:700 }}>✦ Setup SOV with AI</button>
        </div>
      )}

      {loading && <div style={{ textAlign:"center", padding:40, color:t.text4, fontFamily:"'DM Mono',monospace", fontSize:12 }}>Loading...</div>}
      {!loading && payApps.length===0 && sovItems.length>0 && <div style={{ textAlign:"center", padding:40, color:t.text4, fontFamily:"'DM Mono',monospace", fontSize:12 }}>No pay applications yet</div>}

      {payApps.map(app=>(
        <div key={app.id} onClick={()=>setModal({payApp:app})} style={rowStyle}
          onMouseEnter={e=>e.currentTarget.style.borderColor=t.border2}
          onMouseLeave={e=>e.currentTarget.style.borderColor=t.border}>
          <div style={{ flex:1 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
              <span style={{ fontSize:13, fontWeight:700, color:t.text }}>Pay App #{app.app_number||"—"}</span>
              <StatusBadge status={app.status} />
            </div>
            <div style={{ fontSize:11, color:t.text3, fontFamily:"'DM Mono',monospace" }}>
              {app.period_from && app.period_to ? `${fmtDate(app.period_from)} – ${fmtDate(app.period_to)}` : fmtDate(app.period_to)}
              {app.payment_received && <span style={{ color:"#10B981", marginLeft:8 }}>✓ Paid {fmtDate(app.payment_received)}</span>}
            </div>
          </div>
          <span style={{ color:t.text4, fontSize:16 }}>›</span>
        </div>
      ))}

      {modal==="sov" && <SOVModal project={project} sovItems={sovItems} onSave={(items)=>{ setSovItems(items); setModal(null); }} onClose={()=>setModal(null)} />}
      {modal?.payApp !== undefined && modal!=="sov" && <PayAppModal payApp={modal.payApp} project={project} sovItems={sovItems} onSave={handlePayAppSave} onClose={()=>setModal(null)} />}
    </div>
  );
}


// ── Financials Tab (full waterfall) ───────────────────
function FinancialsTab({ project, cos }) {
  const { t } = useTheme();
  const [receipts, setReceipts] = useState([]);
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from("receipts").select("*").eq("project_id",project.id).order("receipt_date",{ascending:false}),
      supabase.from("subcontracts").select("*").eq("project_id",project.id),
    ]).then(([r,s])=>{
      if (!r.error) setReceipts(r.data||[]);
      if (!s.error) setSubs(s.data||[]);
      setLoading(false);
    });
  }, [project.id]);

  const handleSave = (data, isDelete) => {
    if (isDelete) setReceipts(prev=>prev.filter(r=>r.id!==modal?.item?.id));
    else if (modal?.item?.id) setReceipts(prev=>prev.map(r=>r.id===data.id?data:r));
    else setReceipts(prev=>[data,...prev]);
    setModal(null);
  };

  // Waterfall calcs
  const contractVal = project.contract_value || 0;
  const approvedCOs = cos.filter(c=>c.status==="approved").reduce((s,c)=>s+(c.amount||0),0);
  const pendingCOs = cos.filter(c=>c.status==="pending").reduce((s,c)=>s+(c.amount||0),0);
  const revisedContract = contractVal + approvedCOs;
  const subCommitments = subs.reduce((s,sub)=>s+(sub.contract_amount||0),0);
  const subRetainage = subs.reduce((s,sub)=>s+((sub.billed_to_date||0)*(sub.retainage_pct||10)/100),0);
  const directCosts = receipts.reduce((s,r)=>s+(r.amount||0),0);
  const totalCosts = subCommitments + directCosts;
  const grossMargin = revisedContract - totalCosts;
  const grossMarginPct = revisedContract > 0 ? (grossMargin/revisedContract*100).toFixed(1) : 0;
  const netCashPosition = grossMargin - subRetainage;

  // Category breakdown
  const byCategory = RECEIPT_CATEGORIES.reduce((acc,cat)=>{
    const total = receipts.filter(r=>r.category===cat).reduce((s,r)=>s+(r.amount||0),0);
    if (total>0) acc[cat]=total;
    return acc;
  },{});
  const maxCat = Math.max(...Object.values(byCategory),1);

  const exportToSheets = async () => {
    setExporting(true);
    try {
      const sheetData = {
        projectName: project.name,
        company: getCompany(project.company).name,
        address: project.address || "",
        gcName: project.gc_name || "",
        contractValue: contractVal,
        approvedCOs, pendingCOs, revisedContract,
        subCommitments, directCosts, totalCosts,
        grossMargin, grossMarginPct, netCashPosition,
        subs: subs.map(s=>({ name:s.sub_name, scope:s.scope||"", amount:s.contract_amount||0, billed:s.billed_to_date||0, paid:s.paid_to_date||0, pctComplete:s.percent_complete||0 })),
        receipts: receipts.map(r=>({ vendor:r.vendor||"", amount:r.amount||0, category:r.category||"", date:r.receipt_date||"" })),
        byCategory: Object.entries(byCategory),
        exportDate: new Date().toLocaleDateString(),
      };

      const res = await fetch("/api/claude", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514", max_tokens:1000,
          system:"You generate Google Sheets CSV data for a PM budget review. Return ONLY a JSON object with key 'csv' containing the full CSV string with proper formatting.",
          messages:[{ role:"user", content:`Generate a PM Budget Review spreadsheet CSV for this project data: ${JSON.stringify(sheetData)}. Include: 1) Project header info, 2) Financial waterfall (contract → COs → revised → costs → margin), 3) Subcontractor log table, 4) Direct costs by category, 5) Receipt ledger. Use proper CSV formatting with commas and quotes.` }]
        })
      });
      const json = await res.json();
      const text = json?.content?.find(b=>b.type==="text")?.text||"";
      let csv = "";
      try { csv = JSON.parse(text.replace(/```json|```/g,"").trim()).csv; } catch { csv = text; }

      // Download as CSV
      const blob = new Blob([csv], {type:"text/csv"});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${project.name.replace(/\s+/g,"-")}-budget-review.csv`;
      a.click(); URL.revokeObjectURL(url);
    } catch(e) { alert("Export failed: "+e.message); }
    setExporting(false);
  };

  const card = (label, val, color, sub=null) => (
    <div style={{ background:t.bg3, border:`1px solid ${t.border}`, borderRadius:8, padding:"10px 14px" }}>
      <div style={{ fontSize:9, color:t.text4, fontFamily:"'DM Mono',monospace", letterSpacing:0.8, marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:15, fontWeight:700, color, fontFamily:"'DM Mono',monospace" }}>{val}</div>
      {sub && <div style={{ fontSize:10, color:t.text3, fontFamily:"'DM Mono',monospace", marginTop:2 }}>{sub}</div>}
    </div>
  );

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div style={{ fontSize:11, color:t.text3, fontFamily:"'DM Mono',monospace" }}>FINANCIAL WATERFALL</div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={exportToSheets} disabled={exporting} style={{ background:t.bg3, border:`1px solid ${t.border2}`, color:t.text2, padding:"6px 12px", borderRadius:6, cursor:"pointer", fontSize:12, display:"flex", alignItems:"center", gap:5 }}>
            {exporting ? "Exporting..." : "📊 Export CSV"}
          </button>
          <button onClick={()=>setModal({item:null})} style={{ background:"#F97316", border:"none", color:"#000", padding:"7px 16px", borderRadius:6, cursor:"pointer", fontSize:12, fontWeight:700 }}>+ Receipt</button>
        </div>
      </div>

      {/* Waterfall */}
      <div style={{ background:t.bg3, border:`1px solid ${t.border}`, borderRadius:10, padding:"14px 16px", marginBottom:16 }}>
        {[
          { label:"Contract Value", val:contractVal, color:t.text, indent:0 },
          { label:`Approved COs (${cos.filter(c=>c.status==="approved").length})`, val:approvedCOs, color:"#10B981", indent:1, prefix:"+" },
          { label:`Pending COs (${cos.filter(c=>c.status==="pending").length})`, val:pendingCOs, color:"#F59E0B", indent:1, prefix:"+" },
          { label:"= Revised Contract", val:revisedContract, color:"#3B82F6", indent:0, bold:true, line:true },
          { label:`Subcontract Commitments (${subs.length})`, val:subCommitments, color:"#EF4444", indent:1, prefix:"-" },
          { label:`Direct Costs (${receipts.length} receipts)`, val:directCosts, color:"#EF4444", indent:1, prefix:"-" },
          { label:"= Gross Margin", val:grossMargin, color:grossMargin>=0?"#10B981":"#EF4444", indent:0, bold:true, line:true },
          { label:"Sub Retainage Held", val:subRetainage, color:"#F59E0B", indent:1, prefix:"-" },
          { label:"= Net Cash Position", val:netCashPosition, color:netCashPosition>=0?"#10B981":"#EF4444", indent:0, bold:true, line:true },
        ].map((row,i)=>(
          <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:`${row.line?"8px 0 6px":"4px 0"}`, borderTop:row.line?`1px solid ${t.border}`:"none", paddingLeft:row.indent*16 }}>
            <span style={{ fontSize:row.bold?12:11, color:row.bold?t.text:t.text2, fontFamily:"'DM Mono',monospace", fontWeight:row.bold?700:400 }}>{row.label}</span>
            <span style={{ fontSize:row.bold?13:11, color:row.color, fontFamily:"'DM Mono',monospace", fontWeight:row.bold?700:400 }}>
              {row.prefix||""}{fmtMoney(Math.abs(row.val))}
              {row.bold && row.val!==0 && row.label.includes("Margin") && <span style={{ fontSize:10, marginLeft:6, color:t.text3 }}>({grossMarginPct}%)</span>}
            </span>
          </div>
        ))}
      </div>

      {/* Budget bar */}
      {revisedContract > 0 && (
        <div style={{ background:t.bg3, border:`1px solid ${t.border}`, borderRadius:8, padding:"12px 14px", marginBottom:14 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
            <span style={{ fontSize:10, color:t.text4, fontFamily:"'DM Mono',monospace" }}>COST UTILIZATION</span>
            <span style={{ fontSize:11, fontWeight:700, color:totalCosts/revisedContract>0.9?"#EF4444":t.text, fontFamily:"'DM Mono',monospace" }}>{Math.round(totalCosts/revisedContract*100)}%</span>
          </div>
          <div style={{ background:t.bg5, borderRadius:4, height:8, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${Math.min(totalCosts/revisedContract*100,100)}%`, background:totalCosts/revisedContract>0.9?"#EF4444":totalCosts/revisedContract>0.75?"#F59E0B":"#10B981", borderRadius:4, transition:"width 0.4s ease" }} />
          </div>
        </div>
      )}

      {/* Category breakdown */}
      {Object.keys(byCategory).length>0 && (
        <div style={{ background:t.bg3, border:`1px solid ${t.border}`, borderRadius:8, padding:"12px 14px", marginBottom:14 }}>
          <div style={{ fontSize:10, color:t.text4, fontFamily:"'DM Mono',monospace", letterSpacing:0.8, marginBottom:10 }}>DIRECT COST BY CATEGORY</div>
          {Object.entries(byCategory).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>(
            <div key={cat} style={{ marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                <span style={{ fontSize:11, color:t.text2 }}>{cat}</span>
                <span style={{ fontSize:11, color:t.text, fontFamily:"'DM Mono',monospace" }}>{fmtMoney(amt)}</span>
              </div>
              <div style={{ background:t.bg5, borderRadius:3, height:4 }}>
                <div style={{ height:"100%", width:`${amt/maxCat*100}%`, background:"#F97316", borderRadius:3 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Receipt ledger */}
      <div style={{ fontSize:10, color:t.text4, fontFamily:"'DM Mono',monospace", letterSpacing:0.8, marginBottom:8 }}>RECEIPTS ({receipts.length})</div>
      {loading && <div style={{ textAlign:"center", padding:30, color:t.text4, fontFamily:"'DM Mono',monospace", fontSize:12 }}>Loading...</div>}
      {!loading && receipts.length===0 && <div style={{ textAlign:"center", padding:30, color:t.text4, fontFamily:"'DM Mono',monospace", fontSize:12 }}>No receipts yet</div>}
      {receipts.map(r=>(
        <div key={r.id} onClick={()=>setModal({item:r})}
          style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 14px", borderRadius:7, background:t.bg3, border:`1px solid ${t.border}`, marginBottom:5, cursor:"pointer" }}
          onMouseEnter={e=>e.currentTarget.style.borderColor=t.border2}
          onMouseLeave={e=>e.currentTarget.style.borderColor=t.border}>
          {r.file_url && r.file_url.match(/\.(jpg|jpeg|png|gif|webp)/i) ? (
            <img src={r.file_url} style={{ width:44,height:34,objectFit:"cover",borderRadius:5,border:`1px solid ${t.border2}`,flexShrink:0 }} />
          ) : (
            <div style={{ width:44,height:34,background:t.bg5,borderRadius:5,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0 }}>{r.file_url?"📄":"🧾"}</div>
          )}
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2 }}>
              <span style={{ fontSize:13, color:t.text, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.vendor||"Unknown vendor"}</span>
              <span style={{ fontSize:10, color:t.text3, background:t.bg5, padding:"1px 6px", borderRadius:4, flexShrink:0 }}>{r.category}</span>
            </div>
            <div style={{ fontSize:11, color:t.text3, fontFamily:"'DM Mono',monospace" }}>{fmtDate(r.receipt_date)}{r.notes?" · "+r.notes:""}</div>
          </div>
          <div style={{ fontSize:14, fontWeight:700, color:t.text, fontFamily:"'DM Mono',monospace", flexShrink:0 }}>{fmtMoney(r.amount)}</div>
        </div>
      ))}
      {modal && <ReceiptModal receipt={modal.item} projectId={project.id} onSave={handleSave} onClose={()=>setModal(null)} />}
    </div>
  );
}

// ── Project Detail ─────────────────────────────────────
function ProjectDetail({ project, onBack, onEdit }) {
  const [tab, setTab] = useState("logs");
  const [logs, setLogs] = useState([]);
  const [rfis, setRfis] = useState([]);
  const [submittals, setSubmittals] = useState([]);
  const [cos, setCos] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [subcontracts, setSubcontracts] = useState([]);
  const [payApps, setPayApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // {type, item}

  useEffect(() => {
    const id = project.id;
    Promise.all([
      supabase.from("daily_logs").select("*").eq("project_id",id).order("log_date",{ascending:false}),
      supabase.from("rfis").select("*").eq("project_id",id).order("created_at",{ascending:false}),
      supabase.from("submittals").select("*").eq("project_id",id).order("created_at",{ascending:false}),
      supabase.from("change_orders").select("*").eq("project_id",id).order("created_at",{ascending:false}),
      supabase.from("material_orders").select("*").eq("project_id",id).order("created_at",{ascending:false}),
    ]).then(([l,r,s,c,m]) => {
      if (!l.error) setLogs(l.data||[]);
      if (!r.error) setRfis(r.data||[]);
      if (!s.error) setSubmittals(s.data||[]);
      if (!c.error) setCos(c.data||[]);
      if (!m.error) setMaterials(m.data||[]);
      setLoading(false);
    });
  }, [project.id]);

  const co = getCompany(project.company);
  const approvedCOs = cos.filter(c=>c.status==="approved").reduce((sum,c)=>sum+(c.amount||0),0);
  const pendingCOs = cos.filter(c=>c.status==="pending").reduce((sum,c)=>sum+(c.amount||0),0);
  const totalMaterials = materials.reduce((sum,m)=>sum+(m.total_cost||0),0);

  const TABS = [
    { id:"logs", label:"Daily Logs", count:logs.length },
    { id:"rfis", label:"RFIs", count:rfis.length },
    { id:"submittals", label:"Submittals", count:submittals.length },
    { id:"cos", label:"Change Orders", count:cos.length },
    { id:"materials", label:"Materials", count:materials.length },
    { id:"subcontracts", label:"Subcontracts", count:subcontracts.length },
    { id:"payapps", label:"Pay Apps", count:payApps.length },
    { id:"financials", label:"Financials", count:receipts.length },
  ];

  const rowStyle = { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"11px 14px", borderRadius:7, background:"#111", border:"1px solid #1a1a1a", marginBottom:5, cursor:"pointer", gap:10 };

  const handleSave = (type, data, isDelete) => {
    if (type==="logs") setLogs(prev => isDelete ? prev.filter(x=>x.id!==modal.item?.id) : modal.item?.id ? prev.map(x=>x.id===data.id?data:x) : [data,...prev]);
    if (type==="rfis") setRfis(prev => isDelete ? prev.filter(x=>x.id!==modal.item?.id) : modal.item?.id ? prev.map(x=>x.id===data.id?data:x) : [data,...prev]);
    if (type==="submittals") setSubmittals(prev => isDelete ? prev.filter(x=>x.id!==modal.item?.id) : modal.item?.id ? prev.map(x=>x.id===data.id?data:x) : [data,...prev]);
    if (type==="cos") setCos(prev => isDelete ? prev.filter(x=>x.id!==modal.item?.id) : modal.item?.id ? prev.map(x=>x.id===data.id?data:x) : [data,...prev]);
    if (type==="materials") setMaterials(prev => isDelete ? prev.filter(x=>x.id!==modal.item?.id) : modal.item?.id ? prev.map(x=>x.id===data.id?data:x) : [data,...prev]);
    setModal(null);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
      {/* Header */}
      <div style={{ padding:"14px 20px 0", borderBottom:"1px solid #1a1a1a", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
          <button onClick={onBack} style={{ background:"none", border:"none", color:"#555", cursor:"pointer", fontSize:14, padding:"4px 8px 4px 0" }}>← Back</button>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
              <span style={{ fontSize:16, fontWeight:700, color:"#e5e5e5", fontFamily:"'Syne',sans-serif" }}>{project.name}</span>
              <StatusBadge status={project.status} />
              <span style={{ fontSize:11, color:co.color, fontFamily:"'DM Mono',monospace", background:co.color+"15", border:`1px solid ${co.color}30`, padding:"1px 6px", borderRadius:4 }}>{co.short}</span>
            </div>
            {project.address && <div style={{ fontSize:11, color:"#444", fontFamily:"'DM Mono',monospace", marginTop:2 }}>{project.address}</div>}
          </div>
          <button onClick={onEdit} style={{ background:"#1e1e1e", border:"1px solid #2a2a2a", color:"#888", padding:"6px 12px", borderRadius:6, cursor:"pointer", fontSize:12 }}>Edit</button>
        </div>
        {/* Summary strip */}
        <div style={{ display:"flex", gap:16, marginBottom:12, flexWrap:"wrap" }}>
          {project.contract_value && <div style={{ fontSize:11, color:"#555", fontFamily:"'DM Mono',monospace" }}>Contract: <span style={{ color:"#e5e5e5" }}>{fmtMoney(project.contract_value)}</span></div>}
          {approvedCOs > 0 && <div style={{ fontSize:11, color:"#555", fontFamily:"'DM Mono',monospace" }}>Approved COs: <span style={{ color:"#10B981" }}>+{fmtMoney(approvedCOs)}</span></div>}
          {pendingCOs > 0 && <div style={{ fontSize:11, color:"#555", fontFamily:"'DM Mono',monospace" }}>Pending COs: <span style={{ color:"#F59E0B" }}>{fmtMoney(pendingCOs)}</span></div>}
          {totalMaterials > 0 && <div style={{ fontSize:11, color:"#555", fontFamily:"'DM Mono',monospace" }}>Materials: <span style={{ color:"#e5e5e5" }}>{fmtMoney(totalMaterials)}</span></div>}
          {project.gc_name && <div style={{ fontSize:11, color:"#555", fontFamily:"'DM Mono',monospace" }}>GC: <span style={{ color:"#e5e5e5" }}>{project.gc_name}</span></div>}
        </div>
        {/* Tabs */}
        <div style={{ display:"flex", gap:0, overflowX:"auto" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={()=>setTab(t.id)} style={{ padding:"8px 14px", background:"none", border:"none", borderBottom:tab===t.id?"2px solid #F97316":"2px solid transparent", color:tab===t.id?"#e5e5e5":"#555", cursor:"pointer", fontSize:12, fontFamily:"'DM Mono',monospace", whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:5 }}>
              {t.label} {t.count > 0 && <span style={{ background:"#1a1a1a", color:"#555", borderRadius:8, padding:"0 5px", fontSize:10 }}>{t.count}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ flex:1, overflowY:"auto", padding:"16px 20px 80px" }}>
        {loading ? <div style={{ textAlign:"center", padding:40, color:"#333", fontFamily:"'DM Mono',monospace", fontSize:12 }}>Loading...</div> : (
          <>
            {/* Add button */}
            {tab !== "financials" && tab !== "subcontracts" && tab !== "payapps" && <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:12 }}>
              <button onClick={()=>setModal({type:tab,item:null})} style={{ background:"#F97316", border:"none", color:"#000", padding:"7px 16px", borderRadius:6, cursor:"pointer", fontSize:12, fontWeight:700 }}>
                {tab==="financials" ? null : ("+ Add " + (tab==="logs"?"Log":tab==="rfis"?"RFI":tab==="submittals"?"Submittal":tab==="cos"?"Change Order":"Order"))}
              </button>
            </div>}

            {/* Daily Logs */}
            {tab==="logs" && logs.map(log => (
              <div key={log.id} onClick={()=>setModal({type:"logs",item:log})} style={rowStyle}
                onMouseEnter={e=>e.currentTarget.style.borderColor="#2a2a2a"}
                onMouseLeave={e=>e.currentTarget.style.borderColor="#1a1a1a"}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                    <span style={{ fontSize:12, fontWeight:600, color:"#e5e5e5", fontFamily:"'DM Mono',monospace" }}>{fmtDate(log.log_date)}</span>
                    {log.weather && <span style={{ fontSize:11, color:"#555" }}>{log.weather}</span>}
                    {log.crew_count && <span style={{ fontSize:11, color:"#555", fontFamily:"'DM Mono',monospace" }}>👷 {log.crew_count}</span>}
                  </div>
                  <div style={{ fontSize:12, color:"#888", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{log.work_performed||"No description"}</div>
                  {log.issues && <div style={{ fontSize:11, color:"#F59E0B", marginTop:3 }}>⚠ {log.issues}</div>}
                </div>
                <span style={{ color:"#333", fontSize:16 }}>›</span>
              </div>
            ))}
            {tab==="logs" && logs.length===0 && <div style={{ textAlign:"center", padding:40, color:"#333", fontFamily:"'DM Mono',monospace", fontSize:12 }}>No logs yet</div>}

            {/* RFIs */}
            {tab==="rfis" && rfis.map(r => (
              <div key={r.id} onClick={()=>setModal({type:"rfis",item:r})} style={rowStyle}
                onMouseEnter={e=>e.currentTarget.style.borderColor="#2a2a2a"}
                onMouseLeave={e=>e.currentTarget.style.borderColor="#1a1a1a"}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                    {r.rfi_number && <span style={{ fontSize:10, color:"#555", fontFamily:"'DM Mono',monospace" }}>{r.rfi_number}</span>}
                    <span style={{ fontSize:13, color:"#e5e5e5", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.subject}</span>
                  </div>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <StatusBadge status={r.status} />
                    {r.sent_to && <span style={{ fontSize:11, color:"#555" }}>{r.sent_to}</span>}
                    {r.date_due && <span style={{ fontSize:10, color:"#444", fontFamily:"'DM Mono',monospace" }}>Due {fmtDate(r.date_due)}</span>}
                  </div>
                </div>
                <span style={{ color:"#333", fontSize:16 }}>›</span>
              </div>
            ))}
            {tab==="rfis" && rfis.length===0 && <div style={{ textAlign:"center", padding:40, color:"#333", fontFamily:"'DM Mono',monospace", fontSize:12 }}>No RFIs yet</div>}

            {/* Submittals */}
            {tab==="submittals" && submittals.map(s => (
              <div key={s.id} onClick={()=>setModal({type:"submittals",item:s})} style={rowStyle}
                onMouseEnter={e=>e.currentTarget.style.borderColor="#2a2a2a"}
                onMouseLeave={e=>e.currentTarget.style.borderColor="#1a1a1a"}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                    {s.submittal_number && <span style={{ fontSize:10, color:"#555", fontFamily:"'DM Mono',monospace" }}>{s.submittal_number}</span>}
                    <span style={{ fontSize:13, color:"#e5e5e5", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.description}</span>
                  </div>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <StatusBadge status={s.status} />
                    {s.sent_to && <span style={{ fontSize:11, color:"#555" }}>{s.sent_to}</span>}
                    {s.date_due && <span style={{ fontSize:10, color:"#444", fontFamily:"'DM Mono',monospace" }}>Due {fmtDate(s.date_due)}</span>}
                  </div>
                </div>
                <span style={{ color:"#333", fontSize:16 }}>›</span>
              </div>
            ))}
            {tab==="submittals" && submittals.length===0 && <div style={{ textAlign:"center", padding:40, color:"#333", fontFamily:"'DM Mono',monospace", fontSize:12 }}>No submittals yet</div>}

            {/* Change Orders */}
            {tab==="cos" && (
              <>
                {cos.length > 0 && (
                  <div style={{ display:"flex", gap:12, marginBottom:14, flexWrap:"wrap" }}>
                    <div style={{ background:"#0a1a12", border:"1px solid #10B98130", borderRadius:8, padding:"8px 14px" }}>
                      <div style={{ fontSize:16, fontWeight:700, color:"#10B981", fontFamily:"'DM Mono',monospace" }}>{fmtMoney(approvedCOs)}</div>
                      <div style={{ fontSize:9, color:"#555", fontFamily:"'DM Mono',monospace", letterSpacing:0.8 }}>APPROVED</div>
                    </div>
                    <div style={{ background:"#1a1208", border:"1px solid #F59E0B30", borderRadius:8, padding:"8px 14px" }}>
                      <div style={{ fontSize:16, fontWeight:700, color:"#F59E0B", fontFamily:"'DM Mono',monospace" }}>{fmtMoney(pendingCOs)}</div>
                      <div style={{ fontSize:9, color:"#555", fontFamily:"'DM Mono',monospace", letterSpacing:0.8 }}>PENDING</div>
                    </div>
                  </div>
                )}
                {cos.map(c => (
                  <div key={c.id} onClick={()=>setModal({type:"cos",item:c})} style={rowStyle}
                    onMouseEnter={e=>e.currentTarget.style.borderColor="#2a2a2a"}
                    onMouseLeave={e=>e.currentTarget.style.borderColor="#1a1a1a"}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                        {c.co_number && <span style={{ fontSize:10, color:"#555", fontFamily:"'DM Mono',monospace" }}>{c.co_number}</span>}
                        <span style={{ fontSize:13, color:"#e5e5e5", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.description}</span>
                      </div>
                      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                        <StatusBadge status={c.status} />
                        {c.amount && <span style={{ fontSize:12, color:"#e5e5e5", fontFamily:"'DM Mono',monospace", fontWeight:600 }}>{fmtMoney(c.amount)}</span>}
                      </div>
                    </div>
                    <span style={{ color:"#333", fontSize:16 }}>›</span>
                  </div>
                ))}
                {cos.length===0 && <div style={{ textAlign:"center", padding:40, color:"#333", fontFamily:"'DM Mono',monospace", fontSize:12 }}>No change orders yet</div>}
              </>
            )}

            {/* Materials */}
            {tab==="materials" && (
              <>
                {materials.length > 0 && (
                  <div style={{ background:"#111", border:"1px solid #1e1e1e", borderRadius:8, padding:"10px 14px", marginBottom:14, display:"flex", gap:20, flexWrap:"wrap" }}>
                    <div><span style={{ fontSize:10, color:"#555", fontFamily:"'DM Mono',monospace" }}>TOTAL ORDERED </span><span style={{ fontSize:14, fontWeight:700, color:"#e5e5e5", fontFamily:"'DM Mono',monospace" }}>{fmtMoney(totalMaterials)}</span></div>
                    <div><span style={{ fontSize:10, color:"#555", fontFamily:"'DM Mono',monospace" }}>PENDING </span><span style={{ fontSize:14, fontWeight:700, color:"#F59E0B", fontFamily:"'DM Mono',monospace" }}>{materials.filter(m=>m.status==="pending").length}</span></div>
                    <div><span style={{ fontSize:10, color:"#555", fontFamily:"'DM Mono',monospace" }}>DELIVERED </span><span style={{ fontSize:14, fontWeight:700, color:"#10B981", fontFamily:"'DM Mono',monospace" }}>{materials.filter(m=>m.status==="delivered").length}</span></div>
                  </div>
                )}
                {materials.map(m => (
                  <div key={m.id} onClick={()=>setModal({type:"materials",item:m})} style={rowStyle}
                    onMouseEnter={e=>e.currentTarget.style.borderColor="#2a2a2a"}
                    onMouseLeave={e=>e.currentTarget.style.borderColor="#1a1a1a"}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                        <span style={{ fontSize:13, color:"#e5e5e5", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{m.item}</span>
                        {m.quantity && <span style={{ fontSize:11, color:"#555", flexShrink:0 }}>{m.quantity}</span>}
                      </div>
                      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                        <StatusBadge status={m.status} />
                        {m.supplier && <span style={{ fontSize:11, color:"#555" }}>{m.supplier}</span>}
                        {m.total_cost && <span style={{ fontSize:11, color:"#e5e5e5", fontFamily:"'DM Mono',monospace" }}>{fmtMoney(m.total_cost)}</span>}
                        {m.eta && <span style={{ fontSize:10, color:"#444", fontFamily:"'DM Mono',monospace" }}>ETA {fmtDate(m.eta)}</span>}
                      </div>
                    </div>
                    <span style={{ color:"#333", fontSize:16 }}>›</span>
                  </div>
                ))}
                {materials.length===0 && <div style={{ textAlign:"center", padding:40, color:"#333", fontFamily:"'DM Mono',monospace", fontSize:12 }}>No material orders yet</div>}
              </>
            )}

            {/* Financials */}
            {tab==="subcontracts" && <SubcontractsTab project={project} />}
            {tab==="payapps" && <PayAppTab project={project} />}
            {tab==="financials" && <FinancialsTab project={project} cos={cos} />}
          </>
        )}
      </div>

      {/* Modals */}
      {modal?.type==="logs" && <DailyLogModal log={modal.item} projectId={project.id} onSave={(d,del)=>handleSave("logs",d,del)} onClose={()=>setModal(null)} />}
      {modal?.type==="rfis" && <RFIModal rfi={modal.item} projectId={project.id} onSave={(d,del)=>handleSave("rfis",d,del)} onClose={()=>setModal(null)} />}
      {modal?.type==="submittals" && <SubmittalModal submittal={modal.item} projectId={project.id} onSave={(d,del)=>handleSave("submittals",d,del)} onClose={()=>setModal(null)} />}
      {modal?.type==="cos" && <COModal co={modal.item} projectId={project.id} onSave={(d,del)=>handleSave("cos",d,del)} onClose={()=>setModal(null)} />}
      {modal?.type==="materials" && <MaterialModal material={modal.item} projectId={project.id} onSave={(d,del)=>handleSave("materials",d,del)} onClose={()=>setModal(null)} />}
    </div>
  );
}

// ── APM Main ───────────────────────────────────────────
function APMSection() {
  const isMobile = useIsMobile();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const [editingProject, setEditingProject] = useState(null);
  const [filterCo, setFilterCo] = useState("all");
  const [filterStatus, setFilterStatus] = useState("active");

  useEffect(() => {
    supabase.from("projects").select("*").order("created_at",{ascending:false}).then(({data,error}) => {
      if (!error) setProjects(data||[]);
      setLoading(false);
    });
  }, []);

  const handleProjectSave = (proj, isNew) => {
    setProjects(prev => isNew ? [proj,...prev] : prev.map(p=>p.id===proj.id?proj:p));
    setEditingProject(null);
    if (isNew) setSelectedProject(proj);
  };

  const filtered = projects.filter(p => {
    const matchCo = filterCo==="all" || p.company===filterCo;
    const matchStatus = filterStatus==="all" || p.status===filterStatus;
    return matchCo && matchStatus;
  });

  if (selectedProject) {
    const current = projects.find(p=>p.id===selectedProject.id) || selectedProject;
    return (
      <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
        <ProjectDetail
          project={current}
          onBack={()=>setSelectedProject(null)}
          onEdit={()=>setEditingProject(current)}
        />
        {editingProject && <ProjectModal project={editingProject} onSave={handleProjectSave} onClose={()=>setEditingProject(null)} />}
      </div>
    );
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
      {/* APM Header */}
      <div style={{ padding:"12px 20px", borderBottom:"1px solid #1a1a1a", display:"flex", alignItems:"center", gap:12, flexShrink:0, flexWrap:"wrap" }}>
        <div style={{ flex:1, display:"flex", gap:8, flexWrap:"wrap" }}>
          <button onClick={()=>setFilterStatus("active")} style={{ padding:"5px 12px", borderRadius:20, border:filterStatus==="active"?"1px solid #10B98160":"1px solid #2a2a2a", background:filterStatus==="active"?"#10B98115":"#111", color:filterStatus==="active"?"#10B981":"#555", fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"'DM Mono',monospace" }}>Active</button>
          <button onClick={()=>setFilterStatus("all")} style={{ padding:"5px 12px", borderRadius:20, border:filterStatus==="all"?"1px solid #F9731660":"1px solid #2a2a2a", background:filterStatus==="all"?"#F9731615":"#111", color:filterStatus==="all"?"#F97316":"#555", fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"'DM Mono',monospace" }}>All</button>
          {COMPANIES.filter(c=>c.id!=="all").map(co => (
            <button key={co.id} onClick={()=>setFilterCo(f=>f===co.id?"all":co.id)} style={{ padding:"5px 12px", borderRadius:20, border:filterCo===co.id?`1px solid ${co.color}60`:"1px solid #2a2a2a", background:filterCo===co.id?co.color+"15":"#111", color:filterCo===co.id?co.color:"#555", fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"'DM Mono',monospace" }}>{co.short}</button>
          ))}
        </div>
        <button onClick={()=>setEditingProject({})} style={{ background:"#F97316", border:"none", color:"#000", padding:"8px 16px", borderRadius:6, cursor:"pointer", fontSize:12, fontWeight:700, flexShrink:0 }}>+ New Project</button>
      </div>

      {/* Projects list */}
      <div style={{ flex:1, overflowY:"auto", padding:"16px 20px 80px" }}>
        {loading ? (
          <div style={{ textAlign:"center", padding:60, color:"#333", fontFamily:"'DM Mono',monospace", fontSize:12 }}>Loading...</div>
        ) : filtered.length===0 ? (
          <div style={{ textAlign:"center", padding:60, color:"#333", fontFamily:"'DM Mono',monospace", fontSize:12 }}>No projects found — add one above</div>
        ) : (
          filtered.map(proj => {
            const co = getCompany(proj.company);
            return (
              <div key={proj.id} onClick={()=>setSelectedProject(proj)}
                style={{ background:"#111", border:"1px solid #1a1a1a", borderRadius:10, padding:"14px 16px", marginBottom:8, cursor:"pointer", transition:"border-color 0.1s" }}
                onMouseEnter={e=>e.currentTarget.style.borderColor="#2a2a2a"}
                onMouseLeave={e=>e.currentTarget.style.borderColor="#1a1a1a"}>
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:10 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5, flexWrap:"wrap" }}>
                      <span style={{ fontSize:14, fontWeight:700, color:"#e5e5e5", fontFamily:"'Syne',sans-serif" }}>{proj.name}</span>
                      <StatusBadge status={proj.status} />
                      <span style={{ fontSize:10, color:co.color, fontFamily:"'DM Mono',monospace", background:co.color+"15", border:`1px solid ${co.color}30`, padding:"1px 6px", borderRadius:4 }}>{co.short}</span>
                    </div>
                    <div style={{ display:"flex", gap:14, flexWrap:"wrap" }}>
                      {proj.address && <span style={{ fontSize:11, color:"#444", fontFamily:"'DM Mono',monospace" }}>📍 {proj.address}</span>}
                      {proj.gc_name && <span style={{ fontSize:11, color:"#444", fontFamily:"'DM Mono',monospace" }}>🏢 {proj.gc_name}</span>}
                      {proj.contract_value && <span style={{ fontSize:11, color:"#555", fontFamily:"'DM Mono',monospace" }}>{fmtMoney(proj.contract_value)}</span>}
                    </div>
                    {(proj.start_date||proj.end_date) && (
                      <div style={{ fontSize:11, color:"#333", fontFamily:"'DM Mono',monospace", marginTop:4 }}>
                        {fmtDate(proj.start_date)} → {fmtDate(proj.end_date)}
                      </div>
                    )}
                  </div>
                  <span style={{ color:"#333", fontSize:18, flexShrink:0 }}>›</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {editingProject && <ProjectModal project={Object.keys(editingProject).length?editingProject:null} onSave={handleProjectSave} onClose={()=>setEditingProject(null)} />}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}

// ─────────────────────────────────────────────
// Login Screen
// ─────────────────────────────────────────────

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) return;
    setLoading(true); setError("");
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) { setError(err.message); setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100dvh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Syne', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap'); *{box-sizing:border-box;margin:0;padding:0} @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 40, justifyContent: "center" }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "linear-gradient(135deg, #F97316, #ea580c)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⬡</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#e5e5e5", letterSpacing: -0.3 }}>FCG / BR OPS</div>
            <div style={{ fontSize: 10, color: "#444", fontFamily: "'DM Mono', monospace", letterSpacing: 1 }}>OPERATIONS BOARD</div>
          </div>
        </div>
        <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 14, padding: 28, boxShadow: "0 24px 80px rgba(0,0,0,0.5)" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#e5e5e5", marginBottom: 4 }}>Sign in</div>
          <div style={{ fontSize: 11.5, color: "#444", fontFamily: "'DM Mono', monospace", marginBottom: 24 }}>Use your work email and password</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoFocus onKeyDown={e => e.key === "Enter" && handleLogin()} style={{ ...inputStyle, fontSize: 15 }} />
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === "Enter" && handleLogin()} style={{ ...inputStyle, fontSize: 15 }} />
            </div>
          </div>
          {error && <div style={{ marginTop: 14, color: "#ef4444", fontSize: 12, fontFamily: "'DM Mono', monospace", background: "#1a0a0a", border: "1px solid #3a1a1a", borderRadius: 6, padding: "10px 12px" }}>⚠ {error}</div>}
          <button onClick={handleLogin} disabled={loading || !email.trim() || !password.trim()} style={{ marginTop: 20, width: "100%", background: "#F97316", border: "none", borderRadius: 8, padding: "12px 0", color: "#000", fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: email.trim() && password.trim() && !loading ? 1 : 0.4, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {loading ? <><span style={{ display: "inline-block", animation: "spin 0.8s linear infinite" }}>◌</span> Signing in...</> : "Sign In →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────

function AppInner() {
  const { dark, t } = useTheme();
  const isMobile = useIsMobile();
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [appSection, setAppSection] = useState("ops"); // "ops" or "apm"
  const [tasks, setTasks] = useState([]);
  const [team, setTeam] = useState([]);
  const [attachmentCounts, setAttachmentCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState("tasks");
  const [activeCompany, setActiveCompany] = useState("all");
  const [activeProject, setActiveProject] = useState("all");
  const [myTasksOnly, setMyTasksOnly] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [isNew, setIsNew] = useState(false);
  const [search, setSearch] = useState("");
  const [view, setView] = useState("kanban");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [digestOpen, setDigestOpen] = useState(false);

  const dragState = useRef({ active: false, task: null, startX: 0, startY: 0, moved: false });
  const [ghostPos, setGhostPos] = useState(null);

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user || null);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => { await supabase.auth.signOut(); };
  const [ghostTask, setGhostTask] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [overColumn, setOverColumn] = useState(null);
  const columnRefs = useRef({});

  useEffect(() => {
    // Default to list view on mobile
    if (isMobile) setView("list");
  }, [isMobile]);

  useEffect(() => {
    const loadAll = async () => {
      const [tasksRes, teamRes, attRes] = await Promise.all([
        supabase.from("tasks").select("*").order("created_at", { ascending: true }),
        supabase.from("team").select("*").order("created_at", { ascending: true }),
        supabase.from("task_attachments").select("task_id"),
      ]);
      if (!tasksRes.error) setTasks(tasksRes.data || []);
      if (!teamRes.error) setTeam(teamRes.data || []);
      if (!attRes.error) {
        const counts = {};
        (attRes.data || []).forEach(a => { counts[a.task_id] = (counts[a.task_id] || 0) + 1; });
        setAttachmentCounts(counts);
      }
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
      .on("postgres_changes", { event: "*", schema: "public", table: "task_attachments" }, () => {
        supabase.from("task_attachments").select("task_id").then(r => {
          if (!r.error) {
            const counts = {};
            (r.data || []).forEach(a => { counts[a.task_id] = (counts[a.task_id] || 0) + 1; });
            setAttachmentCounts(counts);
          }
        });
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const currentMember = team.find(m => m.email && user?.email && m.email.toLowerCase() === user.email.toLowerCase());

  const allProjects = tasks.map(t => t.project).filter(Boolean);

  const filtered = tasks.filter(t => {
    const matchCo = activeCompany === "all" || t.company === activeCompany;
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase());
    const matchProject = activeProject === "all" || t.project === activeProject;
    const matchMine = !myTasksOnly || t.assignee === currentMember?.id;
    return matchCo && matchSearch && matchProject && matchMine;
  });

  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  const stats = {
    total: filtered.length,
    overdue: filtered.filter(t => t.status !== "done" && t.due && new Date(t.due+"T12:00:00") < today).length,
    dueToday: filtered.filter(t => t.status !== "done" && t.due && new Date(t.due+"T12:00:00") >= today && new Date(t.due+"T12:00:00") < tomorrow).length,
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
    if (e.button !== 0 || isMobile) return;
    e.preventDefault();
    dragState.current = { active: true, task, startX: e.clientX, startY: e.clientY, moved: false };
  }, [isMobile]);

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

  const openNew = () => { setIsNew(true); setEditTask({}); if (isMobile) setSidebarOpen(false); };
  const openEdit = (task) => { if (!dragState.current.moved) { setIsNew(false); setEditTask(task); } };
  const closeModal = () => { setEditTask(null); setIsNew(false); };

  const handleSave = async (form) => {
    const { id, ...fields } = form;
    if (isNew) {
      const { data } = await supabase.from("tasks").insert([fields]).select().single();
      if (data) setTasks(ts => [...ts, data]);
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
    const { data } = await supabase.from("tasks").insert([parsed]).select().single();
    if (data) setTasks(ts => [...ts, data]);
  };

  // ── Mobile layout ──────────────────────────
  if (authLoading) return <div style={{ minHeight: "100dvh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", color: "#333", fontFamily: "monospace" }}>◌</div>;
  if (!user) return <LoginScreen />;

  if (isMobile) {
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
          body { background: #0a0a0a; }
          ::-webkit-scrollbar { width: 0; }
          select option { background: #111; color: #e5e5e5; }
          @keyframes spin { from{transform:rotate(0deg)}to{transform:rotate(360deg)} }
        `}</style>

        <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#0a0a0a", fontFamily: "'Syne', sans-serif" }}>

          {/* Mobile Header */}
          <div style={{ display: "flex", alignItems: "center", padding: "7px 12px", borderBottom: "1px solid #1a1a1a", background: "#0d0d0d", gap: 8, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
              <div style={{ width: 24, height: 24, borderRadius: 5, background: "linear-gradient(135deg, #F97316, #ea580c)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>⬡</div>
              <div style={{ display: "flex", background: "#1a1a1a", borderRadius: 6, overflow: "hidden", border: "1px solid #2a2a2a" }}>
                <button onClick={() => setAppSection("ops")} style={{ padding: "4px 10px", background: appSection === "ops" ? "#F9731620" : "none", border: "none", color: appSection === "ops" ? "#F97316" : "#555", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono', monospace" }}>OPS</button>
                <button onClick={() => setAppSection("apm")} style={{ padding: "4px 10px", background: appSection === "apm" ? "#3B82F620" : "none", border: "none", color: appSection === "apm" ? "#3B82F6" : "#555", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono', monospace" }}>APM</button>
              </div>
            </div>
            {appSection === "ops" && <button onClick={() => setAiOpen(true)} style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)", border: "none", color: "#fff", padding: "6px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>✦ AI</button>}
            {appSection === "ops" && <button onClick={openNew} style={{ background: "#F97316", border: "none", color: "#000", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>+ Task</button>}
          </div>

          {/* Company filter pills */}
          <div style={{ display: "flex", gap: 8, padding: "10px 16px", overflowX: "auto", borderBottom: "1px solid #1a1a1a", flexShrink: 0 }}>
            {COMPANIES.map(co => {
              const active = activeCompany === co.id;
              return (
                <button key={co.id} onClick={() => setActiveCompany(co.id)} style={{ padding: "5px 12px", borderRadius: 20, border: active ? `1px solid ${co.color}60` : "1px solid #2a2a2a", background: active ? co.color + "15" : "#111", color: active ? co.color : "#555", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'DM Mono', monospace" }}>
                  {co.id === "all" ? "All" : co.short}
                </button>
              );
            })}
          </div>

          {/* My Tasks toggle + Project filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderBottom: "1px solid #1a1a1a", overflowX: "auto", flexShrink: 0 }}>
            <button onClick={() => setMyTasksOnly(m => !m)} style={{ padding: "4px 10px", borderRadius: 20, border: myTasksOnly ? "1px solid #F97316" : "1px solid #2a2a2a", background: myTasksOnly ? "#F9731615" : "#111", color: myTasksOnly ? "#F97316" : "#555", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>
              👤 Mine
            </button>
            {[...new Set(tasks.map(t => t.project).filter(Boolean))].map(p => (
              <button key={p} onClick={() => setActiveProject(ap => ap === p ? "all" : p)} style={{ padding: "4px 10px", borderRadius: 20, border: activeProject === p ? "1px solid #8B5CF6" : "1px solid #2a2a2a", background: activeProject === p ? "#8B5CF615" : "#111", color: activeProject === p ? "#8B5CF6" : "#555", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>
                {p}
              </button>
            ))}
          </div>

          {/* Stats strip */}
          <div style={{ display: "flex", borderBottom: "1px solid #1a1a1a", flexShrink: 0 }}>
            {[
              { label: "Total", val: stats.total, color: "#555" },
              { label: "Active", val: stats.inprogress, color: "#F59E0B" },
              { label: "Overdue", val: stats.overdue, color: "#EF4444" },
              { label: "Done", val: stats.done, color: "#10B981" },
            ].map((s, i) => (
              <div key={i} style={{ flex: 1, padding: "5px 0", display: "flex", flexDirection: "column", alignItems: "center", borderRight: i < 3 ? "1px solid #1a1a1a" : "none" }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: s.color, fontFamily: "'DM Mono', monospace" }}>{s.val}</span>
                <span style={{ fontSize: 9, color: "#333", fontFamily: "'DM Mono', monospace", letterSpacing: 0.5 }}>{s.label.toUpperCase()}</span>
              </div>
            ))}
          </div>

          {/* APM Section */}
          {appSection === "apm" && (
            <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
              <APMSection />
            </div>
          )}

          {appSection === "ops" && <>

          {/* Overdue / Due Today banner */}
          {(stats.overdue > 0 || stats.dueToday > 0) && page === "tasks" && (
            <div style={{ display: "flex", gap: 0, flexShrink: 0 }}>
              {stats.overdue > 0 && <div style={{ flex: 1, background: "#1a0808", borderBottom: "1px solid #3a1010", padding: "5px 12px", fontSize: 10, color: "#ef4444", fontFamily: "'DM Mono', monospace", textAlign: "center" }}>⚠ {stats.overdue} OVERDUE</div>}
              {stats.dueToday > 0 && <div style={{ flex: 1, background: "#1a1208", borderBottom: "1px solid #3a2a10", padding: "5px 12px", fontSize: 10, color: "#F59E0B", fontFamily: "'DM Mono', monospace", textAlign: "center" }}>📅 {stats.dueToday} DUE TODAY</div>}
            </div>
          )}

          {/* Content */}
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {page === "settings" ? (
              <SettingsPage team={team} onTeamChange={setTeam} />
            ) : page === "dashboard" ? (
              <DashboardPage tasks={tasks} team={team} />
            ) : loading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#333", fontFamily: "'DM Mono', monospace", fontSize: 12, gap: 10 }}>
                <span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>◌</span> Loading...
              </div>
            ) : (
              <MobileKanban filtered={filtered} team={team} onEdit={openEdit} attachmentCounts={attachmentCounts} onStatusChange={async (task, newStatus) => { setTasks(ts => ts.map(t => t.id === task.id ? {...t, status: newStatus} : t)); await supabase.from("tasks").update({ status: newStatus }).eq("id", task.id); }} />
            )}
          </div>

          </> }

          {/* Bottom nav */}
          <div style={{ display: "flex", borderTop: "1px solid #1a1a1a", background: "#0d0d0d", flexShrink: 0 }}>
            {[
              { id: "tasks", icon: "⊞", label: "Tasks" },
              { id: "dashboard", icon: "◈", label: "Stats" },
              { id: "digest", icon: "✉", label: "Digest" },
              { id: "settings", icon: "⚙", label: "Settings" },
              { id: "signout", icon: "⏻", label: "Sign Out" },
            ].map(nav => (
              <button key={nav.id} onClick={() => {
                if (nav.id === "digest") setDigestOpen(true);
                else if (nav.id === "signout") handleSignOut();
                else setPage(nav.id);
              }} style={{ flex: 1, padding: "12px 0 14px", background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <span style={{ fontSize: 18, color: page === nav.id ? "#F97316" : "#444" }}>{nav.icon}</span>
                <span style={{ fontSize: 9.5, fontFamily: "'DM Mono', monospace", color: page === nav.id ? "#F97316" : "#333", letterSpacing: 0.5 }}>{nav.label.toUpperCase()}</span>
              </button>
            ))}
          </div>

          {editTask !== null && <TaskModal task={editTask} isNew={isNew} onClose={closeModal} onSave={handleSave} onDelete={handleDelete} team={team} />}
          {aiOpen && <AIModal onClose={() => setAiOpen(false)} onAdd={handleAiAdd} team={team} />}
          {digestOpen && <DigestModal tasks={tasks} team={team} onClose={() => setDigestOpen(false)} />}
        </div>
      </>
    );
  }

  // ── Desktop layout ─────────────────────────
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
          <div style={{ padding: "16px 14px 12px", borderBottom: "1px solid #1a1a1a" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: "linear-gradient(135deg, #F97316, #ea580c)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 14 }}>⬡</span>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#e5e5e5", letterSpacing: -0.3 }}>FCG / BR OPS</div>
                <div style={{ fontSize: 9.5, color: "#444", fontFamily: "'DM Mono', monospace", letterSpacing: 0.5 }}>OPERATIONS</div>
              </div>
            </div>
            <div style={{ display: "flex", background: "#151515", borderRadius: 6, overflow: "hidden", border: "1px solid #2a2a2a" }}>
              <button onClick={() => setAppSection("ops")} style={{ flex: 1, padding: "6px 0", background: appSection === "ops" ? "#F9731618" : "none", border: "none", color: appSection === "ops" ? "#F97316" : "#444", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono', monospace" }}>OPS BOARD</button>
              <button onClick={() => setAppSection("apm")} style={{ flex: 1, padding: "6px 0", background: appSection === "apm" ? "#3B82F618" : "none", border: "none", color: appSection === "apm" ? "#3B82F6" : "#444", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono', monospace" }}>APM</button>
            </div>
          </div>

          <div style={{ padding: "14px 10px", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
            <div style={{ marginBottom: 16 }}>
              {[["tasks","Tasks","⊞"],["settings","Settings","⚙"]].map(([id, label, icon]) => (
                <button key={id} onClick={() => setPage(id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "7px 8px", borderRadius: 6, cursor: "pointer", background: page === id ? "#F9731615" : "none", border: page === id ? "1px solid #F9731630" : "1px solid transparent", marginBottom: 2, textAlign: "left" }}>
                  <span style={{ fontSize: 13, color: page === id ? "#F97316" : "#444" }}>{icon}</span>
                  <span style={{ fontSize: 12, color: page === id ? "#e5e5e5" : "#555" }}>{label}</span>
                </button>
              ))}
            </div>

            {page === "tasks" && (
              <>
                <div style={{ fontSize: 9.5, color: "#3a3a3a", letterSpacing: 1.2, fontFamily: "'DM Mono', monospace", padding: "0 8px", marginBottom: 8 }}>COMPANIES</div>
                {COMPANIES.map(co => {
                  const count = co.id === "all" ? tasks.length : tasks.filter(t => t.company === co.id).length;
                  const active = activeCompany === co.id;
                  return (
                    <button key={co.id} onClick={() => setActiveCompany(co.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "7px 8px", borderRadius: 6, cursor: "pointer", background: active ? co.color + "15" : "none", border: active ? `1px solid ${co.color}30` : "1px solid transparent", marginBottom: 2, textAlign: "left" }}>
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

            <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid #1a1a1a" }}>
              <button onClick={() => setDigestOpen(true)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 6, cursor: "pointer", background: "#0a1a12", border: "1px solid #10B98130", color: "#10B981", fontSize: 12, fontWeight: 600, fontFamily: "'Syne', sans-serif", marginBottom: 6 }}
                onMouseEnter={e => e.currentTarget.style.background = "#0d2218"}
                onMouseLeave={e => e.currentTarget.style.background = "#0a1a12"}
              >
                <span style={{ fontSize: 14 }}>✉</span> Send Digest
              </button>
              <button onClick={handleSignOut} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 6, cursor: "pointer", background: "none", border: "1px solid #2a2a2a", color: "#444", fontSize: 12, fontFamily: "'Syne', sans-serif" }}
                onMouseEnter={e => e.currentTarget.style.color = "#e5e5e5"}
                onMouseLeave={e => e.currentTarget.style.color = "#444"}
              >
                <span style={{ fontSize: 13 }}>⏻</span> Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* MAIN */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* TOPBAR */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 20px", height: 56, borderBottom: "1px solid #1a1a1a", flexShrink: 0 }}>
            <button onClick={() => setSidebarOpen(s => !s)} style={{ background: "none", border: "none", cursor: "pointer", color: "#444", fontSize: 16, padding: "4px 6px" }}>☰</button>
            {!sidebarOpen && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 20, height: 20, borderRadius: 4, background: "linear-gradient(135deg, #F97316, #ea580c)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>⬡</div>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#e5e5e5" }}>FCG / BR OPS</span>
              </div>
            )}
            {/* Dark mode toggle */}
            <ThemeToggle />
            {/* OPS / APM toggle — always visible */}
            <div style={{ display: "flex", background: "#151515", borderRadius: 6, overflow: "hidden", border: "1px solid #2a2a2a" }}>
              <button onClick={() => setAppSection("ops")} style={{ padding: "5px 12px", background: appSection === "ops" ? "#F9731618" : "none", border: "none", color: appSection === "ops" ? "#F97316" : "#444", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono', monospace" }}>OPS</button>
              <button onClick={() => setAppSection("apm")} style={{ padding: "5px 12px", background: appSection === "apm" ? "#3B82F618" : "none", border: "none", color: appSection === "apm" ? "#3B82F6" : "#444", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono', monospace" }}>APM</button>
            </div>
            <div style={{ flex: 1 }}>
              {appSection === "ops" && page === "tasks" && activeCompany !== "all" && <CompanyBadge companyId={activeCompany} />}
            </div>
            {page === "tasks" && (
              <>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#333", fontSize: 13 }}>⌕</span>
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks..." style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 6, padding: "6px 12px 6px 30px", color: "#aaa", fontSize: 12, fontFamily: "'DM Mono', monospace", outline: "none", width: 190 }} />
                </div>
                <div style={{ display: "flex", background: "#111", border: "1px solid #1e1e1e", borderRadius: 6, overflow: "hidden" }}>
                  {[["kanban","⊞"],["list","≡"]].map(([v, icon]) => (
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

          {/* STATS */}
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

          {/* PAGE */}
          {appSection === "apm" ? (
            <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
              <APMSection />
            </div>
          ) : page === "settings" ? (
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
                          {colTasks.map(t => <TaskCard key={t.id} task={t} onEdit={openEdit} onMouseDownDrag={handleMouseDownDrag} isDragging={draggingId === t.id} team={team} attachmentCounts={attachmentCounts} />)}
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
                    const attachCount = attachmentCounts?.[task.id] || 0;
                    return (
                      <div key={task.id} onClick={() => openEdit(task)} style={{ display: "grid", gridTemplateColumns: "1fr 80px 110px 80px 100px 90px", gap: 10, padding: "11px 14px", borderRadius: 7, cursor: "pointer", background: "#111", border: "1px solid #1a1a1a", marginBottom: 4, alignItems: "center", animation: "slideIn 0.15s ease-out" }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = "#2a2a2a"}
                        onMouseLeave={e => e.currentTarget.style.borderColor = "#1a1a1a"}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                          <span style={{ fontSize: 13, color: "#ddd", fontFamily: "'Syne', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.title}</span>
                          {attachCount > 0 && <span style={{ fontSize: 10, color: "#444", fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>📎{attachCount}</span>}
                        </div>
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
