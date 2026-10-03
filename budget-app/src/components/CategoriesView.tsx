"use client";

import { useState } from "react";
import type { Category, CategoryGroup } from "@/types";
import { useStore } from "@/hooks/useStore";
import { useToast } from "@/hooks/useToast";
import { GROUP_COLORS } from "@/lib/defaults";
import { GROUP_LABEL, TX_TYPES } from "@/lib/labels";
import { PlusIcon } from "./Icons";
import { ConfirmDialog, EmptyState, Field, ListSkeleton, PageHeader, Sheet, Toggle } from "./ui";

const PALETTE = ["#16a34a", "#e11d48", "#2f6fed", "#9333ea", "#f59e0b", "#0891b2", "#ea580c", "#db2777", "#64748b"];

interface Draft { name: string; group: CategoryGroup; icon: string; color: string; isActive: boolean }
const empty: Draft = { name: "", group: "expense", icon: "", color: GROUP_COLORS.expense, isActive: true };

export function CategoriesView() {
  const store = useStore();
  const toast = useToast();
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(empty);
  const [errors, setErrors] = useState<{ name?: string; group?: string }>({});
  const [confirmDelete, setConfirmDelete] = useState<Category | null>(null);
  const [inUse, setInUse] = useState<{ cat: Category; count: number } | null>(null);

  const usage = editing && editing !== "new" ? store.categoryUsage(editing.id) : 0;

  const open = (c: Category | "new") => {
    setErrors({});
    setDraft(c === "new" ? empty : { name: c.name, group: c.group, icon: c.icon ?? "", color: c.color ?? GROUP_COLORS[c.group], isActive: c.isActive });
    setEditing(c);
  };

  const save = () => {
    const e: typeof errors = {};
    const name = draft.name.trim();
    if (!name) e.name = "Kateqoriya adını daxil edin";
    else if (store.categories.some((c) => c.name.toLowerCase() === name.toLowerCase() && c.group === draft.group && (editing === "new" || c.id !== (editing as Category).id))) e.name = "Bu qrupda eyni adlı kateqoriya var";
    if (editing && editing !== "new" && draft.group !== editing.group && usage > 0) e.group = `Bu kateqoriyada ${usage} əməliyyat var — qrupu dəyişmək olmaz`;
    setErrors(e);
    if (Object.keys(e).length) return;
    store.saveCategory(editing === "new" ? null : (editing as Category).id, {
      name, group: draft.group, isActive: draft.isActive,
      ...(draft.icon.trim() ? { icon: draft.icon.trim().slice(0, 4) } : {}),
      color: draft.color,
    });
    toast.success(editing === "new" ? "Kateqoriya əlavə edildi" : "Kateqoriya yeniləndi");
    setEditing(null);
  };

  const requestDelete = (c: Category) => {
    const count = store.categoryUsage(c.id);
    if (count > 0) setInUse({ cat: c, count });
    else setConfirmDelete(c);
  };

  return (
    <div className="page">
      <PageHeader title="Kateqoriyalar" back="/settings" right={<button type="button" onClick={() => open("new")} className="btn-primary !min-h-[44px] !px-3.5 !text-[15px]"><PlusIcon width={18} height={18} />Yeni</button>} />
      {!store.ready ? <ListSkeleton /> : store.categories.length === 0 ? (
        <EmptyState icon="🏷️" title="Kateqoriya yoxdur" action={<button type="button" className="btn-primary" onClick={() => open("new")}>Kateqoriya əlavə et</button>} />
      ) : (
        <div className="space-y-5">
          {TX_TYPES.map((g) => {
            const items = store.categories.filter((c) => c.group === g);
            if (!items.length) return null;
            return (
              <section key={g} aria-label={GROUP_LABEL[g]}>
                <h2 className="mb-1 px-1 text-[13px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{GROUP_LABEL[g]}</h2>
                <ul className="card divide-y divide-slate-100 !p-2 dark:divide-slate-800">
                  {items.map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => open(c)} className={`flex min-h-[52px] w-full items-center gap-3 px-1 text-left ${c.isActive ? "" : "opacity-50"}`}>
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg" style={{ backgroundColor: `${c.color ?? GROUP_COLORS[c.group]}22` }} aria-hidden>{c.icon ?? "•"}</span>
                        <span className="min-w-0 flex-1 truncate text-[16px] font-medium">{c.name}</span>
                        {!c.isActive && <span className="text-[12px] text-slate-500">arxiv</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Yeni kateqoriya" : "Kateqoriyanı redaktə et"} footer={<button type="button" className="btn-primary w-full" onClick={save}>Yadda saxla</button>}>
        <div className="space-y-4">
          <Field label="Ad" htmlFor="cat-name" error={errors.name}>
            <input id="cat-name" className="input" value={draft.name} maxLength={80} aria-invalid={Boolean(errors.name)} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </Field>
          <Field label="Qrup" htmlFor="cat-group" error={errors.group}>
            <select id="cat-group" className="input" value={draft.group} aria-invalid={Boolean(errors.group)} onChange={(e) => setDraft({ ...draft, group: e.target.value as CategoryGroup, color: GROUP_COLORS[e.target.value as CategoryGroup] })}>
              {TX_TYPES.map((g) => <option key={g} value={g}>{GROUP_LABEL[g]}</option>)}
            </select>
          </Field>
          <Field label="İkon (emoji, ixtiyari)" htmlFor="cat-icon">
            <input id="cat-icon" className="input" value={draft.icon} maxLength={4} placeholder="🛒" onChange={(e) => setDraft({ ...draft, icon: e.target.value })} />
          </Field>
          <div>
            <span className="label" id="cat-color-label">Rəng</span>
            <div role="radiogroup" aria-labelledby="cat-color-label" className="flex flex-wrap gap-2">
              {PALETTE.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={draft.color === c} aria-label={`Rəng ${c}`} onClick={() => setDraft({ ...draft, color: c })} className={`h-11 w-11 rounded-full ring-offset-2 ring-offset-[#f4f6fa] dark:ring-offset-slate-950 ${draft.color === c ? "ring-2 ring-slate-900 dark:ring-white" : ""}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          {editing && editing !== "new" && (
            <>
              <Toggle checked={draft.isActive} onChange={(v) => setDraft({ ...draft, isActive: v })} label="Aktiv" description="Arxiv kateqoriya yeni əməliyyatlarda görünmür" />
              <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
                <p className="mb-2 text-[13px] text-slate-500 dark:text-slate-400">{usage} əməliyyatda istifadə olunur</p>
                <button type="button" className="btn-danger w-full" onClick={() => requestDelete(editing)}>Kateqoriyanı sil</button>
              </div>
            </>
          )}
        </div>
      </Sheet>

      <ConfirmDialog open={Boolean(confirmDelete)} danger title="Kateqoriya silinsin?" message={<>“{confirmDelete?.name}” silinəcək.</>} confirmLabel="Bəli, sil" onCancel={() => setConfirmDelete(null)} onConfirm={() => { if (confirmDelete) { store.deleteCategory(confirmDelete.id); toast.success("Kateqoriya silindi"); } setConfirmDelete(null); setEditing(null); }} />
      <ConfirmDialog open={Boolean(inUse)} title="Kateqoriyanı silmək olmaz" message={<>“{inUse?.cat.name}” kateqoriyası {inUse?.count} əməliyyatda istifadə olunur. Arxivləşdirsəniz, əməliyyatlar saxlanılır, kateqoriya isə yeni əməliyyatlarda görünmür.</>} confirmLabel="Arxivləşdir" onCancel={() => setInUse(null)} onConfirm={() => { if (inUse) { store.archiveCategory(inUse.cat.id, true); toast.success("Kateqoriya arxivləşdirildi"); } setInUse(null); setEditing(null); }} />
    </div>
  );
}
