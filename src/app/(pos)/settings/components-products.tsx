"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Coffee, Beaker, ListChecks, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n/context";
import { getProductRecipe, addRecipeItem, removeRecipeItem } from "@/server/recipe/actions";

type ProductToppingRef = { toppingGroup: { id: string; name: string; type: string; toppings: { id: string; name: string; price: number }[] } };
type Product = {
  id: string; name: string; slug: string; price: number; costPrice: number;
  categoryId: string; category?: { name: string };
  vatId: string; vat?: { name: string; rate: number };
  exciseTaxId?: string | null; exciseTax?: { name: string; rate: number } | null;
  unitId: string; unit?: { name: string };
  isAvailable: boolean; sortOrder: number;
  toppingGroups?: ProductToppingRef[];
};
type Cat = { id: string; name: string };
type Vat = { id: string; name: string; rate: number };
type Excise = { id: string; name: string; rate: number };
type Unit = { id: string; name: string };
type ActionFn = (...args: never[]) => Promise<unknown>;
type LooseFn = (...args: unknown[]) => Promise<unknown>;
type IngredientBasic = { id: string; name: string; baseUnit: string; currentStock: number };
type ToppingGroupType = { id: string; name: string; type: string; toppings: { id: string; name: string; price: number }[]; _count: { toppings: number } };

type RecipeItem = {
  id: string;
  ingredient: { id: string; name: string; baseUnit: string };
  quantity: number;
  unit?: { id: string; name: string } | null;
};

function fmtPrice(v: number) { return new Intl.NumberFormat("vi-VN").format(v || 0); }

