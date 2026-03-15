import React, { useState, useRef, useEffect, useCallback, useContext } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const N8N_WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL || "";

// ─── AI Model ───────────────────────────────────────────────────────────────
// Single source of truth for every Claude API call in this app.
// Change this one line to upgrade the model across all features simultaneously.
const AI_MODEL = 'claude-sonnet-4-20250514';
// ────────────────────────────────────────────────────────────────────────────

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

// Set CSS vars synchronously - must run before any render
function applyCSSVars(dark) {
  const r = document.documentElement;
  if (dark) {
    r.style.setProperty('--bg',    '#0a0a0a');
    r.style.setProperty('--bg2',   '#0d0d0d');
    r.style.setProperty('--bg3',   '#111111');
    r.style.setProperty('--bg4',   '#151515');
    r.style.setProperty('--bg5',   '#1a1a1a');
    r.style.setProperty('--bd',    '#1a1a1a');
    r.style.setProperty('--bd2',   '#2a2a2a');
    r.style.setProperty('--tx',    '#e5e5e5');
    r.style.setProperty('--tx2',   '#888888');
    r.style.setProperty('--tx3',   '#555555');
    r.style.setProperty('--tx4',   '#444444');
    r.style.setProperty('--inp',   '#0e0e0e');
    r.style.setProperty('--inpbd', 'var(--bd)');
    r.style.setProperty('--inptx', '#e0e0e0');
  } else {
    r.style.setProperty('--bg',    '#f4f4f5');
    r.style.setProperty('--bg2',   '#ffffff');
    r.style.setProperty('--bg3',   '#ffffff');
    r.style.setProperty('--bg4',   '#f9f9f9');
    r.style.setProperty('--bg5',   '#f0f0f0');
    r.style.setProperty('--bd',    '#e4e4e7');
    r.style.setProperty('--bd2',   '#d4d4d8');
    r.style.setProperty('--tx',    '#18181b');
    r.style.setProperty('--tx2',   '#52525b');
    r.style.setProperty('--tx3',   '#71717a');
    r.style.setProperty('--tx4',   '#a1a1aa');
    r.style.setProperty('--inp',   '#ffffff');
    r.style.setProperty('--inpbd', '#d4d4d8');
    r.style.setProperty('--inptx', '#18181b');
  }
}

function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => {
    let isDark = true;
    try { const s = localStorage.getItem("theme"); isDark = s ? s === "dark" : false; } catch {}
    applyCSSVars(isDark); // set vars synchronously on first render
    return isDark;
  });
  const t = {
    bg:   'var(--bg)',   bg2: 'var(--bg2)', bg3: 'var(--bg3)', bg4: 'var(--bg4)', bg5: 'var(--bg5)',
    border: 'var(--bd)', border2: 'var(--bd2)',
    text: 'var(--tx)',  text2: 'var(--tx2)', text3: 'var(--tx3)', text4: 'var(--tx4)', text5: 'var(--tx4)',
    input: 'var(--inp)', inputBorder: 'var(--inpbd)', inputText: 'var(--inptx)',
  };
  const toggle = () => setDark(d => {
    const n = !d;
    applyCSSVars(n);
    try { localStorage.setItem("theme", n ? "dark" : "light"); } catch {}
    return n;
  });
  return <ThemeContext.Provider value={{ dark, toggle, t }}>{children}</ThemeContext.Provider>;
}

const getCompany  = (id) => COMPANIES.find(c => c.id === id) || COMPANIES[1];
const getMember   = (id, team) => (team || []).find(t => t.id === id) || { id, name: id, initials: (id||"?")[0]?.toUpperCase(), color: "var(--tx3)" };
const getPriority = (id) => PRIORITIES.find(p => p.id === id) || PRIORITIES[1];

const labelStyle = {
  display: "block", fontSize: 10.5, fontFamily: "'DM Mono', monospace",
  color: "var(--tx3)", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 5
};
const inputStyle = {
  width: "100%", background: "var(--bg)", border: "1px solid var(--bd)",
  borderRadius: 6, padding: "8px 10px", color: "var(--tx)", fontSize: 13,
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
      background: (member?.color || "var(--tx3)") + "22",
      border: `1.5px solid ${(member?.color || "var(--tx3)")}55`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 700, color: member?.color || "var(--tx3)",
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
      <div style={{ background: "var(--bd)", border: "1px solid #F9731660", borderRadius: 8, padding: "12px 14px" }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
          <CompanyBadge companyId={task.company} small />
          <PriorityDot priorityId={task.priority} />
        </div>
        <div style={{ fontSize: 13, color: "var(--tx)", fontWeight: 500, lineHeight: 1.4, fontFamily: "'Syne', sans-serif" }}>{task.title}</div>
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
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "var(--bg)", border: "1px solid #1e1e1e", borderRadius: 6 }}>
      {isImage ? (
        <img src={att.file_url} alt={att.file_name} style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
      ) : (
        <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
      )}
      <a href={att.file_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#aaa", fontFamily: "'DM Mono', monospace", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none" }}>
        {att.file_name}
      </a>
      {onDelete && (
        <button onClick={() => onDelete(att)} style={{ background: "none", border: "none", color: "var(--tx4)", cursor: "pointer", fontSize: 16, padding: "0 4px", flexShrink: 0 }}>×</button>
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
      style={{ background: "var(--bg3)", border: `1px solid ${isDragging ? "#F9731440" : "var(--bd)"}`, borderRadius: 8, padding: "12px 14px", cursor: isDragging ? "grabbing" : "grab", opacity: isDragging ? 0.25 : 1, transition: "opacity 0.12s, border-color 0.12s", userSelect: "none" }}
    >
      <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
        <CompanyBadge companyId={task.company} small />
        <PriorityDot priorityId={task.priority} />
      </div>
      <div style={{ fontSize: 13.5, color: "var(--tx)", fontWeight: 500, lineHeight: 1.4, marginBottom: 10, fontFamily: "'Syne', sans-serif" }}>{task.title}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Avatar member={member} size={24} />
          {attachCount > 0 && (
            <span style={{ fontSize: 10, color: "var(--tx4)", fontFamily: "'DM Mono', monospace" }}>📎 {attachCount}</span>
          )}
        </div>
        {task.due && (
          <span style={{ fontSize: 10.5, fontFamily: "'DM Mono', monospace", color: isOverdue ? "#EF4444" : "var(--tx3)" }}>
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

function TaskModal({ task, onClose, onSave, onDelete, isNew, team, allProjects = [] }) {
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
      <div style={{ background: "var(--bg3)", border: "1px solid var(--bd2)", borderRadius: isMobile ? "16px 16px 0 0" : 12, padding: isMobile ? "24px 20px 32px" : 28, width: "100%", maxWidth: isMobile ? "100%" : 540, boxShadow: "0 24px 80px rgba(0,0,0,0.7)", maxHeight: isMobile ? "92vh" : "88vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 17, fontWeight: 700, color: "var(--tx)" }}>{isNew ? "New Task" : "Edit Task"}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--tx3)", cursor: "pointer", fontSize: 22, padding: "0 4px" }}>×</button>
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
              <div style={{ padding: "10px 12px", background: "var(--bg)", border: "1px dashed #252525", borderRadius: 6, fontSize: 11, color: "var(--tx4)", fontFamily: "'DM Mono', monospace" }}>
                Save the task first, then reopen it to add attachments
              </div>
            ) : (
              <>
                <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" onChange={handleFileUpload} style={{ display: "none" }} />
                <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleFileUpload} style={{ display: "none" }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ flex: 1, padding: "10px 0", background: "var(--bg)", border: "1px dashed #2a2a2a", borderRadius: 6, color: uploading ? "var(--tx3)" : "var(--tx2)", cursor: uploading ? "not-allowed" : "pointer", fontSize: 12, fontFamily: "'DM Mono', monospace", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    {uploading ? <><span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>◌</span> Uploading...</> : "📎 Files"}
                  </button>
                  <button onClick={() => cameraRef.current?.click()} disabled={uploading} style={{ padding: "10px 16px", background: "var(--bg)", border: "1px dashed #2a2a2a", borderRadius: 6, color: uploading ? "var(--tx3)" : "var(--tx2)", cursor: uploading ? "not-allowed" : "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    📷
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "space-between", flexWrap: "wrap" }}>
          {!isNew && <button onClick={() => onDelete(form.id)} style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", padding: "10px 16px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>Delete</button>}
          <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
            <button onClick={onClose} style={{ background: "none", border: "1px solid var(--bd2)", color: "var(--tx2)", padding: "10px 18px", borderRadius: 6, cursor: "pointer", fontSize: 14, fontFamily: "'Syne', sans-serif" }}>Cancel</button>
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
      <div style={{ background: "var(--bg3)", border: "1px solid var(--bd2)", borderRadius: isMobile ? "16px 16px 0 0" : 12, padding: isMobile ? "24px 20px 32px" : 28, width: "100%", maxWidth: isMobile ? "100%" : 460, boxShadow: "0 24px 80px rgba(0,0,0,0.7)", maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 17, fontWeight: 700, color: "var(--tx)" }}>{isNew ? "Add Team Member" : "Edit Member"}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--tx3)", cursor: "pointer", fontSize: 22 }}>×</button>
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
                <span style={{ fontSize: 10, color: "var(--tx4)", fontFamily: "'DM Mono', monospace" }}>custom</span>
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "space-between" }}>
          {!isNew && <button onClick={() => onDelete(form.id)} style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", padding: "10px 16px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>Remove</button>}
          <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
            <button onClick={onClose} style={{ background: "none", border: "1px solid var(--bd2)", color: "var(--tx2)", padding: "10px 18px", borderRadius: 6, cursor: "pointer", fontSize: 14, fontFamily: "'Syne', sans-serif" }}>Cancel</button>
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
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--tx)", fontFamily: "'Syne', sans-serif", marginBottom: 4 }}>Settings</h1>
          <p style={{ fontSize: 12, color: "var(--tx4)", fontFamily: "'DM Mono', monospace" }}>Manage your team, contact info, and preferences</p>
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
              <div key={member.id} onClick={() => openEdit(member)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: "var(--bg3)", border: "1px solid #1a1a1a", borderRadius: 10, cursor: "pointer" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "var(--bd2)"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "var(--bg5)"}
              >
                <Avatar member={member} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--tx)", fontFamily: "'Syne', sans-serif" }}>{member.name}</span>
                    {member.role && <span style={{ fontSize: 10, color: "var(--tx4)", fontFamily: "'DM Mono', monospace", background: "var(--bg5)", padding: "2px 6px", borderRadius: 4 }}>{member.role}</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: member.email ? "var(--tx3)" : "var(--bd2)", fontFamily: "'DM Mono', monospace", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
              <div key={co.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "var(--bg3)", border: "1px solid #1a1a1a", borderRadius: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: co.color }} />
                <span style={{ fontSize: 13, color: "#bbb", fontFamily: "'Syne', sans-serif", flex: 1 }}>{co.name}</span>
                <span style={{ fontSize: 10, color: "#333", fontFamily: "'DM Mono', monospace", background: "var(--bg5)", padding: "2px 6px", borderRadius: 4 }}>{co.short}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Digest */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#aaa", fontFamily: "'Syne', sans-serif", marginBottom: 6 }}>Email Digest</div>
          <div style={{ padding: "14px 16px", background: "var(--bg3)", border: "1px solid #1a1a1a", borderRadius: 8, display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              ["Schedule", "Weekdays 8:00 AM"],
              ["Individual emails", "Each member gets their own open tasks"],
              ["Summary email", "Keaton receives full team overview"],
              ["Manual trigger", "Send Digest button in sidebar"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 11.5, color: "var(--tx3)", fontFamily: "'DM Mono', monospace" }}>{k}</span>
                <span style={{ fontSize: 11.5, color: "var(--tx2)", fontFamily: "'Syne', sans-serif", textAlign: "right" }}>{v}</span>
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
          model: AI_MODEL,
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
      <div style={{ background: "var(--bg3)", border: "1px solid var(--bd2)", borderRadius: isMobile ? "16px 16px 0 0" : 14, padding: isMobile ? "24px 20px 32px" : 28, width: "100%", maxWidth: isMobile ? "100%" : 540, boxShadow: "0 24px 80px rgba(0,0,0,0.7)", maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #a855f7, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>✦</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--tx)", fontFamily: "'Syne', sans-serif" }}>AI Task Add</div>
              <div style={{ fontSize: 10, color: "var(--tx4)", fontFamily: "'DM Mono', monospace" }}>describe it, we'll structure it</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--tx3)", cursor: "pointer", fontSize: 22 }}>×</button>
        </div>
        <div style={{ position: "relative" }}>
          <textarea ref={inputRef} value={prompt} onChange={e => { setPrompt(e.target.value); setPreview(null); setError(""); }}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !isMobile) { e.preventDefault(); parse(); } }}
            placeholder={`e.g. "Keaton follow up with FMGI, high priority FCG, due Friday"`}
            style={{ width: "100%", background: "var(--bg)", border: `1px solid ${listening ? "#a855f7" : "var(--bd2)"}`, borderRadius: 8, padding: "12px 44px 12px 14px", color: "var(--tx)", fontSize: 14, fontFamily: "'Syne', sans-serif", outline: "none", resize: "none", minHeight: 90, boxSizing: "border-box", lineHeight: 1.5, transition: "border-color 0.2s" }}
          />
          <button onClick={listening ? stopVoice : startVoice} disabled={transcribing} title={listening ? "Stop" : transcribing ? "Transcribing..." : "Speak"}
            style={{ position: "absolute", right: 10, top: 10, background: listening ? "linear-gradient(135deg,#7c3aed,#a855f7)" : "var(--bg5)", border: `1px solid ${listening ? "#a855f7" : "#333"}`, borderRadius: 7, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: transcribing ? "not-allowed" : "pointer", fontSize: 15, transition: "all 0.2s", boxShadow: listening ? "0 0 12px rgba(168,85,247,0.5)" : "none", opacity: transcribing ? 0.4 : 1 }}>
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
          <div style={{ marginTop: 16, background: "var(--bg2)", border: "1px solid #1e1e1e", borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 10, color: "var(--tx3)", fontFamily: "'DM Mono', monospace", letterSpacing: 0.8, marginBottom: 12 }}>PARSED — LOOKS GOOD?</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--tx)", fontFamily: "'Syne', sans-serif", marginBottom: 12, lineHeight: 1.4 }}>{preview.title}</div>
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
            {preview.description && <div style={{ fontSize: 11, color: "var(--tx3)", fontFamily: "'DM Mono', monospace", borderTop: "1px solid #1a1a1a", paddingTop: 10 }}>{preview.description}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={() => setPreview(null)} style={{ flex: 1, background: "none", border: "1px solid var(--bd2)", color: "var(--tx2)", padding: "10px 0", borderRadius: 6, cursor: "pointer", fontSize: 13, fontFamily: "'Syne', sans-serif" }}>← Re-parse</button>
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
      <div style={{ background: "var(--bg3)", border: "1px solid var(--bd2)", borderRadius: isMobile ? "16px 16px 0 0" : 14, padding: isMobile ? "24px 20px 32px" : 28, width: "100%", maxWidth: isMobile ? "100%" : 560, boxShadow: "0 24px 80px rgba(0,0,0,0.7)", maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #10B981, #059669)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>✉</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--tx)", fontFamily: "'Syne', sans-serif" }}>Send Daily Digest</div>
              <div style={{ fontSize: 10, color: "var(--tx4)", fontFamily: "'DM Mono', monospace" }}>{openTasks.length} open tasks · {perPerson.length} members</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--tx3)", cursor: "pointer", fontSize: 22 }}>×</button>
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
                <div key={member.id} style={{ background: "var(--bg2)", border: "1px solid #1e1e1e", borderRadius: 8, padding: "12px 14px", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <Avatar member={member} size={24} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#ddd", fontFamily: "'Syne', sans-serif" }}>{member.name}</span>
                    {member.email && <span style={{ fontSize: 10, color: "var(--tx4)", fontFamily: "'DM Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{member.email}</span>}
                    <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--tx4)", fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>{member.tasks.length} task{member.tasks.length !== 1 ? "s" : ""}</span>
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
                    style={{ background: 'var(--bg3)', border: `1px solid ${draggingId === task.id ? 'rgba(249,115,22,0.3)' : 'var(--bd)'}`, borderRadius: 7, padding: '8px 9px', marginBottom: 5, opacity: draggingId === task.id ? 0.25 : 1, transition: 'opacity 0.1s', userSelect: 'none', touchAction: 'none' }}>
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
                <div style={{ border: '1px dashed #1a1a1a', borderRadius: 7, padding: '14px 0', textAlign: 'center', color: 'var(--bd)', fontSize: 10, fontFamily: "'DM Mono', monospace" }}>empty</div>
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
    <div style={{ background: "var(--bg3)", border: "1px solid #1e1e1e", borderRadius: 10, padding: "16px 18px", flex: 1, minWidth: 100 }}>
      <div style={{ fontSize: 28, fontWeight: 800, color, fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>{val}</div>
      <div style={{ fontSize: 10, color: "var(--tx3)", fontFamily: "'DM Mono', monospace", letterSpacing: 0.8, marginTop: 5, textTransform: "uppercase" }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: "#333", fontFamily: "'DM Mono', monospace", marginTop: 2 }}>{sub}</div>}
    </div>
  );

  const maxOpen = Math.max(...byPerson.map(m => m.open), 1);

  return (
    <div style={{ padding: "20px 20px 80px", overflowY: "auto", height: "100%", fontFamily: "'Syne', sans-serif" }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--tx)", marginBottom: 16 }}>Overview</div>

      {/* Stat cards */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {statCard("Total Open", open.length, "var(--tx)")}
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
            <div key={t.id} style={{ fontSize: 12, color: "var(--tx)", padding: "4px 0", borderBottom: "1px solid #1e1e1e", display: "flex", justifyContent: "space-between" }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{t.title}</span>
              <span style={{ color: "#ef4444", fontSize: 10, fontFamily: "'DM Mono', monospace", flexShrink: 0, marginLeft: 8 }}>{new Date(t.due+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>
            </div>
          ))}
          {overdue.length > 5 && <div style={{ fontSize: 10, color: "var(--tx3)", marginTop: 6, fontFamily: "'DM Mono', monospace" }}>+{overdue.length - 5} more</div>}
        </div>
      )}

      {/* Workload by person */}
      {byPerson.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--tx3)", fontFamily: "'DM Mono', monospace", letterSpacing: 1, marginBottom: 10, textTransform: "uppercase" }}>Workload by Person</div>
          {byPerson.map(m => (
            <div key={m.id} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: m.color || "var(--tx3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#000", flexShrink: 0 }}>{m.initials || m.name[0]}</div>
                <span style={{ fontSize: 12, color: "#ccc", flex: 1 }}>{m.name}</span>
                <span style={{ fontSize: 10, color: "var(--tx3)", fontFamily: "'DM Mono', monospace" }}>{m.open} open{m.overdue > 0 ? ` · ${m.overdue} overdue` : ""}</span>
              </div>
              <div style={{ background: "var(--bg5)", borderRadius: 3, height: 5, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 3, background: m.overdue > 0 ? "#EF4444" : (m.color || "#F97316"), width: `${(m.open / maxOpen) * 100}%`, transition: "width 0.3s" }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* By project */}
      {byProject.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--tx3)", fontFamily: "'DM Mono', monospace", letterSpacing: 1, marginBottom: 10, textTransform: "uppercase" }}>By Project</div>
          {byProject.map(p => (
            <div key={p.name} style={{ background: "var(--bg3)", border: "1px solid #1e1e1e", borderRadius: 8, padding: "10px 14px", marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 12, color: "var(--tx)", marginBottom: 2 }}>{p.name}</div>
                <div style={{ fontSize: 10, color: "var(--tx4)", fontFamily: "'DM Mono', monospace" }}>{p.total} total · {p.done} done</div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {p.overdue > 0 && <span style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", borderRadius: 5, padding: "2px 7px", fontSize: 10, fontFamily: "'DM Mono', monospace" }}>{p.overdue} overdue</span>}
                <span style={{ background: "var(--bg5)", color: "var(--tx3)", borderRadius: 5, padding: "2px 7px", fontSize: 10, fontFamily: "'DM Mono', monospace" }}>{p.open} open</span>
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
  co: ["proposed","ATP","Contract","rejected"],
  material: ["pending","ordered","partial","delivered","cancelled"],
};

const STATUS_COLORS = {
  active:"#10B981", on_hold:"#F59E0B", complete:"#3B82F6", cancelled:"var(--tx3)",
  open:"#F59E0B", answered:"#10B981", closed:"var(--tx3)",
  pending:"#F59E0B", submitted:"#3B82F6", approved:"#10B981", rejected:"#EF4444", revise_resubmit:"#F97316",
  ordered:"#3B82F6", partial:"#F59E0B", delivered:"#10B981",
  void:"var(--tx3)", ATP:"#3B82F6", Contract:"#10B981", proposed:"#F59E0B",
};

const fmtDate = d => d ? new Date(d+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"2-digit"}) : "—";
const fmtMoney = v => v != null ? "$"+Number(v).toLocaleString("en-US",{minimumFractionDigits:0}) : "—";

function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] || "var(--tx3)";
  return <span style={{ background: color+"20", color, border:`1px solid ${color}40`, borderRadius:5, padding:"2px 7px", fontSize:10, fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:0.5, whiteSpace:"nowrap" }}>{(status||"").replace(/_/g," ")}</span>;
}

function APMModal({ title, children, onClose, width=540 }) {
  const isMobile = useIsMobile();
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", display:"flex", alignItems:isMobile?"flex-end":"center", justifyContent:"center", zIndex:1000, padding:isMobile?0:20 }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:"var(--bg3)", border:"1px solid var(--bd2)", borderRadius:isMobile?"16px 16px 0 0":12, padding:isMobile?"24px 20px 32px":28, width:"100%", maxWidth:isMobile?"100%":width, boxShadow:"0 24px 80px rgba(0,0,0,0.7)", maxHeight:isMobile?"92vh":"88vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <span style={{ fontSize:16, fontWeight:700, color:"var(--tx)", fontFamily:"'Syne',sans-serif" }}>{title}</span>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"var(--tx3)", cursor:"pointer", fontSize:22 }}>×</button>
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
  const [confirming, setConfirming] = useState(false);
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
          <div style={{ fontSize:10, color:"var(--tx)", fontFamily:"'DM Mono',monospace", letterSpacing:0.8, marginBottom:10 }}>GC / OWNER CONTACT</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <APMField label="GC / Owner"><input value={form.gc_name||""} onChange={e=>set("gc_name",e.target.value)} placeholder="Company name" style={{...inputStyle,fontSize:14}} /></APMField>
            <APMField label="Contact Name"><input value={form.gc_contact||""} onChange={e=>set("gc_contact",e.target.value)} placeholder="Name" style={{...inputStyle,fontSize:14}} /></APMField>
            <APMField label="Email"><input value={form.gc_email||""} onChange={e=>set("gc_email",e.target.value)} placeholder="email@co.com" type="email" style={{...inputStyle,fontSize:14}} /></APMField>
            <APMField label="Phone"><input value={form.gc_phone||""} onChange={e=>set("gc_phone",e.target.value)} placeholder="(555) 000-0000" style={{...inputStyle,fontSize:14}} /></APMField>
          </div>
        </div>
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", gap:8, marginTop:20 }}>
        <div>
          {!isNew && <button onClick={()=>setConfirming(true)} style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.25)", color:"#ef4444", padding:"9px 14px", borderRadius:6, cursor:"pointer", fontSize:12 }}>Delete Project</button>}
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={onClose} style={{ background:"none", border:"1px solid var(--bd2)", color:"var(--tx2)", padding:"9px 18px", borderRadius:6, cursor:"pointer", fontSize:13 }}>Cancel</button>
          <button onClick={handleSave} disabled={saving||!form.name.trim()} style={{ background:"#F97316", border:"none", color:"#000", padding:"9px 22px", borderRadius:6, cursor:"pointer", fontSize:13, fontWeight:700, opacity:form.name.trim()&&!saving?1:0.5 }}>{saving?"Saving...":isNew?"Create Project":"Save"}</button>
        </div>
      </div>
      {confirming && <ConfirmDialog message={`Delete "${form.name}"? This will permanently remove the project and all associated data.`} onConfirm={async()=>{ await supabase.from("projects").delete().eq("id",project.id); onSave(null,"delete"); }} onCancel={()=>setConfirming(false)} />}
    </APMModal>
  );
}

// ── Daily Log Modal ────────────────────────────────────
function DailyLogModal({ log, projectId, onSave, onClose }) {
  const isNew = !log?.id;
  const [form, setForm] = useState({ log_date:new Date().toISOString().slice(0,10), weather:"", crew_count:"", work_performed:"", issues:"", ...(log||{}), project_id:projectId });
  const [saving, setSaving] = useState(false);
  const [delConfirm, setDelConfirm] = useState(false);
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
        {!isNew && <button onClick={()=>setDelConfirm(true)} style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.25)", color:"#ef4444", padding:"9px 14px", borderRadius:6, cursor:"pointer", fontSize:12 }}>Delete</button>}
        <div style={{ display:"flex", gap:8, marginLeft:"auto" }}>
          <button onClick={onClose} style={{ background:"none", border:"1px solid var(--bd2)", color:"var(--tx2)", padding:"9px 18px", borderRadius:6, cursor:"pointer", fontSize:13 }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ background:"#F97316", border:"none", color:"#000", padding:"9px 22px", borderRadius:6, cursor:"pointer", fontSize:13, fontWeight:700 }}>{saving?"Saving...":isNew?"Add Log":"Save"}</button>
        </div>
      </div>

      {delConfirm && <ConfirmDialog message="Delete this Daily Log? This cannot be undone." onConfirm={async()=>{ await supabase.from("daily_logs").delete().eq("id",log.id); setDelConfirm(false); onSave(null,true); }} onCancel={()=>setDelConfirm(false)} />}
    </APMModal>
  );
}

// ── Confirm Dialog ────────────────────────────────────
function ConfirmDialog({ message, onConfirm, onCancel, danger=true }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999 }}
      onClick={onCancel}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"var(--bg3)", border:"1px solid var(--bd2)", borderRadius:12, padding:28, maxWidth:360, width:"90%", boxShadow:"0 20px 60px rgba(0,0,0,0.6)" }}>
        <div style={{ fontSize:14, color:"var(--tx)", marginBottom:22, lineHeight:1.5 }}>{message}</div>
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button onClick={onCancel} style={{ background:"none", border:"1px solid var(--bd2)", color:"var(--tx2)", padding:"8px 18px", borderRadius:6, cursor:"pointer", fontSize:13 }}>Cancel</button>
          <button onClick={onConfirm} style={{ background:danger?"rgba(239,68,68,0.08)":"rgba(16,185,129,0.08)", border:danger?"1px solid rgba(239,68,68,0.3)":"1px solid rgba(16,185,129,0.3)", color:danger?"#ef4444":"#10B981", padding:"8px 20px", borderRadius:6, cursor:"pointer", fontSize:13, fontWeight:700 }}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── Reusable File Upload Zone ─────────────────────────
function FileUploadZone({ fileUrl, fileName, folder, onUploaded, accept="image/*,application/pdf,.doc,.docx" }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${folder}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("attachments").upload(path, file, { upsert: true });
    if (error) { setUploading(false); alert("Upload failed: " + error.message); return; }
    const { data: urlData } = supabase.storage.from("attachments").getPublicUrl(path);
    onUploaded(urlData.publicUrl, file.name);
    setUploading(false);
  };

  return (
    <div
      onClick={() => fileRef.current?.click()}
      onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor="#F97316"; }}
      onDragLeave={e => e.currentTarget.style.borderColor="var(--bd2)"}
      onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor="var(--bd2)"; const f=e.dataTransfer.files[0]; if(f) handleFile(f); }}
      style={{ border:"2px dashed #2a2a2a", borderRadius:8, padding:"12px 16px", cursor:"pointer", display:"flex", alignItems:"center", gap:12, transition:"border-color 0.15s", background:"var(--bg)" }}
      onMouseEnter={e => e.currentTarget.style.borderColor="#F97316"}
      onMouseLeave={e => e.currentTarget.style.borderColor= fileUrl ? "#3a3a3a" : "var(--bd2)"}
    >
      <input ref={fileRef} type="file" accept={accept} style={{ display:"none" }} onChange={e => handleFile(e.target.files[0])} />
      {uploading ? (
        <><span style={{ animation:"spin 0.8s linear infinite", display:"inline-block", color:"#F97316" }}>◌</span><span style={{ fontSize:12, color:"#F97316", fontFamily:"'DM Mono',monospace" }}>Uploading...</span></>
      ) : fileUrl ? (
        <>
          <span style={{ fontSize:20 }}>{fileUrl.match(/\.(jpg|jpeg|png|gif|webp)/i) ? "🖼" : "📄"}</span>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:12, color:"var(--tx)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{fileName || "Attached file"}</div>
            <div style={{ fontSize:10, color:"var(--tx)", fontFamily:"'DM Mono',monospace", marginTop:2 }}>Click to replace · <a href={fileUrl} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{ color:"#F97316", textDecoration:"none" }}>Open ↗</a></div>
          </div>
        </>
      ) : (
        <>
          <span style={{ fontSize:20 }}>📎</span>
          <div>
            <div style={{ fontSize:12, color:"var(--tx2)" }}>Attach file</div>
            <div style={{ fontSize:10, color:"var(--tx)", fontFamily:"'DM Mono',monospace", marginTop:2 }}>PDF, image, doc — drag or click</div>
          </div>
        </>
      )}
    </div>
  );
}

function RFIModal({ rfi, projectId, onSave, onClose }) {
  const isNew = !rfi?.id;
  const [form, setForm] = useState({ rfi_number:"", subject:"", sent_to:"", date_sent:new Date().toISOString().slice(0,10), date_due:"", status:"open", response:"", file_url:"", file_name:"", ...(rfi||{}), project_id:projectId });
  const [saving, setSaving] = useState(false);
  const [delConfirm, setDelConfirm] = useState(false);
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
        <APMField label="Attachment">
          <FileUploadZone fileUrl={form.file_url} fileName={form.file_name} folder={`rfis/${projectId}`} onUploaded={(url,name)=>{ set("file_url",url); set("file_name",name); }} />
        </APMField>
      </div>
      <div style={{ display:"flex", gap:8, marginTop:20, justifyContent:"space-between" }}>
        {!isNew && <button onClick={()=>setDelConfirm(true)} style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.25)", color:"#ef4444", padding:"9px 14px", borderRadius:6, cursor:"pointer", fontSize:12 }}>Delete</button>}
        <div style={{ display:"flex", gap:8, marginLeft:"auto" }}>
          <button onClick={onClose} style={{ background:"none", border:"1px solid var(--bd2)", color:"var(--tx2)", padding:"9px 18px", borderRadius:6, cursor:"pointer", fontSize:13 }}>Cancel</button>
          <button onClick={handleSave} disabled={saving||!form.subject.trim()} style={{ background:"#F97316", border:"none", color:"#000", padding:"9px 22px", borderRadius:6, cursor:"pointer", fontSize:13, fontWeight:700, opacity:form.subject.trim()&&!saving?1:0.5 }}>{saving?"Saving...":isNew?"Add RFI":"Save"}</button>
        </div>
      </div>

      {delConfirm && <ConfirmDialog message="Delete this RFI? This cannot be undone." onConfirm={async()=>{ await supabase.from("rfis").delete().eq("id",rfi.id); setDelConfirm(false); onSave(null,true); }} onCancel={()=>setDelConfirm(false)} />}
    </APMModal>
  );
}

// ── Submittal Modal ────────────────────────────────────
function SubmittalModal({ submittal, projectId, onSave, onClose }) {
  const isNew = !submittal?.id;
  const [form, setForm] = useState({ submittal_number:"", description:"", sent_to:"", date_sent:new Date().toISOString().slice(0,10), date_due:"", status:"pending", file_url:"", file_name:"", ...(submittal||{}), project_id:projectId });
  const [saving, setSaving] = useState(false);
  const [delConfirm, setDelConfirm] = useState(false);
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
        <APMField label="Attachment">
          <FileUploadZone fileUrl={form.file_url} fileName={form.file_name} folder={`submittals/${projectId}`} onUploaded={(url,name)=>{ set("file_url",url); set("file_name",name); }} />
        </APMField>
      </div>
      <div style={{ display:"flex", gap:8, marginTop:20, justifyContent:"space-between" }}>
        {!isNew && <button onClick={()=>setDelConfirm(true)} style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.25)", color:"#ef4444", padding:"9px 14px", borderRadius:6, cursor:"pointer", fontSize:12 }}>Delete</button>}
        <div style={{ display:"flex", gap:8, marginLeft:"auto" }}>
          <button onClick={onClose} style={{ background:"none", border:"1px solid var(--bd2)", color:"var(--tx2)", padding:"9px 18px", borderRadius:6, cursor:"pointer", fontSize:13 }}>Cancel</button>
          <button onClick={handleSave} disabled={saving||!form.description.trim()} style={{ background:"#F97316", border:"none", color:"#000", padding:"9px 22px", borderRadius:6, cursor:"pointer", fontSize:13, fontWeight:700, opacity:form.description.trim()&&!saving?1:0.5 }}>{saving?"Saving...":isNew?"Add Submittal":"Save"}</button>
        </div>
      </div>

      {delConfirm && <ConfirmDialog message="Delete this Submittal? This cannot be undone." onConfirm={async()=>{ await supabase.from("submittals").delete().eq("id",submittal.id); setDelConfirm(false); onSave(null,true); }} onCancel={()=>setDelConfirm(false)} />}
    </APMModal>
  );
}

// ── Change Order Modal ─────────────────────────────────
function COModal({ co, projectId, onSave, onClose }) {
  const isNew = !co?.id;
  const [form, setForm] = useState({ co_number:"", description:"", amount:"", status:"proposed", date_submitted:new Date().toISOString().slice(0,10), date_approved:"", file_url:"", file_name:"", ...(co||{}), project_id:projectId });
  const [saving, setSaving] = useState(false);
  const [delConfirm, setDelConfirm] = useState(false);
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
          <APMField label="Date Approved/Contract"><input type="date" value={form.date_approved||""} onChange={e=>set("date_approved",e.target.value)} style={{...inputStyle,fontSize:14}} /></APMField>
        </div>
        <APMField label="Attachment">
          <FileUploadZone fileUrl={form.file_url} fileName={form.file_name} folder={`change_orders/${projectId}`} onUploaded={(url,name)=>{ set("file_url",url); set("file_name",name); }} />
        </APMField>
      </div>
      <div style={{ display:"flex", gap:8, marginTop:20, justifyContent:"space-between" }}>
        {!isNew && <button onClick={()=>setDelConfirm(true)} style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.25)", color:"#ef4444", padding:"9px 14px", borderRadius:6, cursor:"pointer", fontSize:12 }}>Delete</button>}
        <div style={{ display:"flex", gap:8, marginLeft:"auto" }}>
          <button onClick={onClose} style={{ background:"none", border:"1px solid var(--bd2)", color:"var(--tx2)", padding:"9px 18px", borderRadius:6, cursor:"pointer", fontSize:13 }}>Cancel</button>
          <button onClick={handleSave} disabled={saving||!form.description.trim()} style={{ background:"#F97316", border:"none", color:"#000", padding:"9px 22px", borderRadius:6, cursor:"pointer", fontSize:13, fontWeight:700, opacity:form.description.trim()&&!saving?1:0.5 }}>{saving?"Saving...":isNew?"Add CO":"Save"}</button>
        </div>
      </div>

      {delConfirm && <ConfirmDialog message="Delete this Change Order? This cannot be undone." onConfirm={async()=>{ await supabase.from("change_orders").delete().eq("id",co.id); setDelConfirm(false); onSave(null,true); }} onCancel={()=>setDelConfirm(false)} />}
    </APMModal>
  );
}

// ── Material Order Modal ───────────────────────────────
function MaterialModal({ material, projectId, onSave, onClose }) {
  const isNew = !material?.id;
  const [form, setForm] = useState({ item:"", supplier:"", quantity:"", unit_cost:"", total_cost:"", order_date:new Date().toISOString().slice(0,10), eta:"", status:"pending", notes:"", ...(material||{}), project_id:projectId });
  const [saving, setSaving] = useState(false);
  const [delConfirm, setDelConfirm] = useState(false);
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
        {!isNew && <button onClick={()=>setDelConfirm(true)} style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.25)", color:"#ef4444", padding:"9px 14px", borderRadius:6, cursor:"pointer", fontSize:12 }}>Delete</button>}
        <div style={{ display:"flex", gap:8, marginLeft:"auto" }}>
          <button onClick={onClose} style={{ background:"none", border:"1px solid var(--bd2)", color:"var(--tx2)", padding:"9px 18px", borderRadius:6, cursor:"pointer", fontSize:13 }}>Cancel</button>
          <button onClick={handleSave} disabled={saving||!form.item.trim()} style={{ background:"#F97316", border:"none", color:"#000", padding:"9px 22px", borderRadius:6, cursor:"pointer", fontSize:13, fontWeight:700, opacity:form.item.trim()&&!saving?1:0.5 }}>{saving?"Saving...":isNew?"Add Order":"Save"}</button>
        </div>
      </div>

      {delConfirm && <ConfirmDialog message="Delete this Material Order? This cannot be undone." onConfirm={async()=>{ await supabase.from("material_orders").delete().eq("id",material.id); setDelConfirm(false); onSave(null,true); }} onCancel={()=>setDelConfirm(false)} />}
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
            model: AI_MODEL,
            max_tokens: 300,
            system: `You extract receipt data. Respond ONLY with valid JSON, no markdown, no explanation. Format: {"vendor":"string","amount":number_or_null,"date":"YYYY-MM-DD_or_null","category":"one of: Labor,Concrete,Rebar/Steel,Formwork,Equipment Rental,Subcontractor,Fuel,Tools/Supplies,Permits/Fees,Other","notes":"string - list the key items purchased, e.g. 2x4 lumber x40, concrete mix x10 bags, rebar #4 x20"}. For notes, extract the actual line items from the receipt. Keep it concise but specific - what was bought, quantities if visible. Max 120 chars.`,
            messages: [{ role:"user", content:[
              { type:"image", source:{ type:"base64", media_type:mediaType, data:base64 }},
              { type:"text", text:"Extract vendor, total amount, date, best-fit category, and a concise summary of what was purchased (line items with quantities) for the notes field." }
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
            notes: extracted.notes || f.notes,
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
          style={{ border:"2px dashed #2a2a2a", borderRadius:10, padding:preview?"8px":"28px 20px", textAlign:"center", cursor:"pointer", background:"var(--bg2)", position:"relative", transition:"border-color 0.15s" }}
          onMouseEnter={e=>e.currentTarget.style.borderColor="#F97316"}
          onMouseLeave={e=>e.currentTarget.style.borderColor="var(--bd2)"}
          onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor="#F97316"}}
          onDragLeave={e=>e.currentTarget.style.borderColor="var(--bd2)"}
          onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)handleFile(f);}}
        >
          <input ref={fileRef} type="file" accept="image/*,application/pdf" capture="environment" style={{ display:"none" }} onChange={e=>handleFile(e.target.files[0])} />
          {preview ? (
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              {preview.match(/\.(jpg|jpeg|png|gif|webp)/i) ? (
                <img src={preview} style={{ width:80, height:60, objectFit:"cover", borderRadius:6, border:"1px solid var(--bd2)" }} />
              ) : (
                <div style={{ width:80, height:60, background:"var(--bg5)", borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24 }}>📄</div>
              )}
              <div style={{ textAlign:"left" }}>
                <div style={{ fontSize:12, color:"var(--tx)" }}>{form.file_name}</div>
                {extracting && <div style={{ fontSize:11, color:"#F97316", marginTop:4 }}>⚡ Extracting data...</div>}
                {!extracting && <div style={{ fontSize:11, color:"var(--tx3)", marginTop:4 }}>Click to replace</div>}
              </div>
            </div>
          ) : (
            <>
              {uploading ? (
                <div style={{ fontSize:12, color:"#F97316" }}>Uploading...</div>
              ) : (
                <>
                  <div style={{ fontSize:28, marginBottom:8 }}>📷</div>
                  <div style={{ fontSize:13, color:"var(--tx2)" }}>Tap to upload receipt</div>
                  <div style={{ fontSize:11, color:"var(--tx4)", marginTop:4 }}>Photo, image, or PDF · Auto-extracts data</div>
                </>
              )}
            </>
          )}
        </div>

        {extracting && (
          <div style={{ background:"rgba(16,185,129,0.08)", border:"1px solid rgba(16,185,129,0.2)", borderRadius:8, padding:"10px 14px", fontSize:12, color:"#10B981", display:"flex", alignItems:"center", gap:8 }}>
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
            style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.25)", color:"#ef4444", padding:"9px 14px", borderRadius:6, cursor:"pointer", fontSize:12 }}>Delete</button>
        )}
        <div style={{ display:"flex", gap:8, marginLeft:"auto" }}>
          <button onClick={onClose} style={{ background:"none", border:"1px solid var(--bd2)", color:"var(--tx2)", padding:"9px 18px", borderRadius:6, cursor:"pointer", fontSize:13 }}>Cancel</button>
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
  const [delConfirm, setDelConfirm] = useState(false);
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
              model:AI_MODEL, max_tokens:400,
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
          <div style={{ background:"rgba(16,185,129,0.08)", border:"1px solid rgba(16,185,129,0.2)", borderRadius:8, padding:"10px 14px", fontSize:12, color:"#10B981", display:"flex", alignItems:"center", gap:8 }}>
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
        {!isNew && <button onClick={()=>setDelConfirm(true)} style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.25)", color:"#ef4444", padding:"9px 14px", borderRadius:6, cursor:"pointer", fontSize:12 }}>Delete</button>}
        <div style={{ display:"flex", gap:8, marginLeft:"auto" }}>
          <button onClick={onClose} style={{ background:"none", border:`1px solid ${t.border2}`, color:t.text3, padding:"9px 18px", borderRadius:6, cursor:"pointer", fontSize:13 }}>Cancel</button>
          <button onClick={handleSave} disabled={saving||uploading||extracting||!form.sub_name.trim()} style={{ background:"#F97316", border:"none", color:"#000", padding:"9px 22px", borderRadius:6, cursor:"pointer", fontSize:13, fontWeight:700, opacity:form.sub_name.trim()&&!saving?1:0.5 }}>{saving?"Saving...":isNew?"Add Sub/PO":"Save"}</button>
        </div>
      </div>

      {delConfirm && <ConfirmDialog message="Delete this Subcontract? This cannot be undone." onConfirm={async()=>{ await supabase.from("subcontracts").delete().eq("id",sub.id); setDelConfirm(false); onSave(null,true); }} onCancel={()=>setDelConfirm(false)} />}
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


// ── Schedule Gantt ─────────────────────────────────────
const SCHEDULE_STATUSES = [
  { id:"not_started", label:"Not Started", color:"var(--tx3)" },
  { id:"in_progress", label:"In Progress", color:"#F59E0B" },
  { id:"complete",    label:"Complete",    color:"#10B981" },
  { id:"blocked",     label:"Blocked",     color:"#EF4444" },
];

function ScheduleItemModal({ item, projectId, onSave, onClose }) {
  const { t } = useTheme();
  const isNew = !item?.id;
  const [form, setForm] = useState({
    title:"", phase:"Mobilization", description:"", start_date:"", end_date:"",
    duration_days:"", status:"not_started", sort_order:0,
    ...(item||{}), project_id:projectId
  });
  const [saving, setSaving] = useState(false);
  const [delConfirm, setDelConfirm] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const dynInput = { ...inputStyle, background:t.input, borderColor:t.inputBorder, color:t.inputText };
  const PHASES = ["Mobilization","Demolition","Excavation/Earthwork","Foundation","Slab on Grade","Structural Concrete","Masonry","Flatwork/Paving","MEP Rough-In","Waterproofing","Backfill/Site Work","Finishes","Punch List","Closeout"];

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const dur = form.start_date && form.end_date
      ? Math.max(1, Math.round((new Date(form.end_date)-new Date(form.start_date))/(1000*60*60*24)))
      : (form.duration_days ? Number(form.duration_days) : null);
    const payload = { ...form, duration_days: dur };
    delete payload.id; delete payload.created_at;
    if (isNew) {
      const { data } = await supabase.from("schedule_items").insert([payload]).select().single();
      if (data) onSave(data, true);
    } else {
      await supabase.from("schedule_items").update(payload).eq("id", item.id);
      onSave({...item,...payload}, false);
    }
    setSaving(false);
  };

  return (
    <APMModal title={isNew?"New Schedule Item":"Edit Schedule Item"} onClose={onClose} width={500}>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <APMField label="Task / Milestone">
          <input value={form.title} onChange={e=>set("title",e.target.value)} placeholder="e.g. Pour foundation walls" style={{...dynInput,fontSize:15}} autoFocus />
        </APMField>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <APMField label="Phase">
            <select value={form.phase} onChange={e=>set("phase",e.target.value)} style={{...dynInput,fontSize:13}}>
              {PHASES.map(p=><option key={p} value={p}>{p}</option>)}
            </select>
          </APMField>
          <APMField label="Status">
            <select value={form.status} onChange={e=>set("status",e.target.value)} style={{...dynInput,fontSize:14}}>
              {SCHEDULE_STATUSES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </APMField>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
          <APMField label="Start Date"><input type="date" value={form.start_date||""} onChange={e=>set("start_date",e.target.value)} style={{...dynInput,fontSize:14}} /></APMField>
          <APMField label="End Date"><input type="date" value={form.end_date||""} onChange={e=>set("end_date",e.target.value)} style={{...dynInput,fontSize:14}} /></APMField>
          <APMField label="Duration (days)"><input type="number" value={form.duration_days||""} onChange={e=>set("duration_days",e.target.value)} placeholder="auto" style={{...dynInput,fontSize:14}} /></APMField>
        </div>
        <APMField label="Notes">
          <textarea value={form.description||""} onChange={e=>set("description",e.target.value)} placeholder="Details, predecessor tasks..." style={{...dynInput,minHeight:60,resize:"vertical",fontSize:14}} />
        </APMField>
      </div>
      <div style={{ display:"flex", gap:8, marginTop:20, justifyContent:"space-between" }}>
        {!isNew && <button onClick={async()=>{ await supabase.from("schedule_items").delete().eq("id",item.id); onSave(null,true); }} style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.25)", color:"#ef4444", padding:"9px 14px", borderRadius:6, cursor:"pointer", fontSize:12 }}>Delete</button>}
        <div style={{ display:"flex", gap:8, marginLeft:"auto" }}>
          <button onClick={onClose} style={{ background:"none", border:`1px solid ${t.border2}`, color:t.text3, padding:"9px 18px", borderRadius:6, cursor:"pointer", fontSize:13 }}>Cancel</button>
          <button onClick={handleSave} disabled={saving||!form.title.trim()} style={{ background:"#F97316", border:"none", color:"#000", padding:"9px 22px", borderRadius:6, cursor:"pointer", fontSize:13, fontWeight:700 }}>{saving?"Saving...":isNew?"Add Item":"Save"}</button>
        </div>
      </div>

      {delConfirm && <ConfirmDialog message="Delete this Schedule Item? This cannot be undone." onConfirm={async()=>{ await supabase.from("schedule_items").delete().eq("id",item.id); setDelConfirm(false); onSave(null,true); }} onCancel={()=>setDelConfirm(false)} />}
    </APMModal>
  );
}
function GanttChart({ items, onClickItem }) {
  const { t } = useTheme();
  if (!items.length) return null;

  const PHASE_COLORS = {
    "Mobilization":"#6366f1","Demolition":"#ef4444","Excavation/Earthwork":"#92400e",
    "Foundation":"#b45309","Slab on Grade":"#d97706","Structural Concrete":"#f59e0b",
    "Masonry":"#84cc16","Flatwork/Paving":"#10b981","MEP Rough-In":"#06b6d4",
    "Waterproofing":"#3b82f6","Backfill/Site Work":"#8b5cf6","Finishes":"#ec4899",
    "Punch List":"#f97316","Closeout":"#22c55e",
  };

  // Calculate date range
  const datesWithValues = items.filter(i=>i.start_date);
  if (!datesWithValues.length) return (
    <div style={{ textAlign:"center", padding:40, color:t.text4, fontSize:12, fontFamily:"'DM Mono',monospace" }}>
      No dates set — add start/end dates to tasks to see the Gantt chart
    </div>
  );

  const allStarts = datesWithValues.map(i=>new Date(i.start_date+"T12:00:00").getTime());
  const allEnds = items.filter(i=>i.end_date).map(i=>new Date(i.end_date+"T12:00:00").getTime());
  const minDate = new Date(Math.min(...allStarts));
  const maxDate = allEnds.length ? new Date(Math.max(...allEnds)) : new Date(Math.max(...allStarts));
  // Pad by 3 days each side
  minDate.setDate(minDate.getDate()-3);
  maxDate.setDate(maxDate.getDate()+5);

  const totalDays = Math.max(1, Math.round((maxDate-minDate)/(1000*60*60*24)));
  const DAY_W = Math.max(18, Math.min(28, Math.floor(900/totalDays))); // px per day, responsive
  const LABEL_W = 180;
  const ROW_H = 34;
  const HEADER_H = 52;

  // Build week headers
  const weeks = [];
  const cur = new Date(minDate);
  cur.setDate(cur.getDate() - cur.getDay()); // align to Sunday
  while (cur <= maxDate) {
    const weekStart = new Date(cur);
    const left = Math.max(0, Math.round((weekStart-minDate)/(1000*60*60*24)))*DAY_W;
    weeks.push({ date: new Date(cur), left });
    cur.setDate(cur.getDate()+7);
  }

  // Today line
  const today = new Date();
  const todayLeft = Math.round((today-minDate)/(1000*60*60*24))*DAY_W;

  const getBar = (item) => {
    if (!item.start_date) return null;
    const s = new Date(item.start_date+"T12:00:00");
    const e = item.end_date ? new Date(item.end_date+"T12:00:00") : new Date(s.getTime()+86400000*(item.duration_days||1));
    const left = Math.round((s-minDate)/(1000*60*60*24))*DAY_W;
    const width = Math.max(DAY_W, Math.round((e-s)/(1000*60*60*24))*DAY_W);
    const status = SCHEDULE_STATUSES.find(x=>x.id===item.status);
    const baseColor = PHASE_COLORS[item.phase] || "#6366f1";
    const barColor = item.status==="complete" ? "#10b981" : item.status==="blocked" ? "#ef4444" : baseColor;
    const pct = item.status==="complete" ? 100 : item.status==="in_progress" ? 50 : item.status==="blocked" ? 0 : 0;
    return { left, width, barColor, pct };
  };

  // Group by phase
  const phases = [...new Set(items.map(i=>i.phase).filter(Boolean))];
  const totalW = totalDays * DAY_W;

  return (
    <div style={{ overflowX:"auto", overflowY:"auto", flex:1, position:"relative" }}>
      <div style={{ minWidth: LABEL_W + totalW + 20, position:"relative" }}>
        {/* Header */}
        <div style={{ display:"flex", position:"sticky", top:0, zIndex:10, background:t.bg2 }}>
          <div style={{ width:LABEL_W, flexShrink:0, borderRight:`1px solid ${t.border}`, padding:"8px 12px", fontSize:10, color:t.text4, fontFamily:"'DM Mono',monospace", letterSpacing:0.5, display:"flex", alignItems:"flex-end" }}>TASK</div>
          <div style={{ position:"relative", width:totalW, height:HEADER_H, borderBottom:`1px solid ${t.border}`, overflow:"hidden" }}>
            {weeks.map((w,i)=>(
              <div key={i} style={{ position:"absolute", left:w.left, top:0, height:"100%", borderLeft:`1px solid ${t.border}`, paddingLeft:4 }}>
                <div style={{ fontSize:9, color:t.text4, fontFamily:"'DM Mono',monospace", paddingTop:6 }}>
                  {w.date.toLocaleDateString("en-US",{month:"short",day:"numeric"})}
                </div>
                <div style={{ fontSize:8, color:t.text5, fontFamily:"'DM Mono',monospace" }}>
                  WK {Math.ceil((w.date-new Date(w.date.getFullYear(),0,1))/(7*86400000))}
                </div>
              </div>
            ))}
            {/* Today line in header */}
            {todayLeft >= 0 && todayLeft <= totalW && (
              <div style={{ position:"absolute", left:todayLeft, top:0, bottom:0, width:2, background:"#F97316", zIndex:5 }}>
                <div style={{ position:"absolute", top:6, left:3, fontSize:8, color:"#F97316", fontFamily:"'DM Mono',monospace", whiteSpace:"nowrap", fontWeight:700 }}>TODAY</div>
              </div>
            )}
          </div>
        </div>

        {/* Rows grouped by phase */}
        {phases.map(phase=>{
          const phaseItems = items.filter(i=>i.phase===phase);
          const pColor = PHASE_COLORS[phase] || "#6366f1";
          return (
            <div key={phase}>
              {/* Phase group header */}
              <div style={{ display:"flex", background:t.bg3, borderBottom:`1px solid ${t.border}` }}>
                <div style={{ width:LABEL_W, flexShrink:0, padding:"5px 12px", fontSize:9, fontWeight:700, color:pColor, fontFamily:"'DM Mono',monospace", letterSpacing:0.8, borderRight:`1px solid ${t.border}`, display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ width:6, height:6, borderRadius:"50%", background:pColor, flexShrink:0 }} />
                  {phase.toUpperCase()}
                </div>
                <div style={{ flex:1, position:"relative", height:22 }}>
                  {/* Weekend shading in phase header */}
                  {Array.from({length:totalDays},(_,d)=>{
                    const dd = new Date(minDate.getTime()+d*86400000);
                    if (dd.getDay()===0||dd.getDay()===6) return <div key={d} style={{ position:"absolute",left:d*DAY_W,top:0,width:DAY_W,height:"100%",background:"rgba(255,255,255,0.02)" }} />;
                    return null;
                  })}
                  {todayLeft >= 0 && todayLeft <= totalW && <div style={{ position:"absolute",left:todayLeft,top:0,bottom:0,width:2,background:"#F97316",opacity:0.5,zIndex:5 }} />}
                </div>
              </div>
              {/* Task rows */}
              {phaseItems.map((item,ri)=>{
                const bar = getBar(item);
                const rowBg = ri%2===0 ? 'var(--bg)' : 'var(--bg2)';
                return (
                  <div key={item.id} style={{ display:"flex", height:ROW_H, background:rowBg, borderBottom:`1px solid ${t.border}20` }}
                    onMouseEnter={e=>e.currentTarget.style.background=t.bg3}
                    onMouseLeave={e=>e.currentTarget.style.background=rowBg}>
                    {/* Label */}
                    <div onClick={()=>onClickItem(item)} style={{ width:LABEL_W, flexShrink:0, padding:"0 12px", display:"flex", alignItems:"center", borderRight:`1px solid ${t.border}`, cursor:"pointer", gap:6, overflow:"hidden" }}>
                      <span style={{ width:6, height:6, borderRadius:"50%", flexShrink:0,
                        background: SCHEDULE_STATUSES.find(s=>s.id===item.status)?.color || "var(--tx3)" }} />
                      <span style={{ fontSize:11, color:t.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.title}</span>
                    </div>
                    {/* Bar area */}
                    <div style={{ flex:1, position:"relative", overflow:"hidden" }}>
                      {/* Grid lines */}
                      {Array.from({length:totalDays},(_,d)=>{
                        const dd = new Date(minDate.getTime()+d*86400000);
                        if (dd.getDay()===0||dd.getDay()===6) return <div key={d} style={{ position:"absolute",left:d*DAY_W,top:0,width:DAY_W,height:"100%",background:"rgba(255,255,255,0.015)" }} />;
                        return null;
                      })}
                      {/* Today line */}
                      {todayLeft >= 0 && todayLeft <= totalW && <div style={{ position:"absolute",left:todayLeft,top:0,bottom:0,width:2,background:"#F97316",opacity:0.4,zIndex:5 }} />}
                      {/* Gantt bar */}
                      {bar && (
                        <div onClick={()=>onClickItem(item)} style={{ position:"absolute", left:bar.left, top:7, height:ROW_H-14, width:bar.width,
                          background:`${bar.barColor}30`, border:`1px solid ${bar.barColor}80`, borderRadius:4, cursor:"pointer",
                          display:"flex", alignItems:"center", overflow:"hidden", transition:"opacity 0.1s", zIndex:3 }}
                          onMouseEnter={e=>e.currentTarget.style.opacity="0.8"}
                          onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                          {/* Progress fill */}
                          {bar.pct > 0 && <div style={{ position:"absolute", left:0, top:0, height:"100%", width:`${bar.pct}%`, background:`${bar.barColor}60`, borderRadius:4 }} />}
                          {bar.width > 40 && <span style={{ fontSize:9, color:bar.barColor, fontWeight:700, paddingLeft:5, fontFamily:"'DM Mono',monospace", position:"relative", zIndex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.title}</span>}
                        </div>
                      )}
                      {/* Milestone diamond if no duration */}
                      {bar && (bar.width <= DAY_W*1.5) && (
                        <div onClick={()=>onClickItem(item)} style={{ position:"absolute", left:bar.left-5, top:"50%", transform:"translateY(-50%) rotate(45deg)", width:10, height:10,
                          background:bar.barColor, cursor:"pointer", zIndex:4 }} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScheduleTab({ project }) {
  const { t } = useTheme();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [gcPdf, setGcPdf] = useState(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const gcRef = useRef();

  useEffect(()=>{
    supabase.from("schedule_items").select("*").eq("project_id",project.id).order("sort_order")
      .then(({data})=>{ setItems(data||[]); setLoading(false); });
  },[project.id]);

  const handleSave = (data, isNew) => {
    if (!data) setItems(prev=>prev.filter(i=>i.id!==modal?.item?.id));
    else if (isNew) setItems(prev=>[...prev,data]);
    else setItems(prev=>prev.map(i=>i.id===data.id?data:i));
    setModal(null);
  };

  const generateSchedule = async () => {
    setGenerating(true);
    let msgContent;
    if (gcPdf) {
      const isImg = gcPdf.type.startsWith("image/");
      msgContent = [
        isImg
          ? { type:"image", source:{ type:"base64", media_type:gcPdf.type, data:gcPdf.base64 }}
          : { type:"document", source:{ type:"base64", media_type:"application/pdf", data:gcPdf.base64 }},
        { type:"text", text:`Extract schedule tasks from this GC schedule for our concrete/masonry subcontract scope. Project: "${project.name}", Contract: $${project.contract_value}, Start: ${project.start_date||"TBD"}, End: ${project.end_date||"TBD"}. Return ONLY a JSON array, no markdown. Each item: {"title":"string","phase":"string","description":"string","start_date":"YYYY-MM-DD","end_date":"YYYY-MM-DD","duration_days":number,"status":"not_started"}. Phase must be one of: Mobilization, Demolition, Excavation/Earthwork, Foundation, Slab on Grade, Structural Concrete, Masonry, Flatwork/Paving, MEP Rough-In, Waterproofing, Backfill/Site Work, Finishes, Punch List, Closeout.` }
      ];
    } else {
      msgContent = `Generate a Gantt chart schedule for a concrete/masonry subcontractor. Project: "${project.name}". Address: ${project.address||"N/A"}. Contract: $${project.contract_value}. GC: ${project.gc_name||"N/A"}. Start: ${project.start_date||new Date().toISOString().slice(0,10)}, End: ${project.end_date||"TBD"}. Company: ${getCompany(project.company).name}. Generate 12-20 realistic tasks. CRITICAL: Every task must have start_date and end_date in YYYY-MM-DD format — use the project start/end dates to distribute tasks realistically with proper sequencing (foundation before slab, etc). Return ONLY a JSON array, no markdown. Each item: {"title":"string","phase":"string","description":"string","start_date":"YYYY-MM-DD","end_date":"YYYY-MM-DD","duration_days":number,"status":"not_started","sort_order":number}. Phase must be one of: Mobilization, Demolition, Excavation/Earthwork, Foundation, Slab on Grade, Structural Concrete, Masonry, Flatwork/Paving, MEP Rough-In, Waterproofing, Backfill/Site Work, Finishes, Punch List, Closeout.`;
    }

    const res = await fetch("/api/claude", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ model:AI_MODEL, max_tokens:2500, messages:[{ role:"user", content: msgContent }] })
    });
    const json = await res.json();
    const text = json?.content?.find(b=>b.type==="text")?.text || "";
    try {
      const generated = JSON.parse(text.replace(/```json|```/g,"").trim());
      await supabase.from("schedule_items").delete().eq("project_id",project.id);
      const toInsert = generated.map((g,i)=>({
        project_id:project.id, title:g.title, phase:g.phase||"Mobilization",
        description:g.description||"", start_date:g.start_date||null, end_date:g.end_date||null,
        duration_days:g.duration_days||null, status:"not_started", sort_order:i,
      }));
      const { data } = await supabase.from("schedule_items").insert(toInsert).select();
      setItems(data||[]);
    } catch(e) { alert("Generation failed: "+e.message); }
    setGenerating(false);
  };

  const doneCount = items.filter(i=>i.status==="complete").length;
  const inProgressCount = items.filter(i=>i.status==="in_progress").length;
  const blockedCount = items.filter(i=>i.status==="blocked").length;

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
      {/* Toolbar */}
      <div style={{ display:"flex", gap:8, justifyContent:"space-between", alignItems:"center", marginBottom:12, flexWrap:"wrap", flexShrink:0 }}>
        <div style={{ display:"flex", gap:12, alignItems:"center" }}>
          <span style={{ fontSize:11, color:t.text4, fontFamily:"'DM Mono',monospace" }}>{items.length} tasks</span>
          {doneCount>0 && <span style={{ fontSize:11, color:"#10B981", fontFamily:"'DM Mono',monospace" }}>✓ {doneCount} done</span>}
          {inProgressCount>0 && <span style={{ fontSize:11, color:"#F59E0B", fontFamily:"'DM Mono',monospace" }}>⟳ {inProgressCount} active</span>}
          {blockedCount>0 && <span style={{ fontSize:11, color:"#EF4444", fontFamily:"'DM Mono',monospace" }}>⚠ {blockedCount} blocked</span>}
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={()=>gcRef.current?.click()} style={{ background:"none", border:`1px solid ${t.border2}`, color:t.text2, padding:"6px 12px", borderRadius:6, cursor:"pointer", fontSize:12, display:"flex", alignItems:"center", gap:5 }}>
            📎 {gcPdf ? gcPdf.name.slice(0,14)+"…" : "GC Schedule PDF"}
          </button>
          <input ref={gcRef} type="file" accept="image/*,application/pdf" style={{ display:"none" }}
            onChange={e=>{ const f=e.target.files[0]; if(f){ const r=new FileReader(); r.onload=ev=>setGcPdf({name:f.name,base64:ev.target.result.split(",")[1],type:f.type}); r.readAsDataURL(f); }}} />
          <button onClick={generateSchedule} disabled={generating} style={{ background:"linear-gradient(135deg,#7c3aed,#a855f7)", border:"none", color:"#fff", padding:"6px 14px", borderRadius:6, cursor:"pointer", fontSize:12, fontWeight:700, display:"flex", alignItems:"center", gap:5 }}>
            {generating ? <><span style={{ animation:"spin 0.8s linear infinite", display:"inline-block" }}>◌</span> {gcPdf?"Extracting...":"Generating..."}</> : <><span>✦</span> {gcPdf?"Extract from PDF":"AI Generate"}</>}
          </button>
          {items.length>0 && <button onClick={()=>setClearConfirm(true)} style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.25)", color:"#ef4444", padding:"6px 12px", borderRadius:6, cursor:"pointer", fontSize:12 }}>Clear All</button>}
          <button onClick={()=>setModal({item:null})} style={{ background:"#F97316", border:"none", color:"#000", padding:"6px 14px", borderRadius:6, cursor:"pointer", fontSize:12, fontWeight:700 }}>+ Add Task</button>
        </div>
      </div>

      {/* Legend */}
      {items.length>0 && (
        <div style={{ display:"flex", gap:12, marginBottom:10, flexWrap:"wrap", flexShrink:0 }}>
          {SCHEDULE_STATUSES.map(s=>(
            <div key={s.id} style={{ display:"flex", alignItems:"center", gap:5 }}>
              <span style={{ width:10, height:10, borderRadius:2, background:s.color, flexShrink:0 }} />
              <span style={{ fontSize:10, color:t.text4, fontFamily:"'DM Mono',monospace" }}>{s.label}</span>
            </div>
          ))}
          <div style={{ display:"flex", alignItems:"center", gap:5, marginLeft:8 }}>
            <span style={{ width:2, height:12, background:"#F97316", flexShrink:0 }} />
            <span style={{ fontSize:10, color:t.text4, fontFamily:"'DM Mono',monospace" }}>Today</span>
          </div>
        </div>
      )}

      {loading && <div style={{ textAlign:"center", padding:40, color:t.text4, fontSize:12, fontFamily:"'DM Mono',monospace" }}>Loading...</div>}

      {!loading && items.length===0 && (
        <div style={{ textAlign:"center", padding:60 }}>
          <div style={{ fontSize:32, marginBottom:12 }}>📅</div>
          <div style={{ fontSize:14, color:t.text2, marginBottom:6 }}>No schedule yet</div>
          <div style={{ fontSize:11, color:t.text3, fontFamily:"'DM Mono',monospace", marginBottom:20 }}>Upload a GC schedule PDF or AI-generate from project dates</div>
          <button onClick={generateSchedule} disabled={generating} style={{ background:"linear-gradient(135deg,#7c3aed,#a855f7)", border:"none", color:"#fff", padding:"10px 20px", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:700 }}>
            {generating ? "Generating..." : "✦ AI Generate Gantt"}
          </button>
        </div>
      )}

      {!loading && items.length>0 && (
        <GanttChart items={items} onClickItem={(item)=>setModal({item})} />
      )}

      {modal && <ScheduleItemModal item={modal.item} projectId={project.id} onSave={handleSave} onClose={()=>setModal(null)} />}
      {clearConfirm && <ConfirmDialog message="Clear all schedule items? This cannot be undone." onConfirm={async()=>{ await supabase.from("schedule_items").delete().eq("project_id",project.id); setItems([]); setClearConfirm(false); }} onCancel={()=>setClearConfirm(false)} />}
    </div>
  );
}

// ── Pay Applications / SOV ─────────────────────────────
function SOVModal({ project, sovItems, onSave, onClose }) {
  const { t } = useTheme();
  const [items, setItems] = useState(sovItems.length > 0 ? sovItems.map(i=>({...i})) : [{ item_no:"1", description:"", scheduled_value:"", sort_order:0 }]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [estimateFile, setEstimateFile] = useState(null); // {name, base64, type}
  const [extractingEstimate, setExtractingEstimate] = useState(false);
  const estimateRef = useRef();

  const addRow = () => setItems(prev=>[...prev, { item_no:String(prev.length+1), description:"", scheduled_value:"", sort_order:prev.length }]);
  const removeRow = (idx) => setItems(prev=>prev.filter((_,i)=>i!==idx));
  const updateRow = (idx, k, v) => setItems(prev=>prev.map((item,i)=>i===idx?{...item,[k]:v}:item));

  const handleEstimateUpload = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setEstimateFile({ name: file.name, base64: e.target.result.split(",")[1], type: file.type });
    };
    reader.readAsDataURL(file);
  };

  const extractFromEstimate = async () => {
    if (!estimateFile) return;
    setExtractingEstimate(true);
    const isImg = estimateFile.type.startsWith("image/");
    const msgContent = [
      isImg
        ? { type:"image", source:{ type:"base64", media_type:estimateFile.type, data:estimateFile.base64 }}
        : { type:"document", source:{ type:"base64", media_type:"application/pdf", data:estimateFile.base64 }},
      { type:"text", text:`Extract Schedule of Values line items from this estimate/bid document for an AIA G702 pay application. Contract value is ${project.contract_value}. Return ONLY a JSON array, no markdown. Each item: {"item_no":"string","description":"string","scheduled_value":number}. Use the actual line items, divisions, or cost categories from the document. Values should sum to approximately ${project.contract_value}.` }
    ];
    const res = await fetch("/api/claude", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ model:AI_MODEL, max_tokens:1000, messages:[{ role:"user", content:msgContent }] })
    });
    const json = await res.json();
    const text = json?.content?.find(b=>b.type==="text")?.text || "";
    try {
      const extracted = JSON.parse(text.replace(/```json|```/g,"").trim());
      setItems(extracted.map((s,i)=>({...s, scheduled_value:String(s.scheduled_value), sort_order:i})));
    } catch(e) {}
    setExtractingEstimate(false);
  };

  const suggestSOV = async () => {
    setGenerating(true);
    const res = await fetch("/api/claude", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        model:AI_MODEL, max_tokens:800,
        system:`You are a construction PM specializing in concrete and masonry work. Generate a Schedule of Values for an AIA G702 pay application. Return ONLY a JSON array, no markdown. Each item: {"item_no":"string","description":"string","scheduled_value":number}. Values must sum EXACTLY to the contract amount. Break down costs realistically for the specific project type.`,
        messages:[{ role:"user", content:`Project: "${project.name}". Address: ${project.address||"not specified"}. Contract value: $${project.contract_value}. GC: ${project.gc_name||"not specified"}. Start: ${project.start_date||"not specified"}, End: ${project.end_date||"not specified"}. Company doing work: ${getCompany(project.company).name} (concrete/masonry contractor). Generate 8-14 SOV line items that reflect the actual scope — mobilization, concrete work, formwork, rebar, flatwork, masonry, equipment, etc. based on the project name and details. Values must sum to exactly $${project.contract_value}.` }]
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
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={()=>estimateRef.current?.click()} style={{ background:"none", border:`1px solid ${t.border2}`, color:t.text2, padding:"7px 12px", borderRadius:6, cursor:"pointer", fontSize:12, display:"flex", alignItems:"center", gap:5 }}>
            📎 {estimateFile ? estimateFile.name.slice(0,18)+"…" : "Upload Estimate"}
          </button>
          <input ref={estimateRef} type="file" accept="image/*,application/pdf" style={{ display:"none" }} onChange={e=>handleEstimateUpload(e.target.files[0])} />
          {estimateFile && (
            <button onClick={extractFromEstimate} disabled={extractingEstimate} style={{ background:"linear-gradient(135deg,#0ea5e9,#3b82f6)", border:"none", color:"#fff", padding:"7px 14px", borderRadius:6, cursor:"pointer", fontSize:12, fontWeight:700, display:"flex", alignItems:"center", gap:5 }}>
              {extractingEstimate ? <><span style={{ animation:"spin 0.8s linear infinite", display:"inline-block" }}>◌</span> Reading...</> : <><span>⚡</span> Extract from Estimate</>}
            </button>
          )}
          <button onClick={suggestSOV} disabled={generating||!contractVal} style={{ background:"linear-gradient(135deg,#7c3aed,#a855f7)", border:"none", color:"#fff", padding:"7px 14px", borderRadius:6, cursor:"pointer", fontSize:12, fontWeight:700, display:"flex", alignItems:"center", gap:5, opacity:contractVal?1:0.5 }}>
            {generating ? <><span style={{ animation:"spin 0.8s linear infinite", display:"inline-block" }}>◌</span> Generating...</> : <><span>✦</span> AI Suggest</>}
          </button>
        </div>
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
            <button onClick={()=>removeRow(idx)} style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.25)", color:"#ef4444", borderRadius:5, cursor:"pointer", fontSize:14, padding:"0 6px" }}>×</button>
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
    status:"draft", payment_received:"", notes:"", file_url:"", file_name:"",
    ...(payApp||{}), project_id:project.id
  });
  const [lineItems, setLineItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [delConfirm, setDelConfirm] = useState(false);
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
        <APMField label="Attachment (signed pay app, backup)">
          <FileUploadZone fileUrl={form.file_url} fileName={form.file_name} folder={`pay_apps/${project.id}`} onUploaded={(url,name)=>{ set("file_url",url); set("file_name",name); }} />
        </APMField>

        {/* Summary */}
        <div style={{ background:t.bg4, border:`1px solid ${t.border}`, borderRadius:8, padding:"12px 16px", display:"flex", gap:20, flexWrap:"wrap" }}>
          <div><span style={{ fontSize:10, color:t.text4, fontFamily:"'DM Mono',monospace" }}>THIS PERIOD </span><span style={{ fontSize:15, fontWeight:700, color:t.text, fontFamily:"'DM Mono',monospace" }}>{fmtMoney(totals.completedThis)}</span></div>
          <div><span style={{ fontSize:10, color:t.text4, fontFamily:"'DM Mono',monospace" }}>RETAINAGE </span><span style={{ fontSize:15, fontWeight:700, color:"#EF4444", fontFamily:"'DM Mono',monospace" }}>{fmtMoney(totals.retainage)}</span></div>
          <div><span style={{ fontSize:10, color:t.text4, fontFamily:"'DM Mono',monospace" }}>NET DUE </span><span style={{ fontSize:15, fontWeight:700, color:"#10B981", fontFamily:"'DM Mono',monospace" }}>{fmtMoney(totals.netDue)}</span></div>
        </div>
      </div>
      <div style={{ display:"flex", gap:8, marginTop:20, justifyContent:"space-between" }}>
        {!isNew && <button onClick={()=>setDelConfirm(true)} style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.25)", color:"#ef4444", padding:"9px 14px", borderRadius:6, cursor:"pointer", fontSize:12 }}>Delete</button>}
        <div style={{ display:"flex", gap:8, marginLeft:"auto" }}>
          <button onClick={onClose} style={{ background:"none", border:`1px solid ${t.border2}`, color:t.text3, padding:"9px 18px", borderRadius:6, cursor:"pointer", fontSize:13 }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ background:"#F97316", border:"none", color:"#000", padding:"9px 22px", borderRadius:6, cursor:"pointer", fontSize:13, fontWeight:700 }}>{saving?"Saving...":isNew?"Create Pay App":"Save"}</button>
        </div>
      </div>

      {delConfirm && <ConfirmDialog message="Delete this Pay Application? This cannot be undone." onConfirm={async()=>{ await supabase.from("pay_applications").delete().eq("id",payApp.id); setDelConfirm(false); onSave(null,true); }} onCancel={()=>setDelConfirm(false)} />}
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
          model:AI_MODEL, max_tokens:1000,
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


// ── Precon / Takeoff ──────────────────────────────────

const TAKEOFF_CATS = [
  { id:'site_concrete',     label:'Site Concrete',      color:'#F59E0B', unit:'SF', defaultCost:8.50  },
  { id:'building_concrete', label:'Building Concrete',  color:'#F97316', unit:'SF', defaultCost:9.00  },
  { id:'flatwork',          label:'Flatwork / Slabs',   color:'#EF4444', unit:'SF', defaultCost:7.00  },
  { id:'foundations',       label:'Foundations',        color:'#8B5CF6', unit:'CY', defaultCost:650   },
  { id:'curb_gutter',       label:'Curb & Gutter',      color:'#06B6D4', unit:'LF', defaultCost:28.00 },
  { id:'masonry',           label:'Masonry / CMU',      color:'#10B981', unit:'SF', defaultCost:22.00 },
  { id:'asphalt',           label:'Asphalt / Paving',   color:'#6B7280', unit:'SF', defaultCost:4.50  },
  { id:'grading',           label:'Grading / Earthwork',color:'#84CC16', unit:'CY', defaultCost:18.00 },
  { id:'other',             label:'Other',              color:'#94A3B8', unit:'LS', defaultCost:0     },
];

function TakeoffItemModal({ item, onSave, onClose }) {
  const { t } = useTheme();
  const isNew = !item?.id;
  const cat = TAKEOFF_CATS.find(c=>c.id===item?.category) || TAKEOFF_CATS[0];
  const [form, setForm] = useState({
    category: cat.id, description: item?.description||'', quantity: item?.quantity||'',
    unit: item?.unit||cat.unit, unit_cost: item?.unit_cost||cat.defaultCost,
    ...(item||{})
  });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const total = (Number(form.quantity)||0) * (Number(form.unit_cost)||0);
  const dynInput = {...inputStyle, background:t.input, borderColor:t.inputBorder, color:t.inputText, fontSize:13};

  const handleSave = async () => {
    const payload = {...form, quantity:Number(form.quantity)||0, unit_cost:Number(form.unit_cost)||0, total_cost:total};
    if (isNew) {
      const {data} = await supabase.from('takeoff_items').insert([payload]).select().single();
      if (data) onSave(data, true);
    } else {
      await supabase.from('takeoff_items').update(payload).eq('id', item.id);
      onSave({...item,...payload}, false);
    }
  };

  return (
    <APMModal title={isNew?'New Takeoff Item':'Edit Takeoff Item'} onClose={onClose} width={480}>
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        <APMField label="Category">
          <select value={form.category} onChange={e=>{
            const c=TAKEOFF_CATS.find(x=>x.id===e.target.value)||TAKEOFF_CATS[0];
            set('category',e.target.value); set('unit',c.unit); set('unit_cost',c.defaultCost);
          }} style={{...dynInput}}>
            {TAKEOFF_CATS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </APMField>
        <APMField label="Description">
          <input value={form.description} onChange={e=>set('description',e.target.value)} style={{...dynInput,fontSize:14}} autoFocus />
        </APMField>
        <APMField label="Color">
          <div style={{display:'flex',flexWrap:'wrap',gap:5,padding:'4px 0'}}>
            {['#10B981','#3B82F6','#F59E0B','#EF4444','#8B5CF6','#F97316','#06B6D4','#EC4899','#84CC16','#A855F7','#14B8A6','#6B7280'].map(c=>(
              <button key={c} onClick={()=>set('color',c)}
                style={{width:22,height:22,borderRadius:5,background:c,border:form.color===c?'2px solid #fff':'2px solid transparent',
                  cursor:'pointer',padding:0,flexShrink:0,boxShadow:form.color===c?`0 0 0 2px ${c}`:undefined,transition:'box-shadow 0.1s'}}/>
            ))}
          </div>
        </APMField>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
          <APMField label="Quantity"><input type="number" value={form.quantity} onChange={e=>set('quantity',e.target.value)} style={{...dynInput}} /></APMField>
          <APMField label="Unit"><input value={form.unit} onChange={e=>set('unit',e.target.value)} style={{...dynInput}} /></APMField>
          <APMField label="Unit Cost ($)"><input type="number" value={form.unit_cost} onChange={e=>set('unit_cost',e.target.value)} style={{...dynInput}} /></APMField>
        </div>
        <div style={{background:t.bg5,borderRadius:6,padding:'10px 14px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontSize:11,color:t.text3,fontFamily:"'DM Mono',monospace"}}>TOTAL</span>
          <span style={{fontSize:15,fontWeight:700,color:t.text,fontFamily:"'DM Mono',monospace"}}>${total.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
        </div>
      </div>
      <div style={{display:'flex',gap:8,marginTop:20,justifyContent:'space-between'}}>
        {!isNew && <button onClick={async()=>{const {error}=await supabase.from('takeoff_items').delete().eq('id',item.id).select();if(error){console.error('item delete error:',error);alert('Delete failed: '+error.message);}else{onSave(null,'delete');}}} style={{background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.3)',color:'#ef4444',padding:'8px 14px',borderRadius:6,cursor:'pointer',fontSize:12}}>Delete</button>}
        <div style={{display:'flex',gap:8,marginLeft:'auto'}}>
          <button onClick={onClose} style={{background:'none',border:`1px solid ${t.border2}`,color:t.text3,padding:'8px 18px',borderRadius:6,cursor:'pointer',fontSize:13}}>Cancel</button>
          <button onClick={handleSave} style={{background:'#F97316',border:'none',color:'#000',padding:'8px 22px',borderRadius:6,cursor:'pointer',fontSize:13,fontWeight:700}}>Save</button>
        </div>
      </div>
    </APMModal>
  );
}

function PreconTab({ project }) {
  const { t } = useTheme();
  const [plans, setPlans] = useState([]);
  const [selPlan, setSelPlan] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [pushingSOV, setPushingSOV] = useState(false);
  const [tool, setTool] = useState('select');
  const [activePts, setActivePts] = useState([]);
  const [hoverPt, setHoverPt] = useState(null);
  const [scale, setScale] = useState(null);
  const [scaleStep, setScaleStep] = useState(null);
  const [scalePts, setScalePts] = useState([]);
  const [scaleDist, setScaleDist] = useState('');
  const [scaleUnit, setScaleUnit] = useState('ft');
  const [imgNat, setImgNat] = useState({w:1,h:1});
  const [imgDisp, setImgDisp] = useState({w:1,h:1});
  const [editItem, setEditItem] = useState(null);
  const [activeCondId, setActiveCondId] = useState(null); // item currently being measured into
  const [planB64, setPlanB64] = useState(null);
  const [planMime, setPlanMime] = useState('image/png');
  const [rightTab, setRightTab] = useState('items'); // 'items' | 'estimate'
  const imgRef = useRef();
  const svgRef = useRef();
  const fileRef = useRef();

  useEffect(()=>{
    Promise.all([
      supabase.from('precon_plans').select('*').eq('project_id',project.id).order('created_at'),
      supabase.from('takeoff_items').select('*').eq('project_id',project.id).order('sort_order'),
    ]).then(([{data:p},{data:i}])=>{
      const pl=p||[];
      // Discard legacy items with no plan_id — they have no valid page association
      const validItems=(i||[]).filter(it=>it.plan_id!=null);
      setPlans(pl); setItems(validItems);
      if(pl.length>0){setSelPlan(pl[0]); if(pl[0].scale_px_per_ft) setScale(pl[0].scale_px_per_ft); setOpenTabs([pl[0].id]);}
      setLoading(false);
    });
  },[project.id]);

  // Points stored as raw SVG pixel coords — no normalization needed
  // toPx is identity: SVG coord space = image pixel space
  const toPx=(x,y)=>({x,y});

  // planItems: strict per-sheet item list. Defined early so all handlers can use it.
  const getSvgPos=(e)=>{
    const r=svgRef.current?.getBoundingClientRect();
    if(!r) return {x:0,y:0};
    return {x:e.clientX-r.left,y:e.clientY-r.top};
  };

  const calcArea=(pts)=>{
    if(!scale||pts.length<3) return 0;
    let a=0;
    for(let i=0;i<pts.length;i++){
      const j=(i+1)%pts.length;
      a+=pts[i].x*pts[j].y - pts[j].x*pts[i].y;
    }
    return Math.abs(a)/2/(scale*scale); // px² → ft²
  };

  const calcLinear=(p1,p2)=>{
    if(!scale) return 0;
    return Math.sqrt((p2.x-p1.x)**2+(p2.y-p1.y)**2)/scale; // px → ft
  };

  const handleImgLoad=()=>{
    const img=imgRef.current;
    if(!img) return;
    setImgNat({w:img.naturalWidth, h:img.naturalHeight});
    setImgDisp({w:img.offsetWidth||img.naturalWidth, h:img.offsetHeight||img.naturalHeight});
    // Image plans: DPI stays at user-set value (planDpi)
  };

  const renderPdfPage = async (doc, pageN=1) => {
    if(!doc) return;
    // Wait for canvas to be in DOM
    let canvas = canvasRef.current;
    if(!canvas){
      await new Promise(r=>setTimeout(r,120));
      canvas = canvasRef.current;
    }
    if(!canvas) return;
    setRendering(true);
    try {
      const page = await doc.getPage(pageN);
      const viewport = page.getViewport({scale: 2.0});
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = viewport.width + 'px';
      canvas.style.height = viewport.height + 'px';
      await page.render({canvasContext: ctx, viewport}).promise;
      setImgNat({w:viewport.width, h:viewport.height});
      setImgDisp({w:viewport.width, h:viewport.height});
      setPlanDpi(144); // PDF.js at scale:2 × 72pt/in = 144px/in
    } catch(e){ console.error('renderPdfPage error', e); }
    setRendering(false);
  };

  const loadPdf = async (src) => {
    const lib = await ensurePdfLib();
    if(!lib) return null;
    try {
      lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const doc = await lib.getDocument(src).promise;
      pdfDocRef.current = doc;
      setPdfDoc(doc);
      await renderPdfPage(doc, 1);
      return doc;
    } catch(e) {
      console.error('PDF load error:', e);
      return null;
    }
  };

  const ensurePdfLib = () => new Promise((resolve)=>{
    if(window.pdfjsLib){ resolve(window.pdfjsLib); return; }
    const s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload=()=>resolve(window.pdfjsLib);
    s.onerror=()=>resolve(null);
    document.head.appendChild(s);
  });

  // Sync spaceHeld into panRef so mousedown handler (non-closure) can read it
  useEffect(()=>{ panRef.current._spaceHeld = spaceHeld; },[spaceHeld]);

  useEffect(()=>{
    const handleKey=(e)=>{
      if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA') return;
      if(e.key===' ') setSpaceHeld(true);
      if(e.key==='Escape'){
        setActivePts([]);
        setScalePts([]);
        setScaleStep(null);
        setTool('select');
        setShowScalePicker(false);
        setArchMode(false);
        setArchCtrlPending(false);
      }
      // A = toggle arch mode (linear/area only)
      if((e.key==='a'||e.key==='A')&&!e.ctrlKey&&!e.metaKey){
        const activeCond=itemsRef.current.find(i=>String(i.id)===String(activeCondId));
        if(activeCond&&(activeCond.measurement_type==='linear'||activeCond.measurement_type==='area')){
          e.preventDefault();
          setArchMode(prev=>{ const n=!prev; if(!n)setArchCtrlPending(false); return n; });
        }
      }
    };
    const handleKeyUp=(e)=>{ if(e.key===' ') setSpaceHeld(false); };
    window.addEventListener('keydown',handleKey);
    window.addEventListener('keyup',handleKeyUp);
    return ()=>{ window.removeEventListener('keydown',handleKey); window.removeEventListener('keyup',handleKeyUp); };
  },[activeCondId]);

  // Container callback ref — attaches wheel + pan handlers
  const containerCallbackRef = (el) => {
    if(containerRef.current){
      containerRef.current.removeEventListener('wheel', containerRef._wheelHandler);
    }
    if(el){
      // Wheel zoom toward cursor
      const wheelHandler = (e)=>{
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.05 : 0.95;
        const rect = el.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const contentX = el.scrollLeft + mouseX;
        const contentY = el.scrollTop + mouseY;
        setZoom(prev => {
          const newZoom = Math.min(4, Math.max(0.05, parseFloat((prev*factor).toFixed(2))));
          requestAnimationFrame(()=>{
            el.scrollLeft = contentX*(newZoom/prev) - mouseX;
            el.scrollTop  = contentY*(newZoom/prev) - mouseY;
          });
          return newZoom;
        });
      };
      el.addEventListener('wheel', wheelHandler, {passive:false});
      containerRef.current = el;
      containerRef._wheelHandler = wheelHandler;
    }
  };

  // Compute isPdf synchronously from file_type (blob URLs don't reveal type)
  const isPdfPlan = !!(selPlan && (
    selPlan.file_type?.includes('pdf')
    || selPlan.file_url?.startsWith('data:application/pdf')
  ));

  useEffect(()=>{
    if(!selPlan) return;
    // Reset scale
    if(selPlan.scale_px_per_ft){ setScale(selPlan.scale_px_per_ft); }
    else { setScale(null); setPresetScale(''); }
    setActiveCondId(null); setTool('select'); setActivePts([]);
    pdfDocRef.current = null;
    setPdfDoc(null);

    // If it's a local data: URL (just uploaded), use directly
    if(selPlan.file_url?.startsWith('data:')){
      setBlobUrl(selPlan.file_url);
      return;
    }

    // Otherwise fetch as blob to bypass any CORS/cache issues
    setLoadingPlan(true);
    setBlobUrl(null);
    fetch(selPlan.file_url)
      .then(r=>{ if(!r.ok) throw new Error('HTTP '+r.status); return r.blob(); })
      .then(blob=>{
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
        setLoadingPlan(false);
      })
      .catch(err=>{
        console.error('Plan fetch failed:', err, selPlan.file_url);
        // Fall back to direct URL
        setBlobUrl(selPlan.file_url);
        setLoadingPlan(false);
      });
  },[selPlan?.id, selPlan?.file_url]);

  // When blobUrl is ready, load PDF if needed
  useEffect(()=>{
    if(!blobUrl || !selPlan) return;
    const isPdf = !!(
      selPlan.file_type?.includes('pdf')
      || (selPlan.file_url?.toLowerCase().includes('.pdf') && !selPlan.file_url?.startsWith('data:image'))
      || selPlan.file_url?.startsWith('data:application/pdf')
    );
    if(isPdf) loadPdf(blobUrl);
  },[blobUrl]);

  const saveItem=async(itemData)=>{
    const catDef=TAKEOFF_CATS.find(c=>c.id===itemData.category)||TAKEOFF_CATS[TAKEOFF_CATS.length-1];
    const unit_cost=itemData.unit_cost??catDef.defaultCost;
    const total_cost=(itemData.quantity||0)*unit_cost;
    const payload={...itemData,project_id:project.id,plan_id:selPlan?.id,unit_cost,total_cost,color:catDef.color,sort_order:items.length};
    const {data}=await supabase.from('takeoff_items').insert([payload]).select().single();
    if(data){setItems(prev=>[...prev,data]); setEditItem(data);}
  };

  const handleSvgClick=(e)=>{
    if(!selPlan) return;
    if(spaceHeld || tool==='select') return; // pan mode — don't place points
    const pos=getSvgPos(e);
    const norm=toNorm(pos.x,pos.y);

    if(tool==='scale'&&scaleStep==='picking'){
      const npts=[...scalePts,norm];
      setScalePts(npts);
      if(npts.length===2) setScaleStep('entering');
      return;
    }
    if(tool==='count'){
      saveItem({category:'other',description:'Count marker',quantity:1,unit:'EA',measurement_type:'count',points:[norm]});
      return;
    }
    if(tool==='linear'){
      const npts=[...activePts,norm];
      if(npts.length===2){
        const len=Math.round(calcLinear(npts[0],npts[1])*10)/10;
        saveItem({category:'other',description:'Linear measurement',quantity:len,unit:'LF',measurement_type:'linear',points:npts});
        setActivePts([]);
      } else setActivePts(npts);
      return;
    }
    if(tool==='area'){
      if(activePts.length>=3){
        const fp=toPx(activePts[0].x,activePts[0].y);
        if(Math.sqrt((pos.x-fp.x)**2+(pos.y-fp.y)**2)<14){
          const area=Math.round(calcArea(activePts)*10)/10;
          saveItem({category:'concrete_slab',description:'Concrete area',quantity:area,unit:'SF',measurement_type:'area',points:activePts});
          setActivePts([]);
          return;
        }
      }
      setActivePts(prev=>[...prev,norm]);
    }
  };

  const handleSvgMove=(e)=>{ const p=getSvgPos(e); setHoverPt(toNorm(p.x,p.y)); };

  const confirmScale=async()=>{
    if(!scaleDist||scalePts.length<2) return;
    const p1=toNat(scalePts[0].x,scalePts[0].y);
    const p2=toNat(scalePts[1].x,scalePts[1].y);
    const pxDist=Math.sqrt((p2.x-p1.x)**2+(p2.y-p1.y)**2);
    const realFt=Number(scaleDist)*(scaleUnit==='in'?1/12:1);
    const pxPerFt=pxDist/realFt;
    setScale(pxPerFt); setScaleStep(null); setScalePts([]); setScaleDist(''); setTool('select');
    if(selPlan){
      await supabase.from('precon_plans').update({scale_px_per_ft:pxPerFt}).eq('id',selPlan.id);
      setSelPlan(prev=>({...prev,scale_px_per_ft:pxPerFt}));
    }
  };

  const handleUpload=async(file)=>{
    if(!file) return;
    setUploading(true);
    const ext=file.name.split('.').pop();
    const path=`precon/${project.id}/${Date.now()}.${ext}`;
    const {error}=await supabase.storage.from('attachments').upload(path,file,{upsert:true});
    if(error){setUploading(false);alert('Upload failed: '+error.message);return;}
    const {data:ud}=supabase.storage.from('attachments').getPublicUrl(path);
    const {data:plan}=await supabase.from('precon_plans').insert([{project_id:project.id,name:file.name,file_url:ud.publicUrl,file_type:file.type}]).select().single();
    if(plan){setPlans(prev=>[...prev,plan]);setSelPlan(plan);}
    const reader=new FileReader();
    reader.onload=ev=>{setPlanB64(ev.target.result.split(',')[1]);setPlanMime(file.type);};
    reader.readAsDataURL(file);
    setUploading(false);
  };

  const runAITakeoff=async()=>{
    if(!selPlan) return;
    setAnalyzing(true);
    let b64=planB64; let mime=planMime;
    if(!b64){
      try{
        const res=await fetch(selPlan.file_url);
        const blob=await res.blob();
        mime=blob.type||'image/png';
        b64=await new Promise(resolve=>{const r=new FileReader();r.onload=e=>resolve(e.target.result.split(',')[1]);r.readAsDataURL(blob);});
      }catch(e){setAnalyzing(false);alert('Could not load plan image');return;}
    }
    const isImg=mime.startsWith('image/');
    const block=isImg?{type:'image',source:{type:'base64',media_type:mime,data:b64}}:{type:'document',source:{type:'base64',media_type:'application/pdf',data:b64}};
    const res=await fetch('/api/claude',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({model:AI_MODEL,max_tokens:2500,
        messages:[{role:'user',content:[block,{type:'text',text:`You are a concrete and masonry construction estimator. Analyze this plan/drawing carefully.

Project: "${project.name}" | Contract: ${project.contract_value?'$'+project.contract_value:'TBD'} | GC: ${project.gc_name||'N/A'}

Extract ALL quantifiable scope items for a concrete/masonry subcontractor. Be specific — read any visible dimensions, room labels, notes on the drawings. If you see a dimension string, use it. If you cannot read dimensions, estimate based on visible scale and context.

Return ONLY a valid JSON array, no markdown, no explanation:
[{"category":"concrete_slab|concrete_footing|concrete_wall|masonry_cmu|masonry_brick|rebar|formwork|excavation|flatwork|grout|other","description":"specific item description","quantity":number,"unit":"SF|CY|LF|LB|EA|LS","measurement_type":"area|linear|count|manual","notes":"any important context"}]

Include: foundations, slabs, walls, columns, masonry, flatwork, reinforcement, formwork, excavation. Separate different areas/elements into individual line items.`}]}]})
    });
    const json=await res.json();
    const text=json?.content?.find(b=>b.type==='text')?.text||'';
    try{
      const aiItems=JSON.parse(text.replace(/```json|```/g,'').trim());
      const toInsert=aiItems.map((it,i)=>{
        const catDef=TAKEOFF_CATS.find(c=>c.id===it.category)||TAKEOFF_CATS[TAKEOFF_CATS.length-1];
        const uc=catDef.defaultCost;
        return {project_id:project.id,plan_id:selPlan?.id,category:it.category||'other',description:it.description,quantity:it.quantity||0,unit:it.unit||catDef.unit,unit_cost:uc,total_cost:(it.quantity||0)*uc,measurement_type:it.measurement_type||'manual',points:null,color:catDef.color,ai_generated:true,sort_order:items.length+i};
      });
      const {data}=await supabase.from('takeoff_items').insert(toInsert).select();
      if(data) setItems(prev=>[...prev,...data]);
    }catch(e){alert('AI parse failed: '+e.message);}
    setAnalyzing(false);
  };

  const pushToSOV=async()=>{
    if(!items.length) return;
    setPushingSOV(true);
    const grouped={};
    items.forEach(it=>{
      const cat=TAKEOFF_CATS.find(c=>c.id===it.category);
      const key=cat?.label||it.category;
      if(!grouped[key]) grouped[key]={desc:key,total:0};
      grouped[key].total+=(it.total_cost||0);
    });
    const sovRows=Object.values(grouped).map((g,i)=>({project_id:project.id,item_no:String(i+1),description:g.desc,scheduled_value:Math.round(g.total),sort_order:i}));
    await supabase.from('sov_items').delete().eq('project_id',project.id);
    await supabase.from('sov_items').insert(sovRows);
    setPushingSOV(false);
    alert('SOV updated from takeoff! Go to Pay Apps to review.');
  };

  // SVG rendering
  const renderMeasurements=()=>items.filter(it=>it.points?.length && it.plan_id===selPlan?.id).map(it=>{
    const pts=it.points; // raw pixel coords
    const c=it.color||'#F97316';
    if(it.measurement_type==='area'){
      const d=pts.map((p,i)=>`${i===0?'M':'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')+' Z';
      const cx=pts.reduce((s,p)=>s+p.x,0)/pts.length;
      const cy=pts.reduce((s,p)=>s+p.y,0)/pts.length;
      return(<g key={it.id} onClick={()=>setEditItem(it)} style={{cursor:'pointer'}}>
        <path d={d} fill={c+'28'} stroke={c} strokeWidth={2}/>
        <text x={cx} y={cy} fontSize={11} fill={c} textAnchor="middle" dominantBaseline="middle" fontFamily="'DM Mono',monospace" fontWeight={700} style={{pointerEvents:'none'}}>{it.quantity}{it.unit}</text>
      </g>);
    }
    if(it.measurement_type==='linear'&&pts.length>=2){
      const mx=(pts[0].x+pts[1].x)/2; const my=(pts[0].y+pts[1].y)/2;
      return(<g key={it.id} onClick={()=>setEditItem(it)} style={{cursor:'pointer'}}>
        <line x1={pts[0].x} y1={pts[0].y} x2={pts[1].x} y2={pts[1].y} stroke={c} strokeWidth={2.5} strokeDasharray="7,4"/>
        {pts.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={5} fill={c}/>)}
        <text x={mx} y={my-8} fontSize={11} fill={c} textAnchor="middle" fontFamily="'DM Mono',monospace" fontWeight={700} style={{pointerEvents:'none'}}>{it.quantity} {it.unit}</text>
      </g>);
    }
    if(it.measurement_type==='count'){
      return(<g key={it.id} onClick={()=>setEditItem(it)} style={{cursor:'pointer'}}>
        <circle cx={pts[0].x} cy={pts[0].y} r={9} fill={c} opacity={0.85}/>
        <text x={pts[0].x} y={pts[0].y+4} fontSize={10} fill="#fff" textAnchor="middle" fontFamily="'DM Mono',monospace" style={{pointerEvents:'none'}}>✕</text>
      </g>);
    }
    return null;
  });

  const renderActiveDrawing=()=>{
    const pts=(tool==='scale'&&scaleStep==='picking')?scalePts:activePts;
    if(!pts.length) return null;
    const c=tool==='scale'?'#10B981':tool==='area'?'#F59E0B':'#06B6D4';
    const disp=pts.map(p=>toPx(p.x,p.y));
    const hover=hoverPt?toPx(hoverPt.x,hoverPt.y):null;
    const all=hover?[...disp,hover]:disp;
    return(<>
      {all.length>=2&&<polyline points={all.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke={c} strokeWidth={2} strokeDasharray={tool==='area'?'none':'6,3'} opacity={0.8}/>}
      {disp.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={i===0&&pts.length>=3?9:5} fill={c} stroke={i===0&&pts.length>=3?'#fff':'none'} strokeWidth={2} opacity={0.9}/>)}
      {hover&&<circle cx={hover.x} cy={hover.y} r={4} fill={c} opacity={0.4}/>}
      {tool==='area'&&pts.length>=3&&<text x={disp[0].x+12} y={disp[0].y-8} fontSize={10} fill={c} fontFamily="'DM Mono',monospace">close</text>}
    </>);
  };

  const renderScaleLine=()=>{
    if(scalePts.length<2) return null;
    const p1=toPx(scalePts[0].x,scalePts[0].y);
    const p2=toPx(scalePts[1].x,scalePts[1].y);
    return(<g>
      <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#10B981" strokeWidth={2} strokeDasharray="5,3"/>
      <circle cx={p1.x} cy={p1.y} r={5} fill="#10B981"/>
      <circle cx={p2.x} cy={p2.y} r={5} fill="#10B981"/>
    </g>);
  };

  const totalEst=items.reduce((s,i)=>s+(i.total_cost||0),0); // all sheets
  const catGroups=TAKEOFF_CATS.map(cat=>{
    const its=planItems.filter(i=>i.category===cat.id);
    return its.length?{...cat,items:its,subtotal:its.reduce((s,i)=>s+(i.total_cost||0),0)}:null;
  }).filter(Boolean);

  const toolCursor=(spaceHeld||tool==='select')?'grab':{area:'crosshair',linear:'crosshair',count:'cell',scale:'crosshair'}[tool]||'default';

  if(loading) return <div style={{textAlign:'center',padding:40,color:t.text4,fontSize:12,fontFamily:"'DM Mono',monospace"}}>Loading...</div>;

  return (
    <div style={{display:'flex',height:'100%',gap:0,overflow:'hidden'}}>

      {/* ── Left: Plan Viewer ── */}
      <div style={{flex:1,display:'flex',flexDirection:'column',borderRight:`1px solid ${t.border}`,overflow:'hidden',minWidth:0}}>

        {/* Plan toolbar */}
        <div style={{display:'flex',gap:6,padding:'8px 12px',borderBottom:`1px solid ${t.border}`,flexShrink:0,alignItems:'center',flexWrap:'wrap',background:t.bg2}}>

          {/* Plan selector / upload */}
          <div style={{display:'flex',gap:6,alignItems:'center',flex:1,minWidth:0}}>
            {plans.length>0&&(
              <select value={selPlan?.id||''} onChange={e=>{
                const p=plans.find(x=>x.id===Number(e.target.value));
                setSelPlan(p||null);
                if(p?.scale_px_per_ft) setScale(p.scale_px_per_ft); else setScale(null);
              }} style={{...inputStyle,fontSize:12,padding:'4px 8px',maxWidth:180}}>
                {plans.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            <button onClick={()=>fileRef.current?.click()} disabled={!!uploading}
              style={{background:'none',border:`1px solid ${t.border2}`,color:t.text2,padding:'4px 10px',borderRadius:5,cursor:'pointer',fontSize:11,display:'flex',alignItems:'center',gap:4,flexShrink:0}}>
              {uploading?'Uploading…':'📎 Upload Plan'}
            </button>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{display:'none'}} onChange={e=>handleUpload(e.target.files[0])}/>
          </div>

          {/* Scale indicator */}
          {scale&&<span style={{fontSize:10,color:'#10B981',fontFamily:"'DM Mono',monospace",background:'rgba(16,185,129,0.1)',padding:'3px 8px',borderRadius:4,flexShrink:0}}>⇔ Scale set</span>}
          {!scale&&selPlan&&<span style={{fontSize:10,color:'#F59E0B',fontFamily:"'DM Mono',monospace",flexShrink:0}}>⚠ No scale</span>}

          {/* AI Takeoff */}
          {selPlan&&<button onClick={runAITakeoff} disabled={analyzing}
            style={{background:'linear-gradient(135deg,#7c3aed,#a855f7)',border:'none',color:'#fff',padding:'5px 12px',borderRadius:5,cursor:'pointer',fontSize:11,fontWeight:700,display:'flex',alignItems:'center',gap:4,flexShrink:0}}>
            {analyzing?<><span style={{animation:'spin 0.8s linear infinite',display:'inline-block'}}>◌</span> Analyzing…</>:<><span>✦</span> AI Takeoff</>}
          </button>}
        </div>

        {/* Drawing toolbar */}
        {selPlan&&(
          <div style={{display:'flex',gap:4,padding:'6px 12px',borderBottom:`1px solid ${t.border}`,flexShrink:0,background:t.bg,alignItems:'center'}}>
            {[
              {id:'select',icon:'↖',label:'Select'},
              {id:'area',icon:'⬡',label:'Area'},
              {id:'linear',icon:'━',label:'Linear'},
              {id:'count',icon:'✕',label:'Count'},
              {id:'scale',icon:'⇔',label:'Scale'},
            ].map(tb=>(
              <button key={tb.id} onClick={()=>{setTool(tb.id);setActivePts([]);if(tb.id==='scale'){setScaleStep('picking');setScalePts([]);}else setScaleStep(null);}}
                title={tb.label}
                style={{padding:'5px 10px',borderRadius:5,border:tool===tb.id?`1px solid #F97316`:`1px solid ${t.border}`,background:tool===tb.id?'rgba(249,115,22,0.1)':'none',color:tool===tb.id?'#F97316':t.text3,cursor:'pointer',fontSize:13,fontWeight:600,fontFamily:"'DM Mono',monospace"}}>
                {tb.icon} <span style={{fontSize:9,marginLeft:3}}>{tb.label}</span>
              </button>
            ))}
            {tool==='area'&&activePts.length>0&&(
              <span style={{fontSize:10,color:'#F59E0B',fontFamily:"'DM Mono',monospace",marginLeft:4}}>
                {activePts.length} pts {activePts.length>=3?'• click first point to close':''}
              </span>
            )}
            {tool==='linear'&&activePts.length===1&&(
              <span style={{fontSize:10,color:'#06B6D4',fontFamily:"'DM Mono',monospace",marginLeft:4}}>Click end point</span>
            )}
            {scaleStep==='picking'&&<span style={{fontSize:10,color:'#10B981',fontFamily:"'DM Mono',monospace",marginLeft:4}}>Click 2 points of known distance ({scalePts.length}/2)</span>}
            {!scale&&tool!=='scale'&&<span style={{fontSize:10,color:t.text4,fontFamily:"'DM Mono',monospace",marginLeft:'auto'}}>Set scale first for accurate measurements</span>}
          </div>
        )}

        {/* Plan canvas */}
        <div style={{flex:1,overflow:'auto',display:'flex',alignItems:'flex-start',justifyContent:'flex-start',background:t.bg,padding:selPlan?0:40}}>
          {!selPlan?(
            <div style={{width:'100%',textAlign:'center'}}>
              <div style={{fontSize:40,marginBottom:16}}>📐</div>
              <div style={{fontSize:14,color:t.text2,marginBottom:8}}>No plans uploaded yet</div>
              <div style={{fontSize:11,color:t.text4,fontFamily:"'DM Mono',monospace",marginBottom:20}}>Upload a PDF or image of your plans to get started</div>
              <button onClick={()=>fileRef.current?.click()}
                style={{background:'#F97316',border:'none',color:'#000',padding:'10px 22px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:700}}>
                📎 Upload Plans
              </button>
            </div>
          ):(
            <div style={{position:'relative',display:'inline-block',minWidth:'100%'}}>
              <img ref={imgRef} src={selPlan.file_url} alt="Plan"
                style={{display:'block',maxWidth:'100%',userSelect:'none'}}
                onLoad={handleImgLoad}
                draggable={false}/>
              <svg ref={svgRef}
                style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',cursor:toolCursor}}
                onClick={handleSvgClick}
                onMouseMove={handleSvgMove}
                onMouseLeave={()=>setHoverPt(null)}>
                {renderMeasurements()}
                {renderActiveDrawing()}
                {renderScaleLine()}
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Takeoff Panel ── */}
      <div style={{width:320,flexShrink:0,display:'flex',flexDirection:'column',overflow:'hidden',background:t.bg2}}>

        {/* Right tab bar */}
        <div style={{display:'flex',borderBottom:`1px solid ${t.border}`,flexShrink:0}}>
          {[['items','Items'],['estimate','Estimate']].map(([id,label])=>(
            <button key={id} onClick={()=>setRightTab(id)}
              style={{flex:1,padding:'10px 0',border:'none',background:'none',cursor:'pointer',fontSize:12,fontWeight:700,color:rightTab===id?'#F97316':t.text3,borderBottom:rightTab===id?'2px solid #F97316':'2px solid transparent',fontFamily:"'DM Mono',monospace"}}>
              {label}{id==='items'?` (${items.length})`:''}
            </button>
          ))}
        </div>

        {/* Items tab */}
        {rightTab==='items'&&(
          <div style={{flex:1,overflowY:'auto',padding:10}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <span style={{fontSize:10,color:t.text4,fontFamily:"'DM Mono',monospace"}}>{items.length} ITEMS</span>
              <button onClick={()=>setEditItem({project_id:project.id,plan_id:selPlan?.id})}
                style={{background:'#F97316',border:'none',color:'#000',padding:'4px 10px',borderRadius:5,cursor:'pointer',fontSize:11,fontWeight:700}}>+ Add</button>
            </div>
            {items.length===0&&(
              <div style={{textAlign:'center',padding:'40px 0',color:t.text4,fontSize:11,fontFamily:"'DM Mono',monospace"}}>
                {selPlan?<>Use tools to draw measurements<br/>or click ✦ AI Takeoff</>:'Upload a plan first'}
              </div>
            )}
            {items.map(item=>{
              const cat=TAKEOFF_CATS.find(c=>c.id===item.category)||TAKEOFF_CATS[TAKEOFF_CATS.length-1];
              return(
                <div key={item.id} onClick={()=>setEditItem(item)}
                  style={{background:t.bg3,border:`1px solid ${t.border}`,borderLeft:`3px solid ${cat.color}`,borderRadius:6,padding:'8px 10px',marginBottom:5,cursor:'pointer',transition:'border-color 0.1s'}}
                  onMouseEnter={e=>e.currentTarget.style.borderColor=t.border2}
                  onMouseLeave={e=>e.currentTarget.style.borderColor=t.border}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:6}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:11,fontWeight:700,color:t.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.description}</div>
                      <div style={{fontSize:10,color:t.text3,fontFamily:"'DM Mono',monospace",marginTop:2}}>{cat.label}</div>
                    </div>
                    <div style={{textAlign:'right',flexShrink:0}}>
                      <div style={{fontSize:11,fontWeight:700,color:t.text,fontFamily:"'DM Mono',monospace"}}>{item.quantity} {item.unit}</div>
                      <div style={{fontSize:10,color:'#10B981',fontFamily:"'DM Mono',monospace"}}>${(item.total_cost||0).toLocaleString()}</div>
                    </div>
                  </div>
                  {item.ai_generated&&<span style={{fontSize:9,color:'#a855f7',fontFamily:"'DM Mono',monospace",marginTop:3,display:'inline-block'}}>✦ AI</span>}
                </div>
              );
            })}
          </div>
        )}

        {/* Estimate tab */}
        {rightTab==='estimate'&&(
          <div style={{flex:1,overflowY:'auto',padding:10}}>
            {catGroups.length===0&&(
              <div style={{textAlign:'center',padding:'40px 0',color:t.text4,fontSize:11,fontFamily:"'DM Mono',monospace"}}>No items yet</div>
            )}
            {catGroups.map(cat=>(
              <div key={cat.id} style={{marginBottom:10}}>
                <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                  <span style={{width:8,height:8,borderRadius:2,background:cat.color,flexShrink:0}}/>
                  <span style={{fontSize:10,fontWeight:700,color:t.text2,fontFamily:"'DM Mono',monospace",flex:1}}>{cat.label.toUpperCase()}</span>
                  <span style={{fontSize:11,fontWeight:700,color:t.text,fontFamily:"'DM Mono',monospace"}}>${cat.subtotal.toLocaleString()}</span>
                </div>
                {cat.items.map(it=>(
                  <div key={it.id} style={{display:'flex',justifyContent:'space-between',padding:'3px 8px 3px 16px',fontSize:11,color:t.text3}}>
                    <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1,fontFamily:"'DM Mono',monospace"}}>{it.quantity} {it.unit}</span>
                    <span style={{color:t.text2,fontFamily:"'DM Mono',monospace",flexShrink:0}}>@ ${it.unit_cost} = <span style={{color:t.text}}>${(it.total_cost||0).toLocaleString()}</span></span>
                  </div>
                ))}
              </div>
            ))}
            {catGroups.length>0&&(
              <>
                <div style={{borderTop:`2px solid ${t.border2}`,marginTop:10,paddingTop:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:12,fontWeight:700,color:t.text,fontFamily:"'DM Mono',monospace"}}>TOTAL ESTIMATE</span>
                  <span style={{fontSize:16,fontWeight:700,color:'#10B981',fontFamily:"'DM Mono',monospace"}}>${totalEst.toLocaleString('en-US',{minimumFractionDigits:0})}</span>
                </div>
                {project.contract_value&&(
                  <div style={{fontSize:10,color:totalEst>project.contract_value?'#EF4444':'#10B981',fontFamily:"'DM Mono',monospace",textAlign:'right',marginTop:4}}>
                    {totalEst>project.contract_value?'▲ over contract':'▼ under contract'} by ${Math.abs(totalEst-project.contract_value).toLocaleString()}
                  </div>
                )}
                <button onClick={pushToSOV} disabled={pushingSOV}
                  style={{width:'100%',marginTop:14,background:'linear-gradient(135deg,#3b82f6,#1d4ed8)',border:'none',color:'#fff',padding:'10px 0',borderRadius:7,cursor:'pointer',fontSize:12,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                  {pushingSOV?'Pushing…':'⇒ Push to SOV'}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Scale entry dialog */}
      {scaleStep==='entering'&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}} onClick={()=>{setScaleStep(null);setScalePts([]);}}>
          <div onClick={e=>e.stopPropagation()} style={{background:t.bg3,border:`1px solid ${t.border2}`,borderRadius:12,padding:28,width:320}}>
            <div style={{fontSize:14,fontWeight:700,color:t.text,marginBottom:16}}>⇔ Set Scale</div>
            <div style={{fontSize:12,color:t.text3,marginBottom:12,fontFamily:"'DM Mono',monospace"}}>What is the real-world distance between the two points you selected?</div>
            <div style={{display:'flex',gap:8,marginBottom:16}}>
              <input type="number" value={scaleDist} onChange={e=>setScaleDist(e.target.value)} placeholder="Enter distance"
                style={{...inputStyle,flex:1,fontSize:14}} autoFocus onKeyDown={e=>e.key==='Enter'&&confirmScale()}/>
              <select value={scaleUnit} onChange={e=>setScaleUnit(e.target.value)} style={{...inputStyle,width:60}}>
                <option value="ft">ft</option>
                <option value="in">in</option>
              </select>
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={()=>{setScaleStep(null);setScalePts([]);}} style={{background:'none',border:`1px solid ${t.border2}`,color:t.text3,padding:'8px 16px',borderRadius:6,cursor:'pointer',fontSize:12}}>Cancel</button>
              <button onClick={confirmScale} disabled={!scaleDist} style={{background:'#10B981',border:'none',color:'#000',padding:'8px 20px',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:700}}>Set Scale</button>
            </div>
          </div>
        </div>
      )}

      {editItem&&(
        <TakeoffItemModal item={editItem} onSave={(data,type)=>{
          if(type==='delete') setItems(prev=>prev.filter(i=>i.id!==editItem.id));
          else if(type===true) setItems(prev=>[...prev.filter(i=>i.id!==data.id),data]);
          else setItems(prev=>prev.map(i=>i.id===data.id?data:i));
          setEditItem(null);
        }} onClose={()=>setEditItem(null)}/>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════
// ██████╗ ██████╗ ███████╗ ██████╗ ██████╗ ███╗   ██╗
// ██╔══██╗██╔══██╗██╔════╝██╔════╝██╔═══██╗████╗  ██║
// ██████╔╝██████╔╝█████╗  ██║     ██║   ██║██╔██╗ ██║
// ██╔═══╝ ██╔══██╗██╔══╝  ██║     ██║   ██║██║╚██╗██║
// ██║     ██║  ██║███████╗╚██████╗╚██████╔╝██║ ╚████║
//  STANDALONE TAKEOFF SOFTWARE
// ══════════════════════════════════════════════════════


// All standard construction drawing scales
// group: 'civil' | 'arch' | 'detail'
// ratio: real inches per 1 drawn inch (e.g. 1"=20ft → 240)
const CONSTRUCTION_SCALES = [
  // ── Civil / Engineering (1"=X ft) ──────────────────────────────
  { label:'1"=1ft',      group:'civil', ratio:12    },
  { label:'1"=2ft',      group:'civil', ratio:24    },
  { label:'1"=4ft',      group:'civil', ratio:48    },
  { label:'1"=5ft',      group:'civil', ratio:60    },
  { label:'1"=8ft',      group:'civil', ratio:96    },
  { label:'1"=10ft',     group:'civil', ratio:120   },
  { label:'1"=20ft',     group:'civil', ratio:240   },
  { label:'1"=30ft',     group:'civil', ratio:360   },
  { label:'1"=40ft',     group:'civil', ratio:480   },
  { label:'1"=50ft',     group:'civil', ratio:600   },
  { label:'1"=60ft',     group:'civil', ratio:720   },
  { label:'1"=80ft',     group:'civil', ratio:960   },
  { label:'1"=100ft',    group:'civil', ratio:1200  },
  { label:'1"=200ft',    group:'civil', ratio:2400  },
  { label:'1"=400ft',    group:'civil', ratio:4800  },
  { label:'1"=500ft',    group:'civil', ratio:6000  },
  { label:'1"=1000ft',   group:'civil', ratio:12000 },
  // ── Civil (fractional denominator) ─────────────────────────────
  { label:'1:10',        group:'civil', ratio:10    },
  { label:'1:20',        group:'civil', ratio:20    },
  { label:'1:50',        group:'civil', ratio:50    },
  { label:'1:100',       group:'civil', ratio:100   },
  { label:'1:200',       group:'civil', ratio:200   },
  { label:'1:500',       group:'civil', ratio:500   },
  { label:'1:1000',      group:'civil', ratio:1000  },
  // ── Architectural (fractional inch = 1ft) ───────────────────────
  { label:'1/16"=1ft',   group:'arch',  ratio:192   },
  { label:'3/32"=1ft',   group:'arch',  ratio:128   },
  { label:'1/8"=1ft',    group:'arch',  ratio:96    },
  { label:'3/16"=1ft',   group:'arch',  ratio:64    },
  { label:'1/4"=1ft',    group:'arch',  ratio:48    },
  { label:'3/8"=1ft',    group:'arch',  ratio:32    },
  { label:'1/2"=1ft',    group:'arch',  ratio:24    },
  { label:'3/4"=1ft',    group:'arch',  ratio:16    },
  { label:'1"=1ft',      group:'arch',  ratio:12    },
  { label:'1.5"=1ft',    group:'arch',  ratio:8     },
  { label:'3"=1ft',      group:'arch',  ratio:4     },
  // ── Detail scales ───────────────────────────────────────────────
  { label:'6"=1ft',      group:'detail',ratio:2     },
  { label:'12"=1ft (FS)',group:'detail',ratio:1     },
  { label:'1.5:1',       group:'detail',ratio:0.667 },
  { label:'2:1',         group:'detail',ratio:0.5   },
  { label:'4:1',         group:'detail',ratio:0.25  },
];

const UNIT_COSTS_DEFAULT = {
  concrete_slab:    { mat: 4.50, lab: 2.00, unit:'SF'  },
  concrete_footing: { mat: 85,   lab: 40,   unit:'CY'  },
  concrete_wall:    { mat: 95,   lab: 55,   unit:'CY'  },
  masonry_cmu:      { mat: 12,   lab: 6,    unit:'SF'  },
  masonry_brick:    { mat: 14,   lab: 8,    unit:'SF'  },
  rebar:            { mat: 0.85, lab: 0.35, unit:'LB'  },
  formwork:         { mat: 2.50, lab: 2.00, unit:'SF'  },
  excavation:       { mat: 0,    lab: 8,    unit:'CY'  },
  flatwork:         { mat: 3.50, lab: 2.50, unit:'SF'  },
  grout:            { mat: 140,  lab: 60,   unit:'CY'  },
  other:            { mat: 0,    lab: 0,    unit:'LS'  },
};

const ASSEMBLIES = [
  { id:'sog_4in',    label:'4" Slab on Grade',    items:[
    {category:'concrete_slab',    description:'Concrete slab 4"',  qty_factor:1,    unit:'SF'},
    {category:'rebar',            description:'Rebar #4 @ 16" OC', qty_factor:1.5,  unit:'LB'},
    {category:'formwork',         description:'Edge forms',         qty_factor:0.05, unit:'SF'},
    {category:'excavation',       description:'Sub-base prep',      qty_factor:0.012,unit:'CY'},
  ]},
  { id:'sog_6in',    label:'6" Slab on Grade',    items:[
    {category:'concrete_slab',    description:'Concrete slab 6"',  qty_factor:1,    unit:'SF'},
    {category:'rebar',            description:'Rebar #4 @ 12" OC', qty_factor:2.2,  unit:'LB'},
    {category:'formwork',         description:'Edge forms',         qty_factor:0.05, unit:'SF'},
    {category:'excavation',       description:'Sub-base prep',      qty_factor:0.018,unit:'CY'},
  ]},
  { id:'strip_fnd',  label:'Strip Footing',        items:[
    {category:'concrete_footing', description:'Strip footing concrete', qty_factor:1,   unit:'CY'},
    {category:'rebar',            description:'Rebar longitudinal',     qty_factor:120,  unit:'LB'},
    {category:'formwork',         description:'Footing forms',          qty_factor:18,   unit:'SF'},
    {category:'excavation',       description:'Footing excavation',     qty_factor:1.15, unit:'CY'},
  ]},
  { id:'cmu_wall',   label:'CMU Block Wall',        items:[
    {category:'masonry_cmu',      description:'8" CMU block',           qty_factor:1,    unit:'SF'},
    {category:'grout',            description:'Grout fill cells',       qty_factor:0.005,unit:'CY'},
    {category:'rebar',            description:'Vertical rebar #4',      qty_factor:0.6,  unit:'LB'},
  ]},
  { id:'flatwork',   label:'Concrete Flatwork',     items:[
    {category:'flatwork',         description:'Concrete flatwork 4"',   qty_factor:1,    unit:'SF'},
    {category:'rebar',            description:'WWF 6x6 W2.9',           qty_factor:0.9,  unit:'LB'},
    {category:'formwork',         description:'Perimeter forms',        qty_factor:0.04, unit:'SF'},
  ]},
];

// ── Unit Cost Editor ──────────────────────────────────
function UnitCostEditor({ onClose }) {
  const { t } = useTheme();
  const [costs, setCosts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('unitCosts')||'{}'); } catch{ return {}; }
  });
  const merged = {...UNIT_COSTS_DEFAULT,...costs};
  const set = (cat, field, val) => setCosts(prev => ({...prev, [cat]:{...merged[cat],[field]:Number(val)||0}}));
  const save = () => { localStorage.setItem('unitCosts', JSON.stringify(costs)); onClose(); };
  const dynInput = {...inputStyle, fontSize:12, padding:'4px 8px', background:t.input, borderColor:t.inputBorder, color:t.inputText};

  return (
    <APMModal title="Unit Cost Database" onClose={onClose} width={620}>
      <div style={{fontSize:11,color:t.text3,marginBottom:12,fontFamily:"'DM Mono',monospace"}}>Edit your material and labor rates. Changes apply to all new estimates.</div>
      <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr',gap:6,marginBottom:8}}>
        {['Category','Mat $/unit','Lab $/unit','Unit'].map(h=>(
          <div key={h} style={{fontSize:9,color:t.text4,fontFamily:"'DM Mono',monospace",letterSpacing:0.5,padding:'0 4px'}}>{h}</div>
        ))}
      </div>
      <div style={{maxHeight:340,overflowY:'auto',display:'flex',flexDirection:'column',gap:4}}>
        {TAKEOFF_CATS.map(cat => {
          const c = merged[cat.id]||{mat:0,lab:0,unit:cat.unit};
          return (
            <div key={cat.id} style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr',gap:6,alignItems:'center',padding:'5px 4px',borderRadius:5,background:t.bg4}}>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <span style={{width:8,height:8,borderRadius:2,background:cat.color,flexShrink:0}}/>
                <span style={{fontSize:11,color:t.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{cat.label}</span>
              </div>
              <input type="number" value={c.mat} onChange={e=>set(cat.id,'mat',e.target.value)} style={{...dynInput}}/>
              <input type="number" value={c.lab} onChange={e=>set(cat.id,'lab',e.target.value)} style={{...dynInput}}/>
              <input value={c.unit||cat.unit} onChange={e=>set(cat.id,'unit',e.target.value)} style={{...dynInput}}/>
            </div>
          );
        })}
      </div>
      <div style={{display:'flex',gap:8,marginTop:20,justifyContent:'flex-end'}}>
        <button onClick={onClose} style={{background:'none',border:`1px solid ${t.border2}`,color:t.text3,padding:'8px 18px',borderRadius:6,cursor:'pointer',fontSize:13}}>Cancel</button>
        <button onClick={save} style={{background:'#F97316',border:'none',color:'#000',padding:'8px 22px',borderRadius:6,cursor:'pointer',fontSize:13,fontWeight:700}}>Save Rates</button>
      </div>
    </APMModal>
  );
}

// ── Assembly Picker ───────────────────────────────────
function AssemblyPicker({ onApply, onClose }) {
  const { t } = useTheme();
  const [sel, setSel] = useState(null);
  const [qty, setQty] = useState('');

  const apply = () => {
    if(!sel||!qty) return;
    const asm = ASSEMBLIES.find(a=>a.id===sel);
    if(!asm) return;
    const costs = (() => { try { return {...UNIT_COSTS_DEFAULT,...JSON.parse(localStorage.getItem('unitCosts')||'{}')}; } catch{ return UNIT_COSTS_DEFAULT; } })();
    const items = asm.items.map(it => {
      const q = Number(qty) * it.qty_factor;
      const c = costs[it.category]||UNIT_COSTS_DEFAULT[it.category]||{mat:0,lab:0};
      const uc = (c.mat||0)+(c.lab||0);
      return { category:it.category, description:it.description, quantity:Math.round(q*10)/10, unit:it.unit, unit_cost:uc, total_cost:Math.round(q*uc*100)/100, measurement_type:'manual', ai_generated:false };
    });
    onApply(items);
  };

  return (
    <APMModal title="Assembly Library" onClose={onClose} width={480}>
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {ASSEMBLIES.map(asm=>(
          <div key={asm.id} onClick={()=>setSel(asm.id)}
            style={{border:`1px solid ${sel===asm.id?'#F97316':t.border}`,borderRadius:8,padding:'10px 12px',cursor:'pointer',background:sel===asm.id?'rgba(249,115,22,0.06)':t.bg4,transition:'all 0.1s'}}>
            <div style={{fontSize:13,fontWeight:700,color:sel===asm.id?'#F97316':t.text,marginBottom:4}}>{asm.label}</div>
            <div style={{fontSize:10,color:t.text4,fontFamily:"'DM Mono',monospace"}}>{asm.items.map(i=>i.description).join(' · ')}</div>
          </div>
        ))}
      </div>
      {sel&&(
        <div style={{marginTop:14,display:'flex',alignItems:'center',gap:10}}>
          <div style={{flex:1}}>
            <label style={labelStyle}>Base Quantity ({ASSEMBLIES.find(a=>a.id===sel)?.items[0]?.unit||'SF'})</label>
            <input type="number" value={qty} onChange={e=>setQty(e.target.value)} placeholder="e.g. 2500" style={{...inputStyle,fontSize:14,width:'100%'}} autoFocus/>
          </div>
        </div>
      )}
      <div style={{display:'flex',gap:8,marginTop:20,justifyContent:'flex-end'}}>
        <button onClick={onClose} style={{background:'none',border:`1px solid ${t.border2}`,color:t.text3,padding:'8px 18px',borderRadius:6,cursor:'pointer',fontSize:13}}>Cancel</button>
        <button onClick={apply} disabled={!sel||!qty} style={{background:'#F97316',border:'none',color:'#000',padding:'8px 22px',borderRadius:6,cursor:'pointer',fontSize:13,fontWeight:700,opacity:sel&&qty?1:0.4}}>Apply Assembly</button>
      </div>
    </APMModal>
  );
}

// ── Bid Summary Modal ─────────────────────────────────
function BidSummaryModal({ project, items, onClose }) {
  const { t } = useTheme();
  const [overhead, setOverhead] = useState(10);
  const [markup, setMarkup] = useState(8);
  const [bond, setBond] = useState(1.5);
  const [notes, setNotes] = useState('');

  const subtotal = items.reduce((s,i)=>s+(i.total_cost||0),0);
  const overheadAmt = subtotal * (overhead/100);
  const bondAmt = (subtotal+overheadAmt) * (bond/100);
  const markupAmt = (subtotal+overheadAmt+bondAmt) * (markup/100);
  const total = subtotal+overheadAmt+bondAmt+markupAmt;

  const catGroups = TAKEOFF_CATS.map(cat=>{
    const its = items.filter(i=>i.category===cat.id);
    return its.length?{...cat,subtotal:its.reduce((s,i)=>s+(i.total_cost||0),0)}:null;
  }).filter(Boolean);

  const printBid = () => {
    const win = window.open('','_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>Bid Estimate - ${project.name}</title>
    <style>
      body{font-family:'Arial',sans-serif;max-width:800px;margin:40px auto;color:#111;font-size:13px}
      h1{font-size:22px;margin:0 0 4px}h2{font-size:15px;margin:20px 0 8px;color:#333;border-bottom:1px solid #ddd;padding-bottom:4px}
      .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #F97316}
      .logo{font-size:18px;font-weight:800;color:#F97316}.sub{font-size:11px;color:#666;margin-top:2px}
      table{width:100%;border-collapse:collapse;margin-bottom:16px}th{text-align:left;padding:6px 8px;font-size:11px;color:#666;border-bottom:2px solid #eee;text-transform:uppercase;letter-spacing:0.5px}
      td{padding:6px 8px;border-bottom:1px solid #f0f0f0;font-size:12px}.right{text-align:right}.bold{font-weight:700}
      .total-row{background:#f9f9f9;font-weight:700}.grand-total{background:#F97316;color:#000;font-size:15px}
      .notes{background:#fffdf7;border:1px solid #F9731640;border-radius:6px;padding:12px;margin-top:16px;font-size:12px;color:#555}
      @media print{body{margin:20px}}
    </style></head><body>
    <div class="header">
      <div>
        <div class="logo">${project.company==='fcg'?'Foundation Construction Group LLC':project.company==='brc'?'BR Concrete Inc.':'P4S Corp'}</div>
        <div class="sub">Concrete & Masonry Contractor</div>
      </div>
      <div style="text-align:right">
        <div class="bold" style="font-size:16px">BID ESTIMATE</div>
        <div class="sub">Date: ${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</div>
        <div class="sub">Bid #: ${Date.now().toString().slice(-6)}</div>
      </div>
    </div>
    <h1>${project.name}</h1>
    <div class="sub">${project.address||''} ${project.gc_name?'· GC: '+project.gc_name:''}</div>
    <h2>Cost Breakdown by Division</h2>
    <table>
      <thead><tr><th>Division</th><th class="right">Amount</th></tr></thead>
      <tbody>
        ${catGroups.map(c=>`<tr><td>${c.label}</td><td class="right">$${c.subtotal.toLocaleString('en-US',{minimumFractionDigits:2})}</td></tr>`).join('')}
        <tr class="total-row"><td class="bold">Direct Cost Subtotal</td><td class="right bold">$${subtotal.toLocaleString('en-US',{minimumFractionDigits:2})}</td></tr>
      </tbody>
    </table>
    <h2>Bid Summary</h2>
    <table>
      <tbody>
        <tr><td>Direct Cost Subtotal</td><td class="right">$${subtotal.toLocaleString('en-US',{minimumFractionDigits:2})}</td></tr>
        <tr><td>Overhead & General Conditions (${overhead}%)</td><td class="right">$${overheadAmt.toLocaleString('en-US',{minimumFractionDigits:2})}</td></tr>
        <tr><td>Bond (${bond}%)</td><td class="right">$${bondAmt.toLocaleString('en-US',{minimumFractionDigits:2})}</td></tr>
        <tr><td>Markup / Profit (${markup}%)</td><td class="right">$${markupAmt.toLocaleString('en-US',{minimumFractionDigits:2})}</td></tr>
        <tr class="grand-total"><td class="bold" style="padding:10px 8px">TOTAL BID PRICE</td><td class="right bold" style="padding:10px 8px;font-size:16px">$${total.toLocaleString('en-US',{minimumFractionDigits:2})}</td></tr>
      </tbody>
    </table>
    ${notes?`<div class="notes"><strong>Clarifications / Exclusions:</strong><br/>${notes.split('\n').join('<br/>')}</div>`:''}
    <div style="margin-top:30px;font-size:10px;color:#999;border-top:1px solid #eee;padding-top:12px">This estimate is valid for 30 days from date of issue. Prices subject to material cost fluctuations. Does not include permits unless noted.</div>
    </body></html>`);
    win.document.close(); win.focus(); setTimeout(()=>win.print(),500);
  };

  const dynInput = {...inputStyle,fontSize:13,width:'70px',textAlign:'right',padding:'5px 8px'};

  return (
    <APMModal title="Bid Summary" onClose={onClose} width={560}>
      <div style={{display:'flex',flexDirection:'column',gap:0}}>
        {/* Cost breakdown */}
        <div style={{background:t.bg4,borderRadius:8,padding:14,marginBottom:12}}>
          <div style={{fontSize:10,color:t.text4,fontFamily:"'DM Mono',monospace",letterSpacing:0.5,marginBottom:10}}>DIVISION COSTS</div>
          {catGroups.map(cat=>(
            <div key={cat.id} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:`1px solid ${t.border}`}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{width:8,height:8,borderRadius:2,background:cat.color}}/>
                <span style={{fontSize:12,color:t.text}}>{cat.label}</span>
              </div>
              <span style={{fontSize:12,fontWeight:600,color:t.text,fontFamily:"'DM Mono',monospace"}}>${cat.subtotal.toLocaleString()}</span>
            </div>
          ))}
          <div style={{display:'flex',justifyContent:'space-between',paddingTop:8,marginTop:4}}>
            <span style={{fontSize:12,fontWeight:700,color:t.text}}>Direct Cost Subtotal</span>
            <span style={{fontSize:13,fontWeight:700,color:t.text,fontFamily:"'DM Mono',monospace"}}>${subtotal.toLocaleString()}</span>
          </div>
        </div>

        {/* Adjustments */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:12}}>
          {[['Overhead %',overhead,setOverhead],['Bond %',bond,setBond],['Markup %',markup,setMarkup]].map(([lbl,val,setter])=>(
            <APMField key={lbl} label={lbl}>
              <input type="number" value={val} onChange={e=>setter(Number(e.target.value)||0)} style={{...dynInput,width:'100%'}}/>
            </APMField>
          ))}
        </div>

        {/* Total */}
        <div style={{background:'linear-gradient(135deg,#F97316,#ea580c)',borderRadius:8,padding:'14px 18px',display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <span style={{fontSize:13,fontWeight:700,color:'#000'}}>TOTAL BID PRICE</span>
          <span style={{fontSize:22,fontWeight:800,color:'#000',fontFamily:"'DM Mono',monospace"}}>${total.toLocaleString('en-US',{minimumFractionDigits:0})}</span>
        </div>

        <APMField label="Clarifications / Exclusions">
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="e.g. Does not include permits, demo, or haul-off..." style={{...inputStyle,minHeight:70,resize:'vertical',fontSize:13}}/>
        </APMField>
      </div>
      <div style={{display:'flex',gap:8,marginTop:20,justifyContent:'flex-end'}}>
        <button onClick={onClose} style={{background:'none',border:`1px solid ${t.border2}`,color:t.text3,padding:'8px 18px',borderRadius:6,cursor:'pointer',fontSize:13}}>Close</button>
        <button onClick={printBid} style={{background:'#111',border:'1px solid #333',color:'#fff',padding:'8px 18px',borderRadius:6,cursor:'pointer',fontSize:13,fontWeight:700}}>🖨 Print / PDF</button>
      </div>
    </APMModal>
  );
}

// ── Takeoff Project Modal ─────────────────────────────
function TakeoffProjectModal({ project, apmProjects, onSave, onClose }) {
  const { t } = useTheme();
  const isNew = !project?.id;
  const [form, setForm] = useState({
    name:'', company:'fcg', address:'', gc_name:'', bid_date:'', contract_value:'', apm_project_id:null, status:'estimating',
    ...(project||{})
  });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const dynInput = {...inputStyle,background:'var(--inp)',borderColor:'var(--inpbd)',color:'var(--inptx)',fontSize:13};

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = {...form, contract_value: form.contract_value?Number(form.contract_value):null};
    delete payload.id; delete payload.created_at;
    if (isNew) {
      const {data, error} = await supabase.from('precon_projects').insert([payload]).select().single();
      if (error) { alert('Error creating project: ' + error.message); setSaving(false); return; }
      if (data) onSave(data, true);
    } else {
      const {data, error} = await supabase.from('precon_projects').update(payload).eq('id', project.id).select().single();
      if (error) { alert('Error saving: ' + error.message); setSaving(false); return; }
      onSave({...project,...(data||form)}, false);
    }
    setSaving(false);
  };

  return (
    <APMModal title={isNew?'New Takeoff Project':'Edit Project'} onClose={onClose} width={500}>
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        <APMField label="Project Name"><input value={form.name} onChange={e=>set('name',e.target.value)} style={{...dynInput,fontSize:15}} autoFocus/></APMField>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <APMField label="Company">
            <select value={form.company} onChange={e=>set('company',e.target.value)} style={{...dynInput}}>
              {COMPANIES.filter(c=>c.id!=='all').map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </APMField>
          <APMField label="Status">
            <select value={form.status} onChange={e=>set('status',e.target.value)} style={{...dynInput}}>
              {['estimating','bid_submitted','awarded','lost','hold'].map(s=><option key={s} value={s}>{s.replace(/_/g,' ').toUpperCase()}</option>)}
            </select>
          </APMField>
        </div>
        <APMField label="Address"><input value={form.address||''} onChange={e=>set('address',e.target.value)} style={{...dynInput}}/></APMField>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <APMField label="GC / Owner"><input value={form.gc_name||''} onChange={e=>set('gc_name',e.target.value)} style={{...dynInput}}/></APMField>
          <APMField label="Bid Due Date"><input type="date" value={form.bid_date||''} onChange={e=>set('bid_date',e.target.value)} style={{...dynInput}}/></APMField>
        </div>
        <APMField label="Estimated Contract Value"><input type="number" value={form.contract_value||''} onChange={e=>set('contract_value',e.target.value)} placeholder="0" style={{...dynInput}}/></APMField>
        {apmProjects?.length>0&&(
          <APMField label="Link to APM Project (optional)">
            <select value={form.apm_project_id||''} onChange={e=>set('apm_project_id',e.target.value||null)} style={{...dynInput}}>
              <option value="">— None —</option>
              {apmProjects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </APMField>
        )}
      </div>
      <div style={{display:'flex',gap:8,marginTop:20,justifyContent:'space-between'}}>
        {!isNew&&<button onClick={()=>{if(window.confirm('Delete "'+project.name+'"? This will permanently remove the project and all takeoff data.'))onSave(project,'delete');}} style={{background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.3)',color:'#ef4444',padding:'8px 14px',borderRadius:6,cursor:'pointer',fontSize:12}}>Delete</button>}
        <div style={{display:'flex',gap:8,marginLeft:'auto'}}>
          <button onClick={onClose} style={{background:'none',border:`1px solid var(--bd2)`,color:'var(--tx3)',padding:'8px 18px',borderRadius:6,cursor:'pointer',fontSize:13}}>Cancel</button>
          <button onClick={handleSave} disabled={saving||!form.name.trim()} style={{background:'#F97316',border:'none',color:'#000',padding:'8px 22px',borderRadius:6,cursor:'pointer',fontSize:13,fontWeight:700}}>{saving?'Saving...':isNew?'Create':'Save'}</button>
        </div>
      </div>
    </APMModal>
  );
}

// ── New Condition Creator ─────────────────────────────────────────
// Fast: type name → pick measurement type → creates and arms
function AddItemInline({ cat, selPlan, project, items, onCreated }) {
  const { t } = useTheme();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [mt, setMt] = useState('area');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef();

  if(!open) return(
    <div style={{padding:'4px 10px 4px 16px'}}>
      <button onClick={()=>{setOpen(true);setTimeout(()=>inputRef.current?.focus(),40);}}
        style={{width:'100%',background:'none',border:`1px dashed ${cat.color}55`,color:cat.color,
          padding:'4px 0',borderRadius:4,cursor:'pointer',fontSize:9,fontWeight:700,
          fontFamily:"'DM Mono',monospace",opacity:0.7}}>
        + Add item
      </button>
    </div>
  );

  const handleCreate = async () => {
    if(!name.trim()) return;
    setSaving(true);
    const unitMap = {area:'SF',linear:'LF',count:'EA',manual:'LS'};
    const payload = {
      project_id:project.id, plan_id:selPlan.id,
      category:cat.id, description:name.trim(),
      quantity:0, unit:unitMap[mt]||cat.unit, unit_cost:cat.defaultCost, total_cost:0,
      measurement_type:mt, points:[], color:cat.color,
      ai_generated:false, sort_order:items.length,
    };
    const {data} = await supabase.from('takeoff_items').insert([payload]).select().single();
    if(data) onCreated(data);
    setName(''); setOpen(false); setSaving(false);
  };

  return(
    <div style={{padding:'6px 10px 6px 16px',background:`${cat.color}08`,borderTop:`1px dashed ${cat.color}40`}}>
      <input ref={inputRef} value={name} onChange={e=>setName(e.target.value)}
        placeholder={`Item name (e.g. Sidewalk, Footing...)`}
        onKeyDown={e=>{if(e.key==='Enter'&&name.trim())handleCreate();if(e.key==='Escape')setOpen(false);}}
        style={{width:'100%',background:t.bg3,border:`1px solid ${cat.color}60`,color:t.text,
          borderRadius:4,padding:'5px 8px',fontSize:10,outline:'none',boxSizing:'border-box',marginBottom:6}}/>
      <div style={{display:'flex',gap:4,marginBottom:6}}>
        {[{id:'area',icon:'⬡',lbl:'SF'},{id:'linear',icon:'━',lbl:'LF'},{id:'count',icon:'✕',lbl:'EA'}].map(m=>(
          <button key={m.id} onClick={()=>setMt(m.id)}
            style={{flex:1,padding:'3px 0',border:`1px solid ${mt===m.id?cat.color:t.border}`,
              background:mt===m.id?`${cat.color}25`:'transparent',
              color:mt===m.id?cat.color:t.text4,
              borderRadius:3,cursor:'pointer',fontSize:8,fontFamily:"'DM Mono',monospace",fontWeight:700}}>
            {m.icon} {m.lbl}
          </button>
        ))}
      </div>
      <div style={{display:'flex',gap:4}}>
        <button onClick={handleCreate} disabled={!name.trim()||saving}
          style={{flex:1,background:cat.color,border:'none',color:'#000',padding:'5px 0',borderRadius:4,
            cursor:name.trim()?'pointer':'not-allowed',fontSize:10,fontWeight:700,opacity:name.trim()?1:0.4}}>
          {saving?'...':'✓ Add & Measure'}
        </button>
        <button onClick={()=>setOpen(false)}
          style={{background:'none',border:`1px solid ${t.border}`,color:t.text4,padding:'5px 8px',borderRadius:4,cursor:'pointer',fontSize:10}}>✕</button>
      </div>
    </div>
  );
}

function NewConditionRow({ selPlan, project, items, onCreated }) {
  const { t } = useTheme();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [cat, setCat] = useState('site_concrete');
  const [mt, setMt] = useState('area');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef();

  // Auto-set measure type from category default
  const catDef = TAKEOFF_CATS.find(c=>c.id===cat)||TAKEOFF_CATS[0];
  const unitLabel = catDef.unit;

  const handleCreate = async () => {
    if(!selPlan?.id||!name.trim()) return;
    setSaving(true);
    const payload = {
      project_id: project.id, plan_id: selPlan.id,
      category: cat, description: name.trim(),
      quantity: 0, unit: unitLabel, unit_cost: catDef.defaultCost, total_cost: 0,
      measurement_type: mt, points: [], color: catDef.color,
      ai_generated: false, sort_order: items.length,
    };
    const {data} = await supabase.from('takeoff_items').insert([payload]).select().single();
    if(data) onCreated(data);
    setName(''); setOpen(false); setSaving(false);
  };

  if(!open) return(
    <div style={{padding:'6px 8px',borderBottom:`1px solid ${t.border}`,flexShrink:0}}>
      <button onClick={()=>{setOpen(true);setTimeout(()=>inputRef.current?.focus(),50);}}
        disabled={!selPlan?.id}
        style={{width:'100%',background:'rgba(16,185,129,0.08)',border:'1px dashed rgba(16,185,129,0.4)',color:'#10B981',padding:'7px 0',borderRadius:5,cursor:selPlan?.id?'pointer':'not-allowed',fontSize:11,fontWeight:700,fontFamily:"'DM Mono',monospace",opacity:selPlan?.id?1:0.4}}>
        + NEW ITEM
      </button>
    </div>
  );

  return(
    <div style={{padding:'10px 8px',borderBottom:`1px solid #10B981`,background:'rgba(16,185,129,0.04)',flexShrink:0}}>
      {/* Step 1: Name */}
      <div style={{fontSize:8,color:'#10B981',fontFamily:"'DM Mono',monospace",letterSpacing:0.8,marginBottom:4}}>ITEM NAME</div>
      <input ref={inputRef} value={name} onChange={e=>setName(e.target.value)}
        placeholder="e.g. Sidewalk, Curb & Gutter, Footing..."
        onKeyDown={e=>{if(e.key==='Enter'&&name.trim()) handleCreate(); if(e.key==='Escape') setOpen(false);}}
        style={{width:'100%',background:t.bg3,border:`1px solid ${t.border2}`,color:t.text,borderRadius:4,padding:'6px 8px',fontSize:11,outline:'none',marginBottom:8,boxSizing:'border-box'}}/>

      {/* Step 2: Category */}
      <div style={{fontSize:8,color:t.text4,fontFamily:"'DM Mono',monospace",letterSpacing:0.8,marginBottom:4}}>CATEGORY</div>
      <select value={cat} onChange={e=>setCat(e.target.value)}
        style={{width:'100%',background:t.bg3,border:`1px solid ${t.border2}`,color:t.text,borderRadius:4,padding:'5px 7px',fontSize:11,marginBottom:8,boxSizing:'border-box'}}>
        {TAKEOFF_CATS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
      </select>

      {/* Step 3: Measure type */}
      <div style={{fontSize:8,color:t.text4,fontFamily:"'DM Mono',monospace",letterSpacing:0.8,marginBottom:4}}>MEASURE AS</div>
      <div style={{display:'flex',gap:4,marginBottom:10}}>
        {[{id:'area',icon:'⬡',label:'Area (SF)'},{id:'linear',icon:'━',label:'Linear (LF)'},{id:'count',icon:'✕',label:'Count (EA)'}].map(m=>(
          <button key={m.id} onClick={()=>setMt(m.id)}
            style={{flex:1,padding:'5px 0',border:`1px solid ${mt===m.id?'#10B981':t.border}`,
              background:mt===m.id?'rgba(16,185,129,0.15)':'rgba(0,0,0,0.2)',
              color:mt===m.id?'#10B981':'#888',
              borderRadius:4,cursor:'pointer',fontSize:9,fontFamily:"'DM Mono',monospace",fontWeight:700}}>
            <div style={{fontSize:12}}>{m.icon}</div>
            <div style={{fontSize:8,marginTop:1}}>{m.label}</div>
          </button>
        ))}
      </div>

      <div style={{display:'flex',gap:5}}>
        <button onClick={handleCreate} disabled={!name.trim()||saving}
          style={{flex:1,background:'#10B981',border:'none',color:'#000',padding:'7px 0',borderRadius:4,cursor:name.trim()?'pointer':'not-allowed',fontSize:11,fontWeight:700,opacity:name.trim()?1:0.4}}>
          {saving?'Saving...':'✓ Create & Start Measuring'}
        </button>
        <button onClick={()=>setOpen(false)}
          style={{background:'none',border:`1px solid ${t.border}`,color:t.text4,padding:'7px 10px',borderRadius:4,cursor:'pointer',fontSize:11}}>✕</button>
      </div>
    </div>
  );
}

// ── Inline Item Editor (expands in sidebar row) ──────────────────
function InlineItemEditor({ item, cat, onSave, onDelete }) {
  const { t } = useTheme();
  const [form, setForm] = useState({
    description: item.description||'',
    category: item.category||'other',
    quantity: item.quantity||'',
    unit: item.unit||'SF',
    unit_cost: item.unit_cost||0,
  });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const total = (Number(form.quantity)||0) * (Number(form.unit_cost)||0);
  const inp = {background:t.bg5,border:`1px solid ${t.border2}`,color:t.text,borderRadius:4,padding:'4px 6px',fontSize:10,fontFamily:"'DM Mono',monospace",width:'100%',outline:'none'};
  return(
    <div style={{padding:'8px',background:t.bg3,borderTop:`1px solid ${cat.color}40`}}>
      {/* Description */}
      <input value={form.description} onChange={e=>set('description',e.target.value)}
        placeholder="Description" autoFocus
        style={{...inp,marginBottom:6,fontSize:11}}
        onKeyDown={e=>e.key==='Enter'&&onSave(form)}/>
      {/* Category */}
      <select value={form.category} onChange={e=>{
        const c=TAKEOFF_CATS.find(x=>x.id===e.target.value)||TAKEOFF_CATS[0];
        set('category',e.target.value); set('unit',c.unit); set('unit_cost',c.defaultCost);
      }} style={{...inp,marginBottom:6}}>
        {TAKEOFF_CATS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
      {/* Qty / Unit / Rate row */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 60px 1fr',gap:4,marginBottom:6}}>
        <div>
          <div style={{fontSize:8,color:t.text4,fontFamily:"'DM Mono',monospace",marginBottom:2}}>QTY</div>
          <input type="number" value={form.quantity} onChange={e=>set('quantity',e.target.value)}
            style={{...inp}} onKeyDown={e=>e.key==='Enter'&&onSave(form)}/>
        </div>
        <div>
          <div style={{fontSize:8,color:t.text4,fontFamily:"'DM Mono',monospace",marginBottom:2}}>UNIT</div>
          <input value={form.unit} onChange={e=>set('unit',e.target.value)} style={{...inp}}/>
        </div>
        <div>
          <div style={{fontSize:8,color:t.text4,fontFamily:"'DM Mono',monospace",marginBottom:2}}>$/UNIT</div>
          <input type="number" value={form.unit_cost} onChange={e=>set('unit_cost',e.target.value)}
            style={{...inp}} onKeyDown={e=>e.key==='Enter'&&onSave(form)}/>
        </div>
      </div>
      {/* Total */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,padding:'4px 6px',background:t.bg5,borderRadius:4}}>
        <span style={{fontSize:9,color:t.text4,fontFamily:"'DM Mono',monospace"}}>TOTAL</span>
        <span style={{fontSize:12,fontWeight:700,color:'#10B981',fontFamily:"'DM Mono',monospace"}}>${total.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
      </div>
      {/* Actions */}
      <div style={{display:'flex',gap:4}}>
        <button onClick={()=>onSave(form)} style={{flex:1,background:'#10B981',border:'none',color:'#000',padding:'5px 0',borderRadius:4,cursor:'pointer',fontSize:10,fontWeight:700}}>✓ Save</button>
        <button onClick={onDelete} style={{background:'rgba(239,68,68,0.12)',border:'1px solid rgba(239,68,68,0.3)',color:'#ef4444',padding:'5px 8px',borderRadius:4,cursor:'pointer',fontSize:10}}>✕</button>
      </div>
    </div>
  );
}

const TAKEOFF_TYPES = [
  {id:'area',   label:'Area',      icon:'⬟', desc:'Measure a flat area by clicking on each corner.',                                              unit:'SF', mt:'area',   color:'#10B981'},
  {id:'linear', label:'Linear',    icon:'╱', desc:'Measure a distance by clicking on each point.',                                               unit:'LF', mt:'linear', color:'#3B82F6'},
  {id:'count',  label:'Count',     icon:'✓', desc:'Count objects by clicking on the plan to place a symbol.',                                    unit:'EA', mt:'count',  color:'#F59E0B'},
  {id:'vol2d',  label:'Volume 2D', icon:'2D',desc:'Enter the depth and measure volume by clicking on each corner. Often used for concrete slabs.',unit:'CY', mt:'area',  color:'#8B5CF6'},
  {id:'vol3d',  label:'Volume 3D', icon:'3D',desc:'Enter the width and height and measure volume by clicking on each point.',                    unit:'CY', mt:'linear', color:'#EC4899'},
];
const TO_COLORS = ['#10B981','#3B82F6','#F59E0B','#EF4444','#8B5CF6','#F97316','#06B6D4','#EC4899','#84CC16','#A855F7','#14B8A6','#F43F5E'];

// ── Full Takeoff Workspace ────────────────────────────
function TakeoffWorkspace({ project, onBack, apmProjects, onExitToOps }) {
  const { t } = useTheme();
  const [plans, setPlans] = useState([]);
  const [planSets, setPlanSets] = useState({}); // {batchId:{name,planIds:[]}} persisted to localStorage
  const [namingAll, setNamingAll] = useState(false);
  const [uploadTargetFolder, setUploadTargetFolder] = useState(null);
  const [plansFilter, setPlansFilter] = useState('all'); // 'all' | 'marked'
  const [selPlan, setSelPlan] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [tool, setTool] = useState('select');
  const [activePts, setActivePts] = useState([]);
  const [hoverPt, setHoverPt] = useState(null);
  const [scale, setScale] = useState(null);
  const [scaleStep, setScaleStep] = useState(null);
  const [scalePts, setScalePts] = useState([]);
  const [scaleDist, setScaleDist] = useState('');
  const [scaleUnit, setScaleUnit] = useState('ft');
  const [imgNat, setImgNat] = useState({w:1,h:1});
  const [imgDisp, setImgDisp] = useState({w:1,h:1});
  const [editItem, setEditItem] = useState(null);
  const [planB64, setPlanB64] = useState(null);
  const [planMime, setPlanMime] = useState('image/png');
  const [rightTab, setRightTab] = useState('items');
  const [zoom, setZoom] = useState(1);
  const [showScalePicker, setShowScalePicker] = useState(false);
  const [presetScale, setPresetScale] = useState('');
  const [planDpi, setPlanDpi] = useState(150); // scan DPI for image plans (PDFs auto-set to 144)
  const [showAssembly, setShowAssembly] = useState(false);
  const [showUnitCosts, setShowUnitCosts] = useState(false);
  const [showBidSummary, setShowBidSummary] = useState(false);
  const [editProject, setEditProject] = useState(false);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [rendering, setRendering] = useState(false);
  const [blobUrl, setBlobUrl] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [planErr, setPlanErr] = useState(null);
  const pdfDocRef = useRef(null);
  const imgRef = useRef();
  const canvasRef = useRef();
  const svgRef = useRef();
  const fileRef = useRef();
  const containerRef = useRef();
  const panRef = useRef({active:false, startX:0, startY:0, scrollX:0, scrollY:0});
  const clickTimerRef = useRef(null);   // debounce single vs double click
  const pendingClickRef = useRef(null); // pending single-click event pos
  const itemsRef = useRef(items); // always-current items ref — fixes stale closure in appendMeasurement
  const activePtsRef    = useRef([]);
  const activeCondIdRef = useRef(null);
  const selPlanRef      = useRef(null);
  const commitCurrentPtsRef = useRef(null); // assigned mid-render after appendMeasurement is defined
  const deleteShapesRef  = useRef(null); // assigned each render — callable from keydown
  const copyShapesRef    = useRef(null); // assigned each render — callable from keydown
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [activeCondId, setActiveCondId] = useState(null); // condition currently armed for drawing
  const [estSaving, setEstSaving] = useState(null);
  const [estHover, setEstHover] = useState(null);
  const [collapsedCats, setCollapsedCats] = useState({});
  const [archMode, setArchMode] = useState(false);        // legacy arch toggle (area arcs)
  const [archCtrlPending, setArchCtrlPending] = useState(false); // area: next click = ctrl pt
  // ── New tool features ──────────────────────────────────────────────────
  const [snapEnabled, setSnapEnabled]   = useState(false); // S-key angle snap
  const [arcPending, setArcPending]     = useState(false); // A-key arc mode
  const [selectedShapes, setSelectedShapes] = useState(new Set()); // shape-level: "itemId::shapeIdx"
  const selectedShapesRef               = useRef(new Set()); // always-current ref for keydown
  const [clipboard, setClipboard]       = useState([]);    // copy/paste buffer
  const clipboardRef                    = useRef([]);       // always-current ref for keydown
  const [eraserHover, setEraserHover]   = useState(null);  // {itemId,shapeIdx}
  const [lassoRect, setLassoRect]       = useState(null);  // {sx,sy,ex,ey} live lasso box
  const [copyFlash, setCopyFlash]         = useState(0);     // >0 = show 'Copied N' briefly
  const [dragOffset, setDragOffset]       = useState(null);  // {dx,dy} during shape drag
  const [vertexDrag, setVertexDrag]       = useState(null);  // {itemId,shapeIdx,vertexIdx,point:{x,y}}
  const dragOffsetRef                     = useRef(null);
  const vertexDragRef                     = useRef(null);
  const pasteOffsetRef                  = useRef(0);        // accumulates per paste
  const lassoStartRef                   = useRef(null);     // lasso drag start
  const suppressNextClickRef            = useRef(false);    // suppress SVG click after lasso drag
  const [takeoffStep, setTakeoffStep] = useState(null); // null | 'type' | 'create' | 'settings'
  const [newTOType, setNewTOType] = useState(null);
  const [newTOName, setNewTOName] = useState('');
  const [newTODesc, setNewTODesc] = useState('');
  const [newTOColor, setNewTOColor] = useState('#10B981');
  const [newTOCat, setNewTOCat] = useState('other');
  const [newTOSize, setNewTOSize] = useState('medium');
  const [creatingTO, setCreatingTO] = useState(false);
  const [toSearch, setToSearch] = useState('');
  const [collapsedPlans, setCollapsedPlans] = useState({});
  const [showSheetsDD, setShowSheetsDD] = useState(false);
  const [showScalePanel, setShowScalePanel] = useState(false);
  const [customScaleInput, setCustomScaleInput] = useState('');
  const [openTabs, setOpenTabs] = useState([]); // plan IDs open as browser tabs
  const [leftTab, setLeftTab] = useState('takeoffs'); // 'plans' | 'takeoffs'

  // ── Always-current refs: assigned synchronously each render (correct React pattern) ──
  // avoids TDZ crash that useEffect([dep]) would cause when refs precede state declarations
  itemsRef.current        = items;          // must be sync — keydown delete reads this
  activePtsRef.current    = activePts;
  activeCondIdRef.current = activeCondId;
  selPlanRef.current      = selPlan;
  selectedShapesRef.current = selectedShapes;
  clipboardRef.current    = clipboard;
  dragOffsetRef.current   = dragOffset;
  vertexDragRef.current   = vertexDrag;


  useEffect(()=>{
    const pid = project.id;
    // Load plan sets from localStorage
    try {
      const stored = JSON.parse(localStorage.getItem(`planSets_${pid}`)||'{}');
      setPlanSets(stored);
    } catch(e){}
    Promise.all([
      supabase.from('precon_plans').select('*').eq('project_id',pid).order('created_at'),
      supabase.from('takeoff_items').select('*').eq('project_id',pid).order('sort_order'),
    ]).then(([{data:p},{data:i}])=>{
      const pl=p||[];
      const validItems=(i||[]).filter(it=>it.plan_id!=null);
      setPlans(pl); setItems(validItems);
      if(pl.length>0){setSelPlan(pl[0]); if(pl[0].scale_px_per_ft) setScale(pl[0].scale_px_per_ft);}
      setLoading(false);
    });
  },[project.id]);

  // Helper: save planSets to localStorage
  const savePlanSets = (sets) => {
    setPlanSets(sets);
    try { localStorage.setItem(`planSets_${project.id}`, JSON.stringify(sets)); } catch(e){}
  };

  // Points stored as raw SVG pixel coords — no normalization needed
  // toPx is identity: SVG coord space = image pixel space
  const toPx=(x,y)=>({x,y});

  // planItems: strict per-sheet item list. Defined early so all handlers can use it.
  // IMPORTANT: items with null plan_id are excluded — they have no valid page association.
  const planItems=items.filter(i=>i.plan_id!=null && i.plan_id===selPlan?.id);

  // Sidebar shows ALL project items (across all plans) so you can arm any takeoff
  // regardless of which plan you're currently on. Items are deduplicated by
  // description+category — the first item found acts as the "canonical" arm target;
  // the sibling logic in appendMeasurement handles per-plan branching automatically.
  const sidebarItems = items.filter(i=>i.project_id===project.id);

  const getSvgPos=(e)=>{
    const c=containerRef.current;
    if(!c) return {x:0,y:0};
    const cr=c.getBoundingClientRect();
    // Mouse offset from container top-left, plus scroll, divided by zoom = SVG pixel coord
    return {
      x:(e.clientX - cr.left + c.scrollLeft) / zoom,
      y:(e.clientY - cr.top  + c.scrollTop)  / zoom,
    };
  };

  const calcArea=(pts)=>{
    if(!scale||pts.length<3) return 0;
    let a=0;
    for(let i=0;i<pts.length;i++){
      const j=(i+1)%pts.length;
      a+=pts[i].x*pts[j].y - pts[j].x*pts[i].y;
    }
    return Math.abs(a)/2/(scale*scale); // px² → ft²
  };

  const calcLinear=(p1,p2)=>{
    if(!scale) return 0;
    return Math.sqrt((p2.x-p1.x)**2+(p2.y-p1.y)**2)/scale; // px → ft
  };

  const handleImgLoad=()=>{
    const img=imgRef.current;
    if(!img) return;
    setImgNat({w:img.naturalWidth, h:img.naturalHeight});
    setImgDisp({w:img.offsetWidth||img.naturalWidth, h:img.offsetHeight||img.naturalHeight});
    // Image plans: DPI stays at user-set value (planDpi)
  };

  const renderPdfPage = async (doc, pageN=1) => {
    if(!doc) return;
    // Wait for canvas to be in DOM
    let canvas = canvasRef.current;
    if(!canvas){
      await new Promise(r=>setTimeout(r,120));
      canvas = canvasRef.current;
    }
    if(!canvas) return;
    setRendering(true);
    try {
      const page = await doc.getPage(pageN);
      const viewport = page.getViewport({scale: 2.0});
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = viewport.width + 'px';
      canvas.style.height = viewport.height + 'px';
      await page.render({canvasContext: ctx, viewport}).promise;
      setImgNat({w:viewport.width, h:viewport.height});
      setImgDisp({w:viewport.width, h:viewport.height});
      setPlanDpi(144); // PDF.js at scale:2 × 72pt/in = 144px/in
    } catch(e){ console.error('renderPdfPage error', e); }
    setRendering(false);
  };

  const loadPdf = async (src) => {
    const lib = await ensurePdfLib();
    if(!lib) return null;
    try {
      lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const doc = await lib.getDocument(src).promise;
      pdfDocRef.current = doc;
      setPdfDoc(doc);
      await renderPdfPage(doc, 1);
      return doc;
    } catch(e) {
      console.error('PDF load error:', e);
      return null;
    }
  };

  const ensurePdfLib = () => new Promise((resolve)=>{
    if(window.pdfjsLib){ resolve(window.pdfjsLib); return; }
    const s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload=()=>resolve(window.pdfjsLib);
    s.onerror=()=>resolve(null);
    document.head.appendChild(s);
  });

  // Cleanup blob URLs on unmount
  useEffect(()=>{
    return ()=>{ if(blobUrl&&blobUrl.startsWith('blob:')) URL.revokeObjectURL(blobUrl); };
  },[blobUrl]);

  // Sync spaceHeld into panRef so mousedown handler (non-closure) can read it
  useEffect(()=>{ panRef.current._spaceHeld = spaceHeld; },[spaceHeld]);

  useEffect(()=>{
    const handleKey=(e)=>{
      // Ignore if typing in an input/textarea
      const tag=(e.target?.tagName||'').toLowerCase();
      if(tag==='input'||tag==='textarea'||tag==='select'||e.target?.isContentEditable) return;

      if(e.key===' '){ e.preventDefault(); setSpaceHeld(true); }

      if(e.key==='Escape'){
        setActivePts([]); setScalePts([]); setScaleStep(null);
        setTool('select'); setShowScalePicker(false);
        setArcPending(false); setArchMode(false); setArchCtrlPending(false);
        setSelectedShapes(new Set());
        setDragOffset(null); setVertexDrag(null);
      }

      // V — switch to Select tool
      if(e.key==='v'||e.key==='V'){
        if(!(e.ctrlKey||e.metaKey)){
          setTool('select'); setActivePts([]); setArcPending(false); setArchMode(false);
        }
      }

      // S — toggle angle snap (45°/60°/90°)
      if(e.key==='s'||e.key==='S'){
        setSnapEnabled(p=>!p);
      }

      // A — arc mode for linear takeoffs: auto-commit current segment, enter 3-click arc
      if(e.key==='a'||e.key==='A'){
        const condId = activeCondIdRef.current;
        const cond = itemsRef.current.find(i=>String(i.id)===String(condId));
        if(cond?.measurement_type==='linear'){
          // Commit current straight segment if we have ≥2 pts
          if(commitCurrentPtsRef.current) commitCurrentPtsRef.current();
          setArcPending(true);
          setArchMode(false);
        } else if(cond?.measurement_type==='area'){
          // Legacy arch toggle for area shapes
          setArchMode(p=>{const n=!p;if(!n)setArchCtrlPending(false);return n;});
          setActivePts([]);
        }
      }

      // Delete / Backspace — delete selected shapes
      if(e.key==='Delete'||e.key==='Backspace'){
        if(!selectedShapesRef.current.size) return;
        e.preventDefault(); e.stopPropagation();
        if(e.repeat) return;
        if(deleteShapesRef.current) deleteShapesRef.current();
      }

      // Ctrl+C — copy selected shapes
      if((e.ctrlKey||e.metaKey)&&(e.key==='c'||e.key==='C')){
        if(copyShapesRef.current) copyShapesRef.current();
      }

      // Ctrl+V — paste shape-level clipboard with offset
      if((e.ctrlKey||e.metaKey)&&(e.key==='v'||e.key==='V')){
        const src = clipboardRef.current;
        if(!src.length) return;
        pasteOffsetRef.current = (pasteOffsetRef.current || 0) + 40;
        const OFF = pasteOffsetRef.current;
        const shift = (sh) => sh.map(p=>({...p, x:p.x+OFF, y:p.y+OFF}));
        // Each clipboard entry creates a new item with only the copied shapes
        const inserts = src.map(({item, shapes})=>({
          project_id:item.project_id, plan_id:selPlanRef.current?.id||item.plan_id,
          category:item.category, description:item.description,
          quantity:0, unit:item.unit, unit_cost:item.unit_cost,
          total_cost:0, measurement_type:item.measurement_type,
          color:item.color, points:shapes.map(shift), ai_generated:false,
          sort_order:itemsRef.current.length,
        }));
        supabase.from('takeoff_items').insert(inserts).select().then(({data})=>{
          if(data){
            setItems(prev=>[...prev,...data]);
            // Auto-select all shape 0 of each pasted item
            setSelectedShapes(new Set(data.map(i=>`${i.id}::0`)));
          }
        });
      }
    };
    const handleKeyUp=(e)=>{ if(e.key===' ') setSpaceHeld(false); };
    window.addEventListener('keydown',handleKey, true); // capture phase — nothing can intercept
    window.addEventListener('keyup',handleKeyUp);
    return ()=>{ window.removeEventListener('keydown',handleKey, true); window.removeEventListener('keyup',handleKeyUp); };
  },[]);

  // Container callback ref — attaches wheel + pan handlers
  const containerCallbackRef = (el) => {
    if(containerRef.current){
      containerRef.current.removeEventListener('wheel', containerRef._wheelHandler);
    }
    if(el){
      // Wheel zoom toward cursor
      const wheelHandler = (e)=>{
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.05 : 0.95;
        const rect = el.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const contentX = el.scrollLeft + mouseX;
        const contentY = el.scrollTop + mouseY;
        setZoom(prev => {
          const newZoom = Math.min(4, Math.max(0.05, parseFloat((prev*factor).toFixed(2))));
          requestAnimationFrame(()=>{
            el.scrollLeft = contentX*(newZoom/prev) - mouseX;
            el.scrollTop  = contentY*(newZoom/prev) - mouseY;
          });
          return newZoom;
        });
      };
      el.addEventListener('wheel', wheelHandler, {passive:false});
      containerRef.current = el;
      containerRef._wheelHandler = wheelHandler;
    }
  };

  // Compute isPdf synchronously from file_type (blob URLs don't reveal type)
  const isPdfPlan = !!(selPlan && (
    selPlan.file_type?.includes('pdf')
    || selPlan.file_url?.startsWith('data:application/pdf')
  ));

  // prevBlobUrl ref — used to revoke the old URL only after the new one is set
  const prevBlobUrlRef = useRef(null);

  useEffect(()=>{
    if(!selPlan) return;
    if(selPlan.scale_px_per_ft){ setScale(selPlan.scale_px_per_ft); }
    else { setScale(null); setPresetScale(''); }
    setActiveCondId(null); setTool('select'); setActivePts([]);
    pdfDocRef.current = null;
    setPdfDoc(null);
    setPlanErr(null);
    // NOTE: do NOT reset blobUrl/imgNat here — keep the previous plan visible
    // while the new one downloads. We swap atomically when ready.

    if(selPlan.file_url?.startsWith('data:')){
      // Revoke old blob if any
      if(prevBlobUrlRef.current?.startsWith('blob:')) URL.revokeObjectURL(prevBlobUrlRef.current);
      prevBlobUrlRef.current = null;
      setImgNat({w:1,h:1});
      setBlobUrl(selPlan.file_url);
      return;
    }

    setLoadingPlan(true);

    const marker = '/object/public/attachments/';
    const idx = selPlan.file_url?.indexOf(marker) ?? -1;
    const storagePath = idx !== -1 ? selPlan.file_url.slice(idx + marker.length) : null;

    if(storagePath){
      supabase.storage.from('attachments').download(storagePath)
        .then(({data, error})=>{
          if(error || !data){
            console.error('Supabase download failed:', error?.message, storagePath);
            setPlanErr('Download failed: ' + (error?.message||'unknown') + ' | path: ' + storagePath);
            setLoadingPlan(false);
            return;
          }
          // Revoke old blob URL now that we have the new one
          if(prevBlobUrlRef.current?.startsWith('blob:')) URL.revokeObjectURL(prevBlobUrlRef.current);
          const url = URL.createObjectURL(data);
          prevBlobUrlRef.current = url;
          setImgNat({w:1,h:1}); // reset dims only now, right before new img loads
          setBlobUrl(url);
          setLoadingPlan(false);
        });
    } else {
      if(prevBlobUrlRef.current?.startsWith('blob:')) URL.revokeObjectURL(prevBlobUrlRef.current);
      prevBlobUrlRef.current = null;
      setImgNat({w:1,h:1});
      setBlobUrl(selPlan.file_url);
      setLoadingPlan(false);
    }
  },[selPlan?.id, selPlan?.file_url]);

  useEffect(()=>{
    if(!blobUrl || !selPlan) return;
    if(selPlan.file_type?.includes('pdf') || selPlan.file_url?.startsWith('data:application/pdf')){
      loadPdf(blobUrl);
    }
  },[blobUrl]);


  const getUnitCosts = () => { try{ return {...UNIT_COSTS_DEFAULT,...JSON.parse(localStorage.getItem('unitCosts')||'{}')}; }catch{return UNIT_COSTS_DEFAULT;} };

  const autoDetectScale = async () => {
    if(!selPlan) return;
    setAnalyzing(true);
    let b64=planB64; let mime=planMime;
    if(!b64){
      try{
        const res=await fetch(selPlan.file_url);
        const blob=await res.blob(); mime=blob.type||'image/png';
        b64=await new Promise(resolve=>{const r=new FileReader();r.onload=e=>resolve(e.target.result.split(',')[1]);r.readAsDataURL(blob);});
      }catch(e){setAnalyzing(false);alert('Could not load plan');return;}
    }
    const isImg=mime.startsWith('image/');
    const block=isImg?{type:'image',source:{type:'base64',media_type:mime,data:b64}}:{type:'document',source:{type:'base64',media_type:'application/pdf',data:b64}};
    try{
      const res=await fetch('/api/claude',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({model:AI_MODEL,max_tokens:256,
          messages:[{role:'user',content:[block,{type:'text',text:'Look at this construction drawing. Find the scale bar or scale notation in the title block or anywhere on the drawing. Return ONLY a JSON object like: {"scale":"1\"=20ft","found":true} or {"found":false} if you cannot find one. No other text.'}]}]})});
      const json=await res.json();
      const text=json?.content?.find(b=>b.type==='text')?.text||'';
      const parsed=JSON.parse(text.replace(/```json|```/g,'').trim());
      if(parsed.found&&parsed.scale){
        const match=CONSTRUCTION_SCALES.find(s=>s.label===parsed.scale||s.label.replace('ft',"'")===parsed.scale);
        if(match){
          const pxPerFt=(planDpi*12)/match.ratio;
          setScale(pxPerFt); setPresetScale(match.label);
          if(selPlan?.id&&selPlan.id!=='preview') await supabase.from('precon_plans').update({scale_px_per_ft:pxPerFt}).eq('id',selPlan.id);
          alert('✓ Scale detected: '+match.label);
        } else {
          alert('Detected scale "'+parsed.scale+'" — select it manually from the dropdown.');
        }
      } else { alert('Could not auto-detect scale. Please set manually.'); }
    }catch(e){ alert('Auto-detect failed: '+e.message); }
    setAnalyzing(false);
  };

  const saveItem = async (itemData) => {
    const catDef = TAKEOFF_CATS.find(c=>c.id===itemData.category)||TAKEOFF_CATS[TAKEOFF_CATS.length-1];
    const costs = getUnitCosts();
    const uc = itemData.unit_cost ?? ((costs[itemData.category]?.mat||0)+(costs[itemData.category]?.lab||0));
    const total_cost = (itemData.quantity||0)*uc;
    const pid = project.id;
    const payload = {...itemData, project_id:pid, plan_id:selPlan?.id, unit_cost:uc, total_cost, color:catDef.color, ai_generated:false, sort_order:items.length};
    const {data} = await supabase.from('takeoff_items').insert([payload]).select().single();
    if(data){
      setItems(prev=>[...prev,data]);
      // Auto-expand in sidebar for quick rename/recategorize — no floating modal
      setEditItem(data);
      setRightTab('items');
    }
  };

  // appendMeasurement: add a drawn shape to the active condition.
  // points stored as array-of-shapes: [ [{x,y},...], [{x,y},...] ]
  // qty = sum of all shapes (area, linear, perimeter) or count of shapes (count)
  const appendMeasurement = async (condId, newShape) => {
    let item = itemsRef.current.find(i=>String(i.id)===String(condId));
    if(!item){ console.warn('appendMeasurement: item not found', condId); return; }

    // ── Cross-plan drawing: if the active plan differs from the item's plan,
    //    find or create a sibling item for the current plan ──────────────────
    if(selPlan?.id && item.plan_id !== selPlan.id){
      const sibling = itemsRef.current.find(i=>
        i.plan_id === selPlan.id &&
        i.description === item.description &&
        i.category === item.category &&
        i.project_id === item.project_id &&
        i.measurement_type === item.measurement_type
      );
      if(sibling){
        item = sibling;
      } else {
        // Create new sibling for current plan
        const costs = getUnitCosts();
        const uc = item.unit_cost ?? ((costs[item.category]?.mat||0)+(costs[item.category]?.lab||0));
        const payload = {
          project_id: item.project_id,
          plan_id: selPlan.id,
          category: item.category,
          description: item.description,
          quantity: 0,
          unit: item.unit,
          unit_cost: uc,
          total_cost: 0,
          measurement_type: item.measurement_type,
          color: item.color,
          points: [],
          ai_generated: false,
          sort_order: itemsRef.current.length,
        };
        const {data: newItem} = await supabase.from('takeoff_items').insert([payload]).select().single();
        if(!newItem){ console.error('appendMeasurement: failed to create sibling item'); return; }
        setItems(prev=>[...prev, newItem]);
        // Update activeCondId to point to the new sibling so subsequent draws go here
        setActiveCondId(newItem.id);
        item = newItem;
      }
    }
    // ──────────────────────────────────────────────────────────────────────
    // Detect legacy flat points and upgrade
    const existing = item.points;
    let shapes = [];
    if(!existing || existing.length===0) {
      shapes = [];
    } else if(Array.isArray(existing[0]) || (existing[0] && typeof existing[0].x === 'undefined')) {
      shapes = existing; // already array-of-shapes
    } else {
      shapes = [existing]; // legacy flat → wrap
    }
    shapes = [...shapes, newShape];

    // Recompute total quantity
    let qty = 0;
    if(item.measurement_type==='area'){
      qty = shapes.reduce((s,sh)=> s + calcShapeNetArea(sh), 0);
      qty = Math.round(qty*10)/10;
    } else if(item.measurement_type==='linear'){
      qty = shapes.reduce((s,sh)=>{
        const hasArcs = sh.some(p=>p._ctrl);
        if(hasArcs) {
          const pxLen = calcShapeLength(sh);
          return s + (scale ? pxLen/scale : 0);
        }
        // polyline: sum all segments
        let seg=0;
        for(let i=1;i<sh.length;i++) seg+=calcLinear(sh[i-1],sh[i]);
        return s+seg;
      },0);
      qty = Math.round(qty*10)/10;
    } else if(item.measurement_type==='count'){
      qty = shapes.length;
    }

    const total_cost = qty * (item.unit_cost||0);
    const updated = {...item, points:shapes, quantity:qty, total_cost};
    await supabase.from('takeoff_items').update({points:shapes, quantity:qty, total_cost}).eq('id', item.id);
    setItems(prev=>prev.map(i=>String(i.id)===String(item.id) ? updated : i));
    // Keep tool armed — stay ready for more shapes
  };

  // commitCurrentPtsRef — callable from keydown without stale closure
  commitCurrentPtsRef.current = () => {
    const pts = activePtsRef.current;
    const condId = activeCondIdRef.current;
    if(pts.length >= 2 && condId){
      appendMeasurement(condId, pts);
      setActivePts([]);
      return pts[pts.length-1];
    }
    return pts.length ? pts[pts.length-1] : null;
  };

  // appendMeasurementHole: embed a cutout polygon into the target outer shape
  const appendMeasurementHole = async (condId, holePts) => {
    const item = itemsRef.current.find(i=>String(i.id)===String(condId));
    if(!item||item.measurement_type!=='area') return;
    const shapes = normalizeShapes(item.points);
    if(!shapes.length){ console.warn('cutout: no shapes to cut from'); return; }

    // Clean hole points — remove legacy _hole flag
    const cleanHole = holePts.map(p=>{const {_hole, ...rest}=p; return rest;});

    // Find which outer shape the hole overlaps using centroid point-in-polygon
    const holeCentroid = {
      x: cleanHole.reduce((s,p)=>s+p.x,0)/cleanHole.length,
      y: cleanHole.reduce((s,p)=>s+p.y,0)/cleanHole.length,
    };
    let targetIdx = -1;
    for(let si=0; si<shapes.length; si++){
      const {outer} = splitShapeHoles(shapes[si]);
      const realOuter = outer.filter(p=>!p._ctrl);
      if(realOuter.length>=3 && pointInPoly(holeCentroid, realOuter)){
        targetIdx = si; break;
      }
    }
    // Fallback: use first non-empty shape
    if(targetIdx<0) targetIdx = shapes.findIndex(sh=> splitShapeHoles(sh).outer.length>=3);
    if(targetIdx<0){ console.warn('cutout: no valid outer shape found'); return; }

    // Embed hole: append _holeStart marker + hole points to the target shape
    const newShapes = shapes.map((sh, si)=>{
      if(si !== targetIdx) return sh;
      return [...sh, {_holeStart:true, x:0, y:0}, ...cleanHole];
    });

    // Recompute total area across all shapes (net = outer - holes for each)
    const qty = Math.round(newShapes.reduce((s,sh) => s + calcShapeNetArea(sh), 0)*10)/10;
    const total_cost = Math.max(0, qty) * (item.unit_cost||0);
    const updated = {...item, points:newShapes, quantity:Math.max(0,qty), total_cost};
    await supabase.from('takeoff_items').update({points:newShapes, quantity:Math.max(0,qty), total_cost}).eq('id', condId);
    setItems(prev=>prev.map(i=>String(i.id)===String(condId)?updated:i));
  };

  // processClick: single-click adds a point
  // Applies angle snap when enabled. Handles arc-pending 3-click flow, cutout, area, linear.
  const processClick=(rawPt)=>{
    if(!activeCondId) return;
    const activeCond = itemsRef.current.find(i=>String(i.id)===String(activeCondId));
    if(!activeCond) return;
    const mt = activeCond.measurement_type;

    // Snap to angle from last placed point
    const lastPlaced = activePtsRef.current.length ? activePtsRef.current[activePtsRef.current.length-1] : null;
    const pt = snapToAngle(lastPlaced, rawPt);

    // ── Arc-pending mode (A key): 3-click arc — start → peak → end ───────
    if(arcPending && mt==='linear'){
      setActivePts(prev=>{
        const npts=[...prev, pt];
        if(npts.length===3){
          // [start, peak, end] → commit as quadratic bezier arc shape
          const [start, peak, end] = npts;
          appendMeasurement(activeCondId, [start, {...peak,_ctrl:true}, end]);
          setArcPending(false);
          return [end]; // continue drawing from end point
        }
        return npts;
      });
      return;
    }

    // ── Cutout mode: draw hole polygon for area item ───────────────────────
    if(tool==='cutout' && mt==='area'){
      setActivePts(prev=>[...prev, pt]);
      return;
    }

    if(mt==='linear'){
      if(!archMode){
        setActivePts(prev=>[...prev, pt]);
      } else {
        setActivePts(prev=>{
          const npts=[...prev, pt];
          if(npts.length>=3){
            const [p1,ctrl,p2]=npts;
            appendMeasurement(activeCondId, [p1, {...ctrl,_ctrl:true}, p2]);
            return [];
          }
          return npts;
        });
      }
    } else if(mt==='area'){
      if(!archMode){
        setActivePts(prev=>[...prev, pt]);
      } else {
        if(archCtrlPending){
          setActivePts(prev=>[...prev, {...pt,_ctrl:true}]);
          setArchCtrlPending(false);
        } else {
          setActivePts(prev=>[...prev, pt]);
          setArchCtrlPending(true);
        }
      }
    }
  };

  // finishShape: double-click saves whatever is drawn
  // extraPt = the double-click position that never made it into activePts due to debounce cancellation
  const finishShape=(extraPt=null)=>{
    if(!activeCondId) return;
    const activeCond = itemsRef.current.find(i=>String(i.id)===String(activeCondId));
    if(!activeCond) return;
    const mt = activeCond.measurement_type;
    const rawPts = extraPt ? [...activePts, extraPt] : activePts;
    const lastPlaced = rawPts.length ? rawPts[rawPts.length-2]||null : null;
    const pts = extraPt ? [...activePts, snapToAngle(lastPlaced, extraPt)] : activePts;

    // Cutout finish — save as hole shape (first point flagged _hole:true)
    if(tool==='cutout' && mt==='area' && pts.filter(p=>!p._ctrl).length>=3){
      appendMeasurementHole(activeCondId, pts);
      setActivePts([]); return;
    }
    if(mt==='linear' && pts.length>=2){
      appendMeasurement(activeCondId, pts);
      setActivePts([]);
    } else if(mt==='area' && pts.filter(p=>!p._ctrl).length>=3){
      appendMeasurement(activeCondId, pts);
      setActivePts([]); setArchCtrlPending(false);
    }
  };

  const handleSvgClick=(e)=>{
    if(!selPlan) return;
    if(e.button===2) return;
    // Eraser click — delete the hovered shape or full item
    if(tool==='eraser'){
      if(eraserHover){
        const {itemId,shapeIdx} = eraserHover;
        const item = itemsRef.current.find(i=>i.id===itemId);
        if(!item) return;
        const shapes = Array.isArray(item.points[0]) ? item.points : [item.points];
        if(shapes.length<=1){
          // Delete the whole item
          setItems(prev=>prev.filter(i=>i.id!==itemId));
          supabase.from('takeoff_items').delete().eq('id',itemId).select().then(({data:del,error})=>{ if(error) console.error('eraser del',error); else if(!del||del.length===0) console.warn('eraser: RLS blocked delete for',itemId); });
        } else {
          // Remove just this shape
          const newShapes=shapes.filter((_,i)=>i!==shapeIdx);
          // Recompute qty
          const mt=item.measurement_type;
          let qty=0;
          if(mt==='area') qty=newShapes.reduce((s,sh)=>s+calcShapeNetArea(sh),0);
          else if(mt==='linear') qty=newShapes.reduce((s,sh)=>{let t=0;for(let i=1;i<sh.length;i++)t+=calcLinear(sh[i-1],sh[i]);return s+t;},0);
          else if(mt==='count') qty=newShapes.length;
          qty=Math.round(qty*10)/10;
          const total_cost=qty*(item.unit_cost||0);
          setItems(prev=>prev.map(i=>i.id===itemId?{...i,points:newShapes,quantity:qty,total_cost}:i));
          supabase.from('takeoff_items').update({points:newShapes,quantity:qty,total_cost}).eq('id',itemId).then(({error})=>{ if(error) console.error('eraser upd',error); });
        }
        setEraserHover(null);
      }
      return;
    }
    if(spaceHeld) return;
    if(tool==='select'){
      // Suppress click fired immediately after a lasso drag-release
      if(suppressNextClickRef.current){ suppressNextClickRef.current=false; return; }
      // Plain click on empty canvas clears selection
      setSelectedShapes(new Set());
      return;
    }
    const pt=getSvgPos(e);
    // Scale calibration — no debounce
    if(tool==='scale'&&scaleStep==='picking'){
      const npts=[...scalePts,pt];
      setScalePts(npts);
      if(npts.length===2) setScaleStep('entering');
      return;
    }
    if(!activeCondId) return;
    const activeCond = itemsRef.current.find(i=>String(i.id)===String(activeCondId));
    if(!activeCond) return;
    // Count is instant, no debounce needed
    if(activeCond.measurement_type==='count'){
      appendMeasurement(activeCondId, [pt]); return;
    }
    // Debounce: 220ms — if dblclick fires, cancel pending single
    if(clickTimerRef.current) clearTimeout(clickTimerRef.current);
    pendingClickRef.current = pt;
    clickTimerRef.current = setTimeout(()=>{
      if(pendingClickRef.current){ processClick(pendingClickRef.current); pendingClickRef.current=null; }
      clickTimerRef.current=null;
    }, 220);
  };

  const handleSvgDoubleClick=(e)=>{
    if(!selPlan||spaceHeld||tool==='select') return;
    if(clickTimerRef.current){ clearTimeout(clickTimerRef.current); clickTimerRef.current=null; }
    const lastPt = pendingClickRef.current; // grab before clearing
    pendingClickRef.current=null;
    finishShape(lastPt); // include the final point that debounce cancelled
  };

  const handleSvgContextMenu=(e)=>{ e.preventDefault(); };

  const handleSvgRightPan=(e)=>{
    if(e.button!==2) return;
    e.preventDefault();
    const c=containerRef.current; if(!c) return;
    const sx=e.clientX, sy=e.clientY, scrollX=c.scrollLeft, scrollY=c.scrollTop;
    const onMove=(ev)=>{ c.scrollLeft=scrollX-(ev.clientX-sx); c.scrollTop=scrollY-(ev.clientY-sy); };
    const onUp=()=>{ window.removeEventListener('mousemove',onMove); window.removeEventListener('mouseup',onUp); };
    window.addEventListener('mousemove',onMove);
    window.addEventListener('mouseup',onUp);
  };

  const handleSvgMove=(e)=>{
    if(panRef.current.active){ // dragging — update scroll
      const c=containerRef.current;
      if(c){
        c.scrollLeft = panRef.current.scrollX - (e.clientX - panRef.current.startX);
        c.scrollTop  = panRef.current.scrollY - (e.clientY - panRef.current.startY);
      }
      return;
    }
    const rawPt = getSvgPos(e);
    // Apply snap to the hover cursor position for preview
    const lastPlaced = activePtsRef.current.length ? activePtsRef.current[activePtsRef.current.length-1] : null;
    const snapped = snapToAngle(lastPlaced, rawPt);
    setHoverPt(snapped);
    // Eraser: track which shape is under cursor
    if(tool==='eraser'){
      // Find closest item shape to cursor (crude hit-test: bounding box)
      let found=null;
      const threshold = 12/zoom;
      for(const it of itemsRef.current.filter(i=>i.plan_id===selPlanRef.current?.id&&i.points?.length)){
        const shapes = (Array.isArray(it.points[0]) ? it.points : [it.points]);
        shapes.forEach((sh,si)=>{
          if(it.measurement_type==='count'&&sh[0]){
            const d=Math.hypot(sh[0].x-rawPt.x,sh[0].y-rawPt.y);
            if(d<threshold*3) found={itemId:it.id,shapeIdx:si};
          } else {
            const realPts=sh.filter(p=>!p._ctrl&&!p._hole&&!p._holeStart);
            for(let pi=1;pi<realPts.length;pi++){
              const a=realPts[pi-1],b=realPts[pi];
              // Point-to-segment distance
              const dx=b.x-a.x,dy=b.y-a.y,len2=dx*dx+dy*dy;
              const t=len2===0?0:Math.max(0,Math.min(1,((rawPt.x-a.x)*dx+(rawPt.y-a.y)*dy)/len2));
              const px=a.x+t*dx,py=a.y+t*dy;
              const d=Math.hypot(rawPt.x-px,rawPt.y-py);
              if(d<threshold) found={itemId:it.id,shapeIdx:si};
            }
          }
        });
      }
      setEraserHover(found);
    } else {
      setEraserHover(null);
    }
  };

  const handleSvgMouseDown=(e)=>{
    // Middle-click or space+left = always pan
    const forceP = e.button===1 || panRef.current._spaceHeld;
    // Select tool + left-click without space = lasso box
    const doLasso = !forceP && e.button===0 && tool==='select';
    // Drawing tools + space+left = pan; any other left in drawing mode = ignore (handled by click)
    const doPan = forceP || (!doLasso && (e.button===1 || tool==='select'));

    // ── Vertex drag: mousedown on a vertex handle ──
    if(doLasso && e.target.closest && e.target.closest('[data-vertex]')){
      const vel = e.target.closest('[data-vertex]');
      const iid = vel.dataset.itemId;
      const si = Number(vel.dataset.shapeIdx);
      const vi = Number(vel.dataset.vertexIdx);
      const item = itemsRef.current.find(i=>String(i.id)===String(iid));
      if(!item) return;
      const shapes = normalizeShapes(item.points);
      const origPt = shapes[si]?.[vi];
      if(!origPt) return;
      e.stopPropagation(); e.preventDefault();
      setVertexDrag({itemId:iid, shapeIdx:si, vertexIdx:vi, point:{x:origPt.x, y:origPt.y}});
      const onMove=(mv)=>{
        const cur = getSvgPos(mv);
        setVertexDrag(prev=>prev?{...prev, point:{x:cur.x, y:cur.y}}:null);
      };
      const onUp=()=>{
        window.removeEventListener('mousemove',onMove);
        window.removeEventListener('mouseup',onUp);
        const vd = vertexDragRef.current;
        if(vd) commitVertexDrag(vd);
        setVertexDrag(null);
        suppressNextClickRef.current = true;
      };
      window.addEventListener('mousemove',onMove);
      window.addEventListener('mouseup',onUp);
      return;
    }

    // ── Shape drag: mousedown on an already-selected shape ──
    if(doLasso && e.target.closest && e.target.closest('[data-shape]')){
      const sel = e.target.closest('[data-shape]');
      const iid = sel.dataset.itemId;
      const si = sel.dataset.shapeIdx;
      if(iid!=null && si!=null){
        const shapeKey = `${iid}::${si}`;
        if(selectedShapesRef.current.has(shapeKey)){
          e.stopPropagation(); e.preventDefault();
          const startPt = getSvgPos(e);
          let moved = false;
          const onMove=(mv)=>{
            const cur = getSvgPos(mv);
            const dx = cur.x - startPt.x;
            const dy = cur.y - startPt.y;
            if(!moved && Math.abs(dx)<4 && Math.abs(dy)<4) return;
            moved = true;
            setDragOffset({dx, dy});
          };
          const onUp=()=>{
            window.removeEventListener('mousemove',onMove);
            window.removeEventListener('mouseup',onUp);
            if(moved){
              commitShapeDrag(dragOffsetRef.current);
              suppressNextClickRef.current = true;
            }
            setDragOffset(null);
          };
          window.addEventListener('mousemove',onMove);
          window.addEventListener('mouseup',onUp);
          return;
        }
      }
      // Shape not selected — let click handler select it (fall through to lasso which returns)
      return;
    }

    if(doLasso){
      e.stopPropagation();
      const startPt = getSvgPos(e);
      lassoStartRef.current = startPt;
      setLassoRect({sx:startPt.x, sy:startPt.y, ex:startPt.x, ey:startPt.y});
      const onMove=(mv)=>{
        const cur = getSvgPos(mv);
        setLassoRect({sx:startPt.x, sy:startPt.y, ex:cur.x, ey:cur.y});
      };
      const onUp=(up)=>{
        window.removeEventListener('mousemove',onMove);
        window.removeEventListener('mouseup',onUp);
        const cur = getSvgPos(up);
        setLassoRect(null);
        lassoStartRef.current = null;
        // Select all items whose centroid falls inside the lasso box
        const minX=Math.min(startPt.x,cur.x), maxX=Math.max(startPt.x,cur.x);
        const minY=Math.min(startPt.y,cur.y), maxY=Math.max(startPt.y,cur.y);
        const moved = Math.abs(cur.x-startPt.x)>4 || Math.abs(cur.y-startPt.y)>4;
        if(moved){
          suppressNextClickRef.current = true; // block the click event that fires right after mouseup
          const hit = new Set();
          itemsRef.current.filter(i=>i.plan_id===selPlanRef.current?.id&&i.points?.length).forEach(it=>{
            const shapes = Array.isArray(it.points[0]) ? it.points : (it.points[0]?.x!=null?[it.points]:it.points);
            shapes.forEach((sh,si)=>{
              const realPts = sh.filter(p=>!p._ctrl&&!p._hole&&!p._holeStart);
              if(!realPts.length) return;
              const cx=realPts.reduce((s,p)=>s+p.x,0)/realPts.length;
              const cy=realPts.reduce((s,p)=>s+p.y,0)/realPts.length;
              if(cx>=minX&&cx<=maxX&&cy>=minY&&cy<=maxY) hit.add(`${it.id}::${si}`);
            });
          });
          if(hit.size>0){
            setSelectedShapes(prev=>{
              if(up.shiftKey){ const n=new Set(prev); hit.forEach(k=>n.add(k)); return n; }
              return hit;
            });
          }
        }
        // If no drag (just a click), clear selection handled by handleSvgClick
      };
      window.addEventListener('mousemove',onMove);
      window.addEventListener('mouseup',onUp);
      return;
    }

    if(!doPan) return;
    if(e.button===1) e.preventDefault();
    e.stopPropagation();
    const c=containerRef.current;
    panRef.current = {...panRef.current, active:true, startX:e.clientX, startY:e.clientY,
      scrollX:c?c.scrollLeft:0, scrollY:c?c.scrollTop:0};
    const onUp=()=>{
      panRef.current.active=false;
      window.removeEventListener('mouseup',onUp);
    };
    window.addEventListener('mouseup',onUp);
  };

  // ── Arch / bezier helpers ─────────────────────────────────────────────
  const bezierLength = (p1, ctrl, p2, steps=40) => {
    let len=0, prev=p1;
    for(let i=1;i<=steps;i++){
      const t=i/steps;
      const x=(1-t)**2*p1.x+2*(1-t)*t*ctrl.x+t**2*p2.x;
      const y=(1-t)**2*p1.y+2*(1-t)*t*ctrl.y+t**2*p2.y;
      len+=Math.sqrt((x-prev.x)**2+(y-prev.y)**2);
      prev={x,y};
    }
    return len;
  };
  const bezierPt = (p1, ctrl, p2, t) => ({
    x:(1-t)**2*p1.x+2*(1-t)*t*ctrl.x+t**2*p2.x,
    y:(1-t)**2*p1.y+2*(1-t)*t*ctrl.y+t**2*p2.y,
  });
  const buildShapePath = (pts, close=false) => {
    if(!pts||!pts.length) return '';
    let d=`M${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
    let i=1;
    while(i<pts.length){
      if(pts[i]?._ctrl && i+1<pts.length){
        d+=` Q${pts[i].x.toFixed(2)},${pts[i].y.toFixed(2)} ${pts[i+1].x.toFixed(2)},${pts[i+1].y.toFixed(2)}`;
        i+=2;
      } else {
        d+=` L${pts[i].x.toFixed(2)},${pts[i].y.toFixed(2)}`;
        i++;
      }
    }
    if(close) d+=' Z';
    return d;
  };
  const calcShapeLength = (pts) => {
    if(!pts||pts.length<2) return 0;
    let total=0, i=1;
    while(i<pts.length){
      if(pts[i]?._ctrl && i+1<pts.length){
        total+=bezierLength(pts[i-1]??pts[0], pts[i], pts[i+1]);
        i+=2;
      } else {
        const a=pts[i-1]??pts[0], b=pts[i];
        total+=Math.sqrt((b.x-a.x)**2+(b.y-a.y)**2);
        i++;
      }
    }
    return total;
  };
  const calcShapeArea = (expandedPts) => {
    // Expand arc segments for shoelace
    const expanded=[];
    let i=0;
    while(i<expandedPts.length){
      if(expandedPts[i+1]?._ctrl && i+2<expandedPts.length){
        for(let s=0;s<=20;s++) expanded.push(bezierPt(expandedPts[i],expandedPts[i+1],expandedPts[i+2],s/20));
        i+=3;
      } else { expanded.push(expandedPts[i]); i++; }
    }
    return calcArea(expanded);
  };

  const confirmScale=async()=>{
    if(!scaleDist||scalePts.length<2) return;
    const p1=scalePts[0]; const p2=scalePts[1]; // raw pixel coords
    const pxDist=Math.sqrt((p2.x-p1.x)**2+(p2.y-p1.y)**2);
    const realFt=Number(scaleDist)*(scaleUnit==='in'?1/12:1);
    const pxPerFt=pxDist/realFt;
    setScale(pxPerFt); setPresetScale(''); setScaleStep(null); setScalePts([]); setScaleDist(''); setTool('select');
    if(selPlan){
      await supabase.from('precon_plans').update({scale_px_per_ft:pxPerFt}).eq('id',selPlan.id);
      setSelPlan(prev=>({...prev,scale_px_per_ft:pxPerFt}));
      setPlans(prev=>prev.map(p=>p.id===selPlan.id?{...p,scale_px_per_ft:pxPerFt}:p));
    }
  };

  // Fallback: prettify filename when AI naming fails
  const autoNameSheet = (filename, existingPlans) => {
    let name = filename.replace(/\.[^.]+$/, '');
    name = name.replace(/[-_]/g, ' ').replace(/\s+/g,' ').trim();
    const sheetMatch = name.match(/^([A-Z]{1,2})[-\s]?(\d+\.?\d*)$/i);
    if(sheetMatch) {
      const prefixes = {A:'Architectural',S:'Structural',C:'Civil',M:'Mechanical',E:'Electrical',P:'Plumbing',L:'Landscape',G:'General',FP:'Fire Protection'};
      const prefix = prefixes[sheetMatch[1].toUpperCase()];
      if(prefix) name = `${sheetMatch[1].toUpperCase()}-${sheetMatch[2]} ${prefix}`;
    }
    const base = name;
    let count = 2;
    while(existingPlans.some(p=>p.name===name)) { name = `${base} (${count++})`; }
    return name;
  };

  // AI sheet name extraction — delegates entirely to /api/name-sheet serverless function
  // That function fetches the image server-side (no CORS), sends to Anthropic directly
  // Client never touches the image data — no canvas, no base64 overhead, no Vercel body limit
  const aiNameSheet = async (canvasOrUrl, fallbackName) => {
    try {
      let url;
      if (typeof canvasOrUrl === 'string') {
        url = canvasOrUrl;
      } else {
        // Canvas passed at upload time — convert to small JPEG and use a data URL trick:
        // store on supabase first then we have a real URL... actually just inline base64 via /api/claude
        const MAX = 1200;
        const ratio = Math.min(1, MAX / Math.max(canvasOrUrl.width, canvasOrUrl.height));
        const out = document.createElement('canvas');
        out.width = Math.floor(canvasOrUrl.width * ratio);
        out.height = Math.floor(canvasOrUrl.height * ratio);
        out.getContext('2d').drawImage(canvasOrUrl, 0, 0, out.width, out.height);
        const b64 = out.toDataURL('image/jpeg', 0.88).split(',')[1];
        const resp = await fetch('/api/claude', {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ model:AI_MODEL, max_tokens:60,
            messages:[{role:'user',content:[
              {type:'image',source:{type:'base64',media_type:'image/jpeg',data:b64}},
              {type:'text',text:'Find the title block on this construction drawing (usually bottom-right corner) and extract the sheet number and title.\nReply with ONLY this format: SHEET_NUMBER - SHEET_TITLE\nExamples: C3.01 - SITE PLAN  /  A-101 - FLOOR PLAN  /  M-201 - MECHANICAL PLAN\nIf unreadable reply: UNKNOWN'}
            ]}]})
        });
        const json = await resp.json();
        const raw = (json?.content?.find?.(b=>b.type==='text')?.text||'').trim();
        console.log('[aiNameSheet canvas] raw:', raw);
        if(!raw||raw.toUpperCase().includes('UNKNOWN')||raw.length<3) return fallbackName;
        return raw.replace(/^["'`*\s]+|["'`*\s]+$/g,'').trim();
      }

      // URL path: let the server fetch it
      const resp = await fetch('/api/name-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      if (!resp.ok) { console.error('[aiNameSheet] name-sheet error', resp.status, await resp.text()); return fallbackName; }
      const json = await resp.json();
      console.log('[aiNameSheet] result:', json);
      return json.name || fallbackName;
    } catch (e) {
      console.error('[aiNameSheet] exception:', e);
      return fallbackName;
    }
  };

  const handleUpload=async(file)=>{
    if(!file) return;
    const pid = project.id;
    setUploading('Reading file…');
    const isPdf = file.type?.includes('pdf');
    // Generate a batch ID for this upload — all pages become one folder
    const batchId = `batch_${Date.now()}`;
    const batchName = file.name.replace(/\.[^.]+$/,'').replace(/[-_]/g,' ').trim() || 'Plan Set';

    if(isPdf){
      const arrayBuf = await file.arrayBuffer();
      const lib = await ensurePdfLib();
      if(!lib){ setUploading(false); alert('PDF library not loaded'); return; }
      lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      let doc;
      try { doc = await lib.getDocument({data: arrayBuf.slice(0)}).promise; }
      catch(e){ setUploading(false); alert('Could not read PDF: '+e.message); return; }

      const numPages = doc.numPages;
      const fallbackBase = autoNameSheet(file.name, plans);

      // ── PHASE 1: Render all pages + fire all uploads simultaneously ──
      // Also capture title block crops for AI naming later
      const uploadPromises = [];
      const titleCrops = []; // store b64 crops for naming phase

      for(let pageN=1; pageN<=numPages; pageN++){
        setUploading(`Rendering ${pageN} / ${numPages}…`);
        const page = await doc.getPage(pageN);
        const viewport = page.getViewport({scale:1.8});
        const offscreen = document.createElement('canvas');
        offscreen.width = viewport.width; offscreen.height = viewport.height;
        await page.render({canvasContext: offscreen.getContext('2d'), viewport}).promise;
        const blob = await new Promise(r=>offscreen.toBlob(r,'image/jpeg',0.82));

        // Crop bottom-right 50% × 38% for title block
        const cropW = Math.floor(offscreen.width * 0.50);
        const cropH = Math.floor(offscreen.height * 0.38);
        const cropCanvas = document.createElement('canvas');
        const MAX_CROP = 1200;
        const cropScale = Math.min(1, MAX_CROP / cropW);
        cropCanvas.width  = Math.floor(cropW * cropScale);
        cropCanvas.height = Math.floor(cropH * cropScale);
        cropCanvas.getContext('2d').drawImage(
          offscreen,
          offscreen.width - cropW, offscreen.height - cropH, cropW, cropH,
          0, 0, cropCanvas.width, cropCanvas.height
        );
        titleCrops.push(cropCanvas.toDataURL('image/jpeg', 0.90).split(',')[1]);

        const sheetName = numPages>1 ? `${fallbackBase} — Pg ${pageN}` : fallbackBase;
        const path = `precon/${pid}/${Date.now()}_p${pageN}.jpg`;
        const idx = pageN - 1;
        uploadPromises.push(
          supabase.storage.from('attachments').upload(path, blob, {upsert:true, contentType:'image/jpeg'})
            .then(({error}) => {
              if(error){ console.error('upload fail p'+pageN, error); return null; }
              const {data:ud} = supabase.storage.from('attachments').getPublicUrl(path);
              const publicUrl = ud?.publicUrl || '';
              return supabase.from('precon_plans')
                .insert([{project_id:pid, name:sheetName, file_url:publicUrl, file_type:'image/jpeg'}])
                .select().single()
                .then(({data:plan}) => plan ? {...plan, _idx:idx} : null);
            })
        );
      }

      // Wait for all uploads
      setUploading(`Uploading ${numPages} page${numPages!==1?'s':''}…`);
      const settled = await Promise.all(uploadPromises);
      const newPlans = settled.filter(Boolean).sort((a,b)=>a._idx-b._idx).map(({_idx,...p})=>p);

      if(newPlans.length===0){ setUploading(false); return; }

      // ── Show plans immediately with fallback names so user sees them ──
      setPlans(prev=>[...prev, ...newPlans]);
      setSelPlan(newPlans[0]);
      setPlanB64(null); setPlanMime('image/png');
      if(uploadTargetFolder && planSets[uploadTargetFolder]){
        savePlanSets({...planSets, [uploadTargetFolder]:{...planSets[uploadTargetFolder], planIds:[...(planSets[uploadTargetFolder].planIds||[]), ...newPlans.map(p=>p.id)]}});
      } else {
        savePlanSets({...planSets, [batchId]:{name:batchName, planIds:newPlans.map(p=>p.id), collapsed:false}});
      }
      setUploadTargetFolder(null);

      // ── PHASE 2: AI name in batches of 5 — update each plan live as it's named ──
      const BATCH = 5;
      let named = 0;
      for(let i=0; i<newPlans.length; i+=BATCH){
        const slice = newPlans.slice(i, i+BATCH);
        setUploading(`Naming ${i+1}–${Math.min(i+BATCH, newPlans.length)} of ${newPlans.length}…`);
        await Promise.all(slice.map(async(p, bi)=>{
          const b64 = titleCrops[i+bi];
          if(!b64) return;
          try {
            const resp = await fetch('/api/claude', {
              method:'POST', headers:{'Content-Type':'application/json'},
              body: JSON.stringify({
                model:AI_MODEL, max_tokens:60,
                messages:[{role:'user', content:[
                  {type:'image', source:{type:'base64', media_type:'image/jpeg', data:b64}},
                  {type:'text', text:'This is the bottom-right corner of a construction drawing showing the title block. Extract the sheet number and sheet title.\nReply with ONLY this format: SHEET_NUMBER - SHEET_TITLE\nExamples:\n  C3.01 - SITE PLAN\n  A-101 - FLOOR PLAN\n  S2.0 - FOUNDATION PLAN\n  E-201 - ELECTRICAL PLAN\nIf you cannot clearly read a sheet number and title, reply: UNKNOWN'}
                ]}]
              })
            });
            const j = await resp.json();
            const raw = (j?.content?.find(b=>b.type==='text')?.text||'').trim();
            console.log(`[name pg${i+bi+1}]`, raw);
            if(!raw || raw.toUpperCase().includes('UNKNOWN') || raw.length < 3) return;
            const aiName = raw.replace(/^["'`*\s]+|["'`*\s]+$/g,'').trim();
            if(aiName === p.name) return;
            // Update DB
            await supabase.from('precon_plans').update({name:aiName}).eq('id',p.id);
            // Update UI live — this plan gets its real name immediately
            setPlans(prev=>prev.map(x=>x.id===p.id ? {...x,name:aiName} : x));
            named++;
          } catch(e){ console.warn(`[name pg${i+bi+1}] error:`, e); }
        }));
      }

      setUploading(`✓ Done — ${newPlans.length} sheet${newPlans.length!==1?'s':''} uploaded, ${named} named`);
      setTimeout(()=>setUploading(false), 3000);
      return;
    }

    // Image upload (non-PDF)
    const fallbackName = autoNameSheet(file.name, plans);
    const reader=new FileReader();
    reader.onload=async ev=>{
      const dataUrl = ev.target.result;
      setPlanB64(dataUrl.split(',')[1]);
      setPlanMime(file.type);
      const sheetName = fallbackName;
      setSelPlan({id:'preview',name:sheetName,file_url:dataUrl,file_type:file.type});
      const ext=file.name.split('.').pop();
      const path=`precon/${pid}/${Date.now()}.${ext}`;
      const {error}=await supabase.storage.from('attachments').upload(path,file,{upsert:true});
      if(error){setUploading(false);alert('Upload failed: '+error.message);return;}
      const {data:ud}=supabase.storage.from('attachments').getPublicUrl(path);
      const publicUrl = ud?.publicUrl || ud?.data?.publicUrl || '';
      const {data:plan}=await supabase.from('precon_plans').insert([{project_id:pid,name:sheetName,file_url:publicUrl,file_type:file.type}]).select().single();
      if(plan){
        setPlans(prev=>[...prev.filter(p=>p.id!=='preview'),plan]);
        setSelPlan(plan);
        if(uploadTargetFolder && planSets[uploadTargetFolder]){
          const updated = {...planSets, [uploadTargetFolder]:{...planSets[uploadTargetFolder], planIds:[...(planSets[uploadTargetFolder].planIds||[]), plan.id]}};
          savePlanSets(updated);
        } else {
          const updated = {...planSets, [batchId]:{name:sheetName, planIds:[plan.id], collapsed:false}};
          savePlanSets(updated);
        }
        setUploadTargetFolder(null);
        setUploading('✓ Done');
        setTimeout(()=>setUploading(false), 2500);
      } else {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const runAITakeoff=async()=>{
    if(!selPlan) return;
    setAnalyzing(true);
    let b64=planB64; let mime=planMime;
    if(!b64){
      try{
        const res=await fetch(selPlan.file_url);
        const blob=await res.blob(); mime=blob.type||'image/png';
        b64=await new Promise(resolve=>{const r=new FileReader();r.onload=e=>resolve(e.target.result.split(',')[1]);r.readAsDataURL(blob);});
      }catch(e){setAnalyzing(false);alert('Could not load plan');return;}
    }
    const isImg=mime.startsWith('image/');
    const block=isImg?{type:'image',source:{type:'base64',media_type:mime,data:b64}}:{type:'document',source:{type:'base64',media_type:'application/pdf',data:b64}};
    const costs = getUnitCosts();
    const res=await fetch('/api/claude',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({model:AI_MODEL,max_tokens:3000,
        messages:[{role:'user',content:[block,{type:'text',text:`You are a senior concrete and masonry construction estimator. Analyze this plan drawing extremely carefully.

Project: "${project.name}" | GC: ${project.gc_name||'N/A'} | Est. Value: ${project.contract_value?'$'+project.contract_value:'TBD'}

Your job: Extract EVERY quantifiable scope item for a concrete/masonry subcontractor bidding this job.

Instructions:
- Read ALL dimension strings visible on the plan
- Identify every concrete element: slabs, footings, walls, columns, piers, curbs
- Identify masonry: CMU block walls, brick, stone
- Calculate or estimate quantities from dimensions shown
- If dimensions aren't visible, estimate from drawing scale and context
- Separate different areas into individual line items (e.g. "Slab Area A - 2,400 SF", "Slab Area B - 800 SF")
- Include rebar, formwork, and excavation as separate items

Return ONLY a valid JSON array, no markdown:
[{"category":"concrete_slab|concrete_footing|concrete_wall|masonry_cmu|masonry_brick|rebar|formwork|excavation|flatwork|grout|other","description":"specific item with location/reference","quantity":number,"unit":"SF|CY|LF|LB|EA|LS","measurement_type":"area|linear|count|manual","confidence":"high|medium|low"}]`}]}]})
    });
    const json=await res.json();
    const text=json?.content?.find(b=>b.type==='text')?.text||'';
    try{
      const aiItems=JSON.parse(text.replace(/```json|```/g,'').trim());
      const pid=project.id;
      const toInsert=aiItems.map((it,i)=>{
        const catDef=TAKEOFF_CATS.find(c=>c.id===it.category)||TAKEOFF_CATS[TAKEOFF_CATS.length-1];
        const uc=(costs[it.category]?.mat||0)+(costs[it.category]?.lab||0)||catDef.defaultCost;
        return {project_id:pid,plan_id:selPlan?.id,category:it.category||'other',description:it.description,quantity:it.quantity||0,unit:it.unit||catDef.unit,unit_cost:uc,total_cost:(it.quantity||0)*uc,measurement_type:it.measurement_type||'manual',points:null,color:catDef.color,ai_generated:true,sort_order:items.length+i};
      });
      const {data}=await supabase.from('takeoff_items').insert(toInsert).select();
      if(data) setItems(prev=>[...prev,...data]);
    }catch(e){alert('AI parse failed: '+e.message);}
    setAnalyzing(false);
  };

  const applyAssembly = async (assemblyItems) => {
    const pid = project.id;
    const toInsert = assemblyItems.map((it,i)=>({...it,project_id:pid,plan_id:selPlan?.id,measurement_type:'manual',points:null,color:TAKEOFF_CATS.find(c=>c.id===it.category)?.color||'#555',ai_generated:false,sort_order:items.length+i}));
    const {data}=await supabase.from('takeoff_items').insert(toInsert).select();
    if(data) setItems(prev=>[...prev,...data]);
    setShowAssembly(false);
  };

  const deleteItem = async (id) => {
    const {error}=await supabase.from('takeoff_items').delete().eq('id',id).select();
    if(error){console.error('deleteItem error:',error);alert('Delete failed: '+error.message);return;}
    setItems(prev=>prev.filter(i=>i.id!==id));
  };

  const pushToSOV = async () => {
    const apmId=project.apm_project_id;
    if(!apmId){alert('Link to an APM project first to push SOV.');return;}
    if(!items.length) return;
    const grouped={};
    items.forEach(it=>{ const cat=TAKEOFF_CATS.find(c=>c.id===it.category); const key=cat?.label||it.category; if(!grouped[key])grouped[key]={desc:key,total:0}; grouped[key].total+=(it.total_cost||0); });
    const sovRows=Object.values(grouped).map((g,i)=>({project_id:apmId,item_no:String(i+1),description:g.desc,scheduled_value:Math.round(g.total),sort_order:i}));
    await supabase.from('sov_items').delete().eq('project_id',apmId);
    await supabase.from('sov_items').insert(sovRows);
    alert('✓ SOV updated in APM! Go to the linked project → Pay Apps to review.');
  };

  // Normalize points to array-of-shapes format for rendering.
  // Legacy: [{x,y},...] → wrap in outer array
  // New: [[{x,y},...], ...] — multiple shapes per condition
  const normalizeShapes = (pts) => {
    if(!pts||pts.length===0) return [];
    if(Array.isArray(pts[0])) return pts; // already multi-shape
    if(pts[0] && typeof pts[0].x === 'number') return [pts]; // legacy single
    return pts;
  };

  // Split a single shape's points into outer boundary + embedded holes
  // Holes are separated by {_holeStart:true} marker points
  // Returns {outer: [{x,y},...], holes: [[{x,y},...], ...]}
  const splitShapeHoles = (pts) => {
    if(!pts||!pts.length) return {outer:[], holes:[]};
    const segments = [];
    let cur = [];
    for(const p of pts){
      if(p._holeStart){
        if(cur.length) segments.push(cur);
        cur = [];
      } else {
        cur.push(p);
      }
    }
    if(cur.length) segments.push(cur);
    return { outer: segments[0]||[], holes: segments.slice(1) };
  };

  // Point-in-polygon test (ray casting)
  const pointInPoly = (pt, poly) => {
    let inside = false;
    for(let i=0, j=poly.length-1; i<poly.length; j=i++){
      const xi=poly[i].x, yi=poly[i].y, xj=poly[j].x, yj=poly[j].y;
      if(((yi>pt.y)!==(yj>pt.y)) && (pt.x<(xj-xi)*(pt.y-yi)/(yj-yi)+xi)) inside=!inside;
    }
    return inside;
  };

  // Sutherland-Hodgman polygon clipping — clips subject polygon to clip polygon boundary
  // Returns the intersection polygon (portion of subject inside clip)
  const clipPolygonToOuter = (subject, clip) => {
    if(!subject.length || !clip.length) return [];
    let output = subject.map(p=>({x:p.x, y:p.y}));
    for(let i=0; i<clip.length; i++){
      if(!output.length) return [];
      const input = [...output];
      output = [];
      const a = clip[i], b = clip[(i+1)%clip.length];
      // isInside: point is on the left side of edge a→b
      const inside = (p) => (b.x-a.x)*(p.y-a.y) - (b.y-a.y)*(p.x-a.x) >= 0;
      const intersect = (p1, p2) => {
        const x1=p1.x,y1=p1.y,x2=p2.x,y2=p2.y,x3=a.x,y3=a.y,x4=b.x,y4=b.y;
        const d=(x1-x2)*(y3-y4)-(y1-y2)*(x3-x4);
        if(Math.abs(d)<1e-10) return p1;
        const t=((x1-x3)*(y3-y4)-(y1-y3)*(x3-x4))/d;
        return {x:x1+t*(x2-x1), y:y1+t*(y2-y1)};
      };
      for(let j=0; j<input.length; j++){
        const cur = input[j];
        const prev = input[(j+input.length-1)%input.length];
        const curIn = inside(cur), prevIn = inside(prev);
        if(curIn){
          if(!prevIn) output.push(intersect(prev, cur));
          output.push(cur);
        } else if(prevIn){
          output.push(intersect(prev, cur));
        }
      }
    }
    return output;
  };

  // Compute net area for a shape that may have embedded holes
  // Clips each hole to the outer boundary so overflow doesn't over-subtract
  const calcShapeNetArea = (pts) => {
    const {outer, holes} = splitShapeHoles(pts);
    if(outer.length<3) return 0;
    const outerClean = outer.filter(p=>!p._ctrl);
    const outerArea = Math.abs(outer.some(p=>p._ctrl) ? calcShapeArea(outer) : calcArea(outer));
    // Clip each hole to the outer polygon, then compute its area
    const holesArea = holes.reduce((s,h)=> {
      const hClean = h.filter(p=>!p._ctrl);
      if(hClean.length<3) return s;
      // Clip the hole to the outer boundary so only the intersection counts
      const clipped = clipPolygonToOuter(hClean, outerClean);
      if(clipped.length<3) return s;
      return s + Math.abs(calcArea(clipped));
    }, 0);
    return Math.max(0, outerArea - holesArea);
  };

  // ── snapToAngle: snap a point to nearest allowed angle from 'from' ──────
  const snapToAngle = (from, to) => {
    if(!from||!snapEnabled) return to;
    const dx=to.x-from.x, dy=to.y-from.y, len=Math.hypot(dx,dy);
    if(len<2) return to;
    const deg=Math.atan2(dy,dx)*180/Math.PI;
    const snaps=[0,45,60,90,135,150,180,225,240,270,315,300,360,-45,-60,-90,-135,-150,-180,-225,-240,-270,-300,-315];
    const best=snaps.reduce((b,a)=>{const d=Math.abs(((deg-a)+540)%360-180);return d<b.diff?{a,diff:d}:b;},{a:0,diff:Infinity}).a;
    const rad=best*Math.PI/180;
    return {x:Math.round(from.x+len*Math.cos(rad)), y:Math.round(from.y+len*Math.sin(rad))};
  };

  // SVG — condition-first model. Each item may have multiple shapes.
  // Active condition gets a highlight ring.

  // ── Single source of truth for shape-level delete ────────────────────────
  const deleteSelectedShapes = () => {
    const keys = [...selectedShapesRef.current];
    console.log('[deleteSelectedShapes] keys:', keys);
    if(!keys.length) return;
    const byItem = {};
    keys.forEach(k => {
      const parts = k.split('::');
      const id = parts[0];
      const si = Number(parts[1]);
      if(!byItem[id]) byItem[id] = [];
      byItem[id].push(si);
    });
    console.log('[deleteSelectedShapes] byItem:', byItem);
    Object.entries(byItem).forEach(([id, idxs]) => {
      const item = itemsRef.current.find(i => String(i.id) === String(id));
      if(!item){ console.warn('[deleteSelectedShapes] item not found:', id, 'items count:', itemsRef.current.length, 'ids:', itemsRef.current.map(i=>i.id)); return; }
      const rawPts = item.points;
      let shapes;
      if(!rawPts || rawPts.length === 0){ shapes = []; }
      else if(Array.isArray(rawPts[0])){ shapes = rawPts; }
      else if(rawPts[0] && typeof rawPts[0].x === 'number'){ shapes = [rawPts]; }
      else { shapes = rawPts; }
      console.log('[deleteSelectedShapes] item', id, 'shapes count:', shapes.length, 'removing idxs:', idxs);
      const kept = shapes.filter((_, i) => !idxs.includes(i));
      if(kept.length === 0){
        console.log('[deleteSelectedShapes] deleting entire item', id);
        setItems(prev => prev.filter(i => String(i.id) !== String(id)));
        supabase.from('takeoff_items').delete().eq('id', id).select().then(({ data:del, error }) => {
          if(error) console.error('[deleteSelectedShapes] supabase delete error:', error);
          else if(!del||del.length===0) console.warn('[deleteSelectedShapes] RLS blocked delete for', id);
          else console.log('[deleteSelectedShapes] supabase delete OK for', id);
        });
      } else {
        console.log('[deleteSelectedShapes] trimming item', id, 'kept shapes:', kept.length);
        setItems(prev => prev.map(i => String(i.id) === String(id) ? {...i, points: kept} : i));
        supabase.from('takeoff_items').update({ points: kept }).eq('id', id).select().then(({ data:upd, error }) => {
          if(error) console.error('[deleteSelectedShapes] supabase update error:', error);
          else if(!upd||upd.length===0) console.warn('[deleteSelectedShapes] RLS blocked update for', id);
          else console.log('[deleteSelectedShapes] supabase update OK for', id);
        });
      }
    });
    setSelectedShapes(new Set());
  };
  deleteShapesRef.current = deleteSelectedShapes;

  // ── Commit shape drag: apply offset to selected shapes ─────────────────
  const commitShapeDrag = (offset) => {
    if(!offset) return;
    const {dx, dy} = offset;
    const keys = [...selectedShapesRef.current];
    const byItem = {};
    keys.forEach(k=>{
      const colonIdx = k.lastIndexOf('::');
      const id = k.slice(0, colonIdx);
      const si = Number(k.slice(colonIdx+2));
      if(!byItem[id]) byItem[id] = new Set();
      byItem[id].add(si);
    });
    setItems(prev=>prev.map(item=>{
      const idStr = String(item.id);
      if(!byItem[idStr]) return item;
      const selectedIdxs = byItem[idStr];
      const shapes = normalizeShapes(item.points);
      const newShapes = shapes.map((sh, si)=>{
        if(!selectedIdxs.has(si)) return sh;
        return sh.map(p=>({...p, x:p.x+dx, y:p.y+dy}));
      });
      // Save to Supabase (area/length unchanged by translation, just coords)
      supabase.from('takeoff_items').update({points:newShapes}).eq('id',item.id);
      return {...item, points:newShapes};
    }));
  };

  // ── Commit vertex drag: apply single point change + recompute qty ──────
  const commitVertexDrag = (vd) => {
    if(!vd) return;
    const {itemId, shapeIdx, vertexIdx, point} = vd;
    setItems(prev=>prev.map(item=>{
      if(String(item.id)!==String(itemId)) return item;
      const shapes = normalizeShapes(item.points);
      const newShapes = shapes.map((sh, si)=>{
        if(si!==shapeIdx) return sh;
        return sh.map((p, vi)=> vi===vertexIdx ? {...p, x:point.x, y:point.y} : p);
      });
      const mt = item.measurement_type;
      let qty = 0;
      if(mt==='area') qty = newShapes.reduce((s,sh)=>s+calcShapeNetArea(sh),0);
      else if(mt==='linear') qty = newShapes.reduce((s,sh)=>{let t=0;for(let i=1;i<sh.length;i++){const a=sh[i-1],b=sh[i];if(!a._ctrl&&!b._ctrl) t+=calcLinear(a,b);}return s+t;},0);
      else if(mt==='count') qty = newShapes.length;
      qty = Math.round(Math.abs(qty)*10)/10;
      const total_cost = qty*(item.unit_cost||0);
      supabase.from('takeoff_items').update({points:newShapes, quantity:qty, total_cost}).eq('id',item.id);
      return {...item, points:newShapes, quantity:qty, total_cost};
    }));
  };

  // ── Single source of truth for shape-level copy ───────────────────────────
  const copySelectedShapes = () => {
    const keys = [...selectedShapesRef.current];
    if(!keys.length) return;
    const byItem = {};
    keys.forEach(k => {
      const parts = k.split('::');
      const id = parts[0]; const si = Number(parts[1]);
      if(!byItem[id]) byItem[id] = [];
      byItem[id].push(si);
    });
    const entries = Object.entries(byItem).map(([id, idxs]) => {
      const item = itemsRef.current.find(i => String(i.id) === String(id)); if(!item) return null;
      const rawPts = item.points;
      let shapes;
      if(!rawPts || rawPts.length===0){ shapes=[]; }
      else if(Array.isArray(rawPts[0])){ shapes=rawPts; }
      else if(rawPts[0] && typeof rawPts[0].x==='number'){ shapes=[rawPts]; }
      else { shapes=rawPts; }
      return { item, shapes: idxs.map(i => shapes[i]).filter(Boolean) };
    }).filter(Boolean);
    clipboardRef.current = entries;
    setClipboard(entries);
    pasteOffsetRef.current = 0;
    setCopyFlash(keys.length);
    setTimeout(() => setCopyFlash(0), 1800);
  };
  copyShapesRef.current = copySelectedShapes;

  const renderMeasurements=()=>{
    if(!selPlan?.id) return [];
    const sw=2/zoom, fs=10/zoom, r=5/zoom, rSm=3/zoom, padH=9/zoom;
    return items
      .filter(it=> it.points?.length && it.plan_id===selPlan.id)
      .flatMap(it=>{
        const shapes = normalizeShapes(it.points);
        if(!shapes.length) return [];
        const isActive = it.id===activeCondId;
        const isSelected = false; // resolved per-shape below using selectedShapes
        const c = isActive ? '#F97316' : isSelected ? '#3B82F6' : (it.color||'#10B981');
        const mt = it.measurement_type;

        return shapes.map((pts, shapeIdx)=>{
          const key = `${it.id}-${shapeIdx}`;
          // Skip legacy separate hole shapes (old data format)
          if(pts[0]?._hole) return null;
          const isSelected = selectedShapes.has(`${it.id}::${shapeIdx}`);
          const isEraserTarget = eraserHover?.itemId===it.id && eraserHover?.shapeIdx===shapeIdx;
          const shapeKey = `${it.id}::${shapeIdx}`;
          const onClick = (e)=>{
            if(tool==='eraser') return;
            // ── Cutout: click on an area shape to arm it for cutting ──
            if(tool==='cutout'){
              if(mt==='area'){
                e.stopPropagation();
                setActiveCondId(it.id);
              }
              return;
            }
            if(tool==='select'||(e.ctrlKey||e.metaKey)){
              e.stopPropagation();
              if(e.ctrlKey||e.metaKey){
                setSelectedShapes(prev=>{ const n=new Set(prev); n.has(shapeKey)?n.delete(shapeKey):n.add(shapeKey); return n; });
              } else {
                setSelectedShapes(new Set([shapeKey]));
              }
              return;
            }
            setActiveCondId(it.id);
            setTool(mt==='area'?'area':mt==='perimeter'?'perimeter':mt==='linear'?'linear':mt==='count'?'count':'select');
          };

          // ── Apply vertex drag to display points ──
          let dp = pts;
          if(vertexDrag && String(vertexDrag.itemId)===String(it.id) && vertexDrag.shapeIdx===shapeIdx){
            dp = pts.map((p,vi)=> vi===vertexDrag.vertexIdx ? {...p, x:vertexDrag.point.x, y:vertexDrag.point.y} : p);
          }

          // ── Shape drag ──
          const isDragging = dragOffset && isSelected;
          const dragTransform = isDragging ? `translate(${dragOffset.dx}, ${dragOffset.dy})` : undefined;
          const shapeCursor = isDragging ? 'grabbing' : (isSelected && tool==='select') ? 'grab' : tool==='eraser' ? 'cell' : 'pointer';

          // ── Vertex handles (skip _holeStart markers) ──
          const showVertices = isSelected && tool==='select' && !isDragging;
          const vertexHandles = showVertices ? dp.map((p,vi)=>{
            if(p._ctrl || p._holeStart) return null;
            const isActiveVtx = vertexDrag && String(vertexDrag.itemId)===String(it.id) && vertexDrag.shapeIdx===shapeIdx && vertexDrag.vertexIdx===vi;
            return <circle key={`vtx-${vi}`} data-vertex="1" data-item-id={it.id} data-shape-idx={shapeIdx} data-vertex-idx={vi}
              cx={p.x} cy={p.y} r={r*1.1}
              fill={isActiveVtx?'#3B82F6':'#fff'} stroke="#3B82F6" strokeWidth={sw*0.8}
              style={{cursor:'move',pointerEvents:'all'}}/>;
          }).filter(Boolean) : null;

          if((mt==='area')&&dp.length>=3){
            // Split shape into outer boundary + embedded holes
            const {outer: outerPts, holes: embeddedHoles} = splitShapeHoles(dp);
            if(outerPts.length<3) return null;
            const hasArcs = outerPts.some(p=>p._ctrl);
            const realPts = outerPts.filter(p=>!p._ctrl);
            const validHoles = embeddedHoles.filter(h=>h.length>=3);
            const hasHoles = validHoles.length>0;

            // Build outer SVG path
            const outerD = hasArcs ? buildShapePath(outerPts, true) : (outerPts.map((p,i)=>`${i===0?'M':'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')+' Z');

            // Build hole SVG paths
            const holePaths = validHoles.map(hPts=>{
              const hHasArcs = hPts.some(p=>p._ctrl);
              return hHasArcs ? buildShapePath(hPts, true) : (hPts.map((p,i)=>`${i===0?'M':'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')+' Z');
            });

            const cx=realPts.reduce((s,p)=>s+p.x,0)/(realPts.length||1);
            const cy=realPts.reduce((s,p)=>s+p.y,0)/(realPts.length||1);
            const netArea = Math.round(calcShapeNetArea(dp)*10)/10;
            const lw=38/zoom, lh=padH*1.6;
            const strokeColor = isEraserTarget ? '#EF4444' : c;
            const fillColor = c+'22';
            const strokeW = isEraserTarget ? sw*2 : (isActive?sw*1.5:sw);
            const maskId = `mask-${it.id}-${shapeIdx}`;
            const clipId = `clip-${it.id}-${shapeIdx}`;

            return(<g key={key} data-shape="1" data-item-id={it.id} data-shape-idx={shapeIdx} onClick={onClick} style={{cursor:shapeCursor}} transform={dragTransform}>
              {hasHoles&&(
                <defs>
                  {/* Mask: white=visible, black=cutout. Applied to fill AND outer stroke. */}
                  <mask id={maskId} maskUnits="userSpaceOnUse"
                    x={Math.min(...realPts.map(p=>p.x))-50} y={Math.min(...realPts.map(p=>p.y))-50}
                    width={Math.max(...realPts.map(p=>p.x))-Math.min(...realPts.map(p=>p.x))+100}
                    height={Math.max(...realPts.map(p=>p.y))-Math.min(...realPts.map(p=>p.y))+100}>
                    <path d={outerD} fill="white"/>
                    {holePaths.map((hD,hi)=><path key={hi} d={hD} fill="black"/>)}
                  </mask>
                  {/* ClipPath: constrains hole strokes to only show within outer boundary */}
                  <clipPath id={clipId}><path d={outerD}/></clipPath>
                </defs>
              )}
              {/* Fill: masked — disappears at cutouts, plan shows through */}
              <path d={outerD} fill={fillColor} stroke="none" mask={hasHoles?`url(#${maskId})`:undefined}/>
              {/* Outer stroke: masked — disappears where it passes through cutout regions */}
              <path d={outerD} fill="none" stroke={strokeColor} strokeWidth={strokeW} mask={hasHoles?`url(#${maskId})`:undefined}/>
              {/* Hole strokes: same color as outer, clipped to outer boundary.
                  Combined with masked outer stroke = continuous boundary of the difference shape. */}
              {hasHoles&&holePaths.map((hD,hi)=>(
                <path key={`hs-${hi}`} d={hD} fill="none" stroke={strokeColor} strokeWidth={strokeW} clipPath={`url(#${clipId})`}/>
              ))}
              {isSelected&&<path d={outerD} fill="none" stroke="#3B82F6" strokeWidth={sw*2} strokeDasharray={`${6/zoom},${3/zoom}`} opacity={0.6} style={{pointerEvents:'none'}}/>}
              <rect x={cx-lw/2} y={cy-lh/2} width={lw} height={lh} rx={2/zoom} fill="rgba(0,0,0,0.65)"/>
              <text x={cx} y={cy+fs*0.38} fontSize={fs*0.9} fill={isActive?'#F97316':'#ddd'} textAnchor="middle" fontFamily="'DM Mono',monospace" fontWeight={600} style={{pointerEvents:'none'}}>{netArea} SF</text>
              {vertexHandles}
            </g>);
          }
          if(mt==='linear'&&dp.length>=2){
            const hasArcs = dp.some(p=>p._ctrl);
            const d = hasArcs ? buildShapePath(dp) : ('M'+dp.map(p=>`${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' L'));
            const realPts = dp.filter(p=>!p._ctrl);
            const mx=realPts.reduce((s,p)=>s+p.x,0)/realPts.length;
            const my=realPts.reduce((s,p)=>s+p.y,0)/realPts.length;
            const dist = hasArcs
              ? Math.round((calcShapeLength(dp)/scale)*10)/10
              : (()=>{ let t=0; for(let i=1;i<dp.length;i++) t+=calcLinear(dp[i-1],dp[i]); return Math.round(t*10)/10; })();
            const lw=36/zoom, lh=padH*1.5;
            const strokeColor = isEraserTarget ? '#EF4444' : c;
            const strokeW = isEraserTarget ? sw*2.5 : sw*1.2;
            return(<g key={key} data-shape="1" data-item-id={it.id} data-shape-idx={shapeIdx} onClick={onClick} style={{cursor:shapeCursor}} transform={dragTransform}>
              <path d={d} fill="none" stroke={strokeColor} strokeWidth={strokeW} strokeDasharray={`${6/zoom},${3/zoom}`}/>
              {isSelected&&<path d={d} fill="none" stroke="#3B82F6" strokeWidth={sw*2.5} opacity={0.4} style={{pointerEvents:'none'}}/>}
              {realPts.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={r*0.8} fill={strokeColor} stroke="#fff" strokeWidth={sw*0.4}/>)}
              {hasArcs&&dp.filter(p=>p._ctrl).map((p,i)=><circle key={'ctrl'+i} cx={p.x} cy={p.y} r={r*0.5} fill={c} opacity={0.4}/>)}
              <rect x={mx-lw/2} y={my-lh*1.6} width={lw} height={lh} rx={2/zoom} fill="rgba(0,0,0,0.65)"/>
              <text x={mx} y={my-lh*0.7} fontSize={fs*0.9} fill={isActive?'#F97316':'#ddd'} textAnchor="middle" fontFamily="'DM Mono',monospace" fontWeight={600} style={{pointerEvents:'none'}}>{dist} {scale?'LF':'px'}</text>
              {vertexHandles}
            </g>);
          }
          if(mt==='count'&&dp[0]){
            const p=dp[0];
            const isEr=isEraserTarget;
            return(<g key={key} data-shape="1" data-item-id={it.id} data-shape-idx={shapeIdx} onClick={onClick} style={{cursor:shapeCursor}} transform={dragTransform}>
              <circle cx={p.x} cy={p.y} r={r*1.8} fill={isEr?'#EF4444':c} stroke={isSelected?'#3B82F6':'#fff'} strokeWidth={isSelected?sw*2:sw*0.5}/>
              <text x={p.x} y={p.y+fs*0.38} fontSize={fs*0.9} fill="#fff" textAnchor="middle" fontFamily="'DM Mono',monospace" fontWeight={700} style={{pointerEvents:'none'}}>✕</text>
            </g>);
          }

          return null;
        }).filter(Boolean);
      });
  };

  const renderActive=()=>{
    const pts=(tool==='scale'&&scaleStep==='picking')?scalePts:activePts;
    if(!pts.length&&!archMode) return null;
    const c=tool==='scale'?'#10B981':tool==='cutout'?'#EF4444':archMode?'#a855f7':tool==='area'?'#F59E0B':tool==='perimeter'?'#F97316':'#06B6D4';
    const sw=2.5/zoom, r0=10/zoom, r1=5/zoom, r2=4/zoom, fs=10/zoom;
    const all=hoverPt?[...pts,hoverPt]:pts;
    const activeCond = itemsRef.current.find(i=>String(i.id)===String(activeCondId));
    const mt = activeCond?.measurement_type;

    // Arch linear: show bezier preview when we have p1+p2 and hovering for ctrl
    const isArchLinear = (archMode || arcPending) && mt==='linear';
    const isArchArea   = archMode && mt==='area';

    // Build preview path
    let previewPath = null;
    if(isArchLinear && pts.length===2 && hoverPt){
      // Preview: p1 → curve → p2 with hoverPt as ctrl
      const d=`M${pts[0].x},${pts[0].y} Q${hoverPt.x},${hoverPt.y} ${pts[1].x},${pts[1].y}`;
      const pxLen = bezierLength(pts[0], hoverPt, pts[1]);
      const ft = scale ? Math.round(pxLen/scale*10)/10 : null;
      const mx=(pts[0].x+pts[1].x)/2, my=(pts[0].y+pts[1].y)/2;
      previewPath = (<>
        <path d={d} fill="none" stroke={c} strokeWidth={sw} strokeDasharray={`${6/zoom},${3/zoom}`} opacity={0.9}/>
        <line x1={hoverPt.x} y1={hoverPt.y} x2={pts[0].x} y2={pts[0].y} stroke={c} strokeWidth={sw*0.4} strokeDasharray={`${3/zoom},${3/zoom}`} opacity={0.3}/>
        <line x1={hoverPt.x} y1={hoverPt.y} x2={pts[1].x} y2={pts[1].y} stroke={c} strokeWidth={sw*0.4} strokeDasharray={`${3/zoom},${3/zoom}`} opacity={0.3}/>
        <circle cx={hoverPt.x} cy={hoverPt.y} r={r2} fill={c} opacity={0.6}/>
        {ft&&<text x={mx} y={my-8/zoom} fontSize={fs} fill={c} textAnchor="middle" fontFamily="'DM Mono',monospace" fontWeight={700} style={{pointerEvents:'none'}}>{ft} LF ⌒</text>}
      </>);
    } else if(isArchLinear && pts.length===1 && hoverPt){
      // First segment — show straight preview to p2
      previewPath = <line x1={pts[0].x} y1={pts[0].y} x2={hoverPt.x} y2={hoverPt.y} stroke={c} strokeWidth={sw} strokeDasharray={`${6/zoom},${3/zoom}`} opacity={0.7}/>;
    } else if(!isArchLinear){
      // Normal area/linear/cutout preview
      if(all.length>=2) previewPath = (<>
        <polyline points={all.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke={c} strokeWidth={sw} strokeDasharray={(tool==='area'||tool==='cutout')?'none':`${6/zoom},${3/zoom}`} opacity={0.9}/>
        {tool==='cutout'&&all.length>=3&&<polygon points={all.map(p=>`${p.x},${p.y}`).join(' ')} fill="rgba(239,68,68,0.15)" stroke="none"/>}
      </>);
    }

    return(<>
      {previewPath}
      {/* Draw placed points */}
      {pts.filter(p=>!p._ctrl).map((p,i)=>(
        <circle key={i} cx={p.x} cy={p.y} r={i===0&&pts.length>=3?r0:r1} fill={c} stroke={i===0&&pts.length>=3?'#fff':'none'} strokeWidth={sw*0.8} opacity={0.95}/>
      ))}
      {/* Show ctrl points as diamonds */}
      {pts.filter(p=>p._ctrl).map((p,i)=>(
        <circle key={'c'+i} cx={p.x} cy={p.y} r={r2*0.8} fill={c} opacity={0.5}/>
      ))}
      {hoverPt&&!isArchLinear&&<circle cx={hoverPt.x} cy={hoverPt.y} r={r2} fill={c} opacity={0.5}/>}
      {/* Close hint for area */}
      {(tool==='area'||tool==='cutout')&&activePts.filter(p=>!p._ctrl).length>=3&&!isArchArea&&<text x={pts[0].x+14/zoom} y={pts[0].y-10/zoom} fontSize={fs} fill={c} fontFamily="'DM Mono',monospace" fontWeight={700} style={{pointerEvents:'none'}}>✦ dbl-click to close</text>}
      {/* Snap indicator — small crosshair on cursor when snap is active */}
      {snapEnabled&&hoverPt&&(()=>{
        const sz=9/zoom;
        return(<>
          <line x1={hoverPt.x-sz} y1={hoverPt.y} x2={hoverPt.x+sz} y2={hoverPt.y} stroke="#facc15" strokeWidth={1.2/zoom} opacity={0.9}/>
          <line x1={hoverPt.x} y1={hoverPt.y-sz} x2={hoverPt.x} y2={hoverPt.y+sz} stroke="#facc15" strokeWidth={1.2/zoom} opacity={0.9}/>
          <circle cx={hoverPt.x} cy={hoverPt.y} r={sz*0.55} fill="none" stroke="#facc15" strokeWidth={1/zoom} opacity={0.8}/>
        </>);
      })()}
      {/* dbl-click to finish hint for linear */}
      {tool==='linear'&&!archMode&&activePts.length>=2&&hoverPt&&<text x={hoverPt.x+8/zoom} y={hoverPt.y-8/zoom} fontSize={fs*0.9} fill={c} fontFamily="'DM Mono',monospace" fontWeight={600} style={{pointerEvents:'none'}}>dbl-click to finish</text>}
      {/* Live LF readout — segment from last point to cursor */}
      {tool==='linear'&&!archMode&&activePts.length>=1&&scale&&hoverPt&&(()=>{
        const lastPt=activePts[activePts.length-1];
        const dist=Math.round(calcLinear(lastPt,hoverPt)*10)/10;
        return <text x={(lastPt.x+hoverPt.x)/2} y={(lastPt.y+hoverPt.y)/2-6/zoom} fontSize={fs} fill={c} textAnchor="middle" fontFamily="'DM Mono',monospace" fontWeight={700} style={{pointerEvents:'none'}}>{dist} LF</text>;
      })()}
      {/* Arch mode step indicator */}
      {isArchLinear&&(
        <text x={hoverPt?.x??0} y={(hoverPt?.y??0)-16/zoom} fontSize={fs*0.9} fill={c} textAnchor="middle" fontFamily="'DM Mono',monospace" fontWeight={700} style={{pointerEvents:'none'}}>
          {arcPending ? (pts.length===0?'⌒ Arc: click start':pts.length===1?'⌒ Arc: click peak (radius bulge)':'⌒ Arc: click end') : (pts.length===0?'⌒ Click start':pts.length===1?'⌒ Click end':pts.length===2?'⌒ Click arc bulge':'')}
        </text>
      )}
      {isArchArea&&archCtrlPending&&(
        <text x={hoverPt?.x??0} y={(hoverPt?.y??0)-16/zoom} fontSize={fs*0.9} fill={c} textAnchor="middle" fontFamily="'DM Mono',monospace" fontWeight={700} style={{pointerEvents:'none'}}>⌒ Click arc ctrl pt</text>
      )}
    </>);
  };

  const totalEst=items.reduce((s,i)=>s+(i.total_cost||0),0); // all sheets
  const catGroups=TAKEOFF_CATS.map(cat=>{
    const allCatItems = sidebarItems.filter(i=>i.category===cat.id);
    if(!allCatItems.length) return null;
    const byDesc = new Map();
    allCatItems.forEach(i=>{
      const key = i.description;
      if(!byDesc.has(key)){
        byDesc.set(key, {...i, _planCount:1, _totalQty:i.quantity||0, _totalCost:i.total_cost||0, _siblings:[i]});
      } else {
        const g = byDesc.get(key);
        const newCount = g._planCount+1;
        const newQty = Math.round((g._totalQty+(i.quantity||0))*10)/10;
        const newCost = g._totalCost+(i.total_cost||0);
        const newSibs = [...g._siblings,i];
        const base = i.plan_id===selPlan?.id ? i : g;
        byDesc.set(key, {...base, _planCount:newCount, _totalQty:newQty, _totalCost:newCost, _siblings:newSibs});
      }
    });
    const its = [...byDesc.values()];
    const subtotal = its.reduce((s,i)=>s+(i._totalCost||0),0);
    return {cat, items:its, subtotal};
  }).filter(Boolean);
  const toolCursor=(spaceHeld||tool==='select')?'grab':(tool==='cutout'&&!activeCondId)?'pointer':{area:'crosshair',linear:'crosshair',count:'cell',scale:'crosshair',cutout:'crosshair',eraser:'cell'}[tool]||'default';

  const co = COMPANIES.find(c=>c.id===project.company)||COMPANIES[1];
  const STATUS_COLORS_BID = {estimating:'#F59E0B',bid_submitted:'#3B82F6',awarded:'#10B981',lost:'#EF4444',hold:'#555'};

  // ── right tool icon helper
  const RightBtn = ({icon, label, active, onClick, color}) => {
    const activeColor = color || '#10B981';
    return(
    <button onClick={onClick} title={label}
      style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2,
        padding:'11px 0',border:'none',
        background:active?activeColor+'18':'none',
        color:active?activeColor:t.text3,
        cursor:'pointer',width:'100%',
        borderRight:active?`2px solid ${activeColor}`:'2px solid transparent',
        transition:'all 0.12s'}}>
      <span style={{fontSize:17,lineHeight:1}}>{icon}</span>
      <span style={{fontSize:8,fontFamily:"'DM Mono',monospace",fontWeight:600,letterSpacing:0.2,color:active?activeColor:t.text4,marginTop:1}}>{label}</span>
    </button>
    );
  };

  // ── Export plan with markup + optional legend ──────────────────────────────
  const [exporting, setExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const roundRect = (ctx, x, y, w, h, r) => {
    ctx.beginPath(); ctx.moveTo(x+r, y);
    ctx.lineTo(x+w-r, y); ctx.quadraticCurveTo(x+w, y, x+w, y+r);
    ctx.lineTo(x+w, y+h-r); ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
    ctx.lineTo(x+r, y+h); ctx.quadraticCurveTo(x, y+h, x, y+h-r);
    ctx.lineTo(x, y+r); ctx.quadraticCurveTo(x, y, x+r, y);
    ctx.closePath();
  };

  const exportPlanCanvas = async (plan, withLegend) => {
    const marker = '/object/public/attachments/';

    const loadPlanImg = async (url) => {
      const idx = url?.indexOf(marker) ?? -1;
      const storagePath = idx !== -1 ? url.slice(idx + marker.length) : null;
      if(!storagePath) throw new Error('Could not extract storage path from: ' + url);
      const { data, error } = await supabase.storage.from('attachments').download(storagePath);
      if(error || !data) throw new Error('Supabase download failed: ' + (error?.message || 'unknown') + ' | ' + storagePath);
      const bUrl = URL.createObjectURL(data);
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = bUrl; });
      URL.revokeObjectURL(bUrl);
      return img;
    };

    // For the currently-open PDF plan reuse the already-rendered canvas
    const usePdfCanvas = plan.id === selPlan?.id && isPdfPlan && canvasRef.current;

    let img = null;
    if(!usePdfCanvas){
      img = await loadPlanImg(plan.file_url);
    }

    const W = usePdfCanvas ? canvasRef.current.width  : (img?.naturalWidth  || 800);
    const H = usePdfCanvas ? canvasRef.current.height : (img?.naturalHeight || 1100);

    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    const ctx = out.getContext('2d');

    if(usePdfCanvas){
      ctx.drawImage(canvasRef.current, 0, 0, W, H);
    } else {
      ctx.drawImage(img, 0, 0, W, H);
    }

    // Draw takeoff shapes — use plan's own scale, not the live UI state
    const planScale = plan.scale_px_per_ft || scale || null;
    const planItemsEx = items.filter(it => it.points?.length && it.plan_id === plan.id);
    for(const it of planItemsEx){
      const shapes = normalizeShapes(it.points);
      const c = it.color || '#10B981';
      const mt = it.measurement_type;
      for(const pts of shapes){
        if(!pts.length) continue;
        const realPts = pts.filter(p => !p._ctrl);
        ctx.save();
        ctx.lineWidth = Math.max(2, W/800);
        ctx.strokeStyle = c;

        if(mt === 'area' && realPts.length >= 3){
          ctx.fillStyle = c + '33';
          ctx.beginPath(); ctx.moveTo(realPts[0].x, realPts[0].y);
          for(let i=1;i<realPts.length;i++) ctx.lineTo(realPts[i].x, realPts[i].y);
          ctx.closePath(); ctx.fill(); ctx.stroke();
          const cx = realPts.reduce((s,p)=>s+p.x,0)/realPts.length;
          const cy = realPts.reduce((s,p)=>s+p.y,0)/realPts.length;
          // Per-shape area from geometry
          const pxArea = Math.abs(realPts.reduce((s,p,i)=>{ const n=realPts[(i+1)%realPts.length]; return s+(p.x*n.y-n.x*p.y); },0)/2);
          const shapeQty = planScale ? Math.round((pxArea/(planScale*planScale))*10)/10 : Math.round(pxArea*10)/10;
          const shapeUnit = it.unit || 'SF';
          const labelStr = `${shapeQty.toLocaleString()} ${shapeUnit}`;
          const fs = Math.max(10, W/80);
          ctx.fillStyle='rgba(0,0,0,0.72)'; ctx.fillRect(cx-fs*3,cy-fs*0.9,fs*6,fs*1.8);
          ctx.fillStyle='#eee'; ctx.font=`bold ${fs}px "DM Mono",monospace`;
          ctx.textAlign='center'; ctx.textBaseline='middle';
          ctx.fillText(labelStr, cx, cy);
        } else if(mt === 'linear' && realPts.length >= 2){
          ctx.setLineDash([6,3]); ctx.beginPath(); ctx.moveTo(realPts[0].x, realPts[0].y);
          for(let i=1;i<realPts.length;i++) ctx.lineTo(realPts[i].x, realPts[i].y);
          ctx.stroke(); ctx.setLineDash([]);
          realPts.forEach(p=>{ ctx.fillStyle=c; ctx.beginPath(); ctx.arc(p.x,p.y,4,0,Math.PI*2); ctx.fill(); });
          const mx = realPts.reduce((s,p)=>s+p.x,0)/realPts.length;
          const my = realPts.reduce((s,p)=>s+p.y,0)/realPts.length;
          // Per-shape length from geometry
          let pxLen=0; for(let i=1;i<realPts.length;i++) pxLen+=Math.sqrt((realPts[i].x-realPts[i-1].x)**2+(realPts[i].y-realPts[i-1].y)**2);
          const shapeQty = planScale ? Math.round((pxLen/planScale)*10)/10 : Math.round(pxLen*10)/10;
          const shapeUnit = planScale ? (it.unit||'LF') : 'px';
          const labelStr = `${shapeQty} ${shapeUnit}`;
          const fs = Math.max(10, W/80);
          ctx.fillStyle='rgba(0,0,0,0.72)'; ctx.fillRect(mx-fs*3,my-fs*2.4,fs*6,fs*1.6);
          ctx.fillStyle='#eee'; ctx.font=`bold ${fs}px "DM Mono",monospace`;
          ctx.textAlign='center'; ctx.textBaseline='middle';
          ctx.fillText(labelStr, mx, my-fs*1.6);
        } else if(mt === 'count' && pts[0]){
          const p=pts[0];
          ctx.fillStyle=c; ctx.beginPath(); ctx.arc(p.x,p.y,8,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='#fff'; ctx.font='bold 10px monospace';
          ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('✕',p.x,p.y);        }
        ctx.restore();
      }
    }

    // Legend — clean white panel with qty per item
    if(withLegend && planItemsEx.length > 0){
      // Group by description → sum qty, keep color + unit
      const legendMap = new Map();
      planItemsEx.forEach(it => {
        const key = it.description;
        if(legendMap.has(key)){
          legendMap.get(key).qty += (it.quantity || 0);
        } else {
          legendMap.set(key, { color: it.color||'#10B981', qty: it.quantity||0, unit: it.unit||'' });
        }
      });
      const legendItems = [...legendMap.entries()]; // [desc, {color,qty,unit}]

      const sc     = Math.max(1, W / 1200);
      const fs     = Math.round(13 * sc);
      const fsSub  = Math.round(9  * sc);
      const fsTitle= Math.round(11 * sc);
      const fsQty  = Math.round(11 * sc);
      const padX   = Math.round(14 * sc);
      const padY   = Math.round(12 * sc);
      const swSize = Math.round(10 * sc);
      const rowH   = Math.round(24 * sc);
      const gap    = Math.round(4  * sc);
      const headerH= Math.round(40 * sc);

      // Measure longest row to set width
      const tmpCanvas = document.createElement('canvas');
      const tmpCtx = tmpCanvas.getContext('2d');
      tmpCtx.font = `${fs}px Arial,sans-serif`;
      let maxRowW = 0;
      legendItems.forEach(([desc, {qty, unit}]) => {
        const label = (desc.length > 22 ? desc.slice(0,22)+'…' : desc);
        const qtyStr = qty > 0 ? `  ${Math.round(qty * 10)/10} ${unit}` : '';
        const w = tmpCtx.measureText(label + qtyStr).width;
        if(w > maxRowW) maxRowW = w;
      });
      const legendW = Math.round(padX*2 + swSize + Math.round(8*sc) + maxRowW + Math.round(16*sc));
      const legendH = padY + headerH + legendItems.length * (rowH + gap) + padY;
      const lx = Math.round(20 * sc);
      const ly = Math.round(20 * sc);
      const r  = Math.round(5  * sc);

      // Drop shadow
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.18)';
      ctx.shadowBlur  = Math.round(12 * sc);
      ctx.shadowOffsetY = Math.round(3 * sc);
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, lx, ly, legendW, legendH, r); ctx.fill();
      ctx.restore();

      // Border
      ctx.strokeStyle = '#d1d5db'; ctx.lineWidth = Math.max(1, sc);
      roundRect(ctx, lx, ly, legendW, legendH, r); ctx.stroke();

      // Header bg
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(lx+r, ly); ctx.lineTo(lx+legendW-r, ly);
      ctx.quadraticCurveTo(lx+legendW, ly, lx+legendW, ly+r);
      ctx.lineTo(lx+legendW, ly+headerH); ctx.lineTo(lx, ly+headerH);
      ctx.lineTo(lx, ly+r); ctx.quadraticCurveTo(lx, ly, lx+r, ly);
      ctx.closePath(); ctx.fillStyle='#f3f4f6'; ctx.fill();
      ctx.restore();

      // Header divider
      ctx.fillStyle='#e5e7eb'; ctx.fillRect(lx, ly+headerH, legendW, Math.max(1,sc));

      // "TAKEOFFS" label
      ctx.fillStyle='#6b7280'; ctx.font=`700 ${fsSub}px Arial,sans-serif`;
      ctx.textAlign='left'; ctx.textBaseline='top';
      ctx.fillText('TAKEOFFS', lx+padX, ly+Math.round(padY*0.7));

      // Sheet name
      ctx.fillStyle='#111827'; ctx.font=`600 ${fsTitle}px Arial,sans-serif`;
      ctx.fillText(plan.name.slice(0,32), lx+padX, ly+Math.round(padY*0.7)+fsSub+Math.round(4*sc));

      // Rows
      legendItems.forEach(([desc, {color, qty, unit}], i) => {
        const ry = ly + headerH + Math.round(sc) + gap + i*(rowH+gap);
        const midY = ry + rowH/2;

        // Swatch
        ctx.fillStyle = color;
        roundRect(ctx, lx+padX, midY - swSize/2, swSize, swSize, Math.round(2*sc));
        ctx.fill();
        ctx.strokeStyle='rgba(0,0,0,0.12)'; ctx.lineWidth=Math.max(1,sc*0.5);
        roundRect(ctx, lx+padX, midY - swSize/2, swSize, swSize, Math.round(2*sc));
        ctx.stroke();

        const textX = lx + padX + swSize + Math.round(8*sc);

        // Description
        const label = desc.length > 22 ? desc.slice(0,22)+'…' : desc;
        ctx.fillStyle='#1f2937'; ctx.font=`${fs}px Arial,sans-serif`;
        ctx.textAlign='left'; ctx.textBaseline='middle';
        ctx.fillText(label, textX, midY);

        // Qty + unit — right-aligned, bold, colored
        if(qty > 0){
          const qtyStr = `${Math.round(qty*10)/10} ${unit}`;
          ctx.font=`700 ${fsQty}px Arial,sans-serif`;
          ctx.fillStyle = color;
          ctx.textAlign='right';
          ctx.fillText(qtyStr, lx+legendW-padX, midY);
        }
      });
    }

    return new Promise(res => out.toBlob(res, 'image/png', 0.95));
  };

  const exportPlan = async (plan, withLegend=true) => {
    if(!plan) return;
    console.log('[export] starting for plan:', plan.name, 'withLegend:', withLegend);
    setExporting(true); setShowExportMenu(false);
    try {
      const blob = await exportPlanCanvas(plan, withLegend);
      console.log('[export] blob:', blob);
      if(!blob){ alert('Export failed — canvas could not be converted to image.'); setExporting(false); return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${(project.name||'plan').replace(/\s+/g,'-')}_${plan.name.replace(/\s+/g,'-')}_takeoff.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(()=>URL.revokeObjectURL(a.href),8000);
    } catch(e){ console.error('[export] error', e); alert('Export failed: '+e.message); }
    setExporting(false);
  };

  const exportAllMarked = async (withLegend=true) => {
    const markedPlans = plans.filter(p=>items.some(i=>i.plan_id===p.id && i.points?.length));
    if(!markedPlans.length){ alert('No plans with markup found.'); return; }
    setExporting(true); setShowExportMenu(false);
    try {
      // Load JSZip
      if(!window.JSZip){
        await new Promise((res,rej)=>{
          const s=document.createElement('script');
          s.src='https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
          s.onload=res; s.onerror=rej; document.head.appendChild(s);
        });
      }
      const zip = new window.JSZip();
      for(let i=0;i<markedPlans.length;i++){
        const plan=markedPlans[i];
        setUploading(`Exporting ${i+1} / ${markedPlans.length}: ${plan.name}…`);
        try {
          const blob = await exportPlanCanvas(plan, withLegend);
          const fname = `${String(i+1).padStart(2,'0')}_${plan.name.replace(/[^a-zA-Z0-9._-]/g,'_')}_takeoff.png`;
          zip.file(fname, blob);
        } catch(e){ console.warn('skip plan export',plan.name,e); }
      }
      setUploading('Building ZIP…');
      const zipBlob = await zip.generateAsync({type:'blob', compression:'STORE'});
      const a=document.createElement('a');
      a.href=URL.createObjectURL(zipBlob);
      a.download=`${(project.name||'project').replace(/\s+/g,'-')}_marked_plans.zip`;
      a.click();
      setTimeout(()=>URL.revokeObjectURL(a.href),8000);
    } catch(e){ console.error('exportAll error',e); alert('Export failed: '+e.message); }
    setUploading(false);
    setExporting(false);
  };
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden',position:'relative'}}>

      {/* ── Top Bar ── */}
      <div style={{display:'flex',alignItems:'center',height:42,borderBottom:`1px solid ${t.border}`,background:t.bg,flexShrink:0,gap:0}}>
        <button onClick={onBack} style={{background:'none',border:'none',borderRight:`1px solid ${t.border}`,color:t.text4,cursor:'pointer',fontSize:12,padding:'0 14px',height:'100%',display:'flex',alignItems:'center',gap:5,flexShrink:0}}>
          ← Projects
        </button>
        {onExitToOps&&<button onClick={onExitToOps} style={{background:'none',border:'none',borderRight:`1px solid ${t.border}`,color:t.text3,cursor:'pointer',fontSize:11,padding:'0 12px',height:'100%',display:'flex',alignItems:'center',fontWeight:600,flexShrink:0}}>
          ⊞ OPS
        </button>}
        <div style={{padding:'0 16px',borderRight:`1px solid ${t.border}`,height:'100%',display:'flex',flexDirection:'column',justifyContent:'center',minWidth:0,maxWidth:240,flexShrink:0}}>
          <div style={{fontSize:12,fontWeight:700,color:t.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{project.name}</div>
          {project.bid_date&&<div style={{fontSize:9,color:t.text4}}>Bid {fmtDate(project.bid_date)}</div>}
        </div>
        <div style={{flex:1}}/>
        <div style={{display:'flex',alignItems:'center',gap:3,padding:'0 10px',borderLeft:`1px solid ${t.border}`,height:'100%',flexShrink:0}}>
          <button onClick={()=>setZoom(z=>Math.max(Math.round((z-0.1)*10)/10,0.1))} style={{background:'none',border:`1px solid ${t.border}`,color:t.text3,width:22,height:22,borderRadius:3,cursor:'pointer',fontSize:12,display:'flex',alignItems:'center',justifyContent:'center'}}>−</button>
          <span style={{fontSize:10,color:t.text3,minWidth:36,textAlign:'center'}}>{Math.round(zoom*100)}%</span>
          <button onClick={()=>setZoom(z=>Math.min(Math.round((z+0.1)*10)/10,4))} style={{background:'none',border:`1px solid ${t.border}`,color:t.text3,width:22,height:22,borderRadius:3,cursor:'pointer',fontSize:12,display:'flex',alignItems:'center',justifyContent:'center'}}>+</button>
        </div>
        <button onClick={()=>setShowBidSummary(true)} disabled={!items.length}
          style={{height:'100%',padding:'0 18px',border:'none',borderLeft:`1px solid ${t.border}`,
            background:items.length?'#10B981':'none',color:items.length?'#fff':t.text4,
            cursor:'pointer',fontSize:12,fontWeight:700,flexShrink:0,opacity:items.length?1:0.3}}>
          Bid Summary
        </button>
      </div>

      {/* ── Main Body ── */}
      <div style={{display:'flex',flex:1,overflow:'hidden'}}>

        {/* ── Left Panel — Stack-style ── */}
        <div style={{width:280,flexShrink:0,display:'flex',flexDirection:'column',borderRight:`1px solid ${t.border}`,background:t.bg2,overflow:'hidden'}}>

          {/* Left panel tab strip: Plans | Takeoffs */}
          <div style={{display:'flex',alignItems:'stretch',borderBottom:`1px solid ${t.border}`,flexShrink:0,height:40}}>
            {[['plans','Plans'],['takeoffs','Takeoffs']].map(([id,lbl])=>(
              <button key={id} onClick={()=>setLeftTab(id)}
                style={{flex:1,height:'100%',border:'none',background:'none',cursor:'pointer',
                  fontSize:12,fontWeight:leftTab===id?700:400,
                  color:leftTab===id?'#10B981':t.text4,
                  borderBottom:leftTab===id?'2px solid #10B981':'2px solid transparent',
                  boxSizing:'border-box',transition:'color 0.1s'}}>
                {lbl}
              </button>
            ))}
            <button onClick={()=>setLeftTab('settings')}
              title="Settings"
              style={{width:38,height:'100%',border:'none',background:'none',cursor:'pointer',
                color:leftTab==='settings'?'#10B981':t.text4,fontSize:14,flexShrink:0,
                borderBottom:leftTab==='settings'?'2px solid #10B981':'2px solid transparent',
                boxSizing:'border-box'}}>⚙</button>
          </div>

          {/* ── PLANS tab ── STACK-style folder tree */}
          {leftTab==='plans'&&(
            <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>

              {/* Toolbar: New Folder | Upload | Name All | Filter */}
              <div style={{padding:'8px',borderBottom:`1px solid ${t.border}`,flexShrink:0,display:'flex',gap:5}}>
                <button onClick={()=>{
                  const n=window.prompt('Folder name:','');
                  if(!n?.trim()) return;
                  const fid='folder_'+Date.now();
                  savePlanSets({...planSets,[fid]:{name:n.trim(),planIds:[],collapsed:false}});
                }} style={{padding:'6px 8px',borderRadius:6,border:`1px solid ${t.border}`,background:'none',color:t.text3,cursor:'pointer',fontSize:11,fontWeight:600,display:'flex',alignItems:'center',gap:4,flexShrink:0}}>
                  📁 New
                </button>
                <button onClick={()=>{ setUploadTargetFolder(null); fileRef.current?.click(); }} disabled={!!uploading}
                  style={{flex:1,background:uploading&&uploading.startsWith('✓')?'#10B981':uploading?'#6B7280':'#10B981',border:'none',color:'#fff',padding:'6px 0',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',gap:5,transition:'background 0.2s'}}>
                  {uploading
                    ? uploading.startsWith('✓')
                      ? <>{uploading}</>
                      : <><span style={{animation:'spin 0.8s linear infinite',display:'inline-block'}}>◌</span> {uploading}</>
                    : <>＋ Upload</>}
                </button>
                <button disabled={namingAll||plans.length===0} onClick={async()=>{
                  setNamingAll(true);
                  const realPlans=plans.filter(p=>p.id!=='preview');
                  let renamed=0;
                  for(const p of realPlans){
                    try{
                      const aiName=await aiNameSheet(p.file_url,p.name||'Sheet');
                      if(aiName&&aiName!==p.name){
                        await supabase.from('precon_plans').update({name:aiName}).eq('id',p.id);
                        setPlans(prev=>prev.map(x=>x.id===p.id?{...x,name:aiName}:x));
                        if(selPlan?.id===p.id) setSelPlan(prev=>({...prev,name:aiName}));
                        renamed++;
                      }
                    }catch(e){ console.error('naming failed',p.id,e); }
                  }
                  setNamingAll(false);
                }} style={{padding:'6px 8px',borderRadius:6,border:'1px solid rgba(168,85,247,0.4)',background:'rgba(168,85,247,0.08)',color:'#a855f7',cursor:'pointer',fontSize:11,fontWeight:700,display:'flex',alignItems:'center',gap:3,flexShrink:0}}>
                  {namingAll?<span style={{animation:'spin 0.8s linear infinite',display:'inline-block'}}>◌</span>:'✦'}
                </button>
                <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{display:'none'}} onChange={e=>handleUpload(e.target.files[0])}/>
              </div>

              {/* Filter strip */}
              <div style={{display:'flex',borderBottom:`1px solid ${t.border}`,flexShrink:0}}>
                {[['all','All'],['marked','Marked']].map(([val,lbl])=>{
                  const markedCount = val==='marked' ? plans.filter(p=>items.some(i=>i.plan_id===p.id&&i.points?.length)).length : plans.length;
                  const active = plansFilter===val;
                  return(
                    <button key={val} onClick={()=>setPlansFilter(val)}
                      style={{flex:1,padding:'5px 0',border:'none',borderBottom:active?`2px solid #10B981`:'2px solid transparent',
                        background:'none',color:active?'#10B981':t.text4,cursor:'pointer',fontSize:10,fontWeight:active?700:400,
                        display:'flex',alignItems:'center',justifyContent:'center',gap:4}}>
                      {lbl}
                      <span style={{fontSize:9,background:active?'rgba(16,185,129,0.15)':t.bg3,color:active?'#10B981':t.text4,
                        borderRadius:8,padding:'1px 5px',fontFamily:"'DM Mono',monospace"}}>
                        {markedCount}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Folder tree */}
              <div style={{flex:1,overflowY:'auto',padding:'6px 4px'}}>
                {plans.length===0&&Object.keys(planSets).length===0&&(
                  <div style={{textAlign:'center',padding:'40px 12px',color:t.text4,fontSize:11,lineHeight:2}}>
                    Create a folder and upload plans<br/>or upload directly
                  </div>
                )}
                {plansFilter==='marked'&&plans.length>0&&!plans.some(p=>items.some(i=>i.plan_id===p.id&&i.points?.length))&&(
                  <div style={{textAlign:'center',padding:'32px 12px',color:t.text4,fontSize:11,lineHeight:1.8}}>
                    No plans with takeoffs yet.<br/>
                    <span style={{fontSize:10,color:t.text4}}>Draw measurements on a plan to mark it.</span>
                  </div>
                )}
                {(()=>{
                  const markedIds = new Set(items.filter(i=>i.points?.length).map(i=>i.plan_id));
                  const visiblePlans = plansFilter==='marked' ? plans.filter(p=>markedIds.has(p.id)) : plans;
                  const assignedIds=new Set(Object.values(planSets).flatMap(s=>s.planIds||[]));
                  const ungrouped=visiblePlans.filter(p=>!assignedIds.has(p.id));
                  const folderEntries=Object.entries(planSets);

                  const PlanRow=({p,folderId})=>{
                    const isActive=selPlan?.id===p.id;
                    const isOpen=openTabs.includes(p.id);
                    const cnt=items.filter(it=>it.plan_id===p.id).length;
                    const isMarked=items.some(i=>i.plan_id===p.id&&i.points?.length);
                    return(
                      <div onClick={()=>{
                          if(!openTabs.includes(p.id)) setOpenTabs(prev=>[...prev,p.id]);
                          setSelPlan(p);
                          if(p.scale_px_per_ft) setScale(p.scale_px_per_ft);
                          else{setScale(null);setPresetScale('');}
                          setLeftTab('takeoffs');
                        }}
                        style={{display:'flex',alignItems:'center',gap:7,padding:'5px 6px 5px 20px',borderRadius:5,
                          cursor:'pointer',marginBottom:1,
                          background:isActive?'rgba(16,185,129,0.1)':'transparent',
                          borderLeft:isActive?'2px solid #10B981':isMarked?'2px solid rgba(16,185,129,0.35)':'2px solid transparent',
                          transition:'all 0.1s'}}>
                        <div style={{width:36,height:28,borderRadius:3,overflow:'hidden',flexShrink:0,background:t.bg3,border:`1px solid ${t.border}`}}>
                          <img src={p.file_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e=>e.target.style.display='none'}/>
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:10,fontWeight:isActive?700:400,color:isActive?'#10B981':t.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name||'Unnamed'}</div>
                          <div style={{fontSize:8,color:t.text4,display:'flex',alignItems:'center',gap:3}}>
                            {isMarked&&<span style={{display:'inline-block',width:5,height:5,borderRadius:'50%',background:'#10B981',flexShrink:0}}/>}
                            <span>{cnt?`${cnt} item${cnt!==1?'s':''}`:'No items'}{isOpen?' · open':''}</span>
                          </div>
                        </div>
                        <div style={{display:'flex',gap:2,flexShrink:0}} onClick={e=>e.stopPropagation()}>
                          <button onClick={async()=>{
                            const n=window.prompt('Rename:',p.name||'');
                            if(n?.trim()&&p.id!=='preview'){
                              await supabase.from('precon_plans').update({name:n.trim()}).eq('id',p.id);
                              setPlans(prev=>prev.map(x=>x.id===p.id?{...x,name:n.trim()}:x));
                              if(selPlan?.id===p.id) setSelPlan(prev=>({...prev,name:n.trim()}));
                            }
                          }} style={{fontSize:8,padding:'2px 4px',borderRadius:3,border:`1px solid ${t.border}`,background:'none',color:t.text4,cursor:'pointer'}}>✎</button>
                          <button onClick={async(e)=>{
                            const btn=e.currentTarget; btn.textContent='…'; btn.disabled=true;
                            const aiName=await aiNameSheet(p.file_url,p.name||'Sheet');
                            if(aiName&&aiName!==p.name&&p.id!=='preview'){
                              await supabase.from('precon_plans').update({name:aiName}).eq('id',p.id);
                              setPlans(prev=>prev.map(x=>x.id===p.id?{...x,name:aiName}:x));
                              if(selPlan?.id===p.id) setSelPlan(prev=>({...prev,name:aiName}));
                            }
                            btn.textContent='✦'; btn.disabled=false;
                          }} style={{fontSize:8,padding:'2px 4px',borderRadius:3,border:'1px solid rgba(168,85,247,0.3)',background:'rgba(168,85,247,0.06)',color:'#a855f7',cursor:'pointer'}} title="AI name">✦</button>
                          <button onClick={async()=>{
                            if(!window.confirm('Delete this sheet?')) return;
                            if(p.id!=='preview'){ const {error}=await supabase.from('precon_plans').delete().eq('id',p.id).select(); if(error){console.error('plan delete error:',error);alert('Delete failed: '+error.message);return;} }
                            setPlans(prev=>prev.filter(x=>x.id!==p.id));
                            setOpenTabs(prev=>prev.filter(id=>id!==p.id));
                            if(selPlan?.id===p.id) setSelPlan(null);
                            const updated={};
                            Object.entries(planSets).forEach(([bid,s])=>{updated[bid]={...s,planIds:(s.planIds||[]).filter(id=>id!==p.id)};});
                            savePlanSets(updated);
                          }} style={{fontSize:8,padding:'2px 4px',borderRadius:3,border:'1px solid rgba(239,68,68,0.25)',background:'none',color:'#ef4444',cursor:'pointer'}}>✕</button>
                        </div>
                      </div>
                    );
                  };

                  const FolderRow=([folderId,folder])=>{
                    const folderPlans=(folder.planIds||[]).map(id=>visiblePlans.find(p=>p.id===id)).filter(Boolean);
                    // Hide empty folders when filtering to marked only
                    if(plansFilter==='marked' && folderPlans.length===0) return null;
                    const collapsed=folder.collapsed;
                    return(
                      <div key={folderId} style={{marginBottom:4}}>
                        {/* Folder header row */}
                        <div style={{display:'flex',alignItems:'center',gap:5,padding:'5px 6px',borderRadius:5,
                          background:t.bg3,border:`1px solid ${t.border}`,cursor:'pointer',userSelect:'none'}}
                          onClick={()=>savePlanSets({...planSets,[folderId]:{...folder,collapsed:!collapsed}})}>
                          <span style={{fontSize:9,color:t.text4,width:10,flexShrink:0}}>{collapsed?'▶':'▼'}</span>
                          <span style={{fontSize:13,flexShrink:0}}>📁</span>
                          <span style={{fontSize:11,fontWeight:600,color:t.text,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{folder.name||'Folder'}</span>
                          <span style={{fontSize:9,color:t.text4,flexShrink:0}}>{folderPlans.length}</span>
                          {/* Per-folder actions */}
                          <div style={{display:'flex',gap:3,flexShrink:0}} onClick={e=>e.stopPropagation()}>
                            <button onClick={()=>{
                              setUploadTargetFolder(folderId);
                              setTimeout(()=>fileRef.current?.click(),50);
                            }} style={{fontSize:9,padding:'2px 5px',borderRadius:3,border:`1px solid ${t.border}`,background:'none',color:'#10B981',cursor:'pointer',fontWeight:700}} title="Upload into this folder">＋</button>
                            <button onClick={async()=>{
                              for(const p of folderPlans){
                                if(p.id==='preview') continue;
                                const aiName=await aiNameSheet(p.file_url,p.name||'Sheet');
                                if(aiName&&aiName!==p.name){
                                  await supabase.from('precon_plans').update({name:aiName}).eq('id',p.id);
                                  setPlans(prev=>prev.map(x=>x.id===p.id?{...x,name:aiName}:x));
                                  if(selPlan?.id===p.id) setSelPlan(prev=>({...prev,name:aiName}));
                                }
                              }
                            }} style={{fontSize:9,padding:'2px 4px',borderRadius:3,border:'1px solid rgba(168,85,247,0.3)',background:'none',color:'#a855f7',cursor:'pointer'}} title="AI name all in folder">✦</button>
                            <button onClick={()=>{
                              const n=window.prompt('Rename folder:',folder.name||'');
                              if(n?.trim()) savePlanSets({...planSets,[folderId]:{...folder,name:n.trim()}});
                            }} style={{fontSize:9,padding:'2px 4px',borderRadius:3,border:`1px solid ${t.border}`,background:'none',color:t.text4,cursor:'pointer'}}>✎</button>
                            <button onClick={()=>{
                              if(folderPlans.length&&!window.confirm('Delete folder and all its sheets?')) return;
                              const updated={...planSets};
                              delete updated[folderId];
                              savePlanSets(updated);
                            }} style={{fontSize:9,padding:'2px 4px',borderRadius:3,border:'1px solid rgba(239,68,68,0.25)',background:'none',color:'#ef4444',cursor:'pointer'}}>✕</button>
                          </div>
                        </div>
                        {/* Sheets inside folder */}
                        {!collapsed&&(
                          <div style={{marginTop:1}}>
                            {folderPlans.map(p=><PlanRow key={p.id} p={p} folderId={folderId}/>)}
                            {folderPlans.length===0&&(
                              <div style={{padding:'8px 20px',fontSize:10,color:t.text4,fontStyle:'italic'}}>Empty — click ＋ to upload here</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  };

                  return(<>
                    {folderEntries.map(FolderRow)}
                    {ungrouped.length>0&&(
                      <div style={{marginTop:folderEntries.length?8:0}}>
                        {folderEntries.length>0&&<div style={{fontSize:9,color:t.text4,padding:'2px 4px 4px',letterSpacing:0.5}}>UNSORTED</div>}
                        {ungrouped.map(p=><PlanRow key={p.id} p={p}/>)}
                      </div>
                    )}
                  </>);
                })()}
              </div>
            </div>
          )}
          {/* ── TAKEOFFS tab ── Stack-style */}
          {leftTab==='takeoffs'&&(()=>{
            const activeCond = itemsRef.current.find(i=>String(i.id)===String(activeCondId));
            const armItem = (item) => {
              // If this item has siblings, prefer the one matching the current plan
              const target = (item._siblings && selPlan)
                ? (item._siblings.find(s=>s.id!==undefined && s.plan_id===selPlan.id) || item)
                : item;
              setActiveCondId(target.id);
              setTool(target.measurement_type==='area'?'area':target.measurement_type==='linear'?'linear':target.measurement_type==='count'?'count':'select');
              setActivePts([]); setEditItem(null); setTakeoffStep(null);
            };
            const disarm = () => { setActiveCondId(null); setTool('select'); setActivePts([]); };
            const resetFlow = () => { setTakeoffStep(null); setNewTOType(null); setNewTOName(''); setNewTODesc(''); setNewTOColor('#10B981'); setNewTOCat('other'); setNewTOSize('medium'); };

            // ── STEP: TYPE SELECTOR ──────────────────────────────────────
            if(takeoffStep==='type') return(
              <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
                <div style={{padding:'12px 14px 8px',borderBottom:`1px solid ${t.border}`,flexShrink:0,display:'flex',alignItems:'center',gap:8}}>
                  <button onClick={resetFlow} style={{background:'none',border:'none',color:t.text4,cursor:'pointer',fontSize:13,padding:'2px 4px'}}>←</button>
                  <span style={{fontSize:13,fontWeight:700,color:t.text}}>New Takeoff</span>
                </div>
                <div style={{flex:1,overflowY:'auto',padding:'8px 0'}}>
                  {TAKEOFF_TYPES.map(tt=>(
                    <div key={tt.id} onClick={()=>{setNewTOType(tt);setNewTOColor(tt.color);setNewTOCat(tt.id==='vol2d'||tt.id==='vol3d'?'foundations':tt.mt==='area'?'flatwork':tt.mt==='linear'?'curb_gutter':'other');setTakeoffStep('create');}}
                      style={{display:'flex',alignItems:'flex-start',gap:12,padding:'10px 14px',cursor:'pointer',
                        borderBottom:`1px solid ${t.border}`}}
                      onMouseEnter={e=>e.currentTarget.style.background=t.bg3}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <div style={{width:28,height:28,borderRadius:5,background:tt.color,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:1}}>
                        <span style={{fontSize:tt.icon.length>1?9:14,fontWeight:800,color:'#fff'}}>{tt.icon}</span>
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:600,color:t.text,marginBottom:2}}>{tt.label}</div>
                        <div style={{fontSize:11,color:t.text4,lineHeight:1.4}}>{tt.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );

            // ── STEP: CREATE (name + desc) ────────────────────────────────
            if(takeoffStep==='create') return(
              <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
                <div style={{padding:'10px 14px',borderBottom:`1px solid ${t.border}`,flexShrink:0,display:'flex',alignItems:'center',gap:8}}>
                  <div style={{width:22,height:22,borderRadius:4,background:newTOType?.color||'#10B981',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <span style={{fontSize:newTOType?.icon?.length>1?8:12,fontWeight:800,color:'#fff'}}>{newTOType?.icon}</span>
                  </div>
                  <span style={{fontSize:13,fontWeight:700,color:t.text,flex:1}}>Create New {newTOType?.label} Takeoff</span>
                </div>
                <div style={{flex:1,overflowY:'auto',padding:'16px 14px'}}>
                  <div style={{marginBottom:14}}>
                    <label style={{fontSize:11,fontWeight:600,color:t.text3,display:'block',marginBottom:5}}>Takeoff Name</label>
                    <input autoFocus value={newTOName} onChange={e=>setNewTOName(e.target.value)}
                      onKeyDown={e=>e.key==='Enter'&&newTOName.trim()&&setTakeoffStep('settings')}
                      style={{width:'100%',padding:'8px 10px',border:`1px solid ${t.border2}`,borderRadius:6,
                        fontSize:13,color:t.text,background:t.bg,outline:'none',boxSizing:'border-box',
                        transition:'border-color 0.15s'}}
                      onFocus={e=>e.target.style.borderColor='#10B981'}
                      onBlur={e=>e.target.style.borderColor=t.border2}
                    />
                  </div>
                  <div style={{marginBottom:20}}>
                    <label style={{fontSize:11,fontWeight:600,color:t.text3,display:'block',marginBottom:5}}>Description <span style={{fontWeight:400,color:t.text4}}>(optional)</span></label>
                    <textarea value={newTODesc} onChange={e=>setNewTODesc(e.target.value)}
                      rows={3}
                      style={{width:'100%',padding:'8px 10px',border:`1px solid ${t.border2}`,borderRadius:6,
                        fontSize:12,color:t.text,background:t.bg,outline:'none',resize:'vertical',boxSizing:'border-box',fontFamily:'inherit'}}
                      onFocus={e=>e.target.style.borderColor='#10B981'}
                      onBlur={e=>e.target.style.borderColor=t.border2}
                    />
                  </div>
                  {/* Yellow info card like Stack */}
                  <div style={{marginBottom:14}}>
                    <label style={{fontSize:11,fontWeight:600,color:t.text3,display:'block',marginBottom:5}}>Category</label>
                    <select value={newTOCat} onChange={e=>{setNewTOCat(e.target.value);const c=TAKEOFF_CATS.find(x=>x.id===e.target.value);if(c)setNewTOColor(c.color);}}
                      style={{width:'100%',padding:'8px 10px',border:`1px solid ${t.border2}`,borderRadius:6,
                        fontSize:12,color:t.text,background:t.bg,outline:'none',boxSizing:'border-box',cursor:'pointer'}}>
                      {TAKEOFF_CATS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </div>
                  <div style={{background:'#FEF9C3',border:'1px solid #FDE047',borderRadius:6,padding:'10px 12px',marginBottom:20}}>
                    <div style={{fontSize:12,fontWeight:700,color:'#713F12',marginBottom:4}}>{newTOType?.label}</div>
                    <div style={{fontSize:11,color:'#854D0E',lineHeight:1.5}}>{newTOType?.desc}</div>
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    <button onClick={()=>setTakeoffStep('type')}
                      style={{flex:1,padding:'8px 0',border:`1px solid ${t.border2}`,background:t.bg,color:t.text3,
                        borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center',gap:5}}>
                      ← Takeoffs
                    </button>
                    <button onClick={()=>newTOName.trim()&&setTakeoffStep('settings')}
                      style={{flex:2,padding:'8px 0',border:'none',
                        background:newTOName.trim()?'#10B981':'#ccc',color:'#fff',
                        borderRadius:6,cursor:newTOName.trim()?'pointer':'not-allowed',fontSize:12,fontWeight:700}}>
                      Create Takeoff
                    </button>
                  </div>
                </div>
              </div>
            );

            // ── STEP: SETTINGS (appearance + start measuring) ─────────────
            if(takeoffStep==='settings') return(
              <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
                <div style={{padding:'10px 14px',borderBottom:`1px solid ${t.border}`,flexShrink:0,display:'flex',alignItems:'center',gap:8}}>
                  <div style={{width:22,height:22,borderRadius:4,background:newTOColor,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <span style={{fontSize:newTOType?.icon?.length>1?8:12,fontWeight:800,color:'#fff'}}>{newTOType?.icon}</span>
                  </div>
                  <span style={{fontSize:13,fontWeight:700,color:t.text,flex:1}}>{newTOType?.label} Settings</span>
                </div>
                <div style={{flex:1,overflowY:'auto',padding:'14px 14px'}}>
                  <div style={{marginBottom:14}}>
                    <label style={{fontSize:11,fontWeight:600,color:t.text3,display:'block',marginBottom:5}}>Takeoff Name</label>
                    <input value={newTOName} onChange={e=>setNewTOName(e.target.value)}
                      style={{width:'100%',padding:'7px 10px',border:`1px solid ${t.border2}`,borderRadius:6,
                        fontSize:13,color:t.text,background:t.bg,outline:'none',boxSizing:'border-box'}}/>
                  </div>

                  <div style={{height:1,background:t.border,margin:'12px 0'}}/>
                  <div style={{fontSize:12,fontWeight:700,color:t.text,marginBottom:10,display:'flex',alignItems:'center',gap:6}}>
                    <span>Appearance</span>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
                    <div>
                      <div style={{fontSize:10,color:t.text4,marginBottom:5}}>Line Color</div>
                      <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                        {TO_COLORS.map(c=>(
                          <button key={c} onClick={()=>setNewTOColor(c)}
                            style={{width:20,height:20,borderRadius:4,background:c,border:newTOColor===c?`2px solid ${t.text}`:'2px solid transparent',cursor:'pointer',padding:0,flexShrink:0}}/>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div style={{fontSize:10,color:t.text4,marginBottom:5}}>Line Size</div>
                      <div style={{display:'flex',gap:4}}>
                        {[['sm','Thin'],['medium','Medium'],['lg','Thick']].map(([id,lbl])=>(
                          <button key={id} onClick={()=>setNewTOSize(id)}
                            style={{flex:1,padding:'4px 0',fontSize:9,fontWeight:600,border:`1px solid ${newTOSize===id?newTOColor:t.border}`,
                              background:newTOSize===id?newTOColor+'20':'transparent',color:newTOSize===id?newTOColor:t.text4,
                              borderRadius:4,cursor:'pointer'}}>
                            {lbl}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div style={{height:1,background:t.border,margin:'12px 0'}}/>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                    <div style={{fontSize:12,fontWeight:700,color:t.text}}>Items & Assemblies</div>
                    <span style={{fontSize:10,color:t.text4,background:t.bg3,borderRadius:10,padding:'1px 7px',border:`1px solid ${t.border}`}}>0</span>
                  </div>
                  <div style={{fontSize:10,color:t.text4,lineHeight:1.5,marginBottom:10}}>
                    Items and assemblies are optional. Adding them will produce a detailed Bill of Materials Report.
                  </div>
                  <button onClick={()=>setShowAssembly(true)}
                    style={{width:'100%',padding:'7px 0',border:`1px solid ${t.border2}`,background:t.bg,color:t.text3,
                      borderRadius:5,cursor:'pointer',fontSize:11,marginBottom:16,display:'flex',alignItems:'center',justifyContent:'center',gap:5}}>
                    + Add items and assemblies
                  </button>

                  <div style={{height:1,background:t.border,margin:'4px 0 12px'}}/>
                  <div style={{fontSize:12,fontWeight:700,color:t.text,marginBottom:6}}>Sheet</div>
                  {plans.length===0
                    ? <div style={{fontSize:10,color:'#F59E0B',padding:'6px 10px',background:'#FEF3C7',borderRadius:5,border:'1px solid #FDE68A',marginBottom:12}}>⚠ Upload plans in the Plans tab first</div>
                    : <select value={selPlan?.id||''} onChange={e=>{
                        const p=plans.find(x=>x.id===Number(e.target.value));
                        if(p){
                          if(!openTabs.includes(p.id)) setOpenTabs(prev=>[...prev,p.id]);
                          setSelPlan(p);
                          if(p.scale_px_per_ft) setScale(p.scale_px_per_ft);
                          else{setScale(null);setPresetScale('');}
                        }
                      }}
                      style={{width:'100%',padding:'7px 10px',border:`1px solid ${selPlan?'#10B981':t.border2}`,borderRadius:5,
                        fontSize:12,color:t.text,background:t.bg,marginBottom:12,cursor:'pointer',outline:'none'}}>
                        <option value="">— Select a sheet —</option>
                        {plans.map(p=><option key={p.id} value={p.id}>{p.name||'Unnamed'}</option>)}
                      </select>
                  }

                  <div style={{display:'flex',gap:8}}>
                    <button onClick={()=>setTakeoffStep('create')}
                      style={{flex:1,padding:'8px 0',border:`1px solid ${t.border2}`,background:t.bg,color:t.text3,
                        borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center',gap:5}}>
                      ← Takeoffs
                    </button>
                    <button disabled={creatingTO||!newTOName.trim()} onClick={async()=>{
                      if(!newTOName.trim()) return;
                      setCreatingTO(true);
                      // Auto-select a plan if none is open
                      let activePlan = selPlan;
                      if(!activePlan && plans.length>0){
                        const firstPlan = openTabs.length>0 ? plans.find(p=>p.id===openTabs[0]) : plans[0];
                        activePlan = firstPlan || plans[0];
                        if(!openTabs.includes(activePlan.id)) setOpenTabs(prev=>[...prev, activePlan.id]);
                        setSelPlan(activePlan);
                        if(activePlan.scale_px_per_ft) setScale(activePlan.scale_px_per_ft);
                        else { setScale(null); setPresetScale(''); }
                      }
                      if(!activePlan){ alert('Please upload a plan first'); setCreatingTO(false); return; }
                      const catId = newTOCat;
                      const mt = newTOType?.mt||'area';
                      const payload = {
                        project_id: project.id,
                        plan_id: activePlan.id,
                        category: catId,
                        description: newTOName.trim(),
                        quantity: 0,
                        unit: newTOType?.unit||'SF',
                        unit_cost: 0,
                        total_cost: 0,
                        measurement_type: mt,
                        points: [],
                        color: newTOColor,
                        ai_generated: false,
                        sort_order: items.length,
                      };
                      console.log('inserting takeoff:', payload);
                      const {data, error} = await supabase.from('takeoff_items').insert([payload]).select().single();
                      console.log('result:', data, error);
                      if(error){ alert('Error creating takeoff: '+error.message); setCreatingTO(false); return; }
                      if(data){
                        setItems(prev=>[...prev,data]);
                        // Switch left tab to takeoffs list and arm the new item
                        setLeftTab('takeoffs');
                        setTakeoffStep(null);
                        setActiveCondId(data.id);
                        setTool(mt==='area'?'area':mt==='linear'?'linear':mt==='count'?'count':'area');
                        setActivePts([]);
                        // Reset flow state
                        setNewTOType(null); setNewTOName(''); setNewTODesc(''); setNewTOColor('#10B981'); setNewTOCat('other'); setNewTOSize('medium');
                      }
                      setCreatingTO(false);
                    }}
                      style={{flex:2,padding:'8px 0',border:'none',
                        background:newTOName.trim()&&!creatingTO?'#10B981':'#ccc',color:'#fff',
                        borderRadius:6,cursor:newTOName.trim()&&!creatingTO?'pointer':'not-allowed',fontSize:12,fontWeight:700,
                        display:'flex',alignItems:'center',justifyContent:'center',gap:5}}>
                      {creatingTO?'Creating…':'Start Measuring →'}
                    </button>
                  </div>
                  {plans.length===0&&<div style={{fontSize:10,color:'#F59E0B',textAlign:'center',marginTop:6}}>⚠ Upload a plan in the Plans tab first</div>}
                  {!selPlan&&plans.length>0&&<div style={{fontSize:10,color:'#10B981',textAlign:'center',marginTop:6}}>✓ Will open {(openTabs.length>0?plans.find(p=>p.id===openTabs[0]):plans[0])?.name||'first plan'}</div>}
                </div>
              </div>
            );

            // ── DEFAULT: Category > Items (flat, no plan folder) ──────────
            const searchLower = toSearch.toLowerCase();
            const filteredItems = items.filter(i=>
              !toSearch || i.description?.toLowerCase().includes(searchLower)
            );
            // All items for the current project, grouped by category
            const catGroups = TAKEOFF_CATS.map(cat=>{
              const catItems = filteredItems.filter(i=>i.category===cat.id);
              return {cat, items:catItems};
            });
            const hasAny = catGroups.some(g=>g.items.length>0);

            return(
            <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
              {/* Active measuring banner */}
              {tool==='cutout'&&!activeCond?(
                <div style={{padding:'6px 12px',background:'rgba(239,68,68,0.08)',borderBottom:'2px solid #EF4444',display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
                  <div style={{width:6,height:6,borderRadius:'50%',background:'#EF4444',flexShrink:0}}/>
                  <span style={{fontSize:11,fontWeight:600,color:'#EF4444',flex:1}}>⊘ Click an area shape on the plan to cut from</span>
                  <button onClick={()=>{setTool('select');setActiveCondId(null);}} style={{background:'none',border:'1px solid rgba(239,68,68,0.4)',color:'#EF4444',padding:'2px 8px',borderRadius:3,cursor:'pointer',fontSize:9,fontWeight:700,flexShrink:0}}>Cancel</button>
                </div>
              ):activeCond&&tool==='cutout'?(
                <div style={{padding:'6px 12px',background:'rgba(239,68,68,0.08)',borderBottom:'2px solid #EF4444',display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
                  <div style={{width:6,height:6,borderRadius:'50%',background:'#EF4444',flexShrink:0,animation:'pulse 1.2s ease-in-out infinite'}}/>
                  <span style={{fontSize:11,fontWeight:600,color:'#EF4444',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>⊘ Drawing cutout on: {activeCond.description}</span>
                  <button onClick={()=>{setTool('select');setActiveCondId(null);setActivePts([]);}} style={{background:'none',border:'1px solid rgba(239,68,68,0.4)',color:'#EF4444',padding:'2px 8px',borderRadius:3,cursor:'pointer',fontSize:9,fontWeight:700,flexShrink:0}}>Done</button>
                </div>
              ):activeCond&&(
                <div style={{padding:'6px 12px',background:'rgba(249,115,22,0.08)',borderBottom:'2px solid #F97316',display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
                  <div style={{width:6,height:6,borderRadius:'50%',background:'#F97316',flexShrink:0,animation:'pulse 1.2s ease-in-out infinite'}}/>
                  <span style={{fontSize:11,fontWeight:600,color:'#F97316',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{activeCond.description}</span>
                  <button onClick={disarm} style={{background:'none',border:'1px solid rgba(249,115,22,0.4)',color:'#F97316',padding:'2px 8px',borderRadius:3,cursor:'pointer',fontSize:9,fontWeight:700,flexShrink:0}}>Done</button>
                </div>
              )}

              {/* Search + New Takeoff */}
              <div style={{padding:'8px 10px',borderBottom:`1px solid ${t.border}`,flexShrink:0,display:'flex',gap:6,alignItems:'center'}}>
                <div style={{flex:1,position:'relative'}}>
                  <span style={{position:'absolute',left:7,top:'50%',transform:'translateY(-50%)',color:t.text4,fontSize:11}}>⌕</span>
                  <input value={toSearch} onChange={e=>setToSearch(e.target.value)}
                    placeholder="Search Takeoffs"
                    style={{width:'100%',padding:'5px 8px 5px 22px',border:`1px solid ${t.border}`,borderRadius:5,
                      fontSize:11,color:t.text,background:t.bg,outline:'none',boxSizing:'border-box'}}/>
                </div>
                <button onClick={()=>setTakeoffStep('type')}
                  style={{background:'#10B981',border:'none',color:'#fff',padding:'5px 10px',borderRadius:5,
                    cursor:'pointer',fontSize:11,fontWeight:700,display:'flex',alignItems:'center',gap:4,flexShrink:0,whiteSpace:'nowrap'}}>
                  New Takeoff ▾
                </button>
              </div>

              {/* Column headers */}
              <div style={{display:'flex',alignItems:'center',padding:'3px 10px',borderBottom:`1px solid ${t.border}`,flexShrink:0,background:t.bg3}}>
                <span style={{fontSize:9,fontWeight:700,color:t.text4,flex:1,letterSpacing:0.8,textTransform:'uppercase'}}>Name</span>
                <span style={{fontSize:9,fontWeight:700,color:t.text4,width:64,textAlign:'right',letterSpacing:0.8,textTransform:'uppercase'}}>Qty</span>
                <span style={{width:20}}/>
              </div>

              {/* Category > Items tree */}
              <div style={{flex:1,overflowY:'auto'}}>
                {!hasAny&&(
                  <div style={{textAlign:'center',padding:'40px 16px',color:t.text4,fontSize:11,lineHeight:1.8}}>
                    No takeoffs yet.<br/>Click <strong style={{color:t.text}}>New Takeoff</strong> to get started.
                  </div>
                )}

                {catGroups.map(({cat, items:catItems})=>{
                  // Always show all categories (collapsed if empty), but hide empties when searching
                  if(toSearch && catItems.length===0) return null;
                  const catKey = 'cat_'+cat.id;
                  const catCollapsed = collapsedPlans?.[catKey] ?? (catItems.length===0);
                  const catCost = catItems.reduce((s,i)=>s+(i.total_cost||0),0);

                  return(
                    <div key={cat.id} style={{borderBottom:`1px solid ${t.border}`}}>
                      {/* ── Category header ── */}
                      <div onClick={()=>setCollapsedPlans(p=>({...p,[catKey]:!catCollapsed}))}
                        style={{display:'flex',alignItems:'center',gap:7,padding:'7px 10px',
                          cursor:'pointer',userSelect:'none',
                          borderLeft:`3px solid ${catItems.length>0?cat.color:t.border}`,
                          background:catItems.length>0?`${cat.color}08`:'transparent'}}>
                        <span style={{fontSize:8,color:catItems.length>0?cat.color:t.text4,width:10,flexShrink:0}}>
                          {catCollapsed?'▶':'▼'}
                        </span>
                        <div style={{width:12,height:12,borderRadius:3,background:catItems.length>0?cat.color:t.border2,flexShrink:0}}/>
                        <span style={{fontSize:12,fontWeight:600,color:catItems.length>0?t.text:t.text4,flex:1}}>
                          {cat.label}
                        </span>
                        {catItems.length>0&&(
                          <span style={{fontSize:10,color:t.text4,fontFamily:"'DM Mono',monospace"}}>
                            {catItems.length} item{catItems.length!==1?'s':''}
                          </span>
                        )}
                        {catCost>0&&(
                          <span style={{fontSize:10,fontWeight:700,color:'#10B981',fontFamily:"'DM Mono',monospace",marginLeft:6}}>
                            ${Math.round(catCost).toLocaleString()}
                          </span>
                        )}
                      </div>

                      {/* ── Items ── */}
                      {!catCollapsed&&(
                        <div>
                          {catItems.map(item=>{
                            const isActive = item._siblings
                              ? item._siblings.some(s=>s.id===activeCondId)
                              : item.id===activeCondId;
                            const shapes=(()=>{
                              if(!item.points||!item.points.length) return [];
                              if(Array.isArray(item.points[0])) return item.points;
                              if(item.points[0]?.x!=null) return [item.points];
                              return item.points;
                            })();
                            const qty = item.quantity||0;
                            const itemColor = item.color||cat.color;
                            const typeIcon = {area:'⬟',linear:'╱',count:'✓'}[item.measurement_type]||'✎';
                            const planName = plans.find(p=>p.id===item.plan_id)?.name||'';
                            return(
                              <div key={item.id}
                                onClick={()=>isActive?disarm():armItem(item)}
                                style={{display:'flex',alignItems:'center',gap:7,
                                  padding:'5px 8px 5px 24px',cursor:'pointer',
                                  borderBottom:`1px solid ${t.border}`,
                                  borderLeft:isActive?`3px solid #F97316`:`3px solid ${cat.color}`,
                                  background:isActive?'rgba(249,115,22,0.05)':'transparent'}}
                                onMouseEnter={e=>{if(!isActive)e.currentTarget.style.background=t.bg3;}}
                                onMouseLeave={e=>{if(!isActive)e.currentTarget.style.background='transparent';}}>
                                {/* Type chip */}
                                <div style={{width:18,height:18,borderRadius:3,
                                  background:isActive?'#F97316':itemColor,
                                  display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                                  <span style={{fontSize:8,fontWeight:800,color:'#fff'}}>{typeIcon}</span>
                                </div>
                                {/* Name + plan badge */}
                                <div style={{flex:1,minWidth:0}}>
                                  <div style={{fontSize:11,fontWeight:isActive?600:400,
                                    color:isActive?'#F97316':t.text,
                                    overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                                    {item.description||'Unnamed'}
                                  </div>
                                  <div style={{display:'flex',alignItems:'center',gap:4,marginTop:1}}>
                                    {item._planCount>1
                                      ? <span style={{fontSize:8,color:'#3B82F6',fontWeight:700,background:'rgba(59,130,246,0.1)',borderRadius:3,padding:'1px 4px'}}>{item._planCount} sheets</span>
                                      : <span style={{fontSize:8,color:t.text4,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{plans.find(p=>p.id===item.plan_id)?.name||''}</span>
                                    }
                                  </div>
                                </div>
                                {/* Qty — total across all plan siblings */}
                                <div style={{width:60,textAlign:'right',flexShrink:0}}>
                                  <span style={{fontSize:10,fontFamily:"'DM Mono',monospace",
                                    color:(item._totalQty||0)>0?t.text:t.text4,fontWeight:(item._totalQty||0)>0?600:400}}>
                                    {(item._totalQty||0)>0?`${Math.round((item._totalQty||0)*10)/10} ${item.unit}`:'—'}
                                  </span>
                                </div>
                                {/* ✎ edit item */}
                                <button onClick={e=>{
                                  e.stopPropagation();
                                  setEditItem(item);
                                }} title="Edit takeoff"
                                  style={{background:'none',border:'none',color:t.text4,cursor:'pointer',
                                    fontSize:10,padding:'2px 3px',flexShrink:0,lineHeight:1,opacity:0.4,borderRadius:3}}
                                  onMouseEnter={e=>e.currentTarget.style.opacity='1'}
                                  onMouseLeave={e=>e.currentTarget.style.opacity='0.4'}>✎</button>
                                {/* → jump to plan */}
                                <button onClick={e=>{
                                  e.stopPropagation();
                                  const p=plans.find(x=>x.id===item.plan_id);
                                  if(p){
                                    if(!openTabs.includes(p.id)) setOpenTabs(prev=>[...prev,p.id]);
                                    setSelPlan(p);
                                    if(p.scale_px_per_ft) setScale(p.scale_px_per_ft);
                                    else{setScale(null);setPresetScale('');}
                                  }
                                }} title="Go to plan"
                                  style={{background:'none',border:'none',color:t.text4,cursor:'pointer',
                                    fontSize:12,padding:'0 2px',flexShrink:0,lineHeight:1,opacity:0.5}}>→</button>
                              </div>
                            );
                          })}
                          {/* Add item (only if a plan is open) */}
                          {selPlan&&(
                            <AddItemInline cat={cat} selPlan={selPlan} project={project} items={items}
                              onCreated={(newItem)=>{setItems(prev=>[...prev,newItem]);armItem(newItem);}}/>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            );
          })()}

          {/* ── SETTINGS tab ── */}
          {leftTab==='settings'&&(
            <div style={{flex:1,overflowY:'auto',padding:14}}>
              <div style={{fontSize:10,fontWeight:700,color:t.text4,letterSpacing:0.8,marginBottom:8}}>SCALE</div>
              <div style={{fontSize:10,color:scale?'#10B981':t.text4,marginBottom:8,padding:'6px 10px',background:t.bg3,borderRadius:5,border:`1px solid ${t.border}`}}>
                {scale?`✓ ${presetScale||'Calibrated'} · ${Math.round(scale*10)/10} px/ft`:'Not set for this page'}
              </div>
              <div style={{fontSize:10,color:t.text4,marginBottom:8}}>Use the <strong style={{color:'#10B981'}}>+ Set Scale</strong> button in the lower-right of the canvas to set scale per page.</div>
              {!isPdfPlan&&(
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:10,color:t.text4,marginBottom:4}}>Scan DPI</div>
                  <select value={planDpi} onChange={e=>setPlanDpi(Number(e.target.value))} style={{...inputStyle,width:'100%',fontSize:11}}>
                    {[72,96,100,150,200,300,400,600].map(d=><option key={d} value={d}>{d} dpi</option>)}
                  </select>
                </div>
              )}
              <div style={{height:1,background:t.border,marginBottom:12}}/>
              <div style={{fontSize:10,fontWeight:700,color:t.text4,letterSpacing:0.8,marginBottom:8}}>UNIT COSTS</div>
              <button onClick={()=>setShowUnitCosts(true)} style={{width:'100%',background:'none',border:`1px solid ${t.border2}`,color:t.text3,padding:'7px 0',borderRadius:5,cursor:'pointer',fontSize:11,marginBottom:12}}>Edit Rates</button>
              <div style={{fontSize:10,fontWeight:700,color:t.text4,letterSpacing:0.8,marginBottom:8}}>ASSEMBLIES</div>
              <button onClick={()=>setShowAssembly(true)} style={{width:'100%',background:'none',border:`1px solid rgba(139,92,246,0.4)`,color:'#8B5CF6',padding:'7px 0',borderRadius:5,cursor:'pointer',fontSize:11,fontWeight:700}}>⬡ Assembly Library</button>
            </div>
          )}

          {/* ── ESTIMATE tab (full screen overlay, triggered from bottom bar) ── */}
          {leftTab==='estimate_stub'&&null}

          {/* Bottom: Estimate + total */}
          <div style={{borderTop:`1px solid ${t.border}`,padding:'8px 10px',background:t.bg2,flexShrink:0,display:'flex',alignItems:'center',gap:8}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:9,color:t.text4}}>All sheets</div>
              <div style={{fontSize:13,fontWeight:700,color:'#10B981'}}>${totalEst.toLocaleString()}</div>
            </div>
            <button onClick={()=>setRightTab('estimate')}
              style={{background:'#10B981',border:'none',color:'#fff',padding:'6px 14px',borderRadius:5,cursor:'pointer',fontSize:11,fontWeight:700,flexShrink:0}}>
              $ Estimate →
            </button>
          </div>
        </div>

        {/* ── Center: Tabs + Canvas ── */}
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minWidth:0,position:'relative'}}>

          {/* ── Browser-style tab bar ── */}
          <div style={{display:'flex',alignItems:'stretch',height:36,borderBottom:`1px solid ${t.border}`,background:t.bg2,flexShrink:0,position:'relative'}}>
            <div style={{display:'flex',alignItems:'stretch',flex:1,overflowX:'auto',overflowY:'hidden'}}>
            {openTabs.map(tabId=>{
              const p = plans.find(x=>x.id===tabId);
              if(!p) return null;
              const isActive = selPlan?.id===tabId;
              const cnt = items.filter(it=>it.plan_id===tabId).length;
              return(
                <div key={tabId}
                  onClick={()=>{setSelPlan(p);if(p.scale_px_per_ft)setScale(p.scale_px_per_ft);else{setScale(null);setPresetScale('');}}}
                  style={{display:'flex',alignItems:'center',gap:6,padding:'0 12px',
                    borderRight:`1px solid ${t.border}`,cursor:'pointer',flexShrink:0,minWidth:100,maxWidth:180,
                    background:isActive?t.bg:'transparent',
                    borderBottom:isActive?`2px solid #10B981`:'2px solid transparent',
                    boxSizing:'border-box',position:'relative'}}>
                  <span style={{fontSize:11,fontWeight:isActive?600:400,color:isActive?t.text:t.text3,
                    overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1,minWidth:0}}>
                    {p.name||`Sheet ${plans.indexOf(p)+1}`}
                  </span>
                  {cnt>0&&<span style={{fontSize:9,color:'#10B981',fontFamily:"'DM Mono',monospace",flexShrink:0}}>{cnt}</span>}
                  {/* Close tab */}
                  <button onClick={e=>{
                    e.stopPropagation();
                    const newTabs = openTabs.filter(id=>id!==tabId);
                    setOpenTabs(newTabs);
                    if(isActive){
                      const next = newTabs.length>0 ? plans.find(x=>x.id===newTabs[newTabs.length-1]) : null;
                      setSelPlan(next);
                      if(next?.scale_px_per_ft) setScale(next.scale_px_per_ft);
                      else { setScale(null); setPresetScale(''); }
                    }
                  }} style={{background:'none',border:'none',color:t.text4,cursor:'pointer',
                    fontSize:13,padding:'0',lineHeight:1,flexShrink:0,
                    width:16,height:16,display:'flex',alignItems:'center',justifyContent:'center',
                    borderRadius:'50%',opacity:isActive?0.6:0.3,
                    ':hover':{opacity:1}}}>×</button>
                </div>
              );
            })}
            {/* Placeholder if no tabs */}
            {openTabs.length===0&&(
              <div style={{display:'flex',alignItems:'center',padding:'0 14px',fontSize:10,color:t.text4}}>Open a plan from Plans panel</div>
            )}
            </div>{/* end scrolling tabs */}
            {/* Export — outside overflow div so dropdown is not clipped */}
            {selPlan&&(
              <div style={{position:'relative',flexShrink:0}}>
                <button onClick={()=>setShowExportMenu(v=>!v)} disabled={exporting}
                  style={{height:'100%',padding:'0 14px',border:'none',borderLeft:`1px solid ${t.border}`,
                    background:'none',color:exporting?t.text4:'#3B82F6',cursor:'pointer',fontSize:11,fontWeight:700,
                    display:'flex',alignItems:'center',gap:5,whiteSpace:'nowrap'}}>
                  {exporting?<><span style={{animation:'spin 0.8s linear infinite',display:'inline-block'}}>◌</span> Exporting…</>:<>↓ Export</>}
                </button>
                {showExportMenu&&!exporting&&(
                  <>
                    <div style={{position:'fixed',inset:0,zIndex:49}} onClick={()=>setShowExportMenu(false)}/>
                    <div style={{position:'absolute',top:'100%',right:0,zIndex:50,marginTop:2,
                      background:'#1a1a1a',border:'1px solid rgba(255,255,255,0.12)',borderRadius:7,
                      boxShadow:'0 8px 24px rgba(0,0,0,0.5)',minWidth:220,overflow:'hidden'}}>
                      <div style={{padding:'7px 12px',fontSize:9,fontWeight:700,color:'rgba(255,255,255,0.3)',letterSpacing:0.8,borderBottom:'1px solid rgba(255,255,255,0.07)'}}>
                        EXPORT PLANS
                      </div>
                      {/* Current plan */}
                      <button onClick={()=>exportPlan(selPlan, true)}
                        style={{width:'100%',background:'none',border:'none',color:'rgba(255,255,255,0.85)',
                          padding:'10px 14px',cursor:'pointer',fontSize:11,textAlign:'left',
                          display:'flex',flexDirection:'column',gap:2,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
                        <span style={{fontWeight:700,color:'#3B82F6'}}>↓ This sheet + Legend</span>
                        <span style={{fontSize:9,color:'rgba(255,255,255,0.4)'}}>Current plan with markup &amp; legend</span>
                      </button>
                      <button onClick={()=>exportPlan(selPlan, false)}
                        style={{width:'100%',background:'none',border:'none',color:'rgba(255,255,255,0.85)',
                          padding:'10px 14px',cursor:'pointer',fontSize:11,textAlign:'left',
                          display:'flex',flexDirection:'column',gap:2,borderBottom:'1px solid rgba(255,255,255,0.1)'}}>
                        <span style={{fontWeight:700,color:'rgba(255,255,255,0.7)'}}>↓ This sheet only</span>
                        <span style={{fontSize:9,color:'rgba(255,255,255,0.4)'}}>Markup, no legend</span>
                      </button>
                      {/* All marked plans */}
                      {(()=>{
                        const markedPlans = plans.filter(p=>items.some(i=>i.plan_id===p.id && i.points?.length));
                        if(!markedPlans.length) return null;
                        return(<>
                          <button onClick={()=>exportAllMarked(true)}
                            style={{width:'100%',background:'none',border:'none',color:'rgba(255,255,255,0.85)',
                              padding:'10px 14px',cursor:'pointer',fontSize:11,textAlign:'left',
                              display:'flex',flexDirection:'column',gap:2,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
                            <span style={{fontWeight:700,color:'#10B981'}}>↓ All {markedPlans.length} marked sheets + Legend</span>
                            <span style={{fontSize:9,color:'rgba(255,255,255,0.4)'}}>Downloads as ZIP</span>
                          </button>
                          <button onClick={()=>exportAllMarked(false)}
                            style={{width:'100%',background:'none',border:'none',color:'rgba(255,255,255,0.85)',
                              padding:'10px 14px',cursor:'pointer',fontSize:11,textAlign:'left',
                              display:'flex',flexDirection:'column',gap:2}}>
                            <span style={{fontWeight:700,color:'rgba(16,185,129,0.7)'}}>↓ All {markedPlans.length} marked sheets only</span>
                            <span style={{fontSize:9,color:'rgba(255,255,255,0.4)'}}>No legend — ZIP</span>
                          </button>
                        </>);
                      })()}
                    </div>
                  </>
                )}
              </div>
            )}
            {/* AI Takeoff */}
            {selPlan&&<button onClick={runAITakeoff} disabled={analyzing}
              style={{marginLeft:'auto',height:'100%',padding:'0 14px',border:'none',borderLeft:`1px solid ${t.border}`,
                background:'none',color:analyzing?t.text4:'#a855f7',cursor:'pointer',fontSize:11,fontWeight:700,
                display:'flex',alignItems:'center',gap:5,flexShrink:0,whiteSpace:'nowrap'}}>
              {analyzing?<><span style={{animation:'spin 0.8s linear infinite',display:'inline-block'}}>◌</span> Analyzing…</>:<>✦ AI Takeoff</>}
            </button>}
            <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{display:'none'}} onChange={e=>handleUpload(e.target.files[0])}/>
          </div>

          {/* Plan canvas + floating overlays */}
          <div style={{flex:1,position:'relative',overflow:'hidden',minHeight:0}}>
          <div ref={containerCallbackRef} style={{position:'absolute',inset:0,overflow:'auto',background:'#1e1e1e'}}>
            {!selPlan?(
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',padding:40}}>
                <div style={{fontSize:48,marginBottom:16}}>📐</div>
                <div style={{fontSize:15,fontWeight:700,color:t.text,marginBottom:6}}>No plan open</div>
                <div style={{fontSize:12,color:t.text3,marginBottom:20,textAlign:'center'}}>Go to Plans panel and upload or open a plan</div>
                <button onClick={()=>setLeftTab('plans')} style={{background:'#10B981',border:'none',color:'#fff',padding:'10px 24px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:700}}>Open Plans</button>
              </div>
            ):(()=>{
              const planW = imgNat.w > 4 ? imgNat.w : (canvasRef.current?.width || 800);
              const planH = imgNat.h > 4 ? imgNat.h : (canvasRef.current?.height || 1100);
              return (
                <div style={{width:planW*zoom, height:planH*zoom, position:'relative', flexShrink:0}}>
                  <div style={{transformOrigin:'top left', transform:`scale(${zoom})`, position:'absolute', top:0, left:0}}>
                    {planErr&&<div style={{position:'absolute',top:10,left:10,zIndex:20,background:'#1a0505',border:'1px solid #ef4444',color:'#ef4444',padding:'10px 14px',borderRadius:8,fontSize:11,maxWidth:500,wordBreak:'break-all'}}>{planErr}</div>}
                    {loadingPlan&&(
                      <div style={{width:800,height:600,display:'flex',alignItems:'center',justifyContent:'center',background:'#1a1a1a',color:'#aaa',fontSize:13,gap:8,fontFamily:"'DM Mono',monospace"}}>
                        <span style={{animation:'spin 0.8s linear infinite',display:'inline-block'}}>◌</span> Loading plan…
                      </div>
                    )}
                    {isPdfPlan?(
                      <>
                        {rendering&&<div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.7)',zIndex:5,color:'#fff',fontSize:13,gap:8}}><span style={{animation:'spin 0.8s linear infinite',display:'inline-block'}}>◌</span>Rendering…</div>}
                        <canvas ref={canvasRef} style={{display:'block',userSelect:'none'}}/>
                      </>
                    ):(blobUrl&&(
                      <img ref={imgRef} src={blobUrl} alt=""
                        style={{display:'block',maxWidth:'none',userSelect:'none'}}
                        onLoad={handleImgLoad}
                        onError={(e)=>{
                          console.error('img load failed');
                          setPlanErr('Load failed. URL: ' + (selPlan?.file_url||'').slice(0,120));
                        }}
                        draggable={false}/>
                    ))}
                    <svg ref={svgRef}
                      viewBox={`0 0 ${planW} ${planH}`}
                      style={{position:'absolute',top:0,left:0,width:planW+'px',height:planH+'px',cursor:toolCursor,pointerEvents:'all',userSelect:'none',overflow:'hidden'}}
                      onMouseDown={(e)=>{ handleSvgMouseDown(e); handleSvgRightPan(e); }}
                      onClick={handleSvgClick}
                      onDoubleClick={handleSvgDoubleClick}
                      onContextMenu={handleSvgContextMenu}
                      onMouseMove={handleSvgMove} onMouseLeave={()=>setHoverPt(null)}>
                      <defs><clipPath id="planClip"><rect x={0} y={0} width={planW} height={planH}/></clipPath></defs>
                      <g clipPath="url(#planClip)">
                        {renderMeasurements()}
                        {renderActive()}
                        {scalePts.length>=2&&(()=>{
                          const p1=scalePts[0];const p2=scalePts[1];
                          const sw=2/zoom;
                          return(<g>
                            <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#10B981" strokeWidth={sw} strokeDasharray={`${6/zoom},${3/zoom}`}/>
                            <circle cx={p1.x} cy={p1.y} r={6/zoom} fill="#10B981"/>
                            <circle cx={p2.x} cy={p2.y} r={6/zoom} fill="#10B981"/>
                          </g>);
                        })()}
                        {/* Lasso selection box */}
                        {lassoRect&&(()=>{
                          const {sx,sy,ex,ey}=lassoRect;
                          const lx=Math.min(sx,ex),ly=Math.min(sy,ey),lw=Math.abs(ex-sx),lh=Math.abs(ey-sy);
                          if(lw<2&&lh<2) return null;
                          return(<g style={{pointerEvents:'none'}}>
                            <rect x={lx} y={ly} width={lw} height={lh}
                              fill="rgba(59,130,246,0.08)" stroke="#3B82F6"
                              strokeWidth={1.5/zoom} strokeDasharray={`${5/zoom},${3/zoom}`}/>
                          </g>);
                        })()}
                      </g>
                    </svg>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* ── DEBUG overlay (remove before prod) ── */}
          <div style={{position:'absolute',bottom:8,left:8,zIndex:110,
            background:'rgba(0,0,0,0.75)',color:'#0f0',fontFamily:'monospace',
            fontSize:10,padding:'4px 8px',borderRadius:4,pointerEvents:'none',lineHeight:1.6}}>
            sel:{selectedShapes.size} | clip:{clipboard.length}{dragOffset?' | drag':''}{ vertexDrag?' | vtx':''}
          </div>
          {/* ── Multi-select floating action bar ── */}
          {selectedShapes.size>0&&(
            <div style={{position:'absolute',top:10,left:'50%',transform:'translateX(-50%)',zIndex:110,
              background:'rgba(15,15,15,0.96)',border:'1px solid rgba(59,130,246,0.5)',
              borderRadius:10,padding:'7px 14px',boxShadow:'0 4px 24px rgba(0,0,0,0.6)',
              backdropFilter:'blur(10px)',display:'flex',alignItems:'center',gap:10,pointerEvents:'all'}}>
              <span style={{fontSize:11,color:'#94A3B8',fontWeight:600}}>{selectedShapes.size} selected</span>
              {copyFlash>0&&<span style={{fontSize:11,color:'#6EE7B7',fontWeight:700,animation:'fadeIn 0.2s ease'}}>✓ Copied {copyFlash}</span>}
              <div style={{width:1,height:18,background:'rgba(255,255,255,0.12)'}}/>
              <button onClick={()=>{ if(copyShapesRef.current) copyShapesRef.current(); }}
                title="Copy (Ctrl+C)"
                style={{background:'none',border:'none',color:'#93C5FD',cursor:'pointer',fontSize:11,fontWeight:600,padding:'2px 6px',borderRadius:4,display:'flex',alignItems:'center',gap:4}}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(59,130,246,0.15)'}
                onMouseLeave={e=>e.currentTarget.style.background='none'}>
                ⎘ Copy
              </button>
              <button onClick={()=>{
                const OFF=30;
                const shift=(sh)=>sh.map(p=>({...p,x:p.x+OFF,y:p.y+OFF}));
                const keys=[...selectedShapesRef.current];
                if(!keys.length) return;
                const byItem={};
                keys.forEach(k=>{const parts=k.split('::');const id=parts[0];const si=Number(parts[1]);if(!byItem[id])byItem[id]=[];byItem[id].push(si);});
                const inserts=Object.entries(byItem).map(([id,idxs])=>{
                  const item=itemsRef.current.find(i=>String(i.id)===String(id)); if(!item) return null;
                  const rawPts=item.points;
                  let shapes;
                  if(!rawPts||!rawPts.length){shapes=[];}
                  else if(Array.isArray(rawPts[0])){shapes=rawPts;}
                  else if(rawPts[0]&&typeof rawPts[0].x==='number'){shapes=[rawPts];}
                  else{shapes=rawPts;}
                  const picked=idxs.map(i=>shapes[i]).filter(Boolean);
                  if(!picked.length) return null;
                  return {project_id:item.project_id,plan_id:selPlan?.id||item.plan_id,category:item.category,description:item.description,quantity:0,unit:item.unit,unit_cost:item.unit_cost,total_cost:0,measurement_type:item.measurement_type,color:item.color,points:picked.map(shift),ai_generated:false,sort_order:itemsRef.current.length};
                }).filter(Boolean);
                if(!inserts.length) return;
                supabase.from('takeoff_items').insert(inserts).select().then(({data,error})=>{
                  if(error){console.error('dup error',error); return;}
                  if(data) setItems(prev=>[...prev,...data]);
                });
              }} title="Duplicate"
                style={{background:'none',border:'none',color:'#6EE7B7',cursor:'pointer',fontSize:11,fontWeight:600,padding:'2px 6px',borderRadius:4,display:'flex',alignItems:'center',gap:4}}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(16,185,129,0.15)'}
                onMouseLeave={e=>e.currentTarget.style.background='none'}>
                ⧉ Duplicate
              </button>
              <button onClick={(e)=>{ 
                e.stopPropagation();
                console.log('DELETE BTN CLICKED, ref:', deleteShapesRef.current, 'sel:', selectedShapesRef.current.size);
                if(deleteShapesRef.current) deleteShapesRef.current(); 
                else console.error('deleteShapesRef.current is NULL');
              }}
                title="Delete selected (Del)"
                style={{background:'none',border:'none',color:'#FCA5A5',cursor:'pointer',fontSize:11,fontWeight:600,padding:'2px 6px',borderRadius:4,display:'flex',alignItems:'center',gap:4}}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(252,165,165,0.15)'}
                onMouseLeave={e=>e.currentTarget.style.background='none'}>
                ⌫ Delete
              </button>
              <div style={{width:1,height:18,background:'rgba(255,255,255,0.12)'}}/>
              <button onClick={()=>setSelectedShapes(new Set())} title="Clear selection (Esc)"
                style={{background:'none',border:'none',color:'rgba(255,255,255,0.3)',cursor:'pointer',fontSize:14,padding:'0 2px',lineHeight:1}}>×</button>
            </div>
          )}

          {/* ── Floating Scale Bar (Stack-style, bottom of canvas) ── */}
          {selPlan&&(
            <div style={{position:'absolute',bottom:12,right:16,zIndex:30,display:'flex',alignItems:'center',gap:6,pointerEvents:'all'}}>
              {/* Calibrating status */}
              {scaleStep==='picking'&&(
                <div style={{background:'rgba(16,185,129,0.95)',color:'#fff',borderRadius:6,padding:'5px 12px',fontSize:11,fontWeight:600,boxShadow:'0 2px 10px rgba(0,0,0,0.4)',backdropFilter:'blur(4px)'}}>
                  Click 2 known points ({scalePts.length}/2)
                </div>
              )}
              {/* Scale distance input when 2 pts picked */}
              {scaleStep==='entering'&&(
                <div style={{background:'rgba(10,10,10,0.92)',border:'1px solid rgba(16,185,129,0.4)',borderRadius:8,padding:'8px 12px',boxShadow:'0 4px 20px rgba(0,0,0,0.6)',display:'flex',alignItems:'center',gap:8,backdropFilter:'blur(8px)'}}>
                  <span style={{fontSize:11,color:'rgba(255,255,255,0.5)'}}>Known distance =</span>
                  <input autoFocus type="number" value={scaleDist} onChange={e=>setScaleDist(e.target.value)}
                    placeholder="e.g. 20"
                    style={{width:72,background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.15)',color:'#fff',borderRadius:4,padding:'4px 8px',fontSize:12,outline:'none'}}
                    onKeyDown={e=>{ if(e.key==='Enter') { confirmScale(); setShowScalePanel(false); } }}/>
                  <select value={scaleUnit} onChange={e=>setScaleUnit(e.target.value)} style={{background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.15)',color:'#fff',borderRadius:4,padding:'4px 6px',fontSize:11}}>
                    <option value="ft">ft</option>
                    <option value="in">in</option>
                  </select>
                  <button onClick={()=>{confirmScale();setShowScalePanel(false);}} style={{background:'#10B981',border:'none',color:'#fff',borderRadius:5,padding:'4px 12px',cursor:'pointer',fontSize:11,fontWeight:700}}>Set</button>
                  <button onClick={()=>{setScaleStep(null);setScalePts([]);setTool('select');}} style={{background:'none',border:'none',color:'rgba(255,255,255,0.4)',cursor:'pointer',fontSize:14,padding:'0 2px'}}>×</button>
                </div>
              )}

              {/* Scale preset panel */}
              {showScalePanel&&!scaleStep&&(
                <>
                  <div style={{position:'fixed',inset:0,zIndex:29}} onClick={()=>setShowScalePanel(false)}/>
                  <div style={{position:'absolute',bottom:'calc(100% + 8px)',right:0,
                    background:'#1a1a1a',border:'1px solid rgba(255,255,255,0.12)',borderRadius:8,
                    boxShadow:'0 8px 32px rgba(0,0,0,0.6)',width:220,zIndex:31,
                    backdropFilter:'blur(8px)',display:'flex',flexDirection:'column',
                    maxHeight:'min(480px, calc(100vh - 80px))'}}>

                    {/* Header */}
                    <div style={{padding:'8px 12px',borderBottom:'1px solid rgba(255,255,255,0.08)',fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.4)',letterSpacing:0.8,flexShrink:0}}>
                      SET SCALE — {selPlan?.name?.slice(0,22)}
                    </div>

                    {/* Custom ratio input — 1" = X ft */}
                    <div style={{padding:'8px 10px',borderBottom:'1px solid rgba(255,255,255,0.08)',flexShrink:0}}>
                      <div style={{fontSize:9,color:'rgba(255,255,255,0.35)',marginBottom:5,letterSpacing:0.5}}>CUSTOM  (1&quot; = ? ft)</div>
                      <div style={{display:'flex',gap:6,alignItems:'center'}}>
                        <span style={{fontSize:11,color:'rgba(255,255,255,0.5)',flexShrink:0}}>1&quot; =</span>
                        <input
                          type="number" min="0.1" step="any"
                          value={customScaleInput}
                          onChange={e=>setCustomScaleInput(e.target.value)}
                          placeholder="e.g. 40"
                          style={{flex:1,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.15)',
                            color:'#fff',borderRadius:4,padding:'5px 8px',fontSize:12,outline:'none',minWidth:0}}
                          onKeyDown={async e=>{
                            if(e.key!=='Enter') return;
                            const ft = parseFloat(customScaleInput);
                            if(!ft||ft<=0) return;
                            const pxPerFt = (planDpi*12)/( ft*12 );
                            const label = `1"=${ft}ft`;
                            setScale(pxPerFt); setPresetScale(label);
                            if(selPlan?.id&&selPlan.id!=='preview') await supabase.from('precon_plans').update({scale_px_per_ft:pxPerFt}).eq('id',selPlan.id);
                            setShowScalePanel(false); setCustomScaleInput('');
                          }}
                        />
                        <span style={{fontSize:11,color:'rgba(255,255,255,0.5)',flexShrink:0}}>ft</span>
                        <button onClick={async()=>{
                          const ft = parseFloat(customScaleInput);
                          if(!ft||ft<=0) return;
                          const pxPerFt = (planDpi*12)/( ft*12 );
                          const label = `1"=${ft}ft`;
                          setScale(pxPerFt); setPresetScale(label);
                          if(selPlan?.id&&selPlan.id!=='preview') await supabase.from('precon_plans').update({scale_px_per_ft:pxPerFt}).eq('id',selPlan.id);
                          setShowScalePanel(false); setCustomScaleInput('');
                        }} disabled={!customScaleInput||parseFloat(customScaleInput)<=0}
                          style={{background:'#10B981',border:'none',color:'#fff',borderRadius:4,padding:'5px 10px',cursor:'pointer',fontSize:11,fontWeight:700,flexShrink:0,opacity:customScaleInput&&parseFloat(customScaleInput)>0?1:0.4}}>
                          Set
                        </button>
                      </div>
                    </div>

                    {/* Calibrate + Auto-detect */}
                    <button onClick={()=>{setTool('scale');setScaleStep('picking');setScalePts([]);setActivePts([]);setShowScalePanel(false);}}
                      style={{width:'100%',background:'none',border:'none',color:'#10B981',padding:'9px 12px',cursor:'pointer',fontSize:11,fontWeight:700,textAlign:'left',borderBottom:'1px solid rgba(255,255,255,0.06)',flexShrink:0,display:'flex',alignItems:'center',gap:7}}>
                      <span style={{fontSize:13}}>⊕</span> Calibrate — click 2 points
                    </button>
                    <button onClick={()=>{autoDetectScale();setShowScalePanel(false);}}
                      style={{width:'100%',background:'none',border:'none',color:'#a855f7',padding:'9px 12px',cursor:'pointer',fontSize:11,fontWeight:700,textAlign:'left',borderBottom:'1px solid rgba(255,255,255,0.1)',flexShrink:0,display:'flex',alignItems:'center',gap:7}}>
                      <span style={{fontSize:13}}>✦</span> Auto-Detect from drawing
                    </button>

                    {/* Scrollable preset list */}
                    <div style={{overflowY:'auto',flex:1}}>
                      <div style={{padding:'6px 12px 2px',fontSize:9,color:'rgba(255,255,255,0.3)',letterSpacing:0.6,position:'sticky',top:0,background:'#1a1a1a'}}>CIVIL / ENGINEERING</div>
                      {CONSTRUCTION_SCALES.filter(s=>s.group==='civil').map(s=>(
                        <button key={s.label} onClick={async()=>{
                          const pxPerFt=(planDpi*12)/s.ratio;
                          setScale(pxPerFt); setPresetScale(s.label);
                          if(selPlan?.id&&selPlan.id!=='preview') await supabase.from('precon_plans').update({scale_px_per_ft:pxPerFt}).eq('id',selPlan.id);
                          setShowScalePanel(false);
                        }} style={{width:'100%',background:presetScale===s.label?'rgba(16,185,129,0.15)':'none',border:'none',
                          color:presetScale===s.label?'#10B981':'rgba(255,255,255,0.7)',
                          padding:'6px 14px',cursor:'pointer',fontSize:11,textAlign:'left',display:'flex',alignItems:'center',gap:6}}>
                          {presetScale===s.label&&<span style={{color:'#10B981',fontSize:9}}>✓</span>}{s.label}
                        </button>
                      ))}
                      <div style={{padding:'6px 12px 2px',fontSize:9,color:'rgba(255,255,255,0.3)',letterSpacing:0.6,position:'sticky',top:0,background:'#1a1a1a'}}>ARCHITECTURAL</div>
                      {CONSTRUCTION_SCALES.filter(s=>s.group==='arch').map(s=>(
                        <button key={s.label} onClick={async()=>{
                          const pxPerFt=(planDpi*12)/s.ratio;
                          setScale(pxPerFt); setPresetScale(s.label);
                          if(selPlan?.id&&selPlan.id!=='preview') await supabase.from('precon_plans').update({scale_px_per_ft:pxPerFt}).eq('id',selPlan.id);
                          setShowScalePanel(false);
                        }} style={{width:'100%',background:presetScale===s.label?'rgba(16,185,129,0.15)':'none',border:'none',
                          color:presetScale===s.label?'#10B981':'rgba(255,255,255,0.7)',
                          padding:'6px 14px',cursor:'pointer',fontSize:11,textAlign:'left',display:'flex',alignItems:'center',gap:6}}>
                          {presetScale===s.label&&<span style={{color:'#10B981',fontSize:9}}>✓</span>}{s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Current scale chip */}
              {scale&&presetScale&&(
                <button onClick={()=>setShowScalePanel(s=>!s)}
                  style={{background:'rgba(0,0,0,0.7)',border:'1px solid rgba(16,185,129,0.4)',color:'#10B981',
                    borderRadius:5,padding:'4px 10px',cursor:'pointer',fontSize:11,fontWeight:600,
                    display:'flex',alignItems:'center',gap:5,backdropFilter:'blur(4px)',
                    boxShadow:'0 2px 8px rgba(0,0,0,0.4)'}}>
                  ✓ {presetScale}
                </button>
              )}

              {/* + New Scale / Set Scale button */}
              <button onClick={()=>setShowScalePanel(s=>!s)}
                style={{background:'#10B981',border:'none',color:'#fff',
                  borderRadius:6,padding:'5px 14px',cursor:'pointer',fontSize:11,fontWeight:700,
                  boxShadow:'0 2px 8px rgba(16,185,129,0.4)',display:'flex',alignItems:'center',gap:5}}>
                {scale&&presetScale?'⇔ Change Scale':scale?`⇔ ${Math.round(scale*10)/10} px/ft`:'+ Set Scale'}
              </button>
            </div>
          )}
          </div>
        </div>

        {/* ── Right Tool Bar ── */}
        <div style={{width:56,flexShrink:0,display:'flex',flexDirection:'column',borderLeft:`1px solid ${t.border}`,background:t.bg2,alignItems:'center',paddingTop:6}}>
          {[
            {id:'select', icon:'↖', label:'Select [V]', color:'#94A3B8'},
            null,
            {id:'area',   icon:'⬡', label:'Area',   color:'#F59E0B'},
            {id:'linear', icon:'━', label:'Linear', color:'#06B6D4'},
            {id:'count',  icon:'✕', label:'Count',  color:'#10B981'},
            null,
            {id:'cutout', icon:'⊘', label:'Cutout', color:'#EF4444'},
            {id:'eraser', icon:'⌫', label:'Eraser', color:'#F97316'},
          ].map((btn,i)=>{
            if(!btn) return <div key={i} style={{height:1,background:t.border,width:32,margin:'4px 0'}}/>;
            const isActive = tool===btn.id;
            const onClick = ()=>{
              if(btn.id==='cutout'){
                // Just enter cutout mode — user clicks a shape to arm it
                setTool('cutout'); setActivePts([]); setActiveCondId(null);
                setScaleStep(null); setShowScalePanel(false);
                setArchMode(false); setArchCtrlPending(false); setArcPending(false);
                setSelectedShapes(new Set()); setEraserHover(null);
                return;
              }
              setTool(btn.id);setActivePts([]);setScaleStep(null);setShowScalePanel(false);
              setArchMode(false);setArchCtrlPending(false);setArcPending(false);
              setSelectedShapes(new Set());setEraserHover(null);
            };
            return(
              <button key={btn.id} onClick={onClick} title={btn.label}
                style={{width:'100%',padding:'10px 0',border:'none',background:isActive?`${btn.color}18`:'none',
                  color:isActive?btn.color:t.text3,cursor:'pointer',
                  display:'flex',flexDirection:'column',alignItems:'center',gap:2,
                  borderRight:isActive?`2px solid ${btn.color}`:'2px solid transparent',
                  boxSizing:'border-box',transition:'all 0.1s'}}>
                <span style={{fontSize:16,lineHeight:1}}>{btn.icon}</span>
                <span style={{fontSize:8,fontWeight:600,color:isActive?btn.color:t.text4,letterSpacing:0.2}}>{btn.label}</span>
              </button>
            );
          })}

          {/* Snap toggle [S] — angle snap 45°/60°/90° */}
          <div style={{height:1,background:t.border,width:32,margin:'4px 0'}}/>
          <button onClick={()=>setSnapEnabled(p=>!p)} title="Angle snap 45°/60°/90° [S]"
            style={{width:'100%',padding:'10px 0',border:'none',
              background:snapEnabled?'#facc1518':'none',color:snapEnabled?'#facc15':t.text3,cursor:'pointer',
              display:'flex',flexDirection:'column',alignItems:'center',gap:2,
              borderRight:snapEnabled?'2px solid #facc15':'2px solid transparent',
              boxSizing:'border-box',transition:'all 0.1s'}}>
            <span style={{fontSize:13,lineHeight:1}}>⊕</span>
            <span style={{fontSize:8,fontWeight:600,color:snapEnabled?'#facc15':t.text4,letterSpacing:0.2}}>Snap</span>
            <span style={{fontSize:7,color:snapEnabled?'#facc15':t.text4,opacity:0.7}}>[S]</span>
          </button>

          {/* Arc mode [A] — shown when linear item is armed */}
          {activeCondId&&(()=>{
            const ac=itemsRef.current.find(i=>String(i.id)===String(activeCondId));
            if(!ac||ac.measurement_type!=='linear') return null;
            const arcOn = arcPending;
            return(
              <>
                <div style={{height:1,background:t.border,width:32,margin:'4px 0'}}/>
                <button onClick={()=>{
                  if(arcPending){ setArcPending(false); }
                  else {
                    if(commitCurrentPtsRef.current) commitCurrentPtsRef.current();
                    setArcPending(true);
                  }
                }}
                  title="Arc/Radius tool [A] — 3-click: start → peak → end"
                  style={{width:'100%',padding:'10px 0',border:'none',
                    background:arcOn?'#a855f718':'none',color:arcOn?'#a855f7':t.text3,cursor:'pointer',
                    display:'flex',flexDirection:'column',alignItems:'center',gap:2,
                    borderRight:arcOn?'2px solid #a855f7':'2px solid transparent',
                    boxSizing:'border-box',transition:'all 0.1s'}}>
                  <span style={{fontSize:15,lineHeight:1}}>⌒</span>
                  <span style={{fontSize:8,fontWeight:600,color:arcOn?'#a855f7':t.text4,letterSpacing:0.2}}>Arc</span>
                  <span style={{fontSize:7,color:arcOn?'#a855f7':t.text4,opacity:0.7}}>[A]</span>
                </button>
              </>
            );
          })()}
          {/* Area arch toggle — shown when area item armed */}
          {activeCondId&&(()=>{
            const ac=itemsRef.current.find(i=>String(i.id)===String(activeCondId));
            if(!ac||ac.measurement_type!=='area') return null;
            return(
              <>
                <div style={{height:1,background:t.border,width:32,margin:'4px 0'}}/>
                <button onClick={()=>{setArchMode(p=>{const n=!p;if(!n)setArchCtrlPending(false);return n;});setActivePts([]);}}
                  title="Arc curves for area [A]"
                  style={{width:'100%',padding:'10px 0',border:'none',
                    background:archMode?'#a855f718':'none',color:archMode?'#a855f7':t.text3,cursor:'pointer',
                    display:'flex',flexDirection:'column',alignItems:'center',gap:2,
                    borderRight:archMode?'2px solid #a855f7':'2px solid transparent',
                    boxSizing:'border-box',transition:'all 0.1s'}}>
                  <span style={{fontSize:15,lineHeight:1}}>⌒</span>
                  <span style={{fontSize:8,fontWeight:600,color:archMode?'#a855f7':t.text4,letterSpacing:0.2}}>Arc</span>
                  <span style={{fontSize:7,color:archMode?'#a855f7':t.text4,opacity:0.7}}>[A]</span>
                </button>
              </>
            );
          })()}

          <div style={{flex:1}}/>
          {/* Live measure readout at bottom of tool bar */}
          {(archMode||arcPending)&&(
            <div style={{padding:'6px 2px',textAlign:'center',borderTop:`1px solid #a855f730`,width:'100%',background:'#a855f710'}}>
              <span style={{fontSize:9,color:'#a855f7',fontWeight:700,display:'block',lineHeight:1.4}}>⌒</span>
              <span style={{fontSize:7,color:'#a855f7',fontWeight:600,display:'block',lineHeight:1.4}}>
                {arcPending
                  ? (activePts.length===0?'start':activePts.length===1?'peak':'end')
                  : tool==='linear'?(activePts.length===0?'pt 1':activePts.length===1?'pt 2':'bulge')
                  : (archCtrlPending?'ctrl pt':'vertex')}
              </span>
            </div>
          )}
          {snapEnabled&&(
            <div style={{padding:'6px 2px',textAlign:'center',borderTop:`1px solid #facc1530`,width:'100%',background:'#facc1510'}}>
              <span style={{fontSize:9,color:'#facc15',fontWeight:700,display:'block',lineHeight:1.4}}>⊕</span>
              <span style={{fontSize:7,color:'#facc15',fontWeight:600,display:'block',lineHeight:1.4}}>45/60/90°</span>
            </div>
          )}
          {!archMode&&tool==='area'&&activePts.length>=3&&scale&&hoverPt&&(
            <div style={{padding:'6px 2px',textAlign:'center',borderTop:`1px solid ${t.border}`,width:'100%'}}>
              <span style={{fontSize:9,color:'#F59E0B',fontWeight:700,display:'block',lineHeight:1.4}}>
                {Math.round(calcArea([...activePts,hoverPt])*10)/10}
              </span>
              <span style={{fontSize:8,color:t.text4}}>SF</span>
            </div>
          )}
          {!archMode&&tool==='linear'&&activePts.length>=1&&hoverPt&&scale&&(
            <div style={{padding:'6px 2px',textAlign:'center',borderTop:`1px solid ${t.border}`,width:'100%'}}>
              <span style={{fontSize:9,color:'#06B6D4',fontWeight:700,display:'block',lineHeight:1.4}}>
                {Math.round(calcLinear(activePts[activePts.length-1],hoverPt)*10)/10}
              </span>
              <span style={{fontSize:8,color:t.text4}}>LF</span>
            </div>
          )}
        </div>

      </div>

      {/* ── Full-screen Estimate Page ── */}
      {rightTab==='estimate'&&(()=>{
        const allCatGroups=TAKEOFF_CATS.map(cat=>{
          const its=items.filter(i=>i.plan_id!=null&&i.category===cat.id);
          return its.length?{...cat,items:its,subtotal:its.reduce((s,i)=>s+(i.total_cost||0),0)}:null;
        }).filter(Boolean);
        const sheetTotal=planItems.reduce((s,i)=>s+(i.total_cost||0),0);
        const markup = 1.0; // future: user-adjustable
        const GC_OVERHEAD = 0.12, PROFIT = 0.08;

        // Group items by sheet for the sheet breakdown table
        const sheetBreakdown = plans.map(p=>{
          const pItems = items.filter(i=>i.plan_id===p.id);
          const total = pItems.reduce((s,i)=>s+(i.total_cost||0),0);
          return {plan:p, items:pItems, total};
        }).filter(x=>x.items.length>0);

        return(
        <div style={{position:'absolute',inset:0,background:t.bg,zIndex:100,display:'flex',flexDirection:'column',overflow:'hidden'}}>

          {/* Header */}
          <div style={{display:'flex',alignItems:'center',gap:12,padding:'0 20px',height:50,borderBottom:`1px solid ${t.border}`,background:t.bg2,flexShrink:0}}>
            <button onClick={()=>setRightTab('items')}
              style={{background:'none',border:`1px solid ${t.border2}`,color:t.text3,padding:'5px 12px',borderRadius:5,cursor:'pointer',fontSize:11,display:'flex',alignItems:'center',gap:5}}>
              ← Back to Takeoff
            </button>
            <div style={{width:1,height:20,background:t.border}}/>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:700,color:t.text}}>{project.name}</div>
              <div style={{fontSize:9,color:t.text4,fontFamily:"'DM Mono',monospace"}}>{plans.length} SHEETS · {items.length} CONDITIONS · ESTIMATE REVIEW</div>
            </div>
            {project.contract_value&&(
              <div style={{padding:'5px 12px',borderRadius:5,background:totalEst>(project.contract_value||0)?'rgba(239,68,68,0.1)':'rgba(16,185,129,0.1)',border:`1px solid ${totalEst>(project.contract_value||0)?'rgba(239,68,68,0.3)':'rgba(16,185,129,0.3)'}`}}>
                <div style={{fontSize:8,color:t.text4,fontFamily:"'DM Mono',monospace",textAlign:'center'}}>CONTRACT</div>
                <div style={{fontSize:12,fontWeight:700,color:totalEst>(project.contract_value||0)?'#EF4444':'#10B981',fontFamily:"'DM Mono',monospace"}}>${Number(project.contract_value).toLocaleString()}</div>
              </div>
            )}
            <button onClick={()=>setShowBidSummary(true)}
              style={{background:'linear-gradient(135deg,#10B981,#059669)',border:'none',color:'#000',padding:'8px 18px',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:700}}>
              📋 Bid Summary & Print
            </button>
            {project.apm_project_id&&<button onClick={pushToSOV}
              style={{background:'linear-gradient(135deg,#3b82f6,#1d4ed8)',border:'none',color:'#fff',padding:'8px 18px',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:700}}>
              ⇒ Push to APM SOV
            </button>}
          </div>

          {/* Body — two columns */}
          <div style={{flex:1,overflow:'hidden',display:'flex',gap:0}}>

            {/* Left — Spreadsheet-style editable estimate */}
            <div style={{flex:1,overflowY:'auto',borderRight:`1px solid ${t.border}`,display:'flex',flexDirection:'column'}}>

              {/* Column headers */}
              <div style={{display:'grid',gridTemplateColumns:'28px 1fr 80px 56px 90px 90px 90px 28px',alignItems:'center',padding:'6px 8px',background:t.bg2,borderBottom:`2px solid ${t.border}`,position:'sticky',top:0,zIndex:2,flexShrink:0}}>
                <span/>
                <span style={{fontSize:9,fontWeight:700,color:t.text4,fontFamily:"'DM Mono',monospace",letterSpacing:0.8}}>DESCRIPTION</span>
                <span style={{fontSize:9,fontWeight:700,color:t.text4,fontFamily:"'DM Mono',monospace",textAlign:'right',letterSpacing:0.8}}>QTY</span>
                <span style={{fontSize:9,fontWeight:700,color:t.text4,fontFamily:"'DM Mono',monospace",textAlign:'center',letterSpacing:0.8}}>UNIT</span>
                <span style={{fontSize:9,fontWeight:700,color:t.text4,fontFamily:"'DM Mono',monospace",textAlign:'right',letterSpacing:0.8}}>UNIT COST</span>
                <span style={{fontSize:9,fontWeight:700,color:t.text4,fontFamily:"'DM Mono',monospace",textAlign:'right',letterSpacing:0.8}}>CATEGORY</span>
                <span style={{fontSize:9,fontWeight:700,color:t.text4,fontFamily:"'DM Mono',monospace",textAlign:'right',letterSpacing:0.8}}>TOTAL</span>
                <span/>
              </div>

              {allCatGroups.length===0&&(
                <div style={{textAlign:'center',padding:'60px 0',color:t.text4,fontSize:13,fontFamily:"'DM Mono',monospace",flex:1}}>
                  No takeoff items yet
                </div>
              )}

              {/* Rows — one per item, spreadsheet style */}
              {allCatGroups.map(cat=>{
                const pct=totalEst>0?Math.round(cat.subtotal/totalEst*100):0;
                return(
                  <div key={cat.id}>
                    {/* Category group header */}
                    <div style={{display:'grid',gridTemplateColumns:'28px 1fr 80px 56px 90px 90px 90px 28px',alignItems:'center',padding:'5px 8px',background:`${cat.color}10`,borderLeft:`3px solid ${cat.color}`,borderBottom:`1px solid ${cat.color}25`}}>
                      <span style={{fontSize:9,color:cat.color}}>{pct}%</span>
                      <span style={{fontSize:10,fontWeight:800,color:cat.color,letterSpacing:0.5}}>{cat.label.toUpperCase()}</span>
                      <span/><span/><span/>
                      <span/>
                      <span style={{fontSize:11,fontWeight:800,color:cat.color,fontFamily:"'DM Mono',monospace",textAlign:'right'}}>${cat.subtotal.toLocaleString()}</span>
                      <span/>
                    </div>

                    {cat.items.map((it,rowIdx)=>{
                      const cellKey = `${it.id}`;
                      const isSaving = estSaving===it.id;
                      // Shared cell style
                      const cellBase = {
                        background:'transparent',border:'none',outline:'none',
                        width:'100%',fontFamily:"'DM Mono',monospace",
                        fontSize:11,color:t.text,padding:'2px 4px',
                      };
                      const saveField = async (field, val) => {
                        const numVal = ['quantity','unit_cost'].includes(field) ? (parseFloat(val)||0) : val;
                        const patch = {[field]: numVal};
                        if(field==='quantity'||field==='unit_cost'){
                          const qty = field==='quantity' ? numVal : (it.quantity||0);
                          const uc  = field==='unit_cost' ? numVal : (it.unit_cost||0);
                          patch.total_cost = qty * uc;
                        }
                        setEstSaving(it.id);
                        await supabase.from('takeoff_items').update(patch).eq('id',it.id);
                        setItems(prev=>prev.map(i=>i.id===it.id?{...i,...patch}:i));
                        setEstSaving(null);
                      };
                      const typeIcon = {area:'⬡',linear:'━',count:'✕',manual:'✎'}[it.measurement_type]||'✎';
                      return(
                        <div key={it.id}
                          style={{display:'grid',gridTemplateColumns:'28px 1fr 80px 56px 90px 90px 90px 28px',alignItems:'center',
                            padding:'0 8px',minHeight:34,
                            borderBottom:`1px solid ${t.border}`,
                            background:estHover===it.id?`${cat.color}08`:'transparent',
                            transition:'background 0.1s'}}
                          onMouseEnter={()=>setEstHover(it.id)}
                          onMouseLeave={()=>setEstHover(null)}>

                          {/* Type icon */}
                          <span style={{fontSize:9,color:cat.color,textAlign:'center'}}>{typeIcon}</span>

                          {/* Description — editable */}
                          <input
                            defaultValue={it.description||''}
                            onBlur={e=>{ if(e.target.value!==it.description) saveField('description',e.target.value); }}
                            onKeyDown={e=>{ if(e.key==='Enter'||e.key==='Tab') e.target.blur(); }}
                            style={{...cellBase,cursor:'text'}}
                            title="Click to edit description"
                          />

                          {/* Qty — editable, right-align */}
                          <input type="number"
                            defaultValue={it.quantity||0}
                            onBlur={e=>{ if(parseFloat(e.target.value)!==(it.quantity||0)) saveField('quantity',e.target.value); }}
                            onKeyDown={e=>{ if(e.key==='Enter'||e.key==='Tab') e.target.blur(); }}
                            style={{...cellBase,textAlign:'right',cursor:'text',color:it.quantity>0?t.text:t.text4}}
                            title="Click to edit quantity"
                          />

                          {/* Unit — select */}
                          <select
                            defaultValue={it.unit||'SF'}
                            onChange={e=>saveField('unit',e.target.value)}
                            style={{...cellBase,textAlign:'center',cursor:'pointer',background:t.bg3,border:`1px solid ${t.border}`,borderRadius:3,padding:'2px'}}>
                            {['SF','LF','CY','EA','LS','TN','LB','HR'].map(u=><option key={u} value={u}>{u}</option>)}
                          </select>

                          {/* Unit cost — editable */}
                          <input type="number" step="0.01"
                            defaultValue={(it.unit_cost||0).toFixed(2)}
                            onBlur={e=>{ if(parseFloat(e.target.value)!==(it.unit_cost||0)) saveField('unit_cost',e.target.value); }}
                            onKeyDown={e=>{ if(e.key==='Enter'||e.key==='Tab') e.target.blur(); }}
                            style={{...cellBase,textAlign:'right',cursor:'text'}}
                            title="Click to edit unit cost"
                          />

                          {/* Category — select */}
                          <select
                            defaultValue={it.category||'other'}
                            onChange={e=>saveField('category',e.target.value)}
                            style={{...cellBase,cursor:'pointer',background:t.bg3,border:`1px solid ${t.border}`,borderRadius:3,padding:'2px',fontSize:9}}>
                            {TAKEOFF_CATS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
                          </select>

                          {/* Total — computed, not editable */}
                          <span style={{fontSize:11,fontWeight:700,color:it.total_cost>0?'#10B981':t.text4,fontFamily:"'DM Mono',monospace",textAlign:'right',paddingRight:4}}>
                            {isSaving?'…':'$'+(it.total_cost||0).toLocaleString()}
                          </span>

                          {/* Delete */}
                          <button onClick={async()=>{
                            if(!window.confirm('Delete '+it.description+'?')) return;
                            const {error}=await supabase.from('takeoff_items').delete().eq('id',it.id).select();
                            if(error){console.error('item delete error:',error);alert('Delete failed: '+error.message);return;}
                            setItems(prev=>prev.filter(i=>i.id!==it.id));
                          }} style={{background:'none',border:'none',color:t.text4,cursor:'pointer',fontSize:11,opacity:estHover===it.id?0.6:0,transition:'opacity 0.1s',padding:0,textAlign:'center'}}>✕</button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* Footer total row */}
              {allCatGroups.length>0&&(
                <div style={{display:'grid',gridTemplateColumns:'28px 1fr 80px 56px 90px 90px 90px 28px',alignItems:'center',padding:'8px 8px',borderTop:`2px solid ${t.border2}`,background:t.bg2,position:'sticky',bottom:0,flexShrink:0}}>
                  <span/><span style={{fontSize:10,fontWeight:700,color:t.text,fontFamily:"'DM Mono',monospace"}}>TOTAL DIRECT COST</span>
                  <span/><span/><span/><span/>
                  <span style={{fontSize:14,fontWeight:800,color:'#10B981',fontFamily:"'DM Mono',monospace",textAlign:'right'}}>${totalEst.toLocaleString()}</span>
                  <span/>
                </div>
              )}
            </div>

            {/* Right — Summary panel */}
            <div style={{width:300,flexShrink:0,overflowY:'auto',padding:'20px 20px',background:t.bg2}}>
              <div style={{fontSize:10,fontWeight:700,color:t.text4,fontFamily:"'DM Mono',monospace",letterSpacing:1,marginBottom:14}}>SUMMARY</div>

              {/* Totals card */}
              <div style={{background:t.bg3,borderRadius:8,padding:'14px 16px',marginBottom:14,border:`1px solid ${t.border}`}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                  <span style={{fontSize:10,color:t.text3,fontFamily:"'DM Mono',monospace"}}>DIRECT COST</span>
                  <span style={{fontSize:13,fontWeight:700,color:t.text,fontFamily:"'DM Mono',monospace"}}>${totalEst.toLocaleString()}</span>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                  <span style={{fontSize:10,color:t.text3,fontFamily:"'DM Mono',monospace"}}>OVERHEAD (12%)</span>
                  <span style={{fontSize:11,color:t.text3,fontFamily:"'DM Mono',monospace"}}>${Math.round(totalEst*GC_OVERHEAD).toLocaleString()}</span>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:10,paddingBottom:10,borderBottom:`1px solid ${t.border}`}}>
                  <span style={{fontSize:10,color:t.text3,fontFamily:"'DM Mono',monospace"}}>PROFIT (8%)</span>
                  <span style={{fontSize:11,color:t.text3,fontFamily:"'DM Mono',monospace"}}>${Math.round(totalEst*PROFIT).toLocaleString()}</span>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:11,fontWeight:800,color:t.text,fontFamily:"'DM Mono',monospace"}}>BID TOTAL</span>
                  <span style={{fontSize:18,fontWeight:800,color:'#10B981',fontFamily:"'DM Mono',monospace"}}>${Math.round(totalEst*(1+GC_OVERHEAD+PROFIT)).toLocaleString()}</span>
                </div>
              </div>

              {/* Contract variance */}
              {project.contract_value&&(
                <div style={{padding:'10px 14px',borderRadius:6,marginBottom:14,background:totalEst>(project.contract_value||0)?'rgba(239,68,68,0.08)':'rgba(16,185,129,0.08)',border:`1px solid ${totalEst>(project.contract_value||0)?'rgba(239,68,68,0.25)':'rgba(16,185,129,0.25)'}`}}>
                  <div style={{fontSize:9,color:t.text4,fontFamily:"'DM Mono',monospace",marginBottom:2}}>CONTRACT VALUE</div>
                  <div style={{fontSize:13,fontWeight:700,color:t.text,fontFamily:"'DM Mono',monospace",marginBottom:4}}>${Number(project.contract_value).toLocaleString()}</div>
                  <div style={{fontSize:10,fontWeight:700,color:totalEst>(project.contract_value||0)?'#EF4444':'#10B981',fontFamily:"'DM Mono',monospace"}}>
                    {totalEst>(project.contract_value||0)?'▲ OVER CONTRACT':'▼ UNDER CONTRACT'} BY ${Math.abs(totalEst-(project.contract_value||0)).toLocaleString()}
                  </div>
                </div>
              )}

              {/* Sheet breakdown */}
              {sheetBreakdown.length>0&&(
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:9,fontWeight:700,color:t.text4,fontFamily:"'DM Mono',monospace",letterSpacing:0.8,marginBottom:8}}>BY SHEET</div>
                  {sheetBreakdown.map(({plan:p,total:pTotal})=>(
                    <div key={p.id} style={{display:'flex',alignItems:'center',padding:'5px 8px',borderRadius:4,marginBottom:3,background:p.id===selPlan?.id?`rgba(16,185,129,0.08)`:'none',border:`1px solid ${p.id===selPlan?.id?'rgba(16,185,129,0.25)':t.border}`,cursor:'pointer'}}
                      onClick={()=>{setSelPlan(p);if(p.scale_px_per_ft)setScale(p.scale_px_per_ft);setRightTab('items');}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:9,fontWeight:600,color:t.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}</div>
                        <div style={{fontSize:8,color:t.text4,fontFamily:"'DM Mono',monospace"}}>{items.filter(i=>i.plan_id===p.id).length} conditions</div>
                      </div>
                      <span style={{fontSize:10,fontWeight:700,color:'#10B981',fontFamily:"'DM Mono',monospace",flexShrink:0}}>${pTotal.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        );
      })()}

      {/* Modals */}
      {editItem&&<TakeoffItemModal item={editItem} onSave={(data,type)=>{
        if(type==='delete'){setItems(prev=>prev.filter(i=>i.id!==editItem.id));}
        else if(type===true){setItems(prev=>[...prev.filter(i=>i.id!==data.id),data]);}
        else{setItems(prev=>prev.map(i=>i.id===data.id?data:i));}
        setEditItem(null);
      }} onClose={()=>setEditItem(null)}/>}
      {showAssembly&&<AssemblyPicker onApply={applyAssembly} onClose={()=>setShowAssembly(false)}/>}
      {showUnitCosts&&<UnitCostEditor onClose={()=>setShowUnitCosts(false)}/>}
      {showBidSummary&&<BidSummaryModal project={project} items={items} onClose={()=>setShowBidSummary(false)}/>}
      {editProject&&<TakeoffProjectModal project={project} apmProjects={apmProjects} onSave={async(data,type)=>{ if(type==='delete'){ const {error}=await supabase.rpc('delete_precon_project',{p_id:data.id}); if(error){console.error('delete_precon_project RPC error:',error);alert('Delete failed: '+error.message);} else{onBack();} } else if(data){ const {data:updated}=await supabase.from('precon_projects').update({name:data.name,company:data.company,address:data.address,gc_name:data.gc_name,bid_date:data.bid_date,contract_value:data.contract_value,status:data.status,apm_project_id:data.apm_project_id}).eq('id',data.id).select().single(); if(updated) onBack(); } else { onBack(); } setEditProject(false); }} onClose={()=>setEditProject(false)}/>}
    </div>
  );
}

// ── PreconSection (top-level) ─────────────────────────
function FCGEstimating({ onExit, deepLinkProjectId }) {
  const { t } = useTheme();
  const [estiPage, setEstiPage] = useState('projects'); // 'projects' | 'rates' | 'assemblies'
  const [projects, setProjects] = useState([]);
  const [apmProjects, setApmProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [selProject, setSelProject] = useState(null);
  const [newModal, setNewModal] = useState(false);
  const [filterCo, setFilterCo] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(()=>{
    Promise.all([
      supabase.from('precon_projects').select('*').order('created_at',{ascending:false}),
      supabase.from('projects').select('id,name,company,address,gc_name,contract_value').order('created_at',{ascending:false}),
    ]).then(([{data:pp},{data:ap}])=>{
      const allP = pp||[];
      setProjects(allP);
      setApmProjects(ap||[]);
      setLoadingProjects(false);
      // Deep link: restore project from URL hash
      if(deepLinkProjectId){
        const found = allP.find(p=>p.id===deepLinkProjectId);
        if(found){ setSelProject(found); window.location.hash='/estimate/'+found.id; }
      } else {
        window.location.hash='/estimate';
      }
    });
  },[]);

  // Write hash whenever selProject changes
  useEffect(()=>{
    if(selProject) window.location.hash='/estimate/'+selProject.id;
    else if(!loadingProjects) window.location.hash='/estimate';
  },[selProject]);

  // Global nav "+ New Bid" button fires this event
  useEffect(()=>{
    const handler=()=>setNewModal(true);
    window.addEventListener('fcg-new-bid', handler);
    return ()=>window.removeEventListener('fcg-new-bid', handler);
  },[]);

  const handleSave = async (data, type) => {
    if (type==='delete') {
      const {error}=await supabase.rpc('delete_precon_project',{p_id:data?.id});
      if(error){console.error('delete_precon_project RPC error:',error);alert('Delete failed: '+error.message);}
      else{setProjects(prev=>prev.filter(p=>p.id!==data?.id));}
      setNewModal(false); return;
    }
    if (type===true) { setProjects(prev=>[data,...prev]); }
    else { setProjects(prev=>prev.map(p=>p.id===data.id?data:p)); }
    setNewModal(false);
  };

  const filtered = projects.filter(p=>{
    const matchCo = filterCo==='all'||p.company===filterCo;
    const matchSt = filterStatus==='all'||p.status===filterStatus;
    return matchCo && matchSt;
  });

  const STATUS_COLORS_BID = {estimating:'#F59E0B',bid_submitted:'#3B82F6',awarded:'#10B981',lost:'#EF4444',hold:'#555'};
  const totalBidValue = filtered.reduce((s,p)=>s+(Number(p.contract_value)||0),0);
  const awardedVal = filtered.filter(p=>p.status==='awarded').reduce((s,p)=>s+(Number(p.contract_value)||0),0);

  const projectsView = selProject
    ? <TakeoffWorkspace project={selProject} onBack={()=>{ setSelProject(null); window.location.hash='/estimate'; }} apmProjects={apmProjects} onExitToOps={onExit}/>
    : (
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'}}>
      {/* Header */}
      <div style={{padding:'12px 20px',borderBottom:`1px solid ${t.border}`,background:t.bg2,flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
          <div>
            <div style={{fontSize:16,fontWeight:800,color:t.text,letterSpacing:-0.3}}>Precon / Estimating</div>
            <div style={{fontSize:10,color:t.text4,fontFamily:"'DM Mono',monospace"}}>TAKEOFF · BID MANAGEMENT · ESTIMATE BUILDER</div>
          </div>
          <button onClick={()=>setNewModal(true)} style={{background:'#F97316',border:'none',color:'#000',padding:'8px 16px',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:700}}>+ New Bid</button>
        </div>

        {/* Summary stats */}
        <div style={{display:'flex',gap:12,marginBottom:10,flexWrap:'wrap'}}>
          {[
            {label:'Total Bids',val:filtered.length,color:t.text2},
            {label:'Estimating',val:filtered.filter(p=>p.status==='estimating').length,color:'#F59E0B'},
            {label:'Submitted',val:filtered.filter(p=>p.status==='bid_submitted').length,color:'#3B82F6'},
            {label:'Awarded',val:filtered.filter(p=>p.status==='awarded').length,color:'#10B981'},
            {label:'Bid Volume',val:'$'+totalBidValue.toLocaleString(),color:t.text,isText:true},
            {label:'Awarded $',val:'$'+awardedVal.toLocaleString(),color:'#10B981',isText:true},
          ].map(s=>(
            <div key={s.label} style={{display:'flex',alignItems:'baseline',gap:5}}>
              <span style={{fontSize:s.isText?13:16,fontWeight:800,color:s.color,fontFamily:"'DM Mono',monospace"}}>{s.val}</span>
              <span style={{fontSize:9,color:t.text4,fontFamily:"'DM Mono',monospace",letterSpacing:0.5}}>{s.label.toUpperCase()}</span>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          {['all','estimating','bid_submitted','awarded','lost','hold'].map(s=>(
            <button key={s} onClick={()=>setFilterStatus(s)}
              style={{padding:'4px 10px',borderRadius:20,border:filterStatus===s?`1px solid ${STATUS_COLORS_BID[s]||'#F97316'}60`:'1px solid var(--bd)',background:filterStatus===s?(STATUS_COLORS_BID[s]||'#F97316')+'15':'var(--bg3)',color:filterStatus===s?(STATUS_COLORS_BID[s]||'#F97316'):'var(--tx3)',fontSize:10,fontWeight:700,cursor:'pointer',fontFamily:"'DM Mono',monospace",textTransform:'uppercase'}}>
              {s.replace(/_/g,' ')}
            </button>
          ))}
          <div style={{width:1,height:18,background:t.border,margin:'0 2px',alignSelf:'center'}}/>
          {COMPANIES.filter(c=>c.id!=='all').map(co=>(
            <button key={co.id} onClick={()=>setFilterCo(f=>f===co.id?'all':co.id)}
              style={{padding:'4px 10px',borderRadius:20,border:filterCo===co.id?`1px solid ${co.color}60`:'1px solid var(--bd)',background:filterCo===co.id?co.color+'15':'var(--bg3)',color:filterCo===co.id?co.color:'var(--tx3)',fontSize:10,fontWeight:700,cursor:'pointer',fontFamily:"'DM Mono',monospace"}}>
              {co.short}
            </button>
          ))}
        </div>
      </div>

      {/* Project grid */}
      <div style={{flex:1,overflowY:'auto',padding:20}}>
        {filtered.length===0&&(
          <div style={{textAlign:'center',padding:60}}>
            <div style={{fontSize:40,marginBottom:12}}>📐</div>
            <div style={{fontSize:15,fontWeight:700,color:t.text,marginBottom:6}}>No bids yet</div>
            <div style={{fontSize:12,color:t.text3,fontFamily:"'DM Mono',monospace",marginBottom:24}}>Create a new bid to start your takeoff and estimate</div>
            <button onClick={()=>setNewModal(true)} style={{background:'#F97316',border:'none',color:'#000',padding:'10px 24px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:700}}>+ New Bid</button>
          </div>
        )}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:14}}>
          {filtered.map(p=>{
            const co=COMPANIES.find(c=>c.id===p.company)||COMPANIES[1];
            const statusColor=STATUS_COLORS_BID[p.status]||'#555';
            const apmLinked=apmProjects.find(a=>a.id===p.apm_project_id);
            return(
              <div key={p.id} onClick={()=>setSelProject(p)}
                style={{background:t.bg2,border:`1px solid ${t.border}`,borderRadius:10,padding:16,cursor:'pointer',transition:'all 0.12s',position:'relative',overflow:'hidden'}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor='#F97316';e.currentTarget.style.transform='translateY(-1px)';}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=t.border;e.currentTarget.style.transform='translateY(0)';}}>
                <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${co.color},${co.color}88)`}}/>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8,marginBottom:8}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:t.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}</div>
                    <div style={{fontSize:10,color:t.text3,fontFamily:"'DM Mono',monospace",marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.address||p.gc_name||'No address'}</div>
                  </div>
                  <span style={{fontSize:9,padding:'3px 7px',borderRadius:8,background:statusColor+'20',color:statusColor,fontFamily:"'DM Mono',monospace",fontWeight:700,flexShrink:0,whiteSpace:'nowrap'}}>{(p.status||'').replace(/_/g,' ').toUpperCase()}</span>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:apmLinked?8:0}}>
                  <div>
                    {p.contract_value&&<div style={{fontSize:15,fontWeight:800,color:t.text,fontFamily:"'DM Mono',monospace"}}>${Number(p.contract_value).toLocaleString()}</div>}
                    {p.gc_name&&<div style={{fontSize:10,color:t.text4}}>GC: {p.gc_name}</div>}
                  </div>
                  <div style={{textAlign:'right'}}>
                    <CompanyBadge companyId={p.company} small/>
                    {p.bid_date&&<div style={{fontSize:9,color:p.bid_date<new Date().toISOString().slice(0,10)?'#EF4444':'#F59E0B',fontFamily:"'DM Mono',monospace",marginTop:3}}>📅 {fmtDate(p.bid_date)}</div>}
                  </div>
                </div>
                {apmLinked&&<div style={{fontSize:9,color:'#3B82F6',fontFamily:"'DM Mono',monospace",background:'rgba(59,130,246,0.08)',padding:'3px 8px',borderRadius:4,display:'inline-block'}}>↗ APM: {apmLinked.name}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {newModal&&<TakeoffProjectModal project={null} apmProjects={apmProjects} onSave={handleSave} onClose={()=>setNewModal(false)}/>}
    </div>
  );

  // When inside a project: full-screen workspace, no sidebar
  if(selProject) return(
    <TakeoffWorkspace
      project={selProject}
      onBack={()=>{ setSelProject(null); window.location.hash='/estimate'; }}
      apmProjects={apmProjects}
      onExitToOps={onExit}
    />
  );

  return (
    <div style={{display:'flex',height:'100%',width:'100%',background:'var(--bg)',fontFamily:"'Syne', sans-serif",overflow:'hidden'}}>

      {/* ── FCG Estimating Sidebar ── */}
      <div style={{width:200,flexShrink:0,background:'#0a0f0a',borderRight:'1px solid #1a2e1a',display:'flex',flexDirection:'column',overflow:'hidden'}}>

        {/* Logo */}
        <div style={{padding:'16px 14px 12px',borderBottom:'1px solid #1a2e1a'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:30,height:30,borderRadius:7,background:'linear-gradient(135deg,#10B981,#059669)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,flexShrink:0}}>📐</div>
            <div>
              <div style={{fontSize:12,fontWeight:800,color:'#e5e5e5',letterSpacing:-0.3}}>FCG Estimating</div>
              <div style={{fontSize:8,color:'#10B981',fontFamily:"'DM Mono',monospace",letterSpacing:0.5}}>TAKEOFF · BID · ESTIMATE</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <div style={{padding:'8px 6px',flex:1}}>
          {[
            {id:'projects',icon:'⊞',label:'Projects'},
            {id:'assemblies',icon:'⬡',label:'Assembly Library'},
            {id:'rates',icon:'$',label:'Unit Cost Rates'},
          ].map(item=>(
            <button key={item.id} onClick={()=>{ setEstiPage(item.id); }}
              style={{width:'100%',display:'flex',alignItems:'center',gap:9,padding:'7px 9px',borderRadius:5,cursor:'pointer',background:estiPage===item.id?'rgba(16,185,129,0.12)':'none',border:estiPage===item.id?'1px solid rgba(16,185,129,0.2)':'1px solid transparent',marginBottom:2,textAlign:'left'}}>
              <span style={{fontSize:13,color:estiPage===item.id?'#10B981':'#4a6a4a'}}>{item.icon}</span>
              <span style={{fontSize:11,fontWeight:600,color:estiPage===item.id?'#e5e5e5':'#6a8a6a'}}>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Stats */}
        <div style={{padding:'10px 12px',borderTop:'1px solid #1a2e1a'}}>
          {[
            {label:'Total Bids',val:projects.length},
            {label:'Estimating',val:projects.filter(p=>p.status==='estimating').length,color:'#F59E0B'},
            {label:'Awarded',val:projects.filter(p=>p.status==='awarded').length,color:'#10B981'},
          ].map(s=>(
            <div key={s.label} style={{display:'flex',justifyContent:'space-between',padding:'2px 0'}}>
              <span style={{fontSize:9,color:'#4a6a4a',fontFamily:"'DM Mono',monospace"}}>{s.label}</span>
              <span style={{fontSize:9,fontWeight:700,color:s.color||'#e5e5e5',fontFamily:"'DM Mono',monospace"}}>{s.val}</span>
            </div>
          ))}
        </div>

        {/* Back to OPS */}
        <div style={{padding:'8px 6px',borderTop:'1px solid #1a2e1a'}}>
          <button onClick={onExit} style={{width:'100%',padding:'6px 9px',borderRadius:5,border:'1px solid #1a2e1a',background:'none',color:'#4a6a4a',cursor:'pointer',fontSize:10,fontFamily:"'DM Mono',monospace",display:'flex',alignItems:'center',gap:6}}>
            ← Back to OPS Board
          </button>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
        {estiPage==='projects' && projectsView}
        {estiPage==='assemblies' && <div style={{padding:32}}><AssemblyPicker onApply={()=>{}} onClose={()=>setEstiPage('projects')}/></div>}
        {estiPage==='rates' && <div style={{padding:32}}><UnitCostEditor onClose={()=>setEstiPage('projects')}/></div>}
      </div>
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
  const [scheduleItems, setScheduleItems] = useState([]);
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
    { id:"schedule", label:"Schedule", count:scheduleItems.length },
    { id:"logs", label:"Daily Logs", count:logs.length },
    { id:"rfis", label:"RFIs", count:rfis.length },
    { id:"submittals", label:"Submittals", count:submittals.length },
    { id:"cos", label:"Change Orders", count:cos.length },
    { id:"materials", label:"Materials", count:materials.length },
    { id:"subcontracts", label:"Subcontracts", count:subcontracts.length },
    { id:"payapps", label:"Pay Apps", count:payApps.length },
    { id:"financials", label:"Financials", count:receipts.length },
  ];

  const rowStyle = { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"11px 14px", borderRadius:7, background:"var(--bg3)", border:"1px solid #1a1a1a", marginBottom:5, cursor:"pointer", gap:10 };

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
          <button onClick={onBack} style={{ background:"none", border:"none", color:"var(--tx3)", cursor:"pointer", fontSize:14, padding:"4px 8px 4px 0" }}>← Back</button>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
              <span style={{ fontSize:16, fontWeight:700, color:"var(--tx)", fontFamily:"'Syne',sans-serif" }}>{project.name}</span>
              <StatusBadge status={project.status} />
              <span style={{ fontSize:11, color:co.color, fontFamily:"'DM Mono',monospace", background:co.color+"15", border:`1px solid ${co.color}30`, padding:"1px 6px", borderRadius:4 }}>{co.short}</span>
            </div>
            {project.address && <div style={{ fontSize:11, color:"var(--tx4)", fontFamily:"'DM Mono',monospace", marginTop:2 }}>{project.address}</div>}
          </div>
          <button onClick={onEdit} style={{ background:"var(--bd)", border:"1px solid var(--bd2)", color:"var(--tx2)", padding:"6px 12px", borderRadius:6, cursor:"pointer", fontSize:12 }}>Edit</button>
        </div>
        {/* Summary strip */}
        <div style={{ display:"flex", gap:16, marginBottom:12, flexWrap:"wrap" }}>
          {project.contract_value && <div style={{ fontSize:11, color:"var(--tx)", fontFamily:"'DM Mono',monospace" }}>Contract: <span style={{ color:"var(--tx)" }}>{fmtMoney(project.contract_value)}</span></div>}
          {approvedCOs > 0 && <div style={{ fontSize:11, color:"var(--tx)", fontFamily:"'DM Mono',monospace" }}>Approved COs: <span style={{ color:"#10B981" }}>+{fmtMoney(approvedCOs)}</span></div>}
          {pendingCOs > 0 && <div style={{ fontSize:11, color:"var(--tx)", fontFamily:"'DM Mono',monospace" }}>Pending COs: <span style={{ color:"#F59E0B" }}>{fmtMoney(pendingCOs)}</span></div>}
          {totalMaterials > 0 && <div style={{ fontSize:11, color:"var(--tx)", fontFamily:"'DM Mono',monospace" }}>Materials: <span style={{ color:"var(--tx)" }}>{fmtMoney(totalMaterials)}</span></div>}
          {project.gc_name && <div style={{ fontSize:11, color:"var(--tx)", fontFamily:"'DM Mono',monospace" }}>GC: <span style={{ color:"var(--tx)" }}>{project.gc_name}</span></div>}
        </div>
        {/* Tabs */}
        <div style={{ display:"flex", gap:0, overflowX:"auto" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={()=>setTab(t.id)} style={{ padding:"8px 14px", background:"none", border:"none", borderBottom:tab===t.id?"2px solid #F97316":"2px solid transparent", color:tab===t.id?"var(--tx)":"var(--tx3)", cursor:"pointer", fontSize:12, fontFamily:"'DM Mono',monospace", whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:5 }}>
              {t.label} {t.count > 0 && <span style={{ background:"var(--bg5)", color:"var(--tx3)", borderRadius:8, padding:"0 5px", fontSize:10 }}>{t.count}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ flex:1, overflowY:"auto", padding:"16px 20px 80px" }}>
        {loading ? <div style={{ textAlign:"center", padding:40, color:"#333", fontFamily:"'DM Mono',monospace", fontSize:12 }}>Loading...</div> : (
          <>
            {/* Add button */}
            {tab !== "financials" && tab !== "subcontracts" && tab !== "payapps" && tab !== "schedule" && <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:12 }}>
              <button onClick={()=>setModal({type:tab,item:null})} style={{ background:"#F97316", border:"none", color:"#000", padding:"7px 16px", borderRadius:6, cursor:"pointer", fontSize:12, fontWeight:700 }}>
                {tab==="financials" ? null : ("+ Add " + (tab==="logs"?"Log":tab==="rfis"?"RFI":tab==="submittals"?"Submittal":tab==="cos"?"Change Order":"Order"))}
              </button>
            </div>}

            {/* Daily Logs */}
            {tab==="logs" && logs.map(log => (
              <div key={log.id} onClick={()=>setModal({type:"logs",item:log})} style={rowStyle}
                onMouseEnter={e=>e.currentTarget.style.borderColor="var(--bd2)"}
                onMouseLeave={e=>e.currentTarget.style.borderColor="var(--bg5)"}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                    <span style={{ fontSize:12, fontWeight:600, color:"var(--tx)", fontFamily:"'DM Mono',monospace" }}>{fmtDate(log.log_date)}</span>
                    {log.weather && <span style={{ fontSize:11, color:"var(--tx3)" }}>{log.weather}</span>}
                    {log.crew_count && <span style={{ fontSize:11, color:"var(--tx)", fontFamily:"'DM Mono',monospace" }}>👷 {log.crew_count}</span>}
                  </div>
                  <div style={{ fontSize:12, color:"var(--tx2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{log.work_performed||"No description"}</div>
                  {log.issues && <div style={{ fontSize:11, color:"#F59E0B", marginTop:3 }}>⚠ {log.issues}</div>}
                </div>
                <span style={{ color:"#333", fontSize:16 }}>›</span>
              </div>
            ))}
            {tab==="logs" && logs.length===0 && <div style={{ textAlign:"center", padding:40, color:"#333", fontFamily:"'DM Mono',monospace", fontSize:12 }}>No logs yet</div>}

            {/* RFIs */}
            {tab==="rfis" && rfis.map(r => (
              <div key={r.id} onClick={()=>setModal({type:"rfis",item:r})} style={rowStyle}
                onMouseEnter={e=>e.currentTarget.style.borderColor="var(--bd2)"}
                onMouseLeave={e=>e.currentTarget.style.borderColor="var(--bg5)"}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                    {r.rfi_number && <span style={{ fontSize:10, color:"var(--tx)", fontFamily:"'DM Mono',monospace" }}>{r.rfi_number}</span>}
                    <span style={{ fontSize:13, color:"var(--tx)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.subject}</span>
                  </div>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <StatusBadge status={r.status} />
                    {r.sent_to && <span style={{ fontSize:11, color:"var(--tx3)" }}>{r.sent_to}</span>}
                    {r.date_due && <span style={{ fontSize:10, color:"var(--tx4)", fontFamily:"'DM Mono',monospace" }}>Due {fmtDate(r.date_due)}</span>}
                  </div>
                </div>
                <span style={{ color:"#333", fontSize:16 }}>›</span>
              </div>
            ))}
            {tab==="rfis" && rfis.length===0 && <div style={{ textAlign:"center", padding:40, color:"#333", fontFamily:"'DM Mono',monospace", fontSize:12 }}>No RFIs yet</div>}

            {/* Submittals */}
            {tab==="submittals" && submittals.map(s => (
              <div key={s.id} onClick={()=>setModal({type:"submittals",item:s})} style={rowStyle}
                onMouseEnter={e=>e.currentTarget.style.borderColor="var(--bd2)"}
                onMouseLeave={e=>e.currentTarget.style.borderColor="var(--bg5)"}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                    {s.submittal_number && <span style={{ fontSize:10, color:"var(--tx)", fontFamily:"'DM Mono',monospace" }}>{s.submittal_number}</span>}
                    <span style={{ fontSize:13, color:"var(--tx)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.description}</span>
                  </div>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <StatusBadge status={s.status} />
                    {s.sent_to && <span style={{ fontSize:11, color:"var(--tx3)" }}>{s.sent_to}</span>}
                    {s.date_due && <span style={{ fontSize:10, color:"var(--tx4)", fontFamily:"'DM Mono',monospace" }}>Due {fmtDate(s.date_due)}</span>}
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
                      <div style={{ fontSize:9, color:"var(--tx)", fontFamily:"'DM Mono',monospace", letterSpacing:0.8 }}>APPROVED</div>
                    </div>
                    <div style={{ background:"#1a1208", border:"1px solid #F59E0B30", borderRadius:8, padding:"8px 14px" }}>
                      <div style={{ fontSize:16, fontWeight:700, color:"#F59E0B", fontFamily:"'DM Mono',monospace" }}>{fmtMoney(pendingCOs)}</div>
                      <div style={{ fontSize:9, color:"var(--tx)", fontFamily:"'DM Mono',monospace", letterSpacing:0.8 }}>PENDING</div>
                    </div>
                  </div>
                )}
                {cos.map(c => (
                  <div key={c.id} onClick={()=>setModal({type:"cos",item:c})} style={rowStyle}
                    onMouseEnter={e=>e.currentTarget.style.borderColor="var(--bd2)"}
                    onMouseLeave={e=>e.currentTarget.style.borderColor="var(--bg5)"}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                        {c.co_number && <span style={{ fontSize:10, color:"var(--tx)", fontFamily:"'DM Mono',monospace" }}>{c.co_number}</span>}
                        <span style={{ fontSize:13, color:"var(--tx)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.description}</span>
                      </div>
                      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                        <StatusBadge status={c.status} />
                        {c.amount && <span style={{ fontSize:12, color:"var(--tx)", fontFamily:"'DM Mono',monospace", fontWeight:600 }}>{fmtMoney(c.amount)}</span>}
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
                  <div style={{ background:"var(--bg3)", border:"1px solid #1e1e1e", borderRadius:8, padding:"10px 14px", marginBottom:14, display:"flex", gap:20, flexWrap:"wrap" }}>
                    <div><span style={{ fontSize:10, color:"var(--tx)", fontFamily:"'DM Mono',monospace" }}>TOTAL ORDERED </span><span style={{ fontSize:14, fontWeight:700, color:"var(--tx)", fontFamily:"'DM Mono',monospace" }}>{fmtMoney(totalMaterials)}</span></div>
                    <div><span style={{ fontSize:10, color:"var(--tx)", fontFamily:"'DM Mono',monospace" }}>PENDING </span><span style={{ fontSize:14, fontWeight:700, color:"#F59E0B", fontFamily:"'DM Mono',monospace" }}>{materials.filter(m=>m.status==="pending").length}</span></div>
                    <div><span style={{ fontSize:10, color:"var(--tx)", fontFamily:"'DM Mono',monospace" }}>DELIVERED </span><span style={{ fontSize:14, fontWeight:700, color:"#10B981", fontFamily:"'DM Mono',monospace" }}>{materials.filter(m=>m.status==="delivered").length}</span></div>
                  </div>
                )}
                {materials.map(m => (
                  <div key={m.id} onClick={()=>setModal({type:"materials",item:m})} style={rowStyle}
                    onMouseEnter={e=>e.currentTarget.style.borderColor="var(--bd2)"}
                    onMouseLeave={e=>e.currentTarget.style.borderColor="var(--bg5)"}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                        <span style={{ fontSize:13, color:"var(--tx)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{m.item}</span>
                        {m.quantity && <span style={{ fontSize:11, color:"var(--tx3)", flexShrink:0 }}>{m.quantity}</span>}
                      </div>
                      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                        <StatusBadge status={m.status} />
                        {m.supplier && <span style={{ fontSize:11, color:"var(--tx3)" }}>{m.supplier}</span>}
                        {m.total_cost && <span style={{ fontSize:11, color:"var(--tx)", fontFamily:"'DM Mono',monospace" }}>{fmtMoney(m.total_cost)}</span>}
                        {m.eta && <span style={{ fontSize:10, color:"var(--tx4)", fontFamily:"'DM Mono',monospace" }}>ETA {fmtDate(m.eta)}</span>}
                      </div>
                    </div>
                    <span style={{ color:"#333", fontSize:16 }}>›</span>
                  </div>
                ))}
                {materials.length===0 && <div style={{ textAlign:"center", padding:40, color:"#333", fontFamily:"'DM Mono',monospace", fontSize:12 }}>No material orders yet</div>}
              </>
            )}

            {/* Financials */}
            {tab==="schedule" && <ScheduleTab project={project} />}
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
    if (isNew === "delete") {
      setProjects(prev => prev.filter(p=>p.id!==editingProject?.id));
      setEditingProject(null);
      setSelectedProject(null);
      return;
    }
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
          <button onClick={()=>setFilterStatus("active")} style={{ padding:"5px 12px", borderRadius:20, border:filterStatus==="active"?"1px solid #10B98160":"1px solid #2a2a2a", background:filterStatus==="active"?"#10B98115":"var(--bg3)", color:filterStatus==="active"?"#10B981":"var(--tx3)", fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"'DM Mono',monospace" }}>Active</button>
          <button onClick={()=>setFilterStatus("all")} style={{ padding:"5px 12px", borderRadius:20, border:filterStatus==="all"?"1px solid #F9731660":"1px solid #2a2a2a", background:filterStatus==="all"?"#F9731615":"var(--bg3)", color:filterStatus==="all"?"#F97316":"var(--tx3)", fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"'DM Mono',monospace" }}>All</button>
          {COMPANIES.filter(c=>c.id!=="all").map(co => (
            <button key={co.id} onClick={()=>setFilterCo(f=>f===co.id?"all":co.id)} style={{ padding:"5px 12px", borderRadius:20, border:filterCo===co.id?`1px solid ${co.color}60`:"1px solid #2a2a2a", background:filterCo===co.id?co.color+"15":"var(--bg3)", color:filterCo===co.id?co.color:"var(--tx3)", fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"'DM Mono',monospace" }}>{co.short}</button>
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
                style={{ background:"var(--bg3)", border:"1px solid #1a1a1a", borderRadius:10, padding:"14px 16px", marginBottom:8, cursor:"pointer", transition:"border-color 0.1s" }}
                onMouseEnter={e=>e.currentTarget.style.borderColor="var(--bd2)"}
                onMouseLeave={e=>e.currentTarget.style.borderColor="var(--bg5)"}>
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:10 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5, flexWrap:"wrap" }}>
                      <span style={{ fontSize:14, fontWeight:700, color:"var(--tx)", fontFamily:"'Syne',sans-serif" }}>{proj.name}</span>
                      <StatusBadge status={proj.status} />
                      <span style={{ fontSize:10, color:co.color, fontFamily:"'DM Mono',monospace", background:co.color+"15", border:`1px solid ${co.color}30`, padding:"1px 6px", borderRadius:4 }}>{co.short}</span>
                    </div>
                    <div style={{ display:"flex", gap:14, flexWrap:"wrap" }}>
                      {proj.address && <span style={{ fontSize:11, color:"var(--tx4)", fontFamily:"'DM Mono',monospace" }}>📍 {proj.address}</span>}
                      {proj.gc_name && <span style={{ fontSize:11, color:"var(--tx4)", fontFamily:"'DM Mono',monospace" }}>🏢 {proj.gc_name}</span>}
                      {proj.contract_value && <span style={{ fontSize:11, color:"var(--tx)", fontFamily:"'DM Mono',monospace" }}>{fmtMoney(proj.contract_value)}</span>}
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
    <div style={{ minHeight: "100dvh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Syne', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap'); *{box-sizing:border-box;margin:0;padding:0} @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.35}}`}</style>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 40, justifyContent: "center" }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "linear-gradient(135deg, #F97316, #ea580c)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⬡</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--tx)", letterSpacing: -0.3 }}>FCG / BR OPS</div>
            <div style={{ fontSize: 10, color: "var(--tx4)", fontFamily: "'DM Mono', monospace", letterSpacing: 1 }}>OPERATIONS BOARD</div>
          </div>
        </div>
        <div style={{ background: "var(--bg3)", border: "1px solid #1e1e1e", borderRadius: 14, padding: 28, boxShadow: "0 24px 80px rgba(0,0,0,0.5)" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--tx)", marginBottom: 4 }}>Sign in</div>
          <div style={{ fontSize: 11.5, color: "var(--tx4)", fontFamily: "'DM Mono', monospace", marginBottom: 24 }}>Use your work email and password</div>
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

function ThemeToggle() {
  const { dark, toggle } = useTheme();
  return (
    <button onClick={toggle} title={dark ? "Switch to light mode" : "Switch to dark mode"}
      style={{ background:"none", border:"1px solid var(--bd2)", borderRadius:6, padding:"5px 9px", cursor:"pointer", fontSize:14, color: dark ? "var(--tx)" : "#18181b", lineHeight:1, flexShrink:0 }}>
      {dark ? "☀" : "☾"}
    </button>
  );
}

function AppInner() {
  const { dark, t } = useTheme();
  const isMobile = useIsMobile();
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  // ── URL hash routing ──────────────────────────────────────────────────────
  const parseHash = () => {
    const h = window.location.hash.replace('#','');
    if(h.startsWith('/estimate/')) return {section:'precon', projectId: parseInt(h.split('/')[2])||null};
    if(h === '/estimate') return {section:'precon', projectId:null};
    if(h === '/apm') return {section:'apm', projectId:null};
    return {section:'ops', projectId:null};
  };
  const initHash = parseHash();
  const [appSection, setAppSection] = useState(initHash.section); // "ops" | "apm" | "precon"
  const [deepLinkProjectId] = useState(initHash.projectId); // used by FCGEstimating on mount
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

  // Sync hash → appSection
  useEffect(()=>{
    if(appSection==='precon') return; // FCGEstimating manages sub-hash itself
    window.location.hash = appSection==='apm' ? '/apm' : '/ops';
  },[appSection]);

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
  if (authLoading) return <div style={{ minHeight: "100dvh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", color: "#333", fontFamily: "monospace" }}>◌</div>;
  if (!user) return <LoginScreen />;

  // Note: precon no longer does full-screen takeover — lives in tab shell below

  if (isMobile) {
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
          body { background: var(--bg); color: var(--tx); }
          input, textarea, select { color: var(--inptx) !important; background: var(--inp) !important; border-color: var(--inpbd) !important; }
          input::placeholder, textarea::placeholder { color: var(--tx4) !important; }
          ::-webkit-scrollbar { width: 6px; height: 6px; }
          ::-webkit-scrollbar-track { background: var(--bg); }
          ::-webkit-scrollbar-thumb { background: var(--bd2); border-radius: 3px; }
          ::-webkit-scrollbar-thumb:hover { background: var(--tx3); }
          ::-webkit-scrollbar { width: 0; }
          select option { background: var(--bg3); color: var(--tx); }
          @keyframes spin { from{transform:rotate(0deg)}to{transform:rotate(360deg)} }
        `}</style>

        <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "var(--bg)", fontFamily: "'Syne', sans-serif" }}>

          {/* Mobile Header */}
          <div style={{ display: "flex", alignItems: "center", padding: "7px 12px", borderBottom: "1px solid var(--bd)", background: "var(--bg2)", gap: 8, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
              <div style={{ width: 24, height: 24, borderRadius: 5, background: "linear-gradient(135deg, #F97316, #ea580c)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>⬡</div>
              <div style={{ display: "flex", background: "var(--bg5)", borderRadius: 6, overflow: "hidden", border: "1px solid var(--bd2)" }}>
                <button onClick={() => setAppSection("ops")} style={{ padding: "4px 10px", background: appSection === "ops" ? "#F9731620" : "none", border: "none", color: appSection === "ops" ? "#F97316" : "var(--tx3)", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono', monospace" }}>OPS</button>
                <button onClick={() => setAppSection("apm")} style={{ padding: "4px 10px", background: appSection === "apm" ? "#3B82F620" : "none", border: "none", color: appSection === "apm" ? "#3B82F6" : "var(--tx3)", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono', monospace" }}>APM</button>
                <button onClick={() => setAppSection("precon")} style={{ padding: "4px 10px", background: appSection === "precon" ? "#10B98120" : "none", border: "none", color: appSection === "precon" ? "#10B981" : "var(--tx3)", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono', monospace" }}>ESTIMATE</button>
              </div>
            </div>
            {appSection === "ops" && <button onClick={() => setAiOpen(true)} style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)", border: "none", color: "#fff", padding: "6px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>✦ AI</button>}
            {appSection === "ops" && <button onClick={openNew} style={{ background: "#F97316", border: "none", color: "#000", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>+ Task</button>}
          </div>

          {/* Company filter pills */}
          <div style={{ display: "flex", gap: 8, padding: "10px 16px", overflowX: "auto", borderBottom: "1px solid var(--bd)", flexShrink: 0 }}>
            {COMPANIES.map(co => {
              const active = activeCompany === co.id;
              return (
                <button key={co.id} onClick={() => setActiveCompany(co.id)} style={{ padding: "5px 12px", borderRadius: 20, border: active ? `1px solid ${co.color}60` : "1px solid #2a2a2a", background: active ? co.color + "15" : "var(--bg3)", color: active ? co.color : "var(--tx3)", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'DM Mono', monospace" }}>
                  {co.id === "all" ? "All" : co.short}
                </button>
              );
            })}
          </div>

          {/* My Tasks toggle + Project filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderBottom: "1px solid #1a1a1a", overflowX: "auto", flexShrink: 0 }}>
            <button onClick={() => setMyTasksOnly(m => !m)} style={{ padding: "4px 10px", borderRadius: 20, border: myTasksOnly ? "1px solid #F97316" : "1px solid #2a2a2a", background: myTasksOnly ? "#F9731615" : "var(--bg3)", color: myTasksOnly ? "#F97316" : "var(--tx3)", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>
              👤 Mine
            </button>
            {[...new Set(tasks.map(t => t.project).filter(Boolean))].map(p => (
              <button key={p} onClick={() => setActiveProject(ap => ap === p ? "all" : p)} style={{ padding: "4px 10px", borderRadius: 20, border: activeProject === p ? "1px solid #8B5CF6" : "1px solid #2a2a2a", background: activeProject === p ? "#8B5CF615" : "var(--bg3)", color: activeProject === p ? "#8B5CF6" : "var(--tx3)", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>
                {p}
              </button>
            ))}
          </div>

          {/* Stats strip */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--bd)", flexShrink: 0 }}>
            {[
              { label: "Total", val: stats.total, color: "var(--tx3)" },
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
          <div style={{ display: "flex", borderTop: "1px solid var(--bd)", background: "var(--bg2)", flexShrink: 0 }}>
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
                <span style={{ fontSize: 18, color: page === nav.id ? "#F97316" : "var(--tx4)" }}>{nav.icon}</span>
                <span style={{ fontSize: 9.5, fontFamily: "'DM Mono', monospace", color: page === nav.id ? "#F97316" : "#333", letterSpacing: 0.5 }}>{nav.label.toUpperCase()}</span>
              </button>
            ))}
          </div>

          {editTask !== null && <TaskModal task={editTask} isNew={isNew} onClose={closeModal} onSave={handleSave} onDelete={handleDelete} team={team} allProjects={allProjects} />}
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
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Inter:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: var(--bg); }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: var(--bg3); }
        ::-webkit-scrollbar-thumb { background: var(--bd2); border-radius: 2px; }
        select option { background: var(--bg3); color: var(--tx); }
        @keyframes slideIn { from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)} }
        @keyframes spin { from{transform:rotate(0deg)}to{transform:rotate(360deg)} }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
      `}</style>

      {ghostTask && ghostPos && <DragGhost task={ghostTask} pos={ghostPos} team={team} />}

      <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--bg)", fontFamily: "'Inter', 'Syne', sans-serif", overflow: "hidden", cursor: draggingId ? "grabbing" : "default" }}>

        {/* ── Global Top Nav ── */}
        <div style={{ display: "flex", alignItems: "stretch", height: 44, borderBottom: "1px solid var(--bd)", background: "var(--bg2)", flexShrink: 0, zIndex: 50 }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 18px", borderRight: "1px solid var(--bd)", flexShrink: 0 }}>
            <div style={{ width: 22, height: 22, borderRadius: 5, background: "linear-gradient(135deg, #F97316, #ea580c)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>⬡</div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--tx)", letterSpacing: -0.3, whiteSpace: "nowrap" }}>FCG / BR OPS</span>
          </div>

          {/* Main nav tabs */}
          <div style={{ display: "flex", alignItems: "stretch", flex: 1 }}>
            {[
              { id: "ops",    label: "Ops Board",  icon: "⊞", color: "#F97316" },
              { id: "apm",    label: "PM View",    icon: "◈", color: "#3B82F6" },
              { id: "precon", label: "Estimating", icon: "📐", color: "#10B981" },
            ].map(tab => {
              const isActive = appSection === tab.id;
              return (
                <button key={tab.id} onClick={() => setAppSection(tab.id)}
                  style={{ display: "flex", alignItems: "center", gap: 7, padding: "0 20px",
                    border: "none", background: "none", cursor: "pointer",
                    color: isActive ? tab.color : "var(--tx3)",
                    borderBottom: isActive ? `2px solid ${tab.color}` : "2px solid transparent",
                    fontSize: 13, fontWeight: isActive ? 600 : 400,
                    boxSizing: "border-box", transition: "all 0.12s", whiteSpace: "nowrap" }}>
                  <span style={{ fontSize: 14 }}>{tab.icon}</span>
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Right side: search (ops only) + actions + theme */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 14px", borderLeft: "1px solid var(--bd)" }}>
            {appSection === "ops" && page === "tasks" && (
              <>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--tx4)", fontSize: 12 }}>⌕</span>
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks…"
                    style={{ background: "var(--bg3)", border: "1px solid var(--bd)", borderRadius: 6,
                      padding: "5px 10px 5px 26px", color: "var(--tx)", fontSize: 12, outline: "none", width: 170 }} />
                </div>
                <div style={{ display: "flex", background: "var(--bg3)", border: "1px solid var(--bd)", borderRadius: 5, overflow: "hidden" }}>
                  {[["kanban","⊞"],["list","≡"]].map(([v, icon]) => (
                    <button key={v} onClick={() => setView(v)}
                      style={{ padding: "5px 10px", background: view === v ? "var(--bg5)" : "none",
                        border: "none", cursor: "pointer", color: view === v ? "var(--tx)" : "var(--tx4)", fontSize: 14 }}>{icon}</button>
                  ))}
                </div>
                <button onClick={() => setAiOpen(true)}
                  style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", border: "none", color: "#fff",
                    padding: "5px 12px", borderRadius: 5, cursor: "pointer", fontSize: 12, fontWeight: 700,
                    display: "flex", alignItems: "center", gap: 4 }}>
                  ✦ AI
                </button>
                <button onClick={openNew}
                  style={{ background: "#F97316", border: "none", color: "#fff",
                    padding: "5px 14px", borderRadius: 5, cursor: "pointer", fontSize: 12, fontWeight: 700,
                    display: "flex", alignItems: "center", gap: 4 }}>
                  + New Task
                </button>
              </>
            )}
            {appSection === "precon" && (
              <button onClick={()=>{
                // bubble up to FCGEstimating's newModal — dispatch a custom event
                window.dispatchEvent(new CustomEvent('fcg-new-bid'));
              }}
                style={{ background: "#10B981", border: "none", color: "#fff",
                  padding: "5px 14px", borderRadius: 5, cursor: "pointer", fontSize: 12, fontWeight: 700,
                  display: "flex", alignItems: "center", gap: 4 }}>
                + New Bid
              </button>
            )}
            <ThemeToggle />
            <button onClick={handleSignOut} title="Sign out"
              style={{ background: "none", border: "1px solid var(--bd)", borderRadius: 5, padding: "5px 8px",
                color: "var(--tx4)", cursor: "pointer", fontSize: 12 }}>⏻</button>
          </div>
        </div>

        {/* ── Content Area (below nav) ── */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

          {/* OPS BOARD */}
          {appSection === "ops" && (
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
              {/* Sidebar */}
              <div style={{ width: sidebarOpen ? 220 : 0, minWidth: sidebarOpen ? 220 : 0, background: "var(--bg2)", borderRight: "1px solid var(--bd)", display: "flex", flexDirection: "column", overflow: "hidden", transition: "width 0.2s, min-width 0.2s", flexShrink: 0 }}>
                <div style={{ padding: "12px 14px 10px", borderBottom: "1px solid var(--bd)" }}>
                  <div style={{ display: "flex", background: "var(--bg4)", borderRadius: 5, overflow: "hidden", border: "1px solid var(--bd2)", marginBottom: 10 }}>
                    {[["tasks","Tasks"],["settings","Settings"]].map(([id,lbl]) => (
                      <button key={id} onClick={() => setPage(id)}
                        style={{ flex: 1, padding: "5px 0", background: page===id?"var(--bg5)":"none", border: "none",
                          color: page===id?"var(--tx)":"var(--tx4)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ padding: "10px 14px", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
                  {page === "tasks" && (
                    <>
                      <div style={{ fontSize: 9, color: "var(--tx4)", letterSpacing: 1, fontFamily: "'DM Mono',monospace", marginBottom: 6 }}>COMPANIES</div>
                      {COMPANIES.map(co => {
                        const count = co.id === "all" ? tasks.length : tasks.filter(t => t.company === co.id).length;
                        const active = activeCompany === co.id;
                        return (
                          <button key={co.id} onClick={() => setActiveCompany(co.id)}
                            style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "6px 8px",
                              borderRadius: 5, cursor: "pointer", background: active ? co.color+"12" : "none",
                              border: active ? `1px solid ${co.color}25` : "1px solid transparent", marginBottom: 2, textAlign: "left" }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: co.id==="all"?"#F97316":co.color, flexShrink: 0, opacity: active?1:0.4 }}/>
                            <span style={{ fontSize: 12, color: active?"var(--tx)":"var(--tx3)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{co.id==="all"?"All Companies":co.name}</span>
                            <span style={{ fontSize: 10, fontFamily: "'DM Mono',monospace", color: active?co.color:"var(--tx4)" }}>{count}</span>
                          </button>
                        );
                      })}
                      <div style={{ fontSize: 9, color: "var(--tx4)", letterSpacing: 1, fontFamily: "'DM Mono',monospace", marginBottom: 6, marginTop: 14 }}>TEAM</div>
                      {team.map(m => (
                        <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", marginBottom: 2 }}>
                          <Avatar member={m} size={20} />
                          <span style={{ fontSize: 12, color: "var(--tx3)" }}>{m.name}</span>
                          <span style={{ fontSize: 10, color: "var(--tx4)", marginLeft: "auto", fontFamily: "'DM Mono',monospace" }}>{tasks.filter(t=>t.assignee===m.id&&t.status!=="done").length}</span>
                        </div>
                      ))}
                    </>
                  )}
                  <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid var(--bd)" }}>
                    <button onClick={() => setDigestOpen(true)}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                        borderRadius: 5, cursor: "pointer", background: "none", border: "1px solid var(--bd)",
                        color: "#10B981", fontSize: 12, fontWeight: 600 }}>
                      ✉ Send Digest
                    </button>
                  </div>
                </div>
              </div>

              {/* Main ops area */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {/* Sub-topbar: sidebar toggle + stats */}
                <div style={{ display: "flex", alignItems: "center", gap: 0, borderBottom: "1px solid var(--bd)", background: "var(--bg2)", flexShrink: 0 }}>
                  <button onClick={() => setSidebarOpen(s => !s)}
                    style={{ background: "none", border: "none", borderRight: "1px solid var(--bd)", cursor: "pointer",
                      color: "var(--tx4)", fontSize: 15, padding: "0 14px", height: 40, display: "flex", alignItems: "center" }}>☰</button>
                  {appSection === "ops" && page === "tasks" && activeCompany !== "all" && (
                    <div style={{ padding: "0 14px", borderRight: "1px solid var(--bd)", height: "100%", display: "flex", alignItems: "center" }}>
                      <CompanyBadge companyId={activeCompany} />
                    </div>
                  )}
                  {page === "tasks" && (
                    <>
                      {[
                        { label: "Total", val: stats.total, color: "var(--tx3)" },
                        { label: "In Progress", val: stats.inprogress, color: "#F59E0B" },
                        { label: "Overdue", val: stats.overdue, color: "#EF4444" },
                        { label: "Done", val: stats.done, color: "#10B981" },
                      ].map((s, i) => (
                        <div key={i} style={{ padding: "0 18px", borderRight: "1px solid var(--bd)", height: 40, display: "flex", alignItems: "center", gap: 7 }}>
                          <span style={{ fontSize: 18, fontWeight: 800, color: s.color, fontFamily: "'DM Mono',monospace" }}>{s.val}</span>
                          <span style={{ fontSize: 9.5, color: "var(--tx4)", fontFamily: "'DM Mono',monospace", letterSpacing: 0.5 }}>{s.label.toUpperCase()}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>

                {page === "settings" ? (
                  <SettingsPage team={team} onTeamChange={setTeam} />
                ) : (
                  <div style={{ flex: 1, overflow: "auto", padding: 20, background: "var(--bg)" }}>
                    {loading ? (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--tx4)", fontFamily: "'DM Mono',monospace", fontSize: 12, gap: 10 }}>
                        <span style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}>◌</span> Loading...
                      </div>
                    ) : view === "kanban" ? (
                      <div style={{ display: "flex", gap: 16, minWidth: "max-content", alignItems: "stretch", minHeight: "100%" }}>
                        {STATUSES.map(status => {
                          const colTasks = filtered.filter(t => t.status === status.id);
                          const isOver = overColumn === status.id && draggingId !== null;
                          return (
                            <div key={status.id} ref={el => { columnRefs.current[status.id] = el; }}
                              style={{ width: 260, flexShrink: 0, display: "flex", flexDirection: "column", minHeight: "100%" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, paddingBottom: 10, borderBottom: `1.5px solid ${isOver?"#F97316":"var(--bd)"}`, transition: "border-color 0.12s" }}>
                                <span style={{ fontSize: 14, color: isOver?"#F97316":"var(--tx4)" }}>{status.icon}</span>
                                <span style={{ fontSize: 11, fontWeight: 700, color: isOver?"#F97316":"var(--tx3)", letterSpacing: 1, fontFamily: "'DM Mono',monospace", textTransform: "uppercase" }}>{status.label}</span>
                                <span style={{ marginLeft: "auto", background: "var(--bg5)", color: "var(--tx4)", borderRadius: 10, padding: "2px 7px", fontSize: 11, fontFamily: "'DM Mono',monospace" }}>{colTasks.length}</span>
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minHeight: 200, borderRadius: 8, padding: isOver?"6px":"0", background: isOver?"#F9731610":"transparent", border: isOver?"1.5px dashed #F9731650":"1.5px solid transparent", transition: "all 0.12s" }}>
                                {colTasks.map(t => <TaskCard key={t.id} task={t} onEdit={openEdit} onMouseDownDrag={handleMouseDownDrag} isDragging={draggingId===t.id} team={team} attachmentCounts={attachmentCounts} />)}
                                {colTasks.length===0&&!isOver&&<div style={{ border: "1px dashed var(--bd2)", borderRadius: 8, padding: "18px 0", textAlign: "center", color: "var(--tx4)", fontSize: 11, fontFamily: "'DM Mono',monospace" }}>empty</div>}
                                {isOver&&<div style={{ border: "1.5px dashed #F9731680", borderRadius: 8, padding: "14px 0", textAlign: "center", color: "#F97316", fontSize: 11, fontFamily: "'DM Mono',monospace" }}>↓ drop here</div>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ maxWidth: 900 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 110px 80px 100px 90px", gap: 10, padding: "8px 14px", marginBottom: 6, fontSize: 9.5, fontFamily: "'DM Mono',monospace", color: "var(--tx4)", letterSpacing: 0.8, textTransform: "uppercase" }}>
                          <span>Task</span><span>Company</span><span>Assignee</span><span>Priority</span><span>Status</span><span>Due</span>
                        </div>
                        {filtered.length===0&&<div style={{ textAlign:"center", padding:40, color:"var(--tx4)", fontFamily:"'DM Mono',monospace", fontSize:12 }}>No tasks found</div>}
                        {filtered.map(task => {
                          const member = getMember(task.assignee, team);
                          const isOverdue = task.status!=="done"&&task.due&&new Date(task.due)<new Date();
                          const attachCount = attachmentCounts?.[task.id]||0;
                          return (
                            <div key={task.id} onClick={()=>openEdit(task)}
                              style={{ display:"grid", gridTemplateColumns:"1fr 80px 110px 80px 100px 90px", gap:10, padding:"11px 14px", borderRadius:7, cursor:"pointer", background:"var(--bg2)", border:"1px solid var(--bd)", marginBottom:4, alignItems:"center", animation:"slideIn 0.15s ease-out" }}
                              onMouseEnter={e=>e.currentTarget.style.borderColor="var(--bd2)"}
                              onMouseLeave={e=>e.currentTarget.style.borderColor="var(--bd)"}
                            >
                              <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:0 }}>
                                <span style={{ fontSize:13, color:"var(--tx)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{task.title}</span>
                                {attachCount>0&&<span style={{ fontSize:10, color:"var(--tx4)", fontFamily:"'DM Mono',monospace", flexShrink:0 }}>📎{attachCount}</span>}
                              </div>
                              <CompanyBadge companyId={task.company} small />
                              <div style={{ display:"flex", alignItems:"center", gap:5 }}><Avatar member={member} size={20}/><span style={{ fontSize:11, color:"var(--tx3)" }}>{member.name}</span></div>
                              <PriorityDot priorityId={task.priority}/>
                              <span style={{ fontSize:11, fontFamily:"'DM Mono',monospace", color:task.status==="done"?"#10B981":task.status==="inprogress"?"#F59E0B":"var(--tx3)" }}>{STATUSES.find(s=>s.id===task.status)?.label}</span>
                              <span style={{ fontSize:11, fontFamily:"'DM Mono',monospace", color:isOverdue?"#EF4444":"var(--tx4)" }}>
                                {task.due?new Date(task.due+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"}):"—"}
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
          )}

          {/* PM VIEW */}
          {appSection === "apm" && (
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <APMSection />
            </div>
          )}

          {/* ESTIMATING */}
          {appSection === "precon" && (
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <FCGEstimating onExit={() => setAppSection("ops")} deepLinkProjectId={deepLinkProjectId}/>
            </div>
          )}

        </div>
      </div>

      {editTask !== null && <TaskModal task={editTask} isNew={isNew} onClose={closeModal} onSave={handleSave} onDelete={handleDelete} team={team} allProjects={allProjects} />}
      {aiOpen && <AIModal onClose={() => setAiOpen(false)} onAdd={handleAiAdd} team={team} />}
      {digestOpen && <DigestModal tasks={tasks} team={team} onClose={() => setDigestOpen(false)} />}
    </>
  );
}

