"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import type { EditorView } from "@tiptap/pm/view";
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Code2,
  ImagePlus,
  Undo2,
  Redo2,
  Save,
  FileDown,
  Loader2,
  FileText,
  ExternalLink,
} from "lucide-react";
import {
  fetchTradeDocument,
  saveTradeDocument,
  uploadTradePdf,
  tradePdfUrl,
} from "@/lib/api";

export interface PdfHeader {
  title: string;
  subtitle: string;
  stats: { label: string; value: string }[];
}

type Status = "idle" | "dirty" | "saving" | "saved" | "error";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function insertImageIntoView(view: EditorView, url: string) {
  const { state } = view;
  const node = state.schema.nodes.image?.create({ src: url });
  if (!node) return;
  view.dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Rich journal editor with inline images.
 *
 * Two modes:
 *  - Bound  (pass `tradeId` + `pdfHeader`): loads/saves to the server on its
 *    own and can export a PDF that gets stored against the trade.
 *  - Draft  (pass `initialHtml` + `onChange`): content is owned by the parent
 *    (e.g. the new-trade form) and persisted together with the trade. No PDF
 *    export until the trade exists.
 */
export function TradeDocumentEditor({
  tradeId,
  pdfHeader,
  initialHtml,
  onChange,
}: {
  tradeId?: number;
  pdfHeader?: PdfHeader;
  initialHtml?: string;
  onChange?: (html: string) => void;
}) {
  const bound = typeof tradeId === "number";

  const [status, setStatus] = useState<Status>("idle");
  const [loading, setLoading] = useState(bound);
  const [exporting, setExporting] = useState(false);
  const [hasPdf, setHasPdf] = useState(false);
  const [pdfVersion, setPdfVersion] = useState<string | number>("");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfHeaderRef = useRef(pdfHeader);
  pdfHeaderRef.current = pdfHeader;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const seededRef = useRef(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Image.configure({ inline: false, allowBase64: true }),
      Placeholder.configure({
        placeholder:
          "Write your trade breakdown here — thesis, execution, screenshots, lessons… Paste or drop images anywhere.",
      }),
    ],
    editorProps: {
      attributes: { class: "trade-doc-editor" },
      handlePaste(view, event) {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of Array.from(items)) {
          if (item.type.startsWith("image/")) {
            const file = item.getAsFile();
            if (file) {
              void fileToDataUrl(file).then((url) =>
                insertImageIntoView(view, url)
              );
              return true;
            }
          }
        }
        return false;
      },
      handleDrop(view, event) {
        const files = (event as DragEvent).dataTransfer?.files;
        if (!files || files.length === 0) return false;
        const images = Array.from(files).filter((f) =>
          f.type.startsWith("image/")
        );
        if (images.length === 0) return false;
        event.preventDefault();
        images.forEach((file) =>
          void fileToDataUrl(file).then((url) => insertImageIntoView(view, url))
        );
        return true;
      },
    },
    onUpdate({ editor }) {
      if (bound) {
        setStatus((s) => (s === "saving" ? s : "dirty"));
      } else {
        onChangeRef.current?.(editor.isEmpty ? "" : editor.getHTML());
      }
    },
  });

  // Bound mode: load the stored document from the server.
  useEffect(() => {
    if (!editor || !bound) return;
    let cancelled = false;
    setLoading(true);
    fetchTradeDocument(tradeId)
      .then((doc) => {
        if (cancelled) return;
        editor.commands.setContent(doc.html || "", { emitUpdate: false });
        setHasPdf(doc.hasPdf);
        setPdfVersion(doc.pdfUpdatedAt ?? "");
        setStatus("idle");
      })
      .catch(() => {
        if (!cancelled) setError("Could not load the document.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editor, bound, tradeId]);

  // Draft mode: seed the editor once from the parent-provided HTML.
  useEffect(() => {
    if (!editor || bound || seededRef.current) return;
    seededRef.current = true;
    editor.commands.setContent(initialHtml || "", { emitUpdate: false });
  }, [editor, bound, initialHtml]);

  const doSave = useCallback(async (): Promise<boolean> => {
    if (!editor || !bound) return false;
    setStatus("saving");
    try {
      const html = editor.isEmpty ? "" : editor.getHTML();
      await saveTradeDocument(tradeId, html);
      setStatus("saved");
      return true;
    } catch {
      setStatus("error");
      setError("Failed to save the document.");
      return false;
    }
  }, [editor, bound, tradeId]);

  const handlePickImage = async (file: File | undefined) => {
    if (!editor || !file || !file.type.startsWith("image/")) return;
    const url = await fileToDataUrl(file);
    editor.chain().focus().setImage({ src: url }).run();
  };

  const buildPrintNode = useCallback((): HTMLDivElement => {
    const header = pdfHeaderRef.current;
    const content = editor && !editor.isEmpty ? editor.getHTML() : "";
    const container = document.createElement("div");
    container.style.cssText =
      "position:fixed;left:-10000px;top:0;width:794px;background:#ffffff;color:#111827;" +
      "padding:48px;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;";
    const statsHtml = (header?.stats ?? [])
      .map(
        (s) =>
          `<div><div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;">${escapeHtml(
            s.label
          )}</div><div style="font-size:15px;font-weight:600;margin-top:2px;">${escapeHtml(
            s.value
          )}</div></div>`
      )
      .join("");
    container.innerHTML = `
      <style>
        .doc-content img{max-width:100%;height:auto;border-radius:8px;margin:10px 0;display:block;}
        .doc-content h1{font-size:22px;font-weight:700;margin:18px 0 8px;}
        .doc-content h2{font-size:18px;font-weight:700;margin:16px 0 6px;}
        .doc-content h3{font-size:16px;font-weight:600;margin:12px 0 6px;}
        .doc-content p{margin:8px 0;line-height:1.6;font-size:14px;}
        .doc-content ul,.doc-content ol{padding-left:24px;margin:8px 0;font-size:14px;line-height:1.6;}
        .doc-content blockquote{border-left:3px solid #d1d5db;padding-left:12px;color:#4b5563;margin:10px 0;}
        .doc-content pre{background:#f3f4f6;padding:12px;border-radius:8px;overflow:auto;font-size:13px;white-space:pre-wrap;}
        .doc-content code{font-family:monospace;}
        .doc-content a{color:#2563eb;text-decoration:underline;}
        .doc-content:empty::after{content:"No notes written for this trade.";color:#9ca3af;font-size:14px;}
      </style>
      <div style="border-bottom:2px solid #111827;padding-bottom:16px;margin-bottom:24px;">
        <div style="font-size:24px;font-weight:700;">${escapeHtml(
          header?.title ?? ""
        )}</div>
        <div style="font-size:13px;color:#6b7280;margin-top:4px;">${escapeHtml(
          header?.subtitle ?? ""
        )}</div>
        <div style="display:flex;flex-wrap:wrap;gap:20px;margin-top:14px;">${statsHtml}</div>
      </div>
      <div class="doc-content">${content}</div>
    `;
    return container;
  }, [editor]);

  const handleExportPdf = useCallback(async () => {
    if (!editor || !bound) return;
    setExporting(true);
    setError(null);
    const saved = await doSave();
    if (!saved) {
      setExporting(false);
      return;
    }
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas-pro"),
      ]);
      const node = buildPrintNode();
      document.body.appendChild(node);
      // Ensure every embedded image is fully decoded before capture.
      await Promise.all(
        Array.from(node.querySelectorAll("img")).map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise((res) => {
                img.onload = () => res(null);
                img.onerror = () => res(null);
              })
        )
      );
      const canvas = await html2canvas(node, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });
      document.body.removeChild(node);

      const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;
      const imgData = canvas.toDataURL("image/jpeg", 0.92);

      let heightLeft = imgH;
      let position = 0;
      pdf.addImage(imgData, "JPEG", 0, position, imgW, imgH);
      heightLeft -= pageH;
      while (heightLeft > 0) {
        position -= pageH;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, imgW, imgH);
        heightLeft -= pageH;
      }

      const blob = pdf.output("blob");
      await uploadTradePdf(tradeId, blob);
      setHasPdf(true);
      setPdfVersion(Date.now());
    } catch {
      setError("Failed to export the PDF.");
    } finally {
      setExporting(false);
    }
  }, [editor, bound, doSave, buildPrintNode, tradeId]);

  const statusText =
    status === "saving"
      ? "Saving…"
      : status === "saved"
        ? "Saved"
        : status === "dirty"
          ? "Unsaved changes"
          : status === "error"
            ? "Error"
            : "";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Toolbar
          editor={editor}
          onInsertImage={() => fileInputRef.current?.click()}
        />
        {bound ? (
          <div className="flex items-center gap-3">
            {statusText && (
              <span
                className={`text-xs ${
                  status === "error" ? "text-loss" : "text-muted"
                }`}
              >
                {statusText}
              </span>
            )}
            <button
              type="button"
              onClick={doSave}
              disabled={status === "saving" || loading}
              className="btn btn-ghost"
            >
              <Save className="h-4 w-4" /> Save
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exporting || loading}
              className="btn btn-primary"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4" />
              )}
              {exporting ? "Exporting…" : "Save as PDF"}
            </button>
          </div>
        ) : (
          <span className="text-xs text-muted">
            Saved with the trade · export to PDF from the trade page
          </span>
        )}
      </div>

      <div className="rounded-lg border border-border bg-background">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading document…
          </div>
        ) : (
          <EditorContent editor={editor} />
        )}
      </div>

      {error && <p className="text-sm text-loss">{error}</p>}

      {bound && hasPdf && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface-2 px-4 py-3">
          <FileText className="h-5 w-5 text-accent" />
          <span className="text-sm">PDF attached to this trade</span>
          <div className="ml-auto flex gap-2">
            <a
              href={tradePdfUrl(tradeId, { cacheBust: pdfVersion })}
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost"
            >
              <ExternalLink className="h-4 w-4" /> View
            </a>
            <a
              href={tradePdfUrl(tradeId, {
                download: true,
                cacheBust: pdfVersion,
              })}
              className="btn btn-ghost"
            >
              <FileDown className="h-4 w-4" /> Download
            </a>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handlePickImage(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function Toolbar({
  editor,
  onInsertImage,
}: {
  editor: Editor | null;
  onInsertImage: () => void;
}) {
  if (!editor) return <div className="h-9" />;

  const Btn = ({
    onClick,
    active,
    disabled,
    title,
    children,
  }: {
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    title: string;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-8 w-8 items-center justify-center rounded-md border text-sm transition-colors ${
        active
          ? "border-accent bg-accent/15 text-accent"
          : "border-border bg-surface-2 text-foreground hover:bg-[#1e2530]"
      } disabled:opacity-40`}
    >
      {children}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Btn
        title="Bold"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-4 w-4" />
      </Btn>
      <Btn
        title="Italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-4 w-4" />
      </Btn>
      <Btn
        title="Strikethrough"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="h-4 w-4" />
      </Btn>
      <span className="mx-1 h-5 w-px bg-border" />
      <Btn
        title="Heading 1"
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 className="h-4 w-4" />
      </Btn>
      <Btn
        title="Heading 2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="h-4 w-4" />
      </Btn>
      <Btn
        title="Bullet list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-4 w-4" />
      </Btn>
      <Btn
        title="Numbered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-4 w-4" />
      </Btn>
      <Btn
        title="Quote"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="h-4 w-4" />
      </Btn>
      <Btn
        title="Code block"
        active={editor.isActive("codeBlock")}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <Code2 className="h-4 w-4" />
      </Btn>
      <span className="mx-1 h-5 w-px bg-border" />
      <Btn title="Insert image" onClick={onInsertImage}>
        <ImagePlus className="h-4 w-4" />
      </Btn>
      <span className="mx-1 h-5 w-px bg-border" />
      <Btn
        title="Undo"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 className="h-4 w-4" />
      </Btn>
      <Btn
        title="Redo"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 className="h-4 w-4" />
      </Btn>
    </div>
  );
}
