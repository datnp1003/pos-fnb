"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pencil, Trash2, Plus, Shield, ShoppingBag, ClipboardList, DollarSign, BarChart3, Settings2, LayoutDashboard, Tv, Music, Users, X, Check, Eye } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n/context";
import { MobileSheet } from "@/components/shared/mobile-sheet";
import { getUsers, getRoles, createUser, updateUser, deleteUser, createRole, updateRole, deleteRole } from "@/server/settings/actions";

type User = Awaited<ReturnType<typeof getUsers>>[0];
type Role = Awaited<ReturnType<typeof getRoles>>[0];

type ActionKey = "view" | "create" | "edit" | "delete";

interface ModuleDef {
  key: string;
  label: string;
  icon: React.ElementType;
  color: string;
}

const MODULES: ModuleDef[] = [
  { key: "order", label: "Sales", icon: ShoppingBag, color: "blue" },
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, color: "emerald" },
  { key: "inventory", label: "Inventory", icon: ClipboardList, color: "amber" },
  { key: "cash", label: "Cash", icon: DollarSign, color: "green" },
  { key: "reports", label: "Reports", icon: BarChart3, color: "purple" },
  { key: "settings", label: "Settings", icon: Settings2, color: "gray" },
  { key: "kds", label: "KDS", icon: Tv, color: "red" },
  { key: "karaoke", label: "Karaoke", icon: Music, color: "pink" },
];

const ACTIONS: { key: ActionKey; label: string; short: string }[] = [
  { key: "view", label: "View", short: "V" },
  { key: "create", label: "Create", short: "C" },
  { key: "edit", label: "Edit", short: "E" },
  { key: "delete", label: "Delete", short: "D" },
];

const ALL_ACTIONS: ActionKey[] = ["view", "create", "edit", "delete"];

function addPermissionEntry(p: string, result: Record<string, ActionKey[]>) {
  const sep = Math.max(p.lastIndexOf("."), p.lastIndexOf(":"));
  if (sep < 0) return;
  const moduleKey = p.substring(0, sep);
  const action = p.substring(sep + 1);
  if (action === "*") {
    result[moduleKey] = [...ALL_ACTIONS];
  } else if ((ALL_ACTIONS as string[]).includes(action)) {
    if (!result[moduleKey]) result[moduleKey] = [];
    if (!result[moduleKey].includes(action as ActionKey)) result[moduleKey].push(action as ActionKey);
  }
}

function parsePermissions(permissions: string): Record<string, ActionKey[]> {
  try {
    const arr = JSON.parse(permissions || "[]") as string[];
    if (!Array.isArray(arr)) return {};
    const result: Record<string, ActionKey[]> = {};
    for (const p of arr) {
      if (p === "*") {
        for (const m of MODULES) result[m.key] = [...ALL_ACTIONS];
        return result;
      }
      addPermissionEntry(p, result);
    }
    return result;
  } catch { return {}; }
}

function serializePermissions(perms: Record<string, ActionKey[]>): string {
  const allModules = MODULES.map(m => m.key);
  const hasAll = allModules.every(m => perms[m]?.length === 4);
  if (hasAll) return JSON.stringify(["*"]);
  const arr: string[] = [];
  for (const [moduleKey, actions] of Object.entries(perms)) {
    if (!actions || actions.length === 0) continue;
    if (actions.length === 4) { arr.push(`${moduleKey}.*`); }
    else { for (const a of actions) arr.push(`${moduleKey}:${a}`); }
  }
  return JSON.stringify(arr);
}

function parseScopes(scopes: string): string[] {
  try { const arr = JSON.parse(scopes || "[]"); return Array.isArray(arr) ? arr : []; }
  catch { return []; }
}

function serializeScopes(modules: string[]): string {
  return JSON.stringify(modules);
}

