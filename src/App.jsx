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
    try { const s = localStorage.getItem("theme"); isDark = s ? s === "dark" : true; } catch {}
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
            model: "claude-sonnet-4-20250514",
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
      body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:2500, messages:[{ role:"user", content: msgContent }] })
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
      body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000, messages:[{ role:"user", content:msgContent }] })
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
        model:"claude-sonnet-4-20250514", max_tokens:800,
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


// ── Precon / Takeoff ──────────────────────────────────

const TAKEOFF_CATS = [
  { id:'concrete_slab',    label:'Concrete – Slab on Grade', unit:'SF',  cy:true,  defaultCost:6.50,  color:'#F59E0B' },
  { id:'concrete_footing', label:'Concrete – Footings',      unit:'CY',  cy:false, defaultCost:125,   color:'#F97316' },
  { id:'concrete_wall',    label:'Concrete – Walls/Columns', unit:'CY',  cy:false, defaultCost:150,   color:'#EF4444' },
  { id:'masonry_cmu',      label:'Masonry – CMU Block',      unit:'SF',  cy:false, defaultCost:18,    color:'#8B5CF6' },
  { id:'masonry_brick',    label:'Masonry – Brick',          unit:'SF',  cy:false, defaultCost:22,    color:'#6366F1' },
  { id:'rebar',            label:'Rebar / Steel',            unit:'LB',  cy:false, defaultCost:1.20,  color:'#10B981' },
  { id:'formwork',         label:'Formwork',                 unit:'SF',  cy:false, defaultCost:4.50,  color:'#06B6D4' },
  { id:'excavation',       label:'Excavation',               unit:'CY',  cy:false, defaultCost:8,     color:'#84CC16' },
  { id:'flatwork',         label:'Flatwork / Paving',        unit:'SF',  cy:false, defaultCost:6,     color:'#3B82F6' },
  { id:'grout',            label:'Grout / Mortar',           unit:'CY',  cy:false, defaultCost:200,   color:'#EC4899' },
  { id:'other',            label:'Other / General',          unit:'LS',  cy:false, defaultCost:0,     color:'#555'    },
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
        {!isNew && <button onClick={async()=>{await supabase.from('takeoff_items').delete().eq('id',item.id);onSave(null,'delete');}} style={{background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.3)',color:'#ef4444',padding:'8px 14px',borderRadius:6,cursor:'pointer',fontSize:12}}>Delete</button>}
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
      const pl=p||[]; setPlans(pl); setItems(i||[]);
      if(pl.length>0){setSelPlan(pl[0]); if(pl[0].scale_px_per_ft) setScale(pl[0].scale_px_per_ft);}
      setLoading(false);
    });
  },[project.id]);

  const toNorm=(x,y)=>({x:x/imgDisp.w,y:y/imgDisp.h});
  const toPx=(nx,ny)=>({x:nx*imgDisp.w,y:ny*imgDisp.h});
  const toNat=(nx,ny)=>({x:nx*imgNat.w,y:ny*imgNat.h});

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
      const pi=toNat(pts[i].x,pts[i].y);
      const pj=toNat(pts[j].x,pts[j].y);
      a+=pi.x*pj.y; a-=pj.x*pi.y;
    }
    return Math.abs(a)/2/(scale*scale);
  };

  const calcLinear=(p1,p2)=>{
    if(!scale) return 0;
    const n1=toNat(p1.x,p1.y); const n2=toNat(p2.x,p2.y);
    return Math.sqrt((n2.x-n1.x)**2+(n2.y-n1.y)**2)/scale;
  };

  const handleImgLoad=()=>{
    if(!imgRef.current) return;
    setImgNat({w:imgRef.current.naturalWidth,h:imgRef.current.naturalHeight});
    const r=imgRef.current.getBoundingClientRect();
    setImgDisp({w:r.width,h:r.height});
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

  useEffect(()=>{
    const handleKey=(e)=>{
      if(e.key==='Escape'){
        setActivePts([]);
        setScalePts([]);
        setScaleStep(null);
        setTool('select');
        setShowScalePicker(false);
      }
    };
    window.addEventListener('keydown',handleKey);
    return ()=>window.removeEventListener('keydown',handleKey);
  },[]);

  // Wheel zoom — use callback ref pattern
  const containerCallbackRef = (el) => {
    if(containerRef.current && containerRef._wheelHandler){
      containerRef.current.removeEventListener('wheel', containerRef._wheelHandler);
    }
    if(el){
      const handler = (e)=>{
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.1 : -0.1;
        setZoom(z=>Math.min(4, Math.max(0.1, Math.round((z+delta)*10)/10)));
      };
      el.addEventListener('wheel', handler, {passive:false});
      containerRef.current = el;
      containerRef._wheelHandler = handler;
    }
  };

  // Compute isPdf synchronously in render — never use state for this
  const isPdfPlan = !!(selPlan && (
    selPlan.file_type?.includes('pdf')
    || (selPlan.file_url?.toLowerCase().includes('.pdf') && !selPlan.file_url?.startsWith('data:image'))
    || selPlan.file_url?.startsWith('data:application/pdf')
  ));

  useEffect(()=>{
    if(!selPlan) return;
    const isPdf = !!(
      selPlan.file_type?.includes('pdf')
      || (selPlan.file_url?.toLowerCase().includes('.pdf') && !selPlan.file_url?.startsWith('data:image'))
      || selPlan.file_url?.startsWith('data:application/pdf')
    );
    // Reset scale from saved value
    if(selPlan.scale_px_per_ft){ setScale(selPlan.scale_px_per_ft); }
    else { setScale(null); setPresetScale(''); }
    pdfDocRef.current = null;
    setPdfDoc(null);
    if(isPdf){
      loadPdf(selPlan.file_url);
    }
  },[selPlan?.id, selPlan?.file_url]);

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
      body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:2500,
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
  const renderMeasurements=()=>items.filter(it=>it.points?.length).map(it=>{
    const pts=it.points.map(p=>toPx(p.x,p.y));
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

  const totalEst=items.reduce((s,i)=>s+(i.total_cost||0),0);
  const catGroups=TAKEOFF_CATS.map(cat=>{
    const its=items.filter(i=>i.category===cat.id);
    return its.length?{...cat,items:its,subtotal:its.reduce((s,i)=>s+(i.total_cost||0),0)}:null;
  }).filter(Boolean);

  const toolCursor={select:'default',area:'crosshair',linear:'crosshair',count:'cell',scale:'crosshair'}[tool]||'default';

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
            <button onClick={()=>fileRef.current?.click()} disabled={uploading}
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


// Standard construction drawing scales (architectural + engineering)
const CONSTRUCTION_SCALES = [
  { label:'1"=1ft',     pxPerFt: null, ratio: 12    },
  { label:'1"=2ft',     pxPerFt: null, ratio: 24    },
  { label:'1"=4ft',     pxPerFt: null, ratio: 48    },
  { label:'1"=8ft',     pxPerFt: null, ratio: 96    },
  { label:'1"=10ft',    pxPerFt: null, ratio: 120   },
  { label:'1"=16ft',    pxPerFt: null, ratio: 192   },
  { label:'1"=20ft',    pxPerFt: null, ratio: 240   },
  { label:'1"=30ft',    pxPerFt: null, ratio: 360   },
  { label:'1"=40ft',    pxPerFt: null, ratio: 480   },
  { label:'1"=50ft',    pxPerFt: null, ratio: 600   },
  { label:'1"=60ft',    pxPerFt: null, ratio: 720   },
  { label:'1"=100ft',   pxPerFt: null, ratio: 1200  },
  { label:'1/8"=1ft',   pxPerFt: null, ratio: 96    },
  { label:'1/4"=1ft',   pxPerFt: null, ratio: 48    },
  { label:'3/8"=1ft',   pxPerFt: null, ratio: 32    },
  { label:'1/2"=1ft',   pxPerFt: null, ratio: 24    },
  { label:'3/4"=1ft',   pxPerFt: null, ratio: 16    },
  { label:'1.5"=1ft',   pxPerFt: null, ratio: 8     },
  { label:'3"=1ft',     pxPerFt: null, ratio: 4     },
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
        {!isNew&&<button onClick={()=>onSave(project,'delete')} style={{background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.3)',color:'#ef4444',padding:'8px 14px',borderRadius:6,cursor:'pointer',fontSize:12}}>Delete</button>}
        <div style={{display:'flex',gap:8,marginLeft:'auto'}}>
          <button onClick={onClose} style={{background:'none',border:`1px solid var(--bd2)`,color:'var(--tx3)',padding:'8px 18px',borderRadius:6,cursor:'pointer',fontSize:13}}>Cancel</button>
          <button onClick={handleSave} disabled={saving||!form.name.trim()} style={{background:'#F97316',border:'none',color:'#000',padding:'8px 22px',borderRadius:6,cursor:'pointer',fontSize:13,fontWeight:700}}>{saving?'Saving...':isNew?'Create':'Save'}</button>
        </div>
      </div>
    </APMModal>
  );
}

// ── Full Takeoff Workspace ────────────────────────────
function TakeoffWorkspace({ project, onBack, apmProjects }) {
  const { t } = useTheme();
  const [plans, setPlans] = useState([]);
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
  const [showAssembly, setShowAssembly] = useState(false);
  const [showUnitCosts, setShowUnitCosts] = useState(false);
  const [showBidSummary, setShowBidSummary] = useState(false);
  const [editProject, setEditProject] = useState(false);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [rendering, setRendering] = useState(false);
  const pdfDocRef = useRef(null);
  const imgRef = useRef();
  const canvasRef = useRef();
  const svgRef = useRef();
  const fileRef = useRef();
  const containerRef = useRef();


  useEffect(()=>{
    const pid = project.id;
    Promise.all([
      supabase.from('precon_plans').select('*').eq('project_id',pid).order('created_at'),
      supabase.from('takeoff_items').select('*').eq('project_id',pid).order('sort_order'),
    ]).then(([{data:p},{data:i}])=>{
      const pl=p||[]; setPlans(pl); setItems(i||[]);
      if(pl.length>0){setSelPlan(pl[0]); if(pl[0].scale_px_per_ft) setScale(pl[0].scale_px_per_ft);}
      setLoading(false);
    });
  },[project.id]);

  const toNorm=(x,y)=>({x:x/imgDisp.w,y:y/imgDisp.h});
  const toPx=(nx,ny)=>({x:nx*imgDisp.w,y:ny*imgDisp.h});
  const toNat=(nx,ny)=>({x:nx*imgNat.w,y:ny*imgNat.h});

  const getSvgPos=(e)=>{
    const r=svgRef.current?.getBoundingClientRect();
    if(!r) return {x:0,y:0};
    return {x:(e.clientX-r.left)/zoom,y:(e.clientY-r.top)/zoom};
  };

  const calcArea=(pts)=>{
    if(!scale||pts.length<3) return 0;
    let a=0;
    for(let i=0;i<pts.length;i++){
      const j=(i+1)%pts.length;
      const pi=toNat(pts[i].x,pts[i].y);
      const pj=toNat(pts[j].x,pts[j].y);
      a+=pi.x*pj.y; a-=pj.x*pi.y;
    }
    return Math.abs(a)/2/(scale*scale);
  };

  const calcLinear=(p1,p2)=>{
    if(!scale) return 0;
    const n1=toNat(p1.x,p1.y); const n2=toNat(p2.x,p2.y);
    return Math.sqrt((n2.x-n1.x)**2+(n2.y-n1.y)**2)/scale;
  };

  const handleImgLoad=()=>{
    if(!imgRef.current) return;
    setImgNat({w:imgRef.current.naturalWidth,h:imgRef.current.naturalHeight});
    const r=imgRef.current.getBoundingClientRect();
    setImgDisp({w:r.width,h:r.height});
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

  useEffect(()=>{
    const handleKey=(e)=>{
      if(e.key==='Escape'){
        setActivePts([]);
        setScalePts([]);
        setScaleStep(null);
        setTool('select');
        setShowScalePicker(false);
      }
    };
    window.addEventListener('keydown',handleKey);
    return ()=>window.removeEventListener('keydown',handleKey);
  },[]);

  // Wheel zoom — use callback ref pattern
  const containerCallbackRef = (el) => {
    if(containerRef.current && containerRef._wheelHandler){
      containerRef.current.removeEventListener('wheel', containerRef._wheelHandler);
    }
    if(el){
      const handler = (e)=>{
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.1 : -0.1;
        setZoom(z=>Math.min(4, Math.max(0.1, Math.round((z+delta)*10)/10)));
      };
      el.addEventListener('wheel', handler, {passive:false});
      containerRef.current = el;
      containerRef._wheelHandler = handler;
    }
  };

  // Compute isPdf synchronously in render — never use state for this
  const isPdfPlan = !!(selPlan && (
    selPlan.file_type?.includes('pdf')
    || (selPlan.file_url?.toLowerCase().includes('.pdf') && !selPlan.file_url?.startsWith('data:image'))
    || selPlan.file_url?.startsWith('data:application/pdf')
  ));

  useEffect(()=>{
    if(!selPlan) return;
    const isPdf = !!(
      selPlan.file_type?.includes('pdf')
      || (selPlan.file_url?.toLowerCase().includes('.pdf') && !selPlan.file_url?.startsWith('data:image'))
      || selPlan.file_url?.startsWith('data:application/pdf')
    );
    // Reset scale from saved value
    if(selPlan.scale_px_per_ft){ setScale(selPlan.scale_px_per_ft); }
    else { setScale(null); setPresetScale(''); }
    pdfDocRef.current = null;
    setPdfDoc(null);
    if(isPdf){
      loadPdf(selPlan.file_url);
    }
  },[selPlan?.id, selPlan?.file_url]);

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
        body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:256,
          messages:[{role:'user',content:[block,{type:'text',text:'Look at this construction drawing. Find the scale bar or scale notation in the title block or anywhere on the drawing. Return ONLY a JSON object like: {"scale":"1\"=20ft","found":true} or {"found":false} if you cannot find one. No other text.'}]}]})});
      const json=await res.json();
      const text=json?.content?.find(b=>b.type==='text')?.text||'';
      const parsed=JSON.parse(text.replace(/```json|```/g,'').trim());
      if(parsed.found&&parsed.scale){
        const match=CONSTRUCTION_SCALES.find(s=>s.label===parsed.scale||s.label.replace('ft',"'")===parsed.scale);
        if(match){
          const dpi=144; const pxPerFt=dpi/(match.ratio/12);
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
    if(data){setItems(prev=>[...prev,data]); setEditItem(data);}
  };

  const handleSvgClick=(e)=>{
    if(!selPlan) return;
    const pos=getSvgPos(e);
    const norm=toNorm(pos.x,pos.y);
    if(tool==='scale'&&scaleStep==='picking'){
      const npts=[...scalePts,norm];
      setScalePts(npts);
      if(npts.length===2) setScaleStep('entering');
      return;
    }
    if(tool==='count'){ saveItem({category:'other',description:'Count',quantity:1,unit:'EA',measurement_type:'count',points:[norm]}); return; }
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
          saveItem({category:'concrete_slab',description:'Area',quantity:area,unit:'SF',measurement_type:'area',points:activePts});
          setActivePts([]); return;
        }
      }
      setActivePts(prev=>[...prev,norm]);
    }
    if(tool==='perimeter'){
      if(activePts.length>=3){
        const fp=toPx(activePts[0].x,activePts[0].y);
        if(Math.sqrt((pos.x-fp.x)**2+(pos.y-fp.y)**2)<14){
          // Sum all sides
          let perim=0;
          for(let i=0;i<activePts.length;i++){
            perim+=calcLinear(activePts[i],activePts[(i+1)%activePts.length]);
          }
          perim=Math.round(perim*10)/10;
          saveItem({category:'formwork',description:'Perimeter',quantity:perim,unit:'LF',measurement_type:'perimeter',points:activePts});
          setActivePts([]); return;
        }
      }
      setActivePts(prev=>[...prev,norm]);
    }
  };

  const handleSvgMove=(e)=>{ setHoverPt(toNorm(getSvgPos(e).x, getSvgPos(e).y)); };

  const confirmScale=async()=>{
    if(!scaleDist||scalePts.length<2) return;
    const p1=toNat(scalePts[0].x,scalePts[0].y);
    const p2=toNat(scalePts[1].x,scalePts[1].y);
    const pxDist=Math.sqrt((p2.x-p1.x)**2+(p2.y-p1.y)**2);
    const realFt=Number(scaleDist)*(scaleUnit==='in'?1/12:1);
    const pxPerFt=pxDist/realFt;
    setScale(pxPerFt); setScaleStep(null); setScalePts([]); setScaleDist(''); setTool('select');
    if(selPlan) await supabase.from('precon_plans').update({scale_px_per_ft:pxPerFt}).eq('id',selPlan.id);
  };

  const autoNameSheet = (filename, existingPlans) => {
    // Strip extension
    let name = filename.replace(/\.[^.]+$/, '');
    // Common sheet naming patterns: S1.0, A-101, C3.1, etc
    // If it looks like a raw filename, make it prettier
    name = name.replace(/[-_]/g, ' ').replace(/\s+/g,' ').trim();
    // Check if it matches a sheet code pattern
    const sheetMatch = name.match(/^([A-Z]{1,2})[-\s]?(\d+\.?\d*)$/i);
    if(sheetMatch) {
      const prefixes = {A:'Architectural',S:'Structural',C:'Civil',M:'Mechanical',E:'Electrical',P:'Plumbing',L:'Landscape',G:'General',FP:'Fire Protection'};
      const prefix = prefixes[sheetMatch[1].toUpperCase()];
      if(prefix) name = `${sheetMatch[1].toUpperCase()}-${sheetMatch[2]} ${prefix}`;
    }
    // Deduplicate: if name exists, append number
    const base = name;
    let count = 2;
    while(existingPlans.some(p=>p.name===name)) { name = `${base} (${count++})`; }
    return name;
  };

  const handleUpload=async(file)=>{
    if(!file) return;
    const pid = project.id;
    setUploading(true);
    const isPdf = file.type?.includes('pdf');

    if(isPdf){
      // Read file as ArrayBuffer for PDF.js processing
      const arrayBuf = await file.arrayBuffer();
      const lib = await ensurePdfLib();
      if(!lib){ setUploading(false); alert('PDF library not loaded'); return; }
      lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      let doc;
      try { doc = await lib.getDocument({data: arrayBuf.slice(0)}).promise; }
      catch(e){ setUploading(false); alert('Could not read PDF: '+e.message); return; }

      const numPages = doc.numPages;
      const baseName = autoNameSheet(file.name, plans);
      const newPlans = [];

      for(let pageN=1; pageN<=numPages; pageN++){
        // Render page to canvas → blob → upload as PNG
        const page = await doc.getPage(pageN);
        const viewport = page.getViewport({scale:2.0});
        const offscreen = document.createElement('canvas');
        offscreen.width = viewport.width; offscreen.height = viewport.height;
        await page.render({canvasContext: offscreen.getContext('2d'), viewport}).promise;
        const blob = await new Promise(r=>offscreen.toBlob(r,'image/png',0.95));
        const sheetName = numPages>1 ? `${baseName} — Pg ${pageN}` : baseName;
        const path = `precon/${pid}/${Date.now()}_p${pageN}.png`;
        const {error} = await supabase.storage.from('attachments').upload(path, blob, {upsert:true, contentType:'image/png'});
        if(error){ console.error('page upload fail', error); continue; }
        const {data:ud} = supabase.storage.from('attachments').getPublicUrl(path);
        const publicUrl = ud?.publicUrl || '';
        const {data:plan} = await supabase.from('precon_plans')
          .insert([{project_id:pid, name:sheetName, file_url:publicUrl, file_type:'image/png'}])
          .select().single();
        if(plan) newPlans.push(plan);
      }

      if(newPlans.length>0){
        setPlans(prev=>[...prev, ...newPlans]);
        setSelPlan(newPlans[0]);
        setPlanB64(null); setPlanMime('image/png');
      }
      setUploading(false);
      return;
    }

    // Image upload (non-PDF)
    const sheetName = autoNameSheet(file.name, plans);
    const reader=new FileReader();
    reader.onload=ev=>{
      const dataUrl = ev.target.result;
      setPlanB64(dataUrl.split(',')[1]);
      setPlanMime(file.type);
      setSelPlan({id:'preview',name:sheetName,file_url:dataUrl,file_type:file.type});
    };
    reader.readAsDataURL(file);
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
    }
    setUploading(false);
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
      body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:3000,
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
    await supabase.from('takeoff_items').delete().eq('id',id);
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

  // SVG
  const renderMeasurements=()=>items.filter(it=>it.points?.length).map(it=>{
    const pts=it.points.map(p=>toPx(p.x,p.y));
    const c=it.color||'#F97316';
    if(it.measurement_type==='area'&&pts.length>=3){
      const d=pts.map((p,i)=>`${i===0?'M':'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')+' Z';
      const cx=pts.reduce((s,p)=>s+p.x,0)/pts.length;
      const cy=pts.reduce((s,p)=>s+p.y,0)/pts.length;
      return(<g key={it.id} onClick={()=>setEditItem(it)} style={{cursor:'pointer'}}>
        <path d={d} fill={c+'30'} stroke={c} strokeWidth={2.5}/>
        <rect x={cx-28} y={cy-10} width={56} height={20} rx={4} fill="rgba(0,0,0,0.65)"/>
        <text x={cx} y={cy+4} fontSize={11} fill="#fff" textAnchor="middle" fontFamily="'DM Mono',monospace" fontWeight={700} style={{pointerEvents:'none'}}>{it.quantity} {it.unit}</text>
      </g>);
    }
    if(it.measurement_type==='linear'&&pts.length>=2){
      const mx=(pts[0].x+pts[1].x)/2; const my=(pts[0].y+pts[1].y)/2;
      return(<g key={it.id} onClick={()=>setEditItem(it)} style={{cursor:'pointer'}}>
        <line x1={pts[0].x} y1={pts[0].y} x2={pts[1].x} y2={pts[1].y} stroke={c} strokeWidth={3} strokeDasharray="8,4"/>
        {pts.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={6} fill={c} stroke="#fff" strokeWidth={1.5}/>)}
        <rect x={mx-22} y={my-18} width={44} height={18} rx={4} fill="rgba(0,0,0,0.65)"/>
        <text x={mx} y={my-5} fontSize={11} fill="#fff" textAnchor="middle" fontFamily="'DM Mono',monospace" fontWeight={700} style={{pointerEvents:'none'}}>{it.quantity}{it.unit}</text>
      </g>);
    }
    if(it.measurement_type==='count'&&pts[0]){
      return(<g key={it.id} onClick={()=>setEditItem(it)} style={{cursor:'pointer'}}>
        <circle cx={pts[0].x} cy={pts[0].y} r={10} fill={c} stroke="#fff" strokeWidth={1.5}/>
        <text x={pts[0].x} y={pts[0].y+4} fontSize={11} fill="#fff" textAnchor="middle" fontFamily="'DM Mono',monospace" fontWeight={700} style={{pointerEvents:'none'}}>✕</text>
      </g>);
    }
    if(it.measurement_type==='perimeter'&&pts.length>=3){
      const d=pts.map((p,i)=>`${i===0?'M':'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')+' Z';
      const cx=pts.reduce((s,p)=>s+p.x,0)/pts.length;
      const cy=pts.reduce((s,p)=>s+p.y,0)/pts.length;
      return(<g key={it.id} onClick={()=>setEditItem(it)} style={{cursor:'pointer'}}>
        <path d={d} fill="none" stroke={c} strokeWidth={2.5} strokeDasharray="10,4"/>
        {pts.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={3} fill={c}/>)}
        <rect x={cx-28} y={cy-10} width={56} height={20} rx={4} fill="rgba(0,0,0,0.65)"/>
        <text x={cx} y={cy+4} fontSize={11} fill="#fff" textAnchor="middle" fontFamily="'DM Mono',monospace" fontWeight={700} style={{pointerEvents:'none'}}>{it.quantity} {it.unit}</text>
      </g>);
    }
    return null;
  });

  const renderActive=()=>{
    const pts=(tool==='scale'&&scaleStep==='picking')?scalePts:activePts;
    if(!pts.length) return null;
    const c=tool==='scale'?'#10B981':tool==='area'?'#F59E0B':tool==='perimeter'?'#F97316':'#06B6D4';
    const disp=pts.map(p=>toPx(p.x,p.y));
    const hover=hoverPt?toPx(hoverPt.x,hoverPt.y):null;
    const all=hover?[...disp,hover]:disp;
    return(<>
      {all.length>=2&&<polyline points={all.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke={c} strokeWidth={2.5} strokeDasharray={tool==='area'?'none':'6,3'} opacity={0.9}/>}
      {disp.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={i===0&&pts.length>=3?10:5} fill={c} stroke={i===0&&pts.length>=3?'#fff':'none'} strokeWidth={2} opacity={0.95}/>)}
      {hover&&<circle cx={hover.x} cy={hover.y} r={4} fill={c} opacity={0.5}/>}
      {tool==='area'&&pts.length>=3&&<text x={disp[0].x+14} y={disp[0].y-10} fontSize={10} fill={c} fontFamily="'DM Mono',monospace" fontWeight={700} style={{pointerEvents:'none'}}>← close</text>}
    </>);
  };

  const totalEst=items.reduce((s,i)=>s+(i.total_cost||0),0);
  const catGroups=TAKEOFF_CATS.map(cat=>{
    const its=items.filter(i=>i.category===cat.id);
    return its.length?{...cat,items:its,subtotal:its.reduce((s,i)=>s+(i.total_cost||0),0)}:null;
  }).filter(Boolean);
  const toolCursor={select:'default',area:'crosshair',linear:'crosshair',count:'cell',scale:'crosshair'}[tool]||'default';

  const co = COMPANIES.find(c=>c.id===project.company)||COMPANIES[1];
  const STATUS_COLORS_BID = {estimating:'#F59E0B',bid_submitted:'#3B82F6',awarded:'#10B981',lost:'#EF4444',hold:'#555'};

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 16px',borderBottom:`1px solid ${t.border}`,background:t.bg2,flexShrink:0,flexWrap:'wrap'}}>
        <button onClick={onBack} style={{background:'none',border:'none',color:t.text3,cursor:'pointer',fontSize:13,padding:'4px 8px 4px 0',display:'flex',alignItems:'center',gap:4}}>← Back</button>
        <div style={{width:1,height:20,background:t.border}}/>
        <CompanyBadge companyId={project.company} small/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:14,fontWeight:700,color:t.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{project.name}</div>
          <div style={{fontSize:10,color:t.text4,fontFamily:"'DM Mono',monospace"}}>{project.address||''}{project.gc_name?' · '+project.gc_name:''}</div>
        </div>
        <span style={{fontSize:10,padding:'3px 8px',borderRadius:10,background:STATUS_COLORS_BID[project.status]+'20',color:STATUS_COLORS_BID[project.status]||'#555',fontFamily:"'DM Mono',monospace",fontWeight:700}}>{(project.status||'').replace(/_/g,' ').toUpperCase()}</span>
        {project.bid_date&&<span style={{fontSize:10,color:t.text4,fontFamily:"'DM Mono',monospace"}}>📅 Bid: {fmtDate(project.bid_date)}</span>}
        <button onClick={()=>setEditProject(true)} style={{background:'none',border:`1px solid ${t.border2}`,color:t.text3,padding:'5px 10px',borderRadius:5,cursor:'pointer',fontSize:11}}>Edit</button>
        <button onClick={()=>setShowBidSummary(true)} disabled={!items.length} style={{background:'linear-gradient(135deg,#10B981,#059669)',border:'none',color:'#000',padding:'5px 12px',borderRadius:5,cursor:'pointer',fontSize:11,fontWeight:700,opacity:items.length?1:0.4}}>📋 Bid Summary</button>
      </div>

      <div style={{display:'flex',flex:1,overflow:'hidden'}}>
        {/* ── Plan Viewer ── */}
        <div style={{flex:1,display:'flex',flexDirection:'column',borderRight:`1px solid ${t.border}`,overflow:'hidden',minWidth:0}}>

          {/* Plan toolbar */}
          <div style={{display:'flex',gap:6,padding:'7px 12px',borderBottom:`1px solid ${t.border}`,flexShrink:0,alignItems:'center',background:t.bg2,flexWrap:'wrap'}}>
            <div style={{display:'flex',gap:6,alignItems:'center',flex:1,minWidth:0}}>
              {plans.length>0&&(
                <div style={{display:'flex',alignItems:'center',gap:0,maxWidth:200}}>
                  <select value={selPlan?.id||''} onChange={e=>{
                    const p=plans.find(x=>x.id===Number(e.target.value));
                    setSelPlan(p||null);setShowScalePicker(false);
                    if(p?.scale_px_per_ft){setScale(p.scale_px_per_ft);}else{setScale(null);setPresetScale('');}
                  }} style={{...inputStyle,fontSize:11,padding:'3px 8px',maxWidth:160,borderRadius:'4px 0 0 4px',borderRight:'none'}}>
                    {plans.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <button title="Rename sheet" onClick={async()=>{
                    const newName=window.prompt('Rename sheet:',selPlan?.name||'');
                    if(newName&&newName.trim()&&selPlan?.id&&selPlan.id!=='preview'){
                      await supabase.from('precon_plans').update({name:newName.trim()}).eq('id',selPlan.id);
                      setPlans(prev=>prev.map(p=>p.id===selPlan.id?{...p,name:newName.trim()}:p));
                      setSelPlan(prev=>({...prev,name:newName.trim()}));
                    }
                  }} style={{background:t.bg4,border:`1px solid ${t.border2}`,borderLeft:'none',color:t.text4,padding:'3px 7px',borderRadius:'0 4px 4px 0',cursor:'pointer',fontSize:10}}>✎</button>
                </div>
              )}
              <button onClick={()=>fileRef.current?.click()} disabled={uploading}
                style={{background:'none',border:`1px solid ${t.border2}`,color:t.text2,padding:'4px 9px',borderRadius:5,cursor:'pointer',fontSize:11,display:'flex',alignItems:'center',gap:4,flexShrink:0,whiteSpace:'nowrap'}}>
                {uploading?'⟳ Uploading…':'📎 Upload Sheet'}
              </button>
              <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{display:'none'}} onChange={e=>handleUpload(e.target.files[0])}/>
            </div>
            <div style={{display:'flex',gap:4,alignItems:'center',flexShrink:0}}>
              {scale&&<span style={{fontSize:9,color:'#10B981',fontFamily:"'DM Mono',monospace",background:'rgba(16,185,129,0.1)',padding:'2px 6px',borderRadius:3}}>⇔ SCALED</span>}

              <button onClick={()=>setZoom(z=>Math.min(z+0.25,4))} style={{background:t.bg4,border:`1px solid ${t.border}`,color:t.text3,padding:'3px 7px',borderRadius:4,cursor:'pointer',fontSize:12}}>+</button>
              <span style={{fontSize:10,color:t.text4,fontFamily:"'DM Mono',monospace",minWidth:32,textAlign:'center'}}>{Math.round(zoom*100)}%</span>
              <button onClick={()=>setZoom(z=>Math.max(z-0.25,0.25))} style={{background:t.bg4,border:`1px solid ${t.border}`,color:t.text3,padding:'3px 7px',borderRadius:4,cursor:'pointer',fontSize:12}}>−</button>
              <button onClick={()=>setZoom(1)} style={{background:t.bg4,border:`1px solid ${t.border}`,color:t.text4,padding:'3px 7px',borderRadius:4,cursor:'pointer',fontSize:10,fontFamily:"'DM Mono',monospace"}}>FIT</button>
            </div>
            {selPlan&&<button onClick={runAITakeoff} disabled={analyzing}
              style={{background:'linear-gradient(135deg,#7c3aed,#a855f7)',border:'none',color:'#fff',padding:'5px 11px',borderRadius:5,cursor:'pointer',fontSize:11,fontWeight:700,display:'flex',alignItems:'center',gap:4,flexShrink:0}}>
              {analyzing?<><span style={{animation:'spin 0.8s linear infinite',display:'inline-block'}}>◌</span>Analyzing…</>:<><span>✦</span>AI Takeoff</>}
            </button>}
          </div>

          {/* Drawing toolbar */}
          {selPlan&&(
            <div style={{display:'flex',gap:3,padding:'5px 12px',borderBottom:`1px solid ${t.border}`,flexShrink:0,background:t.bg,alignItems:'center',overflowX:'auto',position:'relative'}}>
              {[
                {id:'select',    icon:'↖', label:'Select',    color:'var(--tx3)'},
                {id:'area',      icon:'⬡', label:'Area',      color:'#F59E0B'},
                {id:'perimeter', icon:'⬠', label:'Perimeter', color:'#F97316'},
                {id:'linear',    icon:'━', label:'Linear',    color:'#06B6D4'},
                {id:'count',     icon:'✕', label:'Count',     color:'#10B981'},
              ].map(tb=>(
                <button key={tb.id}
                  onClick={()=>{setTool(tb.id);setActivePts([]);setScaleStep(null);}}
                  title={tb.label}
                  style={{padding:'4px 9px',borderRadius:4,border:tool===tb.id?`1.5px solid ${tb.color}`:`1px solid ${t.border}`,background:tool===tb.id?tb.color+'18':'none',color:tool===tb.id?tb.color:t.text4,cursor:'pointer',fontSize:12,fontWeight:600,display:'flex',alignItems:'center',gap:4,whiteSpace:'nowrap',flexShrink:0}}>
                  <span style={{fontSize:13}}>{tb.icon}</span><span style={{fontSize:10}}>{tb.label}</span>
                </button>
              ))}
              {/* Scale tools */}
              <div style={{width:1,height:18,background:t.border,margin:'0 2px',flexShrink:0}}/>
              <select
                value={presetScale}
                onChange={async e=>{
                  const val=e.target.value;
                  if(val==='cal'){setTool('scale');setScaleStep('picking');setScalePts([]);setActivePts([]);return;}
                  if(val==='auto'){autoDetectScale();return;}
                  const s=CONSTRUCTION_SCALES.find(x=>x.label===val);
                  if(!s) return;
                  const dpi=144;
                  const pxPerFt=dpi/(s.ratio/12);
                  setScale(pxPerFt); setPresetScale(s.label);
                  if(selPlan?.id&&selPlan.id!=='preview') await supabase.from('precon_plans').update({scale_px_per_ft:pxPerFt}).eq('id',selPlan.id);
                }}
                style={{...inputStyle,fontSize:10,padding:'3px 7px',borderRadius:4,color:scale?'#10B981':t.text4,fontFamily:"'DM Mono',monospace",fontWeight:700,minWidth:120,flexShrink:0,border:scale?'1px solid rgba(16,185,129,0.4)':`1px solid ${t.border}`}}>
                <option value="">⇔ Set Scale</option>
                <option value="auto">✦ Auto-Detect from Drawing</option>
                <option value="cal">⊕ Calibrate (click 2 pts)</option>
                <optgroup label="Engineering">
                  {CONSTRUCTION_SCALES.filter(s=>s.label.startsWith('1"=')).map(s=><option key={s.label} value={s.label}>{s.label}</option>)}
                </optgroup>
                <optgroup label="Architectural">
                  {CONSTRUCTION_SCALES.filter(s=>!s.label.startsWith('1"=')).map(s=><option key={s.label} value={s.label}>{s.label}</option>)}
                </optgroup>
              </select>
              <div style={{width:1,height:18,background:t.border,margin:'0 4px',flexShrink:0}}/>
              <button onClick={()=>setShowAssembly(true)} style={{padding:'4px 9px',borderRadius:4,border:`1px solid ${t.border}`,background:'none',color:'#8B5CF6',cursor:'pointer',fontSize:10,fontWeight:700,flexShrink:0,display:'flex',alignItems:'center',gap:3}}>
                <span>⬡</span>Assembly
              </button>
              <button onClick={()=>setShowUnitCosts(true)} style={{padding:'4px 9px',borderRadius:4,border:`1px solid ${t.border}`,background:'none',color:t.text4,cursor:'pointer',fontSize:10,flexShrink:0,display:'flex',alignItems:'center',gap:3}}>
                <span>$</span>Rates
              </button>
              <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
                {tool==='area'&&activePts.length>0&&(
                  <span style={{fontSize:10,color:'#F59E0B',fontFamily:"'DM Mono',monospace"}}>
                    {activePts.length>=3?`⬡ ${Math.round(calcArea([...activePts,(hoverPt||activePts[0])])*10)/10} SF · dbl-click or click ● to close`:`⬡ ${activePts.length} pts — keep clicking`}
                  </span>
                )}
                {tool==='perimeter'&&activePts.length>0&&(
                  <span style={{fontSize:10,color:'#F97316',fontFamily:"'DM Mono',monospace"}}>
                    {activePts.length>=3?`⬠ ${Math.round(activePts.reduce((s,p,i)=>s+(i>0?calcLinear(activePts[i-1],p):0),0)*10)/10} LF · dbl-click to close`:`⬠ ${activePts.length} pts`}
                  </span>
                )}
                {tool==='linear'&&activePts.length===1&&hoverPt&&(
                  <span style={{fontSize:10,color:'#06B6D4',fontFamily:"'DM Mono',monospace"}}>
                    ━ {Math.round(calcLinear(activePts[0],hoverPt)*10)/10} LF
                  </span>
                )}
                {scaleStep==='picking'&&<span style={{fontSize:10,color:'#10B981',fontFamily:"'DM Mono',monospace"}}>Click 2 points of known distance ({scalePts.length}/2) · ESC to cancel</span>}
                {scale&&!scaleStep&&<span style={{fontSize:9,color:'#10B981',fontFamily:"'DM Mono',monospace",background:'rgba(16,185,129,0.1)',padding:'2px 6px',borderRadius:3}}>{presetScale||'SCALED'}</span>}
                {!scale&&<span style={{fontSize:9,color:'#F59E0B',fontFamily:"'DM Mono',monospace"}}>⚠ set scale for accurate measurements</span>}
              </div>
            </div>
          )}

          {/* Plan canvas */}
          <div ref={containerCallbackRef} style={{flex:1,overflow:'auto',background:'#2a2a2a',position:'relative',minHeight:0}}>
            {!selPlan?(
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',padding:40}}>
                <div style={{fontSize:48,marginBottom:16}}>📐</div>
                <div style={{fontSize:15,fontWeight:700,color:t.text,marginBottom:6}}>No plans uploaded</div>
                <div style={{fontSize:12,color:t.text3,fontFamily:"'DM Mono',monospace",marginBottom:24,textAlign:'center'}}>Upload PDFs or images of your plans<br/>to start measuring and quantifying</div>
                <button onClick={()=>fileRef.current?.click()}
                  style={{background:'#F97316',border:'none',color:'#000',padding:'10px 24px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:700}}>📎 Upload Plans</button>
              </div>
            ):(
              <div style={{display:'inline-block',transformOrigin:'top left',transform:`scale(${zoom})`,position:'relative'}}>
                {isPdfPlan ? (
                  <>
                    {rendering&&<div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.7)',zIndex:5,color:'#fff',fontSize:13,gap:8,borderRadius:4}}><span style={{animation:'spin 0.8s linear infinite',display:'inline-block'}}>◌</span>Loading...</div>}
                    <canvas ref={canvasRef} style={{display:'block',userSelect:'none'}}/>
                  </>
                ):(
                  <img ref={imgRef} src={selPlan.file_url} alt="Plan"
                    crossOrigin="anonymous"
                    style={{display:'block',maxWidth:'none',userSelect:'none',minWidth:400,minHeight:300}}
                    onLoad={handleImgLoad}
                    onError={(e)=>{
                      console.error('Image load failed:', selPlan.file_url);
                      e.target.style.outline='2px solid #ef4444';
                      e.target.insertAdjacentHTML('afterend','<div style="position:absolute;top:20px;left:20px;background:#1a0505;color:#ef4444;padding:12px 16px;border-radius:8px;font-size:12px;font-family:monospace;border:1px solid #3a1010;max-width:500px">Failed to load: '+selPlan.file_url+'</div>');
                    }}
                    draggable={false}/>
                )}
                <svg ref={svgRef}
                  style={{position:'absolute',top:0,left:0,width:(canvasRef.current?.width||imgDisp.w||800)+'px',height:(canvasRef.current?.height||imgDisp.h||1100)+'px',cursor:toolCursor}}
                  onClick={handleSvgClick}
                    onDoubleClick={(e)=>{
                      if((tool==='area'||tool==='perimeter')&&activePts.length>=3){
                        e.stopPropagation();
                        if(tool==='area'){
                          const area=Math.round(calcArea(activePts)*10)/10;
                          saveItem({category:'concrete_slab',description:'Area',quantity:area,unit:'SF',measurement_type:'area',points:activePts});
                        } else {
                          let perim=0;
                          for(let i=0;i<activePts.length;i++) perim+=calcLinear(activePts[i],activePts[(i+1)%activePts.length]);
                          saveItem({category:'formwork',description:'Perimeter',quantity:Math.round(perim*10)/10,unit:'LF',measurement_type:'perimeter',points:activePts});
                        }
                        setActivePts([]);
                      }
                    }}
                    onMouseMove={handleSvgMove} onMouseLeave={()=>setHoverPt(null)}>
                    {renderMeasurements()}
                    {renderActive()}
                    {scalePts.length>=2&&(()=>{
                      const p1=toPx(scalePts[0].x,scalePts[0].y);const p2=toPx(scalePts[1].x,scalePts[1].y);
                      return(<g><line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#10B981" strokeWidth={2.5} strokeDasharray="6,3"/><circle cx={p1.x} cy={p1.y} r={6} fill="#10B981"/><circle cx={p2.x} cy={p2.y} r={6} fill="#10B981"/></g>);
                    })()}
                  </svg>
                </div>
            )}
          </div>
        </div>

        {/* ── Right Panel ── */}
        <div style={{width:300,flexShrink:0,display:'flex',flexDirection:'column',overflow:'hidden',background:t.bg2}}>
          <div style={{display:'flex',borderBottom:`1px solid ${t.border}`,flexShrink:0}}>
            {[['items',`Items (${items.length})`],['estimate','Estimate']].map(([id,lbl])=>(
              <button key={id} onClick={()=>setRightTab(id)}
                style={{flex:1,padding:'9px 0',border:'none',background:'none',cursor:'pointer',fontSize:11,fontWeight:700,color:rightTab===id?'#F97316':t.text3,borderBottom:rightTab===id?'2px solid #F97316':'2px solid transparent',fontFamily:"'DM Mono',monospace"}}>
                {lbl}
              </button>
            ))}
          </div>

          {rightTab==='items'&&(
            <div style={{flex:1,overflowY:'auto',padding:8}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,padding:'0 2px'}}>
                <span style={{fontSize:9,color:t.text4,fontFamily:"'DM Mono',monospace",letterSpacing:0.5}}>{items.filter(i=>i.ai_generated).length} AI · {items.filter(i=>!i.ai_generated).length} MANUAL</span>
                <div style={{display:'flex',gap:5}}>
                  <button onClick={()=>setShowAssembly(true)} style={{background:'rgba(139,92,246,0.1)',border:'1px solid rgba(139,92,246,0.3)',color:'#8B5CF6',padding:'3px 8px',borderRadius:4,cursor:'pointer',fontSize:10,fontWeight:700}}>⬡ Assembly</button>
                  <button onClick={()=>setEditItem({project_id:project.id,plan_id:selPlan?.id})} style={{background:'#F97316',border:'none',color:'#000',padding:'3px 8px',borderRadius:4,cursor:'pointer',fontSize:10,fontWeight:700}}>+ Add</button>
                </div>
              </div>
              {items.length===0&&(
                <div style={{textAlign:'center',padding:'30px 0',color:t.text4,fontSize:11,fontFamily:"'DM Mono',monospace"}}>
                  {selPlan?'Use drawing tools or AI Takeoff':'Upload a plan to start'}
                </div>
              )}
              {TAKEOFF_CATS.map(cat=>{
                const catItems=items.filter(i=>i.category===cat.id);
                if(!catItems.length) return null;
                return(<div key={cat.id} style={{marginBottom:8}}>
                  <div style={{display:'flex',alignItems:'center',gap:5,padding:'4px 2px',marginBottom:3}}>
                    <span style={{width:7,height:7,borderRadius:2,background:cat.color,flexShrink:0}}/>
                    <span style={{fontSize:9,fontWeight:700,color:t.text3,fontFamily:"'DM Mono',monospace",letterSpacing:0.5,flex:1}}>{cat.label.toUpperCase()}</span>
                    <span style={{fontSize:9,color:t.text4,fontFamily:"'DM Mono',monospace"}}>{catItems.length}</span>
                  </div>
                  {catItems.map(item=>(
                    <div key={item.id}
                      style={{background:t.bg3,borderLeft:`3px solid ${cat.color}`,borderRadius:5,padding:'6px 8px',marginBottom:3,cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:6,position:'relative'}}
                      onMouseEnter={e=>{e.currentTarget.style.background=t.bg4;e.currentTarget.querySelector('.item-del').style.opacity='1';}}
                      onMouseLeave={e=>{e.currentTarget.style.background=t.bg3;e.currentTarget.querySelector('.item-del').style.opacity='0';}}>
                      <div style={{flex:1,minWidth:0}} onClick={()=>setEditItem(item)}>
                        <div style={{fontSize:11,fontWeight:600,color:t.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.description}</div>
                        <div style={{fontSize:9,color:t.text4,fontFamily:"'DM Mono',monospace",marginTop:1,display:'flex',gap:6}}>
                          <span>{item.quantity} {item.unit}</span>
                          {item.ai_generated&&<span style={{color:'#a855f7'}}>✦AI</span>}
                        </div>
                      </div>
                      <span style={{fontSize:10,fontWeight:700,color:'#10B981',fontFamily:"'DM Mono',monospace",flexShrink:0}} onClick={()=>setEditItem(item)}>${(item.total_cost||0).toLocaleString()}</span>
                      <button className="item-del" onClick={async e=>{e.stopPropagation();await supabase.from('takeoff_items').delete().eq('id',item.id);setItems(prev=>prev.filter(i=>i.id!==item.id));}}
                        style={{opacity:0,transition:'opacity 0.1s',position:'absolute',top:4,right:4,background:'rgba(239,68,68,0.15)',border:'none',color:'#ef4444',cursor:'pointer',fontSize:10,padding:'1px 4px',borderRadius:3,lineHeight:1}}>✕</button>
                    </div>
                  ))}
                </div>);
              })}
            </div>
          )}

          {rightTab==='estimate'&&(
            <div style={{flex:1,overflowY:'auto',padding:8}}>
              {catGroups.length===0&&<div style={{textAlign:'center',padding:'30px 0',color:t.text4,fontSize:11,fontFamily:"'DM Mono',monospace"}}>No items yet</div>}
              {catGroups.map(cat=>(
                <div key={cat.id} style={{marginBottom:12}}>
                  <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:5}}>
                    <span style={{width:8,height:8,borderRadius:2,background:cat.color}}/>
                    <span style={{fontSize:10,fontWeight:700,color:t.text2,fontFamily:"'DM Mono',monospace",flex:1,letterSpacing:0.3}}>{cat.label.toUpperCase()}</span>
                    <span style={{fontSize:11,fontWeight:700,color:t.text,fontFamily:"'DM Mono',monospace"}}>${cat.subtotal.toLocaleString()}</span>
                  </div>
                  {cat.items.map(it=>(
                    <div key={it.id} style={{display:'flex',padding:'2px 0 2px 12px',fontSize:10,color:t.text3,gap:4,justifyContent:'space-between',alignItems:'center'}}
                      onMouseEnter={e=>e.currentTarget.querySelector('.del-btn').style.opacity='1'}
                      onMouseLeave={e=>e.currentTarget.querySelector('.del-btn').style.opacity='0'}>
                      <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1,fontFamily:"'DM Mono',monospace",cursor:'pointer'}} onClick={()=>setEditItem(it)}>{it.description}</span>
                      <span style={{color:t.text2,fontFamily:"'DM Mono',monospace",flexShrink:0,whiteSpace:'nowrap'}}>{it.quantity}{it.unit} × ${it.unit_cost} = <span style={{color:t.text,fontWeight:600}}>${(it.total_cost||0).toLocaleString()}</span></span>
                      <button className="del-btn" onClick={async()=>{await supabase.from('takeoff_items').delete().eq('id',it.id);setItems(prev=>prev.filter(i=>i.id!==it.id));}}
                        style={{opacity:0,transition:'opacity 0.1s',background:'none',border:'none',color:'#ef4444',cursor:'pointer',fontSize:12,padding:'0 2px',flexShrink:0,lineHeight:1}}>✕</button>
                    </div>
                  ))}
                </div>
              ))}
              {catGroups.length>0&&(
                <div style={{borderTop:`2px solid ${t.border2}`,marginTop:8,paddingTop:10}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                    <span style={{fontSize:11,fontWeight:700,color:t.text,fontFamily:"'DM Mono',monospace"}}>DIRECT COST</span>
                    <span style={{fontSize:15,fontWeight:800,color:'#10B981',fontFamily:"'DM Mono',monospace"}}>${totalEst.toLocaleString()}</span>
                  </div>
                  {project.contract_value&&<div style={{fontSize:10,color:totalEst>(project.contract_value||0)?'#EF4444':'#10B981',fontFamily:"'DM Mono',monospace",textAlign:'right',marginBottom:12}}>{totalEst>(project.contract_value||0)?'▲ over':'▼ under'} est. contract by ${Math.abs(totalEst-(project.contract_value||0)).toLocaleString()}</div>}
                  <button onClick={()=>setShowBidSummary(true)} style={{width:'100%',background:'linear-gradient(135deg,#10B981,#059669)',border:'none',color:'#000',padding:'9px 0',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:700,marginBottom:8}}>📋 Bid Summary & Print</button>
                  {project.apm_project_id&&<button onClick={pushToSOV} style={{width:'100%',background:'linear-gradient(135deg,#3b82f6,#1d4ed8)',border:'none',color:'#fff',padding:'8px 0',borderRadius:6,cursor:'pointer',fontSize:11,fontWeight:700}}>⇒ Push to APM SOV</button>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {scaleStep==='entering'&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}} onClick={()=>{setScaleStep(null);setScalePts([]);}}>
          <div onClick={e=>e.stopPropagation()} style={{background:t.bg3,border:`1px solid ${t.border2}`,borderRadius:12,padding:28,width:320}}>
            <div style={{fontSize:14,fontWeight:700,color:t.text,marginBottom:12}}>⇔ Calibrate Scale</div>
            <div style={{fontSize:12,color:t.text3,marginBottom:14,fontFamily:"'DM Mono',monospace"}}>Real-world distance between your 2 points?</div>
            <div style={{display:'flex',gap:8,marginBottom:16}}>
              <input type="number" value={scaleDist} onChange={e=>setScaleDist(e.target.value)} placeholder="Distance" style={{...inputStyle,flex:1,fontSize:14}} autoFocus onKeyDown={e=>e.key==='Enter'&&confirmScale()}/>
              <select value={scaleUnit} onChange={e=>setScaleUnit(e.target.value)} style={{...inputStyle,width:60}}>
                <option value="ft">ft</option><option value="in">in</option>
              </select>
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={()=>{setScaleStep(null);setScalePts([]);}} style={{background:'none',border:`1px solid ${t.border2}`,color:t.text3,padding:'7px 14px',borderRadius:6,cursor:'pointer',fontSize:12}}>Cancel</button>
              <button onClick={confirmScale} disabled={!scaleDist} style={{background:'#10B981',border:'none',color:'#000',padding:'7px 18px',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:700,opacity:scaleDist?1:0.4}}>Set Scale</button>
            </div>
          </div>
        </div>
      )}
      {editItem&&<TakeoffItemModal item={editItem} onSave={(data,type)=>{
        if(type==='delete'){setItems(prev=>prev.filter(i=>i.id!==editItem.id));}
        else if(type===true){setItems(prev=>[...prev.filter(i=>i.id!==data.id),data]);}
        else{setItems(prev=>prev.map(i=>i.id===data.id?data:i));}
        setEditItem(null);
      }} onClose={()=>setEditItem(null)}/>}
      {showAssembly&&<AssemblyPicker onApply={applyAssembly} onClose={()=>setShowAssembly(false)}/>}
      {showUnitCosts&&<UnitCostEditor onClose={()=>setShowUnitCosts(false)}/>}
      {showBidSummary&&<BidSummaryModal project={project} items={items} onClose={()=>setShowBidSummary(false)}/>}
      {editProject&&<TakeoffProjectModal project={project} apmProjects={apmProjects} onSave={async(data,type)=>{ if(type!=='delete'&&data){ const {data:updated}=await supabase.from('precon_projects').update({name:data.name,company:data.company,address:data.address,gc_name:data.gc_name,bid_date:data.bid_date,contract_value:data.contract_value,status:data.status,apm_project_id:data.apm_project_id}).eq('id',data.id).select().single(); if(updated) onBack(); } else { onBack(); } setEditProject(false); }} onClose={()=>setEditProject(false)}/>}
    </div>
  );
}