export function ProductsManager({
  products, categories, vats, exciseTaxes, units, createProduct, updateProduct, deleteProduct,
  allIngredients, toppingGroups, linkToppingGroup, unlinkToppingGroup,
}: Readonly<{
  products: Product[]; categories: Cat[]; vats: Vat[]; exciseTaxes: Excise[]; units: Unit[];
  createProduct: ActionFn; updateProduct: ActionFn; deleteProduct: ActionFn;
  allIngredients: IngredientBasic[];
  toppingGroups: ToppingGroupType[];
  linkToppingGroup: ActionFn;
  unlinkToppingGroup: ActionFn;
}>) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ name: "", slug: "", price: "0", costPrice: "0", categoryId: "", vatId: vats[0]?.id ?? "", exciseTaxId: "", unitId: units[0]?.id ?? "", sortOrder: "0" });

  // Recipe state
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [recipeProductId, setRecipeProductId] = useState("");
  const [recipeProductName, setRecipeProductName] = useState("");
  const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);
  const [recipeForm, setRecipeForm] = useState({ ingredientId: "", quantity: "0" });

  // Topping linking state
  const [toppingOpen, setToppingOpen] = useState(false);
  const [toppingProductId, setToppingProductId] = useState("");
  const [toppingProductName, setToppingProductName] = useState("");

  // Filter & pagination
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 15;

  const filtered = useMemo(() => {
    let list = products;
    if (catFilter) list = list.filter(p => p.categoryId === catFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q));
    }
    return list;
  }, [products, catFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageItems = filtered.slice((page - 1) * perPage, page * perPage);

  // Reset page when filter changes — intentional reactive reset.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setPage(1); }, [catFilter, search]);

  function openNew() { setEditing(null); setForm({ name: "", slug: "", price: "0", costPrice: "0", categoryId: categories[0]?.id ?? "", vatId: vats[0]?.id ?? "", exciseTaxId: "", unitId: units[0]?.id ?? "", sortOrder: "0" }); setOpen(true); }
  function openEdit(p: Product) { setEditing(p); setForm({ name: p.name, slug: p.slug, price: p.price.toString(), costPrice: p.costPrice.toString(), categoryId: p.categoryId, vatId: p.vatId, exciseTaxId: p.exciseTaxId ?? "", unitId: p.unitId, sortOrder: p.sortOrder.toString() }); setOpen(true); }

  async function openRecipe(p: Product) {
    setRecipeProductId(p.id);
    setRecipeProductName(p.name);
    setRecipeForm({ ingredientId: "", quantity: "0" });
    start(async () => {
      const items = await getProductRecipe(p.id);
      setRecipeItems(items.map(i => ({
        id: i.id,
        ingredient: i.ingredient,
        quantity: i.quantity,
        unit: i.unit,
      })));
    });
    setRecipeOpen(true);
  }

  async function handleAddRecipe() {
    if (!recipeForm.ingredientId || Number.parseFloat(recipeForm.quantity) <= 0) {
      toast.error(t.settings.ingredientRequired);
      return;
    }
    start(async () => {
      await addRecipeItem({ productId: recipeProductId, ingredientId: recipeForm.ingredientId, quantity: Number.parseFloat(recipeForm.quantity) });
      toast.success(t.settings.recipeAdded);
      // Refresh recipe list
      const items = await getProductRecipe(recipeProductId);
      setRecipeItems(items.map(i => ({ id: i.id, ingredient: i.ingredient, quantity: i.quantity, unit: i.unit })));
      setRecipeForm({ ingredientId: "", quantity: "0" });
    });
  }

  async function handleRemoveRecipe(recipeId: string) {
    start(async () => {
      await removeRecipeItem(recipeId);
      toast.success(t.settings.recipeDeleted);
      const items = await getProductRecipe(recipeProductId);
      setRecipeItems(items.map(i => ({ id: i.id, ingredient: i.ingredient, quantity: i.quantity, unit: i.unit })));
    });
  }

  function save() {
    start(async () => {
      try {
        const data = { name: form.name, slug: form.slug, price: Number.parseFloat(form.price), costPrice: Number.parseFloat(form.costPrice ?? "0"), categoryId: form.categoryId, vatId: form.vatId, exciseTaxId: form.exciseTaxId || undefined, unitId: form.unitId, sortOrder: Number.parseInt(form.sortOrder, 10) };
        if (editing) await (updateProduct as LooseFn)(editing.id, data);
        else await (createProduct as LooseFn)(data);
        toast.success(editing ? t.settings.updated : t.settings.added);
        setOpen(false);
      } catch { toast.error(t.common.error); }
    });
  }

  function handleDelete(id: string) { start(async () => { await (deleteProduct as LooseFn)(id); toast.success(t.common.success); }); }


  return (
    <>
      {/* Filter bar */}
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input className="pl-9 h-10 rounded-lg" placeholder={t.common.search + "..."} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 items-center">
          <Button size="sm" className="h-10" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> {t.settings.add}</Button>
        </div>
      </div>

      {/* Category tags */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
            catFilter ? "bg-gray-100 text-gray-500 hover:bg-gray-200" : "bg-amber-500 text-white shadow-sm"
          }`}
          onClick={() => setCatFilter("")}
        >{t.inventory.all}        </button>
        {categories.map(c => (
          <button
            key={c.id}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
              catFilter === c.id ? "bg-amber-500 text-white shadow-sm" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
            onClick={() => setCatFilter(catFilter === c.id ? "" : c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Stats */}
      <p className="text-xs text-gray-400 mb-3">
        {t.inventory.showing} {filtered.length > 0 ? (page - 1) * perPage + 1 : 0}–{Math.min(page * perPage, filtered.length)} / {t.inventory.totalItems_products} {filtered.length}
        {catFilter && <span className="ml-2">· {t.inventory.filterBy} {categories.find(c => c.id === catFilter)?.name}</span>}
        {search.trim() && <span className="ml-2">· {t.inventory.searchFor} &quot;{search.trim()}&quot;</span>}
      </p>

      {/* Table */}
      <div className="w-full overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-semibold text-gray-600">{t.settings.name}</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">{t.inventory.typeColumn}</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">{t.settings.price}</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">{t.settings.vat}</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">{t.settings.exciseTax}</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">{t.settings.units}</th>
              <th className="w-32 px-4 py-3 text-right text-gray-400 text-xs font-medium">{t.settings.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pageItems.length === 0 && (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">{catFilter ? t.inventory.noProductsInCategory : t.inventory.noProductsYet}</td></tr>
            )}
            {pageItems.map(p => (
              <tr key={p.id} className="hover:bg-amber-50/30 transition-colors">
                <td className="px-4 py-3 font-medium flex items-center gap-2">
                  <Coffee className="h-4 w-4 text-gray-400" /> {p.name} {!p.isAvailable && <Badge variant="secondary">{t.settings.inactive}</Badge>}
                </td>
                <td className="px-4 py-3"><Badge variant="outline">{p.category?.name}</Badge></td>
                <td className="px-4 py-3 font-mono text-sm">{fmtPrice(p.price)}{t.common.d || "₫"}</td>
                <td className="px-4 py-3">{p.vat?.name} ({(p.vat?.rate ?? 0) * 100}%)</td>
                <td className="px-4 py-3">{p.exciseTax ? `${p.exciseTax.name} (${p.exciseTax.rate * 100}%)` : "—"}</td>
                <td className="px-4 py-3">{p.unit?.name}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setToppingProductId(p.id); setToppingProductName(p.name); setToppingOpen(true); }} title={t.inventory.toppingTooltip}><ListChecks className="h-3.5 w-3.5 text-amber-500" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openRecipe(p)} title={t.inventory.recipeTooltip}><Beaker className="h-3.5 w-3.5 text-blue-500" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-red-500" onClick={() => handleDelete(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <Button variant="outline" size="sm" className="h-8 text-xs" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="h-3.5 w-3.5 mr-1" /> {t.inventory.previous}
          </Button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button key={p} className={`h-8 w-8 rounded-lg text-xs font-medium transition-colors ${p === page ? "bg-amber-500 text-white" : "text-gray-500 hover:bg-gray-100"}`} onClick={() => setPage(p)}>{p}</button>
          ))}
          <Button variant="outline" size="sm" className="h-8 text-xs" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
{t.inventory.next} <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
      )}

      {/* Product add/edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? t.settings.edit : t.common.add}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>{t.settings.name}</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") }))} /></div>
              <div className="space-y-1"><Label>Slug</Label><Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>{t.settings.price} (₫)</Label><Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} /></div>
              <div className="space-y-1"><Label>{t.settings.cost} (₫)</Label><Input type="number" value={form.costPrice} onChange={e => setForm(f => ({ ...f, costPrice: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>{t.settings.categories}</Label>
                <Select value={form.categoryId} onValueChange={v => setForm(f => ({ ...f, categoryId: v ?? "" }))}>
                  <SelectTrigger><SelectValue placeholder={t.settings.sidebar.categories}>{categories.find(c => c.id === form.categoryId)?.name}</SelectValue></SelectTrigger>
                  <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>{t.settings.units}</Label>
                <Select value={form.unitId} onValueChange={v => setForm(f => ({ ...f, unitId: v ?? "" }))}>
                  <SelectTrigger><SelectValue placeholder={t.settings.units}>{units.find(u => u.id === form.unitId)?.name}</SelectValue></SelectTrigger>
                  <SelectContent>{units.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>{t.settings.vat}</Label>
                <Select value={form.vatId} onValueChange={v => setForm(f => ({ ...f, vatId: v ?? "" }))}>
                  <SelectTrigger><SelectValue placeholder={t.settings.vat}>{vats.find(v => v.id === form.vatId)?.name}</SelectValue></SelectTrigger>
                  <SelectContent>{vats.map(v => <SelectItem key={v.id} value={v.id}>{v.name} ({(v.rate * 100).toFixed(0)}%)</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>{t.settings.exciseTax} ({t.inventory.notApplied})</Label>
                <Select value={form.exciseTaxId} onValueChange={v => setForm(f => ({ ...f, exciseTaxId: v ?? "" }))}>
                  <SelectTrigger><SelectValue placeholder={t.inventory.notApplied}>{form.exciseTaxId && form.exciseTaxId !== "none" ? exciseTaxes.find(e => e.id === form.exciseTaxId)?.name : t.inventory.notApplied}</SelectValue></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t.inventory.notApplied}</SelectItem>
                    {exciseTaxes.map(e => <SelectItem key={e.id} value={e.id}>{e.name} ({(e.rate * 100).toFixed(0)}%)</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1"><Label>{t.settings.sortOrder}</Label><Input type="number" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={pending}>{pending ? t.common.saving : t.common.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recipe dialog */}
      <Dialog open={recipeOpen} onOpenChange={setRecipeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Beaker className="h-5 w-5 text-blue-500" />
              {t.inventory.recipeFor} {recipeProductName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Current recipe items */}
            {recipeItems.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm border rounded-lg bg-muted/30">
                <Beaker className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>{t.inventory.noRecipeYet}</p>
                <p className="text-xs mt-1">{t.inventory.addIngredientToCalculateCost}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">{t.inventory.currentIngredients}</Label>
                {recipeItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between border rounded-lg p-3 bg-muted/30">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.ingredient.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.quantity} {item.unit?.name || item.ingredient.baseUnit} / {t.inventory.perServing} {recipeProductName.toLowerCase().includes(t.inventory.portion.slice(0,2)) ? t.inventory.portion : t.inventory.dish}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="text-destructive h-7 w-7" onClick={() => handleRemoveRecipe(item.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new ingredient */}
            <div className="border-t pt-3">
              <Label className="text-sm font-semibold mb-2 block">{t.inventory.addIngredient}</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select value={recipeForm.ingredientId} onValueChange={v => setRecipeForm(f => ({ ...f, ingredientId: v ?? "" }))}>
                    <SelectTrigger><SelectValue placeholder={t.settings.selectIngredient}>{allIngredients.find(i => i.id === recipeForm.ingredientId)?.name}</SelectValue></SelectTrigger>
                    <SelectContent>
                      {allIngredients.filter(i => !recipeItems.some(r => r.ingredient.id === i.id)).map(i => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.name} <span className="text-xs text-muted-foreground">({i.baseUnit})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  type="number"
                  className="w-24"
                  placeholder="SL"
                  value={recipeForm.quantity}
                  onChange={e => setRecipeForm(f => ({ ...f, quantity: e.target.value }))}
                  min="0"
                  step="0.1"
                />
                <Button size="sm" onClick={handleAddRecipe} disabled={pending || !recipeForm.ingredientId}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                {t.inventory.recipeHelpText}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecipeOpen(false)}>{t.common.close}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Topping linking dialog */}
      {toppingOpen && (
        <ToppingLinkDialog
          productId={toppingProductId}
          productName={toppingProductName}
          toppingGroups={toppingGroups}
          selectedGroupIds={new Set(products.find(p => p.id === toppingProductId)?.toppingGroups?.map(tg => tg.toppingGroup.id) ?? [])}
          onLink={async (groupId) => {
            start(async () => {
              await (linkToppingGroup as LooseFn)(toppingProductId, groupId);
              toast.success(t.settings.recipeAssigned);
            });
          }}
          onUnlink={async (groupId) => {
            start(async () => {
              await (unlinkToppingGroup as LooseFn)(toppingProductId, groupId);
              toast.success(t.settings.recipeUnassigned);
            });
          }}
          onClose={() => setToppingOpen(false)}
        />
      )}
    </>
  );
}

function ToppingLinkDialog({
  productId, productName, toppingGroups, selectedGroupIds, onLink, onUnlink, onClose
}: Readonly<{
  productId: string;
  productName: string;
  toppingGroups: ToppingGroupType[];
  selectedGroupIds: Set<string>;
  onLink: (groupId: string) => Promise<void>;
  onUnlink: (groupId: string) => Promise<void>;
  onClose: () => void;
}>) {
  const [, start] = useTransition();
  const [localSelected, setLocalSelected] = useState(new Set(selectedGroupIds));
  const { t } = useI18n();

  if (!productId) return null;

  async function toggle(groupId: string) {
    if (localSelected.has(groupId)) {
      setLocalSelected(prev => { const n = new Set(prev); n.delete(groupId); return n; });
      start(async () => { await onUnlink(groupId); });
    } else {
      setLocalSelected(prev => { const n = new Set(prev); n.add(groupId); return n; });
      start(async () => { await onLink(groupId); });
    }
  }

  const typeLabel: Record<string, string> = { SINGLE: t.inventory.typeSingle, MULTIPLE: t.inventory.typeMultiple, REQUIRED: t.inventory.typeRequired };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-amber-500" />
            {t.inventory.optionsFor} {productName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {toppingGroups.length === 0 ? (
            <p className="text-center py-6 text-gray-400 text-sm">{t.inventory.noToppingGroups}</p>
          ) : (
            toppingGroups.map(g => {
              const isLinked = localSelected.has(g.id);
              return (
                <button
                  type="button"
                  key={g.id}
                  className={`w-full text-left flex items-center justify-between border rounded-xl p-4 cursor-pointer transition-all ${
                    isLinked ? "border-amber-300 bg-amber-50 shadow-sm" : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => toggle(g.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-gray-900">{g.name}</span>
                      <Badge variant={isLinked ? "default" : "secondary"} className="text-[10px]">
                        {typeLabel[g.type] || g.type}
                      </Badge>
                      {isLinked && <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">{t.inventory.linkedToppingBadge}</Badge>}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {g.toppings.map(top => (
                        <span key={top.id} className="inline-flex text-[11px] bg-white border border-gray-200 rounded-md px-2 py-0.5 text-gray-500">
                          {top.name}{top.price > 0 ? <span className="text-gray-400 ml-1">+{top.price.toLocaleString()}{t.common.d}</span> : null}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 shrink-0 ml-3 flex items-center justify-center transition-colors ${
                    isLinked ? "border-amber-500 bg-amber-500" : "border-gray-300"
                  }`}>
                    {isLinked && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                  </div>
                </button>
              );
            })
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t.common.close}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