export function UsersManager({ users, roles }: { readonly users: readonly User[]; readonly roles: readonly Role[] }) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("users");
  const [openUserSheet, setOpenUserSheet] = useState(false);
  const [openRoleSheet, setOpenRoleSheet] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [userForm, setUserForm] = useState({ username: "", password: "", name: "", roleId: "" });
  const [rolePerms, setRolePerms] = useState<Record<string, ActionKey[]>>({});
  const [roleName, setRoleName] = useState("");

  const actionLabels: Record<ActionKey, string> = {
    view: t.settings.actionView,
    create: t.settings.actionCreate,
    edit: t.settings.actionEdit,
    delete: t.settings.actionDelete,
  };
  const actionShort: Record<ActionKey, string> = { view: "M", create: "C", edit: "E", delete: "D" };

  function openNewUser() { setEditingUser(null); setUserForm({ username: "", password: "", name: "", roleId: roles[0]?.id ?? "" }); setOpenUserSheet(true); }
  function openEditUser(u: User) { setEditingUser(u); setUserForm({ username: u.username, password: "", name: u.name, roleId: u.roleId }); setOpenUserSheet(true); }
  function openNewRole() { setEditingRole(null); setRoleName(""); setRolePerms({}); setOpenRoleSheet(true); }
  function openEditRole(r: Role) {
    setEditingRole(r); setRoleName(r.name); setRolePerms(parsePermissions(r.permissions));
    setOpenRoleSheet(true);
  }

  function toggleModuleAction(moduleKey: string, action: ActionKey) {
    setRolePerms(prev => {
      const next = { ...prev };
      if (!next[moduleKey]) next[moduleKey] = [];
      const idx = next[moduleKey].indexOf(action);
      if (idx >= 0) { next[moduleKey] = next[moduleKey].filter(a => a !== action); if (next[moduleKey].length === 0) delete next[moduleKey]; }
      else { next[moduleKey] = [...next[moduleKey], action]; }
      return next;
    });
  }

  function moduleAll(moduleKey: string) { setRolePerms(prev => ({ ...prev, [moduleKey]: ["view", "create", "edit", "delete"] })); }
  function moduleNone(moduleKey: string) { setRolePerms(prev => { const next = { ...prev }; delete next[moduleKey]; return next; }); }
  function selectAll() {
    const all: Record<string, ActionKey[]> = {};
    MODULES.forEach(m => all[m.key] = ["view", "create", "edit", "delete"]);
    setRolePerms(all);
  }
  function viewOnly() {
    const all: Record<string, ActionKey[]> = {};
    MODULES.forEach(m => all[m.key] = ["view"]);
    setRolePerms(all);
  }
  function clearAll() { setRolePerms({}); }

  const selectedScopes = Object.keys(rolePerms);

  async function saveUser() {
    try {
      if (editingUser) {
        await updateUser(editingUser.id, { name: userForm.name, roleId: userForm.roleId, ...(userForm.password ? { password: userForm.password } : {}) });
      } else {
        await createUser(userForm as Parameters<typeof createUser>[0]);
      }
      toast.success(t.common.success);
      setOpenUserSheet(false);
    } catch { toast.error(t.common.error); }
  }

  async function saveRole() {
    try {
      const data = { name: roleName, permissions: serializePermissions(rolePerms), scopes: serializeScopes(selectedScopes) };
      if (editingRole) await updateRole(editingRole.id, data);
      else await createRole(data);
      toast.success(t.common.success);
      setOpenRoleSheet(false);
    } catch { toast.error(t.common.error); }
  }

  function getModuleLabel(key: string) { return MODULES.find(m => m.key === key)?.label || key; }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="users"><Users className="h-4 w-4 mr-1" />{t.settings.users}</TabsTrigger>
          <TabsTrigger value="roles"><Shield className="h-4 w-4 mr-1" />{t.settings.roles}</TabsTrigger>
        </TabsList>

        {/* ==== USERS TAB ==== */}
        <TabsContent value="users" className="space-y-4 pt-4">
          <div className="flex justify-between">
            <h3 className="text-lg font-semibold">{t.settings.userList}</h3>
            <button onClick={openNewUser} className="btn-pos-secondary text-sm gap-1"><Plus className="h-4 w-4" /> {t.common.add}</button>
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>{t.settings.name}</TableHead><TableHead>{t.settings.account}</TableHead><TableHead>{t.settings.roles}</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {users.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell>{u.username}</TableCell>
                  <TableCell><Badge variant="outline">{u.role.name}</Badge></TableCell>
                  <TableCell className="text-right space-x-1">
                    <button className="p-1.5 rounded-lg hover:bg-gray-100" onClick={() => openEditUser(u)}><Pencil className="h-4 w-4 text-gray-500" /></button>
                    <button className="p-1.5 rounded-lg hover:bg-red-50" onClick={() => { deleteUser(u.id); toast.success(t.common.success); }}><Trash2 className="h-4 w-4 text-red-500" /></button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        {/* ==== ROLES TAB ==== */}
        <TabsContent value="roles" className="space-y-4 pt-4">
          <div className="flex justify-between">
            <h3 className="text-lg font-semibold">{t.settings.roleList}</h3>
            <button onClick={openNewRole} className="btn-pos-secondary text-sm gap-1"><Shield className="h-4 w-4" /> {t.common.add}</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {roles.map(r => {
              const perms = parsePermissions(r.permissions);
              const scopes = parseScopes(r.scopes || "[]");
              const userCount = users.filter(u => u.roleId === r.id).length;
              const isFull = Object.keys(perms).length > 0 && Object.values(perms).every(a => a.length === 4);
              let roleContent: React.ReactNode;
              if (isFull) {
                roleContent = <Badge className="bg-amber-100 text-amber-800 text-xs">{t.settings.permissionAll}</Badge>;
              } else if (scopes.length > 0) {
                const colorMap: Record<string, string> = { blue: "bg-blue-100 text-blue-700", emerald: "bg-emerald-100 text-emerald-700", amber: "bg-amber-100 text-amber-700", green: "bg-green-100 text-green-700", purple: "bg-purple-100 text-purple-700", gray: "bg-gray-100 text-gray-700", red: "bg-red-100 text-red-700", pink: "bg-pink-100 text-pink-700" };
                roleContent = (
                  <div className="flex flex-wrap gap-1">
                    {scopes.map(s => {
                      const mod = MODULES.find(m => m.key === s);
                      const IconComponent = mod?.icon || Shield;
                      return (
                        <span key={s} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${colorMap[s] || "bg-gray-100 text-gray-700"}`}>
                          <IconComponent className="h-3 w-3" />
                          {mod?.label || s}
                        </span>
                      );
                    })}
                  </div>
                );
              } else {
                roleContent = <p className="text-xs text-muted-foreground italic">{t.settings.noPermission}</p>;
              }
              return (
                <Card key={r.id} className="hover:shadow-md transition-shadow cursor-pointer group" onClick={() => openEditRole(r)}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">{r.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">{userCount} {t.settings.userCount_other.replace("{{count}}", String(userCount))}</p>
                      </div>
                      <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1 rounded hover:bg-gray-100" onClick={(e) => { e.stopPropagation(); openEditRole(r); }}><Pencil className="h-3 w-3 text-gray-400" /></button>
                        <button className="p-1 rounded hover:bg-red-50" onClick={(e) => { e.stopPropagation(); deleteRole(r.id); toast.success(t.common.success); }}><Trash2 className="h-3 w-3 text-red-400" /></button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>{roleContent}</CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* ====== USER SHEET ====== */}
      <MobileSheet open={openUserSheet} onClose={() => setOpenUserSheet(false)} title={editingUser ? t.settings.editUser : t.settings.addUser}>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>{t.settings.fullName}</Label>
            <Input value={userForm.name} onChange={e => setUserForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>{t.settings.username}</Label>
            <Input value={userForm.username} onChange={e => setUserForm(f => ({ ...f, username: e.target.value }))} disabled={!!editingUser} />
          </div>
          <div className="space-y-1">
            <Label>{editingUser ? t.settings.newPassword : t.settings.password}</Label>
            <Input type="password" value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>{t.settings.roles}</Label>
            <Select value={userForm.roleId} onValueChange={v => setUserForm(f => ({ ...f, roleId: v ?? "" }))}>
              <SelectTrigger><SelectValue placeholder={t.settings.selectRole}>{roles.find(r => r.id === userForm.roleId)?.name}</SelectValue></SelectTrigger>
              <SelectContent>{roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={() => setOpenUserSheet(false)} className="flex-1 h-11 rounded-lg border border-gray-200 font-medium text-sm text-gray-600">{t.common.cancel}</button>
          <button onClick={saveUser} className="flex-1 h-11 rounded-lg bg-amber-500 text-white font-semibold text-sm">{t.common.save}</button>
        </div>
      </MobileSheet>

      {/* ====== ROLE SHEET — PERMISSION MATRIX ====== */}
      <MobileSheet open={openRoleSheet} onClose={() => setOpenRoleSheet(false)} title={editingRole ? t.settings.editRole : t.settings.addRole} maxWidth="max-w-2xl">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Role Name */}
          <div className="space-y-1">
            <Label>{t.settings.roleName}</Label>
            <Input value={roleName} onChange={e => setRoleName(e.target.value)} placeholder="VD: Thu Ngân" className="font-semibold" />
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={selectAll} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-colors">
              <Check className="h-3 w-3" /> {t.settings.permissionAll}
            </button>
            <button type="button" onClick={viewOnly} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition-colors">
              <Eye className="h-3 w-3" /> {t.settings.permissionViewOnly}
            </button>
            <button type="button" onClick={clearAll} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 transition-colors">
              <X className="h-3 w-3" /> {t.settings.permissionClearAll}
            </button>
          </div>

          {/* Permission Matrix */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[1.6fr_repeat(4,1fr)_40px] bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600">
              <div className="p-3">{t.settings.moduleLabel}</div>
              {ACTIONS.map(a => (
                <div key={a.key} className="p-3 text-center">{actionLabels[a.key]}</div>
              ))}
              <div className="p-3"></div>
            </div>
            {/* Rows */}
            {MODULES.map(mod => {
              const modPerms = rolePerms[mod.key] || [];
              const isFull = modPerms.length === 4;
              const hasSome = modPerms.length > 0;
              const IconComponent = mod.icon;
              return (
                <div key={mod.key} className={`grid grid-cols-[1.6fr_repeat(4,1fr)_40px] border-b border-gray-100 hover:bg-gray-50/50 transition-colors ${hasSome ? "" : "opacity-60"}`}>
                  <div className="p-3 flex items-center gap-2">
                    <IconComponent className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium">{mod.label}</span>
                  </div>
                  {ACTIONS.map(a => {
                    const checked = modPerms.includes(a.key);
                    return (
                      <div key={a.key} className="p-3 flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => toggleModuleAction(mod.key, a.key)}
                          className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold transition-all border-2 ${
                            checked
                              ? "bg-amber-500 border-amber-500 text-white shadow-sm"
                              : "border-gray-200 text-gray-400 hover:border-amber-300 hover:text-amber-500 bg-white"
                          }`}
                        >
                          {checked ? <Check className="h-3 w-3" /> : actionShort[a.key]}
                        </button>
                      </div>
                    );
                  })}
                  <div className="p-3 flex items-center justify-center">
                    {isFull ? (
                      <button type="button" onClick={() => moduleNone(mod.key)} className="text-red-400 hover:text-red-600 p-0.5 rounded" title={t.settings.moduleNone}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <button type="button" onClick={() => moduleAll(mod.key)} className="text-amber-400 hover:text-amber-600 p-0.5 rounded" title={t.settings.moduleAll}>
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary */}
          <div className="text-xs text-muted-foreground">
            {selectedScopes.length === 0 ? (
              <span className="text-gray-400 italic">{t.settings.noPermission}</span>
            ) : (
              <span>{t.settings.selectedModules.replace("{count}", String(selectedScopes.length))}: {selectedScopes.map(s => getModuleLabel(s)).join(", ")}</span>
            )}
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={() => setOpenRoleSheet(false)} className="flex-1 h-11 rounded-lg border border-gray-200 font-medium text-sm text-gray-600">{t.common.cancel}</button>
          <button onClick={saveRole} disabled={!roleName} className="flex-1 h-11 rounded-lg bg-amber-500 text-white font-semibold text-sm disabled:opacity-40">{t.common.save}</button>
        </div>
      </MobileSheet>
    </div>
  );
}
