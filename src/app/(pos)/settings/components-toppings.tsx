"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Layers } from "lucide-react";
import { runAction } from "@/lib/run-action";
import { useI18n } from "@/i18n/context";

type Group = { id: string; name: string; type: string; toppings: Topping[]; _count: { toppings: number } };
type Topping = { id: string; name: string; price: number; toppingGroupId: string };
type ActionFn = (...args: never[]) => Promise<unknown>;
type LooseFn = (...args: unknown[]) => Promise<unknown>;
type Cat = { id: string; name: string };
type ProductInfo = { id: string; name: string; categoryId: string; category?: { name: string } | null; toppingGroups?: { toppingGroup: { id: string } }[] };

export function ToppingsManager({
  groups, createGroup, updateGroup, deleteGroup, createTopping, updateTopping, deleteTopping,
  categories, products, linkToppingGroup, unlinkToppingGroup,
}: Readonly<{
  groups: Group[]; createGroup: ActionFn; updateGroup: ActionFn; deleteGroup: ActionFn;
  createTopping: ActionFn; updateTopping: ActionFn; deleteTopping: ActionFn;
  categories: Cat[]; products: ProductInfo[];
  linkToppingGroup: ActionFn; unlinkToppingGroup: ActionFn;
}>) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [openGroup, setOpenGroup] = useState(false);
  const [openTopping, setOpenTopping] = useState(false);
  const [editGroup, setEditGroup] = useState<Group | null>(null);
  const [editTopping, setEditTopping] = useState<Topping | null>(null);
  const [gForm, setGForm] = useState({ name: "", type: "SINGLE" });
  const [tForm, setTForm] = useState({ name: "", price: "0", toppingGroupId: "" });

  function doAct(fn: ActionFn, ...args: unknown[]) {
    start(async () => {
      await runAction(
        () => (fn as LooseFn)(...args),
        { success: t.common.success, error: t.common.error },
        () => { setOpenGroup(false); setOpenTopping(false); },
      );
    });
  }

  const typeLabel: Record<string, string> = { SINGLE: t.inventory.typeSingle, MULTIPLE: t.inventory.typeMultiple, REQUIRED: t.inventory.typeRequired };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => { setEditGroup(null); setGForm({ name: "", type: "SINGLE" }); setOpenGroup(true); }}>
          <Plus className="h-4 w-4 mr-1" /> {t.settings.add}
        </Button>
      </div>
      {groups.length === 0 && <p className="text-center text-muted-foreground py-8">{t.common.noData}</p>}
      {groups.map(g => (
        <Card key={g.id}>
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">{g.name}</CardTitle>
                <Badge variant="secondary">{typeLabel[g.type] || g.type}</Badge>
                <span className="text-xs text-muted-foreground">{g._count.toppings} option</span>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => { setEditGroup(g); setGForm({ name: g.name, type: g.type }); setOpenGroup(true); }}><Pencil className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon" onClick={() => doAct(deleteGroup, g.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-2">
              {g.toppings.map(top => (
                <div key={top.id} className="flex items-center gap-1 border rounded-md px-3 py-1.5 text-sm">
                  <span>{top.name}</span>
                  {top.price > 0 && <span className="text-muted-foreground text-xs">+{top.price.toLocaleString()}{t.common.d}</span>}
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { setEditTopping(top); setTForm({ name: top.name, price: top.price.toString(), toppingGroupId: top.toppingGroupId }); setOpenTopping(true); }}><Pencil className="h-2.5 w-2.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => doAct(deleteTopping, top.id)}><Trash2 className="h-2.5 w-2.5 text-destructive" /></Button>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => { setEditTopping(null); setTForm({ name: "", price: "0", toppingGroupId: g.id }); setOpenTopping(true); }}>
              <Plus className="h-3 w-3 mr-1" /> {t.settings.add}
            </Button>

            {/* Linked products list */}
            <LinkedProductsSection
              groupId={g.id}
              products={products}
              categories={categories}
              onLink={linkToppingGroup}
              onUnlink={unlinkToppingGroup}
              pending={pending}
              start={start}
            />
          </CardContent>
        </Card>
      ))}

      <Dialog open={openGroup} onOpenChange={setOpenGroup}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editGroup ? t.settings.edit : t.settings.add}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>{t.settings.name}</Label><Input value={gForm.name} onChange={e => setGForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="space-y-1"><Label>{t.settings.type}</Label>
              <Select value={gForm.type} onValueChange={v => setGForm(f => ({ ...f, type: v ?? "" }))}>
                <SelectTrigger><SelectValue placeholder={t.settings.type}>{typeLabel[gForm.type] ?? ""}</SelectValue></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SINGLE">{t.inventory.typeSingle} (Single)</SelectItem>
                  <SelectItem value="MULTIPLE">{t.inventory.typeMultiple} (Multiple)</SelectItem>
                  <SelectItem value="REQUIRED">{t.inventory.typeRequired} (Required)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button disabled={pending} onClick={() => doAct(editGroup ? updateGroup : createGroup, editGroup?.id, gForm)}>{pending ? t.common.saving : t.common.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openTopping} onOpenChange={setOpenTopping}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editTopping ? t.settings.edit : t.settings.add}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>{t.settings.name}</Label><Input value={tForm.name} onChange={e => setTForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="space-y-1"><Label>{t.inventory.extraPrice}</Label><Input type="number" value={tForm.price} onChange={e => setTForm(f => ({ ...f, price: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button disabled={pending} onClick={() => {
              const data = { name: tForm.name, price: Number.parseFloat(tForm.price) || 0 };
              if (editTopping) doAct(updateTopping, editTopping.id, data);
              else doAct(createTopping, { ...data, toppingGroupId: tForm.toppingGroupId, sortOrder: 0 });
            }}>{pending ? t.common.saving : t.common.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LinkedProductsSection({
  groupId, products, categories, onLink, onUnlink, start
}: Readonly<{
  groupId: string;
  products: ProductInfo[];
  categories: Cat[];
  onLink: ActionFn;
  onUnlink: ActionFn;
  pending: boolean;
  start: (fn: () => Promise<void>) => void;
}>) {
  const { t } = useI18n();
  const [showPicker, setShowPicker] = useState(false);
  const [catFilter, setCatFilter] = useState("");

  const linked = products.filter(p => p.toppingGroups?.some(tg => tg.toppingGroup.id === groupId));
  const available = products.filter(p => !p.toppingGroups?.some(tg => tg.toppingGroup.id === groupId));
  const filteredAvailable = catFilter ? available.filter(p => p.categoryId === catFilter) : available;

  const linkedByCat: Record<string, ProductInfo[]> = {};
  linked.forEach(p => {
    const catName = p.category?.name || t.inventory.other;
    if (!linkedByCat[catName]) linkedByCat[catName] = [];
    linkedByCat[catName].push(p);
  });

  function handleUnlink(productId: string) {
    start(async () => { await (onUnlink as LooseFn)(productId, groupId); });
  }

  return (
    <div className="mt-3 border-t pt-3">
      <div className="flex items-center justify-between mb-2">
        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          {t.inventory.appliesTo} ({linked.length})
        </Label>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50"
          onClick={() => setShowPicker(!showPicker)}
        >
          <Plus className="h-3 w-3 mr-1" />
          {showPicker ? t.inventory.closePicker : t.inventory.assignMoreItems}
        </Button>
      </div>

      {linked.length === 0 ? (
        <p className="text-xs text-gray-400 italic">{t.common.noData}</p>
      ) : (
        <div className="space-y-1.5">
          {Object.entries(linkedByCat).map(([catName, prods]) => (
            <div key={catName} className="flex items-start gap-2">
              <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5">{catName}</Badge>
              <div className="flex flex-wrap gap-1">
                {prods.map(p => (
                  <span key={p.id} className="inline-flex items-center gap-1 text-[11px] bg-amber-50 border border-amber-200 text-amber-800 rounded-md pl-2 pr-1 py-0.5">
                    {p.name}
                    <button
                      className="ml-0.5 hover:bg-red-100 rounded p-0.5 text-amber-400 hover:text-red-500"
                      onClick={() => handleUnlink(p.id)}
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showPicker && (
        <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
          <div className="flex gap-2">
            <Select value={catFilter} onValueChange={v => setCatFilter(v === "all" ? "" : v ?? "")}>
              <SelectTrigger className="h-9 text-xs rounded-lg">
                <SelectValue placeholder={t.inventory.allCategoriesItems}>{catFilter ? categories.find(c => c.id === catFilter)?.name : t.inventory.allCategories}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.inventory.allCategories}</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {filteredAvailable.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">{t.inventory.allItemsAssigned}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
              {filteredAvailable.map(p => (
                <button
                  key={p.id}
                  className="inline-flex items-center gap-1 text-[11px] bg-white border border-gray-200 hover:border-amber-300 hover:bg-amber-50 rounded-md px-2.5 py-1 text-gray-600 hover:text-amber-700 transition-colors"
                  onClick={() => start(async () => { await (onLink as LooseFn)(p.id, groupId); })}
                >
                  <Plus className="h-2.5 w-2.5" />
                  {p.name}
                  {p.category && <span className="text-gray-400 text-[10px]">({p.category.name})</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
