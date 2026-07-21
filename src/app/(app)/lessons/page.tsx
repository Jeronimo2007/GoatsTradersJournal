"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Lightbulb,
  Pin,
  PinOff,
  Trash2,
  Pencil,
  Check,
  X,
} from "lucide-react";
import {
  fetchLessons,
  createLesson,
  updateLesson,
  deleteLesson,
} from "@/lib/api";
import type { Lesson } from "@/lib/types";
import { LESSON_MAX_LENGTH } from "@/lib/types";
import { formatRelativeTime, formatDateTime } from "@/lib/format";
import { Chip, EmptyState } from "@/components/ui";
import clsx from "clsx";

export default function LessonsPage() {
  const [lessons, setLessons] = useState<Lesson[] | undefined>(undefined);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  useEffect(() => {
    fetchLessons().then(setLessons);
  }, []);

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of lessons ?? []) {
      for (const t of l.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag, count]) => ({ tag, count }));
  }, [lessons]);

  const visible = useMemo(() => {
    if (!lessons) return [];
    if (!activeTag) return lessons;
    return lessons.filter((l) => l.tags.includes(activeTag));
  }, [lessons, activeTag]);

  const handleCreate = async (text: string) => {
    const created = await createLesson({ text });
    setLessons((prev) => sortLessons([created, ...(prev ?? [])]));
  };

  const handleDelete = async (id: number) => {
    setLessons((prev) => prev?.filter((l) => l.id !== id));
    await deleteLesson(id);
  };

  const handleTogglePin = async (lesson: Lesson) => {
    const updated = await updateLesson(lesson.id, { pinned: !lesson.pinned });
    setLessons((prev) =>
      sortLessons((prev ?? []).map((l) => (l.id === lesson.id ? updated : l)))
    );
  };

  const handleEdit = async (id: number, text: string) => {
    const updated = await updateLesson(id, { text });
    setLessons((prev) =>
      sortLessons((prev ?? []).map((l) => (l.id === id ? updated : l)))
    );
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold">Lecciones</h1>
        <p className="text-sm text-muted">
          Anota aprendizajes y conclusiones — compartidos entre todas las cuentas. Añade{" "}
          <span className="text-accent">#etiquetas</span> para agruparlas.
        </p>
      </div>

      <Composer onPost={handleCreate} />

      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setActiveTag(null)}>
            <Chip tone={activeTag === null ? "accent" : "default"}>Todas</Chip>
          </button>
          {allTags.map(({ tag, count }) => (
            <button
              key={tag}
              onClick={() => setActiveTag((cur) => (cur === tag ? null : tag))}
            >
              <Chip tone={activeTag === tag ? "accent" : "default"}>
                #{tag} <span className="ml-1 opacity-60">{count}</span>
              </Chip>
            </button>
          ))}
        </div>
      )}

      {lessons === undefined ? (
        <div className="text-muted">Cargando lecciones…</div>
      ) : visible.length === 0 ? (
        <EmptyState
          title={activeTag ? `No hay lecciones con la etiqueta #${activeTag}` : "Aún no hay lecciones"}
          description={
            activeTag
              ? "Intenta con una etiqueta diferente o limpia el filtro."
              : "Publica tu primer aprendizaje arriba — un error a evitar, una configuración que funcionó, o una regla para recordar."
          }
        />
      ) : (
        <div className="space-y-3">
          {visible.map((lesson) => (
            <LessonCard
              key={lesson.id}
              lesson={lesson}
              onDelete={() => handleDelete(lesson.id)}
              onTogglePin={() => handleTogglePin(lesson)}
              onEdit={(text) => handleEdit(lesson.id, text)}
              onTagClick={(tag) => setActiveTag((cur) => (cur === tag ? null : tag))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function sortLessons(lessons: Lesson[]): Lesson[] {
  return [...lessons].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function Avatar() {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
      <Lightbulb className="h-5 w-5" />
    </div>
  );
}

function Composer({ onPost }: { onPost: (text: string) => Promise<void> }) {
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  const autoGrow = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  const remaining = LESSON_MAX_LENGTH - text.length;
  const canPost = text.trim().length > 0 && remaining >= 0 && !posting;

  const submit = async () => {
    if (!canPost) return;
    setPosting(true);
    try {
      await onPost(text.trim());
      setText("");
      requestAnimationFrame(() => {
        if (ref.current) ref.current.style.height = "auto";
      });
    } finally {
      setPosting(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="card p-4">
      <div className="flex gap-3">
        <Avatar />
        <div className="flex-1 min-w-0">
          <textarea
            ref={ref}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              autoGrow();
            }}
            onKeyDown={onKeyDown}
            rows={2}
            placeholder="¿Qué aprendiste hoy?"
            className="w-full resize-none bg-transparent text-base leading-relaxed text-foreground outline-none placeholder:text-muted"
          />
          <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-3">
            <span className="text-xs text-muted">⌘/Ctrl + Enter para publicar</span>
            <div className="flex items-center gap-3">
              <CharCount remaining={remaining} />
              <button
                onClick={submit}
                disabled={!canPost}
                className="btn btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {posting ? "Publicando…" : "Publicar"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CharCount({ remaining }: { remaining: number }) {
  if (remaining > 100) return null;
  const over = remaining < 0;
  return (
    <span
      className={clsx(
        "text-xs tabular-nums",
        over ? "text-loss font-semibold" : remaining <= 20 ? "text-warning" : "text-muted"
      )}
    >
      {remaining}
    </span>
  );
}

function LessonCard({
  lesson,
  onDelete,
  onTogglePin,
  onEdit,
  onTagClick,
}: {
  lesson: Lesson;
  onDelete: () => void;
  onTogglePin: () => void;
  onEdit: (text: string) => Promise<void>;
  onTagClick: (tag: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(lesson.text);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!draft.trim() || draft.trim() === lesson.text) {
      setEditing(false);
      setDraft(lesson.text);
      return;
    }
    setSaving(true);
    try {
      await onEdit(draft.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card p-4">
      <div className="flex gap-3">
        <Avatar />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold">Me</span>
              <span
                className="text-muted"
                title={formatDateTime(lesson.createdAt)}
              >
                · {formatRelativeTime(lesson.createdAt)}
              </span>
              {lesson.pinned && (
                  <span className="inline-flex items-center gap-1 text-xs text-accent">
                    <Pin className="h-3 w-3" /> Fijado
                  </span>
              )}
            </div>
            {!editing && (
              <div className="flex items-center gap-1 text-muted">
                <IconButton title="Editar" onClick={() => setEditing(true)}>
                  <Pencil className="h-4 w-4" />
                </IconButton>
                <IconButton
                  title={lesson.pinned ? "Desfijar" : "Fijar"}
                  onClick={onTogglePin}
                >
                  {lesson.pinned ? (
                    <PinOff className="h-4 w-4" />
                  ) : (
                    <Pin className="h-4 w-4" />
                  )}
                </IconButton>
                <IconButton title="Eliminar" danger onClick={onDelete}>
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </div>
            )}
          </div>

          {editing ? (
            <div className="mt-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={LESSON_MAX_LENGTH}
                rows={3}
                className="field-textarea"
                autoFocus
              />
              <div className="mt-2 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setEditing(false);
                    setDraft(lesson.text);
                  }}
                  className="btn btn-ghost"
                >
                  <X className="h-4 w-4" /> Cancelar
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  className="btn btn-primary disabled:opacity-40"
                >
                  <Check className="h-4 w-4" /> {saving ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-1 whitespace-pre-wrap break-words text-[0.95rem] leading-relaxed">
              <LessonText text={lesson.text} onTagClick={onTagClick} />
            </p>
          )}

          {lesson.updatedAt !== lesson.createdAt && !editing && (
            <div className="mt-2 text-[11px] text-muted">
              editado {formatRelativeTime(lesson.updatedAt)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Renders the text with #hashtags highlighted as clickable accents. */
function LessonText({
  text,
  onTagClick,
}: {
  text: string;
  onTagClick: (tag: string) => void;
}) {
  const parts = text.split(/(#[\p{L}\p{N}_]+)/gu);
  return (
    <>
      {parts.map((part, i) => {
        if (/^#[\p{L}\p{N}_]+$/u.test(part)) {
          const tag = part.slice(1).toLowerCase();
          return (
            <button
              key={i}
              onClick={() => onTagClick(tag)}
              className="text-accent hover:underline"
            >
              {part}
            </button>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function IconButton({
  children,
  title,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      className={clsx(
        "rounded-md p-1.5 transition-colors hover:bg-surface-2",
        danger ? "hover:text-loss" : "hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