// ── PreconSection (top-level) ─────────────────────────
function FCGEstimating({ onExit }) {
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
      setProjects(pp||[]);
      setApmProjects(ap||[]);
      setLoadingProjects(false);
    });
  },[]);

  const handleSave = async (data, type) => {
    if (type==='delete') {
      await supabase.from('precon_projects').delete().eq('id', data?.id);
      setProjects(prev=>prev.filter(p=>p.id!==data?.id));
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
    ? <TakeoffWorkspace project={selProject} onBack={()=>setSelProject(null)} apmProjects={apmProjects}/>
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

  return (
    <div style={{display:'flex',height:'100vh',width:'100vw',position:'fixed',inset:0,background:'var(--bg)',fontFamily:"'Syne', sans-serif",zIndex:10,overflow:'hidden'}}>

      {/* ── FCG Estimating Sidebar ── */}
      <div style={{width:220,flexShrink:0,background:'#0a0f0a',borderRight:'1px solid #1a2e1a',display:'flex',flexDirection:'column',overflow:'hidden'}}>

        {/* Logo */}
        <div style={{padding:'18px 16px 14px',borderBottom:'1px solid #1a2e1a'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
            <div style={{width:32,height:32,borderRadius:8,background:'linear-gradient(135deg,#10B981,#059669)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>📐</div>
            <div>
              <div style={{fontSize:13,fontWeight:800,color:'#e5e5e5',letterSpacing:-0.3,lineHeight:1.1}}>FCG Estimating</div>
              <div style={{fontSize:9,color:'#10B981',fontFamily:"'DM Mono',monospace",letterSpacing:0.5}}>TAKEOFF · BID · ESTIMATE</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <div style={{padding:'10px 8px',flex:1}}>
          {[
            {id:'projects',icon:'⊞',label:'Projects'},
            {id:'assemblies',icon:'⬡',label:'Assembly Library'},
            {id:'rates',icon:'$',label:'Unit Cost Rates'},
          ].map(item=>(
            <button key={item.id} onClick={()=>{ if(item.id==='rates'){/* handled below */} setEstiPage(item.id); if(selProject) setSelProject(null); }}
              style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'8px 10px',borderRadius:6,cursor:'pointer',background:estiPage===item.id?'rgba(16,185,129,0.12)':'none',border:estiPage===item.id?'1px solid rgba(16,185,129,0.25)':'1px solid transparent',marginBottom:2,textAlign:'left'}}>
              <span style={{fontSize:14,color:estiPage===item.id?'#10B981':'#4a6a4a'}}>{item.icon}</span>
              <span style={{fontSize:12,fontWeight:600,color:estiPage===item.id?'#e5e5e5':'#6a8a6a'}}>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Stats */}
        <div style={{padding:'12px 14px',borderTop:'1px solid #1a2e1a'}}>
          {[
            {label:'Total Bids',val:projects.length},
            {label:'Estimating',val:projects.filter(p=>p.status==='estimating').length,color:'#F59E0B'},
            {label:'Awarded',val:projects.filter(p=>p.status==='awarded').length,color:'#10B981'},
          ].map(s=>(
            <div key={s.label} style={{display:'flex',justifyContent:'space-between',padding:'3px 0'}}>
              <span style={{fontSize:10,color:'#4a6a4a',fontFamily:"'DM Mono',monospace"}}>{s.label}</span>
              <span style={{fontSize:10,fontWeight:700,color:s.color||'#e5e5e5',fontFamily:"'DM Mono',monospace"}}>{s.val}</span>
            </div>
          ))}
        </div>

        {/* Back to OPS */}
        <div style={{padding:'10px 8px',borderTop:'1px solid #1a2e1a'}}>
          <button onClick={onExit} style={{width:'100%',padding:'7px 10px',borderRadius:6,border:'1px solid #1a2e1a',background:'none',color:'#4a6a4a',cursor:'pointer',fontSize:11,fontFamily:"'DM Mono',monospace",display:'flex',alignItems:'center',gap:6}}>
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
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap'); *{box-sizing:border-box;margin:0;padding:0} @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
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
  const [appSection, setAppSection] = useState("ops"); // "ops" | "apm" | "precon"
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
  if (authLoading) return <div style={{ minHeight: "100dvh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", color: "#333", fontFamily: "monospace" }}>◌</div>;
  if (!user) return <LoginScreen />;

  // FCG Estimating — full-screen takeover
  if (appSection === "precon") {
    return <FCGEstimating onExit={() => setAppSection("ops")} />;
  }

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
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: var(--bg); }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: var(--bg3); }
        ::-webkit-scrollbar-thumb { background: var(--bd2); border-radius: 2px; }
        select option { background: var(--bg3); color: var(--tx); }
        @keyframes slideIn { from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)} }
        @keyframes spin { from{transform:rotate(0deg)}to{transform:rotate(360deg)} }
      `}</style>

      {ghostTask && ghostPos && <DragGhost task={ghostTask} pos={ghostPos} team={team} />}

      <div style={{ display: "flex", height: "100vh", background: "var(--bg)", fontFamily: "'Syne', sans-serif", overflow: "hidden", cursor: draggingId ? "grabbing" : "default" }}>

        {/* SIDEBAR */}
        <div style={{ width: sidebarOpen ? 220 : 0, minWidth: sidebarOpen ? 220 : 0, background: "var(--bg2)", borderRight: "1px solid var(--bd)", display: "flex", flexDirection: "column", overflow: "hidden", transition: "width 0.2s, min-width 0.2s", flexShrink: 0 }}>
          <div style={{ padding: "16px 14px 12px", borderBottom: "1px solid #1a1a1a" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: "linear-gradient(135deg, #F97316, #ea580c)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 14 }}>⬡</span>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--tx)", letterSpacing: -0.3 }}>FCG / BR OPS</div>
                <div style={{ fontSize: 9.5, color: "var(--tx4)", fontFamily: "'DM Mono', monospace", letterSpacing: 0.5 }}>OPERATIONS</div>
              </div>
            </div>
            <div style={{ display: "flex", background: "var(--bg4)", borderRadius: 6, overflow: "hidden", border: "1px solid var(--bd2)" }}>
              <button onClick={() => setAppSection("ops")} style={{ flex: 1, padding: "6px 0", background: appSection === "ops" ? "#F9731618" : "none", border: "none", color: appSection === "ops" ? "#F97316" : "var(--tx4)", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono', monospace" }}>OPS BOARD</button>
              <button onClick={() => setAppSection("apm")} style={{ flex: 1, padding: "6px 0", background: appSection === "apm" ? "#3B82F618" : "none", border: "none", color: appSection === "apm" ? "#3B82F6" : "var(--tx4)", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono', monospace" }}>APM</button>
              <button onClick={() => setAppSection("precon")} style={{ flex: 1, padding: "6px 0", background: appSection === "precon" ? "#10B98118" : "none", border: "none", color: appSection === "precon" ? "#10B981" : "var(--tx4)", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono', monospace" }}>ESTIMATE</button>
            </div>
          </div>

          <div style={{ padding: "14px 10px", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
            <div style={{ marginBottom: 16 }}>
              {[["tasks","Tasks","⊞"],["settings","Settings","⚙"]].map(([id, label, icon]) => (
                <button key={id} onClick={() => setPage(id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "7px 8px", borderRadius: 6, cursor: "pointer", background: page === id ? "#F9731615" : "none", border: page === id ? "1px solid #F9731630" : "1px solid transparent", marginBottom: 2, textAlign: "left" }}>
                  <span style={{ fontSize: 13, color: page === id ? "#F97316" : "var(--tx4)" }}>{icon}</span>
                  <span style={{ fontSize: 12, color: page === id ? "var(--tx)" : "var(--tx3)" }}>{label}</span>
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
                      <span style={{ fontSize: 12, color: active ? "var(--tx)" : "var(--tx3)", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{co.id === "all" ? "All Companies" : co.name}</span>
                      <span style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: active ? co.color : "var(--tx4)" }}>{count}</span>
                    </button>
                  );
                })}
                <div style={{ fontSize: 9.5, color: "#3a3a3a", letterSpacing: 1.2, fontFamily: "'DM Mono', monospace", padding: "0 8px", marginBottom: 8, marginTop: 18 }}>TEAM</div>
                {team.map(m => (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", marginBottom: 2 }}>
                    <Avatar member={m} size={22} />
                    <span style={{ fontSize: 12, color: "var(--tx3)" }}>{m.name}</span>
                    <span style={{ fontSize: 10, color: "var(--tx4)", marginLeft: "auto", fontFamily: "'DM Mono', monospace" }}>{tasks.filter(t => t.assignee === m.id && t.status !== "done").length}</span>
                  </div>
                ))}
              </>
            )}

            <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid var(--bd)" }}>
              <button onClick={() => setDigestOpen(true)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 6, cursor: "pointer", background: "#0a1a12", border: "1px solid #10B98130", color: "#10B981", fontSize: 12, fontWeight: 600, fontFamily: "'Syne', sans-serif", marginBottom: 6 }}
                onMouseEnter={e => e.currentTarget.style.background = "#0d2218"}
                onMouseLeave={e => e.currentTarget.style.background = "#0a1a12"}
              >
                <span style={{ fontSize: 14 }}>✉</span> Send Digest
              </button>
              <button onClick={handleSignOut} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 6, cursor: "pointer", background: "none", border: "1px solid var(--bd2)", color: "var(--tx4)", fontSize: 12, fontFamily: "'Syne', sans-serif" }}
                onMouseEnter={e => e.currentTarget.style.color = "var(--tx)"}
                onMouseLeave={e => e.currentTarget.style.color = "var(--tx4)"}
              >
                <span style={{ fontSize: 13 }}>⏻</span> Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* MAIN */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* TOPBAR */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 20px", height: 56, borderBottom: "1px solid var(--bd)", flexShrink: 0 }}>
            <button onClick={() => setSidebarOpen(s => !s)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--tx4)", fontSize: 16, padding: "4px 6px" }}>☰</button>
            {!sidebarOpen && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 20, height: 20, borderRadius: 4, background: "linear-gradient(135deg, #F97316, #ea580c)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>⬡</div>
                <span style={{ fontSize: 13, fontWeight: 800, color: "var(--tx)" }}>FCG / BR OPS</span>
              </div>
            )}
            {/* Dark mode toggle */}
            <ThemeToggle />
            {/* OPS / APM toggle — always visible */}
            <div style={{ display: "flex", background: "var(--bg4)", borderRadius: 6, overflow: "hidden", border: "1px solid var(--bd2)" }}>
              <button onClick={() => setAppSection("ops")} style={{ padding: "5px 12px", background: appSection === "ops" ? "#F9731618" : "none", border: "none", color: appSection === "ops" ? "#F97316" : "var(--tx4)", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono', monospace" }}>OPS</button>
              <button onClick={() => setAppSection("apm")} style={{ padding: "5px 12px", background: appSection === "apm" ? "#3B82F618" : "none", border: "none", color: appSection === "apm" ? "#3B82F6" : "var(--tx4)", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono', monospace" }}>APM</button>
              <button onClick={() => setAppSection("precon")} style={{ padding: "5px 12px", background: appSection === "precon" ? "#10B98118" : "none", border: "none", color: appSection === "precon" ? "#10B981" : "var(--tx4)", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Mono', monospace" }}>ESTIMATE</button>
            </div>
            <div style={{ flex: 1 }}>
              {appSection === "ops" && page === "tasks" && activeCompany !== "all" && <CompanyBadge companyId={activeCompany} />}
            </div>
            {page === "tasks" && (
              <>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#333", fontSize: 13 }}>⌕</span>
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks..." style={{ background: "var(--bg3)", border: "1px solid var(--bd)", borderRadius: 6, padding: "6px 12px 6px 30px", color: "var(--tx2)", fontSize: 12, fontFamily: "'DM Mono', monospace", outline: "none", width: 190 }} />
                </div>
                <div style={{ display: "flex", background: "var(--bg3)", border: "1px solid var(--bd)", borderRadius: 6, overflow: "hidden" }}>
                  {[["kanban","⊞"],["list","≡"]].map(([v, icon]) => (
                    <button key={v} onClick={() => setView(v)} style={{ padding: "6px 12px", background: view === v ? "var(--bg5)" : "none", border: "none", cursor: "pointer", color: view === v ? "var(--tx)" : "var(--tx4)", fontSize: 14 }}>{icon}</button>
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
            <div style={{ display: "flex", borderBottom: "1px solid var(--bd)", flexShrink: 0 }}>
              {[
                { label: "Total", val: stats.total, color: "var(--tx3)" },
                { label: "In Progress", val: stats.inprogress, color: "#F59E0B" },
                { label: "Overdue", val: stats.overdue, color: "#EF4444" },
                { label: "Done", val: stats.done, color: "#10B981" },
              ].map((s, i) => (
                <div key={i} style={{ padding: "10px 20px", borderRight: "1px solid var(--bd)", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: s.color, fontFamily: "'DM Mono', monospace" }}>{s.val}</span>
                  <span style={{ fontSize: 10.5, color: "#3a3a3a", fontFamily: "'DM Mono', monospace", letterSpacing: 0.5 }}>{s.label.toUpperCase()}</span>
                </div>
              ))}
            </div>
          )}

          {/* PAGE */}
          {appSection === "precon" ? (
            <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
              <FCGEstimating />
            </div>
          ) : appSection === "apm" ? (
            <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
              <APMSection />
            </div>
          ) : page === "settings" ? (
            <SettingsPage team={team} onTeamChange={setTeam} />
          ) : (
            <div style={{ flex: 1, overflow: "auto", padding: 20, height: 0, background: "var(--bg)" }}>
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
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, paddingBottom: 10, borderBottom: `1.5px solid ${isOver ? "#F97316" : "var(--bd)"}`, transition: "border-color 0.12s" }}>
                          <span style={{ fontSize: 14, color: isOver ? "#F97316" : "#666" }}>{status.icon}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: isOver ? "#F97316" : "var(--tx2)", letterSpacing: 1, fontFamily: "'DM Mono', monospace", textTransform: "uppercase" }}>{status.label}</span>
                          <span style={{ marginLeft: "auto", background: "var(--bg5)", color: "var(--tx3)", borderRadius: 10, padding: "2px 7px", fontSize: 11, fontFamily: "'DM Mono', monospace" }}>{colTasks.length}</span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minHeight: 200, borderRadius: 8, padding: isOver ? "6px" : "0", background: isOver ? "#F9731610" : "transparent", border: isOver ? "1.5px dashed #F9731650" : "1.5px solid transparent", transition: "all 0.12s" }}>
                          {colTasks.map(t => <TaskCard key={t.id} task={t} onEdit={openEdit} onMouseDownDrag={handleMouseDownDrag} isDragging={draggingId === t.id} team={team} attachmentCounts={attachmentCounts} />)}
                          {colTasks.length === 0 && !isOver && <div style={{ border: "1px dashed var(--bd2)", borderRadius: 8, padding: "18px 0", textAlign: "center", color: "var(--tx4)", fontSize: 11, fontFamily: "'DM Mono', monospace" }}>empty</div>}
                          {isOver && <div style={{ border: "1.5px dashed #F9731680", borderRadius: 8, padding: "14px 0", textAlign: "center", color: "#F97316", fontSize: 11, fontFamily: "'DM Mono', monospace" }}>↓ drop here</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ maxWidth: 900 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 110px 80px 100px 90px", gap: 10, padding: "8px 14px", marginBottom: 6, fontSize: 9.5, fontFamily: "'DM Mono', monospace", color: "var(--tx4)", letterSpacing: 0.8, textTransform: "uppercase" }}>
                    <span>Task</span><span>Company</span><span>Assignee</span><span>Priority</span><span>Status</span><span>Due</span>
                  </div>
                  {filtered.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#333", fontFamily: "'DM Mono', monospace", fontSize: 12 }}>No tasks found</div>}
                  {filtered.map(task => {
                    const member = getMember(task.assignee, team);
                    const isOverdue = task.status !== "done" && task.due && new Date(task.due) < new Date();
                    const attachCount = attachmentCounts?.[task.id] || 0;
                    return (
                      <div key={task.id} onClick={() => openEdit(task)} style={{ display: "grid", gridTemplateColumns: "1fr 80px 110px 80px 100px 90px", gap: 10, padding: "11px 14px", borderRadius: 7, cursor: "pointer", background: "var(--bg3)", border: "1px solid var(--bd)", marginBottom: 4, alignItems: "center", animation: "slideIn 0.15s ease-out" }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = "var(--bd2)"}
                        onMouseLeave={e => e.currentTarget.style.borderColor = "var(--bg5)"}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                          <span style={{ fontSize: 13, color: "var(--tx)", fontFamily: "'Syne', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.title}</span>
                          {attachCount > 0 && <span style={{ fontSize: 10, color: "var(--tx4)", fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>📎{attachCount}</span>}
                        </div>
                        <CompanyBadge companyId={task.company} small />
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}><Avatar member={member} size={20} /><span style={{ fontSize: 11, color: "var(--tx3)" }}>{member.name}</span></div>
                        <PriorityDot priorityId={task.priority} />
                        <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: task.status === "done" ? "#10B981" : task.status === "inprogress" ? "#F59E0B" : "var(--tx3)" }}>{STATUSES.find(s => s.id === task.status)?.label}</span>
                        <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: isOverdue ? "#EF4444" : "var(--tx4)" }}>
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

      {editTask !== null && <TaskModal task={editTask} isNew={isNew} onClose={closeModal} onSave={handleSave} onDelete={handleDelete} team={team} allProjects={allProjects} />}
      {aiOpen && <AIModal onClose={() => setAiOpen(false)} onAdd={handleAiAdd} team={team} />}
      {digestOpen && <DigestModal tasks={tasks} team={team} onClose={() => setDigestOpen(false)} />}
    </>
  );
}
