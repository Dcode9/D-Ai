import { useState, useMemo } from "react";
import type { Conversation, Project } from "../hooks/useChat";
import { cn } from "../utils/cn";

type Props = {
  open: boolean;
  onClose: () => void;
  conversations: Conversation[];
  projects: Project[];
  activeId: string | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onPin: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
  onBranch: (id: string) => void;
  onCreateProject: (name: string, color?: string) => void;
  onRenameProject: (id: string, newName: string) => void;
  onDeleteProject: (id: string) => void;
  onAssignToProject: (chatId: string, projectId: string | null) => void;
};

const fmt = (ts: number) => {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export function HistoryDrawer({
  open,
  onClose,
  conversations,
  projects,
  activeId,
  onOpen,
  onDelete,
  onPin,
  onRename,
  onBranch,
  onCreateProject,
  onRenameProject,
  onDeleteProject,
  onAssignToProject,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingChatTitle, setEditingChatTitle] = useState("");
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState("");
  const [movingChatId, setMovingChatId] = useState<string | null>(null);

  // Filter conversations by search
  const filteredConversations = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.messages.some((m) => m.content.toLowerCase().includes(q)),
    );
  }, [conversations, searchQuery]);

  // Pinned conversations
  const pinnedChats = useMemo(
    () => filteredConversations.filter((c) => c.pinned),
    [filteredConversations],
  );

  // Unpinned chats mapped by project
  const { unassignedRoots, projectChatsMap } = useMemo(() => {
    const unpinned = filteredConversations.filter((c) => !c.pinned);
    const unassigned: Conversation[] = [];
    const projMap: Record<string, Conversation[]> = {};

    projects.forEach((p) => {
      projMap[p.id] = [];
    });

    unpinned.forEach((c) => {
      if (c.projectId && projMap[c.projectId]) {
        projMap[c.projectId].push(c);
      } else {
        // Group top-level roots without project
        if (!c.parentId) {
          unassigned.push(c);
        } else {
          // If parent is not in project, add to unassigned list
          unassigned.push(c);
        }
      }
    });

    return { unassignedRoots: unassigned, projectChatsMap: projMap };
  }, [filteredConversations, projects]);

  // Hierarchical map for rendering tree branches (Parent -> Children)
  const childrenMap = useMemo(() => {
    const map: Record<string, Conversation[]> = {};
    conversations.forEach((c) => {
      if (c.parentId) {
        if (!map[c.parentId]) map[c.parentId] = [];
        map[c.parentId].push(c);
      }
    });
    return map;
  }, [conversations]);

  const toggleProjectCollapse = (pId: string) => {
    setCollapsedProjects((prev) => ({ ...prev, [pId]: !prev[pId] }));
  };

  const handleStartRename = (c: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingChatId(c.id);
    setEditingChatTitle(c.title);
  };

  const handleSaveRename = (cId: string) => {
    if (editingChatTitle.trim()) {
      onRename(cId, editingChatTitle.trim());
    }
    setEditingChatId(null);
  };

  const handleCreateProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newProjectName.trim()) {
      onCreateProject(newProjectName.trim());
      setNewProjectName("");
      setIsCreatingProject(false);
    }
  };

  // Recursive tree item renderer for chats and branches
  const renderChatItem = (c: Conversation, depth: number = 0) => {
    const isEditing = editingChatId === c.id;
    const isMoving = movingChatId === c.id;
    const isBranch = Boolean(c.parentId);
    const childBranches = childrenMap[c.id] || [];
    const hasChildren = childBranches.length > 0;

    return (
      <div key={c.id} className="relative select-none">
        <div
          style={{ paddingLeft: `${Math.min(depth * 14 + 10, 56)}px` }}
          className={cn(
            "group relative flex items-center justify-between rounded-sm py-2 pr-2 text-left transition-all duration-150",
            c.id === activeId
              ? "bg-gold/15 text-cream shadow-[inset_2px_0_0_#D4AF37]"
              : "text-cream/90 hover:bg-white/[.04]",
          )}
        >
          {/* Branch hierarchical connector line */}
          {depth > 0 && (
            <span
              style={{ left: `${depth * 14 - 4}px` }}
              className="pointer-events-none absolute top-1/2 -translate-y-1/2 font-mono text-[11px] text-gold/40"
            >
              ↳
            </span>
          )}

          <div
            className="min-w-0 flex-1 cursor-pointer pr-1"
            onClick={() => {
              onOpen(c.id);
              onClose();
            }}
          >
            {isEditing ? (
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  value={editingChatTitle}
                  onChange={(e) => setEditingChatTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveRename(c.id);
                    if (e.key === "Escape") setEditingChatId(null);
                  }}
                  autoFocus
                  className="w-full rounded border border-gold/50 bg-ink px-2 py-0.5 font-body text-[13.5px] text-cream outline-none focus:border-gold"
                />
                <button
                  type="button"
                  onClick={() => handleSaveRename(c.id)}
                  className="cursor-pointer text-[11px] text-gold hover:text-cream px-1"
                >
                  ✓
                </button>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-1.5">
                  {isBranch && (
                    <span
                      title="Branch of conversation"
                      className="font-mono text-[11px] text-gold/70 select-none shrink-0"
                    >
                      ⑂
                    </span>
                  )}
                  <span className="line-clamp-1 font-body text-[14.5px] font-medium leading-snug">
                    {c.title}
                  </span>
                  {c.pinned && (
                    <span title="Pinned conversation" className="text-[10px] text-gold shrink-0">
                      📌
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-2 font-body text-[11px] text-muted">
                  <span>{fmt(c.updatedAt || c.createdAt)}</span>
                  {c.messages.length > 0 && (
                    <span>• {c.messages.length} msg{c.messages.length === 1 ? "" : "s"}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quick inline action bar */}
          {!isEditing && (
            <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              {/* Branch button */}
              <button
                type="button"
                title="Branch conversation from here"
                onClick={(e) => {
                  e.stopPropagation();
                  onBranch(c.id);
                  onClose();
                }}
                className="cursor-pointer p-1 text-gold/50 hover:text-cream transition-colors"
              >
                <span className="font-mono text-[12px]">⑂</span>
              </button>

              {/* Pin/Unpin */}
              <button
                type="button"
                title={c.pinned ? "Unpin conversation" : "Pin conversation"}
                onClick={(e) => {
                  e.stopPropagation();
                  onPin(c.id);
                }}
                className="cursor-pointer p-1 text-gold/50 hover:text-cream transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill={c.pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="17" x2="12" y2="22" />
                  <path d="M5 17h14v-2l-2-3V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v7l-2 3v2z" />
                </svg>
              </button>

              {/* Move to Project */}
              <button
                type="button"
                title="Assign to project"
                onClick={(e) => {
                  e.stopPropagation();
                  setMovingChatId(isMoving ? null : c.id);
                }}
                className="cursor-pointer p-1 text-gold/50 hover:text-cream transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              </button>

              {/* Rename */}
              <button
                type="button"
                title="Rename conversation"
                onClick={(e) => handleStartRename(c, e)}
                className="cursor-pointer p-1 text-gold/50 hover:text-cream transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>

              {/* Delete */}
              <button
                type="button"
                title="Delete conversation & branches"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`Delete “${c.title}” and any nested branches?`)) {
                    onDelete(c.id);
                  }
                }}
                className="cursor-pointer p-1 text-gold/50 hover:!text-red-400 transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Project assignment popup dropdown */}
        {isMoving && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="my-1 ml-4 rounded border border-gold/30 bg-ink-2 p-2 shadow-lg"
          >
            <div className="mb-1 text-[11px] uppercase tracking-wider text-gold/70">
              Assign to Project:
            </div>
            <button
              type="button"
              onClick={() => {
                onAssignToProject(c.id, null);
                setMovingChatId(null);
              }}
              className={cn(
                "w-full text-left px-2 py-1 text-[12px] rounded hover:bg-gold/10 transition-colors",
                !c.projectId ? "text-gold font-semibold" : "text-cream/70",
              )}
            >
              (No Project)
            </button>
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onAssignToProject(c.id, p.id);
                  setMovingChatId(null);
                }}
                className={cn(
                  "w-full text-left px-2 py-1 text-[12px] rounded hover:bg-gold/10 transition-colors flex items-center gap-1.5",
                  c.projectId === p.id ? "text-gold font-semibold" : "text-cream/80",
                )}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color || "#D4AF37" }} />
                <span>{p.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Render child branches recursively */}
        {hasChildren && (
          <div className="relative">
            {childBranches.map((child) => renderChatItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div
        className={cn(
          "absolute inset-0 z-30 bg-black/50 backdrop-blur-[2px] transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          "absolute left-0 top-0 z-40 flex h-full w-[350px] max-w-[88vw] flex-col bg-[#110e13]/95 shadow-[0_0_60px_rgba(0,0,0,.75)] transition-transform duration-500 ease-[cubic-bezier(.2,.7,.2,1)] backdrop-blur-md",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Double-rail heraldic gold border */}
        <div className="pointer-events-none absolute inset-2.5 border border-gold/40" />
        <div className="pointer-events-none absolute inset-[14px] border border-gold/15" />

        {/* Drawer Header */}
        <div className="relative flex items-center justify-between px-7 pb-3 pt-6">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-[26px] tracking-wide text-cream">Archives</h2>
            <span className="font-mono text-[11px] text-gold/60">[{conversations.length}]</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer text-gold/70 transition-colors hover:text-cream p-1"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative px-6 py-2">
          <div className="relative flex items-center">
            <svg
              className="absolute left-3 h-3.5 w-3.5 text-gold/50 pointer-events-none"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search chronicles & lineage…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded border border-gold/25 bg-black/40 py-1.5 pl-8 pr-3 font-body text-[13px] text-cream placeholder-gold/30 outline-none transition-colors focus:border-gold/60 focus:bg-black/60"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 text-[11px] text-gold/60 hover:text-cream"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="relative mx-6 h-px bg-gradient-to-r from-gold/50 via-gold/20 to-transparent" />

        {/* Scrollable conversation list */}
        <div className="scroll-gold relative flex-1 overflow-y-auto px-5 py-3 space-y-4">
          {/* PINNED SECTION */}
          {pinnedChats.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 px-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-gold/80">
                <span>📌 Pinned</span>
                <span className="font-mono text-[10px] text-gold/50">({pinnedChats.length})</span>
              </div>
              <div className="space-y-0.5">
                {pinnedChats.map((c) => renderChatItem(c, 0))}
              </div>
            </div>
          )}

          {/* PROJECTS SECTION */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-gold/80">
                Projects
              </span>
              <button
                type="button"
                onClick={() => setIsCreatingProject(!isCreatingProject)}
                className="flex cursor-pointer items-center gap-1 text-[11px] text-gold/70 hover:text-cream transition-colors"
              >
                <span>+ New</span>
              </button>
            </div>

            {/* Inline Project Creator */}
            {isCreatingProject && (
              <form
                onSubmit={handleCreateProjectSubmit}
                className="mx-1 rounded border border-gold/30 bg-ink p-2 space-y-2"
              >
                <input
                  type="text"
                  placeholder="Project name…"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  autoFocus
                  className="w-full rounded border border-gold/30 bg-black/50 px-2 py-1 font-body text-[13px] text-cream outline-none focus:border-gold"
                />
                <div className="flex justify-end gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setIsCreatingProject(false)}
                    className="cursor-pointer text-muted hover:text-cream"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="cursor-pointer rounded bg-gold/20 px-2.5 py-0.5 text-gold hover:bg-gold/30 hover:text-cream"
                  >
                    Create
                  </button>
                </div>
              </form>
            )}

            {/* Projects list */}
            {projects.map((proj) => {
              const isCollapsed = Boolean(collapsedProjects[proj.id]);
              const projChats = (projectChatsMap[proj.id] || []).filter((c) => !c.parentId);
              const isEditingProj = editingProjectId === proj.id;

              return (
                <div key={proj.id} className="rounded border border-gold/15 bg-black/20 overflow-hidden">
                  <div className="flex items-center justify-between px-2.5 py-1.5 hover:bg-white/[.02] transition-colors">
                    <button
                      type="button"
                      onClick={() => toggleProjectCollapse(proj.id)}
                      className="flex flex-1 items-center gap-2 text-left cursor-pointer"
                    >
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: proj.color || "#D4AF37" }}
                      />
                      {isEditingProj ? (
                        <input
                          type="text"
                          value={editingProjectName}
                          onChange={(e) => setEditingProjectName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              if (editingProjectName.trim()) onRenameProject(proj.id, editingProjectName.trim());
                              setEditingProjectId(null);
                            }
                            if (e.key === "Escape") setEditingProjectId(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                          className="rounded border border-gold/40 bg-ink px-1.5 py-0.5 text-[12px] text-cream outline-none"
                        />
                      ) : (
                        <span className="line-clamp-1 font-body text-[13px] font-medium text-cream/90">
                          {proj.name}
                        </span>
                      )}
                      <span className="font-mono text-[10px] text-gold/50">({projChats.length})</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        title="Rename project"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingProjectId(proj.id);
                          setEditingProjectName(proj.name);
                        }}
                        className="p-1 text-gold/40 hover:text-cream text-[10px]"
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        title="Delete project"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Delete project “${proj.name}”? Chats will be unassigned.`)) {
                            onDeleteProject(proj.id);
                          }
                        }}
                        className="p-1 text-gold/40 hover:text-red-400 text-[10px]"
                      >
                        ✕
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleProjectCollapse(proj.id)}
                        className="p-1 text-gold/60"
                      >
                        <svg
                          className={cn("h-3 w-3 transition-transform", !isCollapsed && "rotate-90")}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Project conversation items */}
                  {!isCollapsed && (
                    <div className="border-t border-gold/10 px-1 py-1 space-y-0.5 bg-black/10">
                      {projChats.length === 0 ? (
                        <div className="px-3 py-1 text-[11px] italic text-muted">
                          No conversations in this project.
                        </div>
                      ) : (
                        projChats.map((c) => renderChatItem(c, 0))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ALL CHATS & BRANCHES */}
          <div className="space-y-1 pt-1">
            <div className="flex items-center justify-between px-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-gold/80">
              <span>All Chronicles</span>
            </div>

            {unassignedRoots.length === 0 && conversations.length === 0 && (
              <p className="px-2 pt-2 font-body text-[14px] italic leading-relaxed text-muted">
                No conversations recorded yet.
              </p>
            )}

            <div className="space-y-0.5">
              {unassignedRoots.map((c) => renderChatItem(c, 0))}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
