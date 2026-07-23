"use client";

import { useState, useTransition } from "react";
import { useI18n } from "@/i18n/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Table2 } from "lucide-react";
import { runAction } from "@/lib/run-action";

type Area = {
  id: string; name: string; type: string; sortOrder: number;
  tables: TableInfo[]; _count: { tables: number };
};
type TableInfo = { id: string; name: string; capacity: number; isKaraoke: boolean };
type ActionFn = (...args: never[]) => Promise<unknown>;
type LooseFn = (...args: unknown[]) => Promise<unknown>;

type Props = Readonly<{
  areas: Area[];
  createArea: ActionFn;
  updateArea: ActionFn;
  deleteArea: ActionFn;
  createTable: ActionFn;
  updateTable: ActionFn;
  deleteTable: ActionFn;
}>;

export function AreasManager({ areas, createArea, updateArea, deleteArea, createTable, updateTable, deleteTable }: Props) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [openArea, setOpenArea] = useState(false);
  const [openTable, setOpenTable] = useState(false);
  const [editArea, setEditArea] = useState<Area | null>(null);
  const [editTable, setEditTable] = useState<TableInfo | null>(null);
  const [areaForm, setAreaForm] = useState({ name: "", type: "RESTAURANT", sortOrder: "0" });
  const [tableForm, setTableForm] = useState({ name: "", areaId: "", capacity: "4", isKaraoke: false, positionX: "0", positionY: "0" });

  function openNewArea() { setEditArea(null); setAreaForm({ name: "", type: "RESTAURANT", sortOrder: "0" }); setOpenArea(true); }
  function openEditArea(a: Area) { setEditArea(a); setAreaForm({ name: a.name, type: a.type, sortOrder: a.sortOrder.toString() }); setOpenArea(true); }

  function openNewTable(areaId: string) {
    const area = areas.find(a => a.id === areaId);
    const isKaraoke = area?.type === "KARAOKE";
    setEditTable(null);
    setTableForm({ name: "", areaId, capacity: "4", isKaraoke, positionX: "0", positionY: "0" });
    setOpenTable(true);
  }

  function openEditTable(tbl: TableInfo) {
    setEditTable(tbl);
    setTableForm({
      name: tbl.name, areaId: areas.find(a => a.tables.some(tb => tb.id === tbl.id))?.id ?? "",
      capacity: tbl.capacity.toString(), isKaraoke: tbl.isKaraoke,
      positionX: "0", positionY: "0",
    });
    setOpenTable(true);
  }

  function doAction(fn: ActionFn, ...args: unknown[]) {
    startTransition(async () => {
      await runAction(
        () => (fn as LooseFn)(...args),
        { success: t.common.success, error: t.common.error },
        () => { setOpenArea(false); setOpenTable(false); },
      );
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">{t.settings.areas}</h3>
        <Button size="sm" onClick={openNewArea}><Plus className="h-4 w-4 mr-1" /> {t.settings.addArea}</Button>
      </div>

      {areas.map(area => (
        <Card key={area.id}>
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{area.name}</CardTitle>
                <Badge variant="secondary">{t.settings.areaTypes[area.type as keyof typeof t.settings.areaTypes] || area.type}</Badge>
                <span className="text-xs text-muted-foreground">{area._count.tables} {t.settings.tables.toLowerCase()}</span>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => openEditArea(area)}><Pencil className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon" onClick={() => doAction(deleteArea, area.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {area.tables.length === 0 ? (
              <p className="text-sm text-muted-foreground mb-2">{t.settings.noTables}</p>
            ) : (
              <div className="flex flex-wrap gap-2 mb-3">
                {area.tables.map(tbl => (
                  <div key={tbl.id} className="flex items-center gap-1 border rounded-md px-3 py-1.5 text-sm">
                    <Table2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{tbl.name}</span>
                    <span className="text-muted-foreground">({tbl.capacity} {t.order.seats})</span>
                    {tbl.isKaraoke && <Badge variant="outline" className="text-[10px] px-1">{t.settings.karaoke}</Badge>}
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => openEditTable(tbl)}><Pencil className="h-2.5 w-2.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => doAction(deleteTable, tbl.id)}><Trash2 className="h-2.5 w-2.5 text-destructive" /></Button>
                  </div>
                ))}
              </div>
            )}
            <Button variant="outline" size="sm" onClick={() => openNewTable(area.id)}>
              <Plus className="h-3 w-3 mr-1" /> {t.settings.addTable}
            </Button>
          </CardContent>
        </Card>
      ))}

      {/* Area Dialog */}
      <Dialog open={openArea} onOpenChange={setOpenArea}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editArea ? t.settings.editArea : t.settings.addArea}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>{t.settings.name}</Label><Input value={areaForm.name} onChange={e => setAreaForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="space-y-1"><Label>{t.settings.type}</Label>
              <Select value={areaForm.type} onValueChange={v => setAreaForm(f => ({ ...f, type: v ?? "" }))}>
                <SelectTrigger><SelectValue placeholder={t.settings.type}>{t.settings.areaTypes[areaForm.type as keyof typeof t.settings.areaTypes] || areaForm.type}</SelectValue></SelectTrigger>
                <SelectContent>
                  <SelectItem value="RESTAURANT">{t.settings.areaTypes.RESTAURANT}</SelectItem>
                  <SelectItem value="KARAOKE">{t.settings.areaTypes.KARAOKE}</SelectItem>
                  <SelectItem value="TAKEAWAY">{t.settings.areaTypes.TAKEAWAY}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>{t.settings.sortOrder || "Sort Order"}</Label><Input type="number" value={areaForm.sortOrder} onChange={e => setAreaForm(f => ({ ...f, sortOrder: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button disabled={pending} onClick={() => editArea ? doAction(updateArea, editArea.id, { ...areaForm, sortOrder: Number(areaForm.sortOrder) }) : doAction(createArea, { ...areaForm, sortOrder: Number(areaForm.sortOrder) })}>
              {pending ? t.common.saving : t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Table Dialog */}
      <Dialog open={openTable} onOpenChange={setOpenTable}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editTable ? t.settings.editTable : t.settings.addTable}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>{t.settings.name}</Label><Input value={tableForm.name} onChange={e => setTableForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="space-y-1"><Label>{t.settings.capacity}</Label><Input type="number" value={tableForm.capacity} onChange={e => setTableForm(f => ({ ...f, capacity: e.target.value }))} /></div>
            {!editTable && (
              <div className="space-y-1">
                <Label>{t.settings.areas}</Label>
                <p className="h-11 px-4 rounded-lg border border-gray-200 bg-gray-50 flex items-center text-sm font-medium text-gray-700">
                  {areas.find(a => a.id === tableForm.areaId)?.name || tableForm.areaId}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button disabled={pending} onClick={() => editTable ? doAction(updateTable, editTable.id, tableForm) : doAction(createTable, tableForm)}>
              {pending ? t.common.saving : t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
