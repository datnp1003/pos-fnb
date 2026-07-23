import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import { renderWithProviders, userEvent } from "@/test/render";
import { UsersManager } from "./components";

vi.mock("@/server/settings/actions", () => ({
  getUsers: vi.fn(),
  getRoles: vi.fn(),
  createUser: vi.fn(async () => undefined),
  updateUser: vi.fn(async () => undefined),
  deleteUser: vi.fn(async () => undefined),
  createRole: vi.fn(async () => undefined),
  updateRole: vi.fn(async () => undefined),
  deleteRole: vi.fn(async () => undefined),
}));

import { createRole, createUser, deleteRole, deleteUser, updateRole, updateUser } from "@/server/settings/actions";

const createUserMock = vi.mocked(createUser);
const updateUserMock = vi.mocked(updateUser);
const deleteUserMock = vi.mocked(deleteUser);
const createRoleMock = vi.mocked(createRole);
const updateRoleMock = vi.mocked(updateRole);
const deleteRoleMock = vi.mocked(deleteRole);
const toastMock = vi.mocked(toast);

const adminRole = { id: "role-1", name: "Admin", permissions: "[\"*\"]", scopes: "[\"order\",\"settings\"]" };
const viewerRole = { id: "role-2", name: "Viewer", permissions: "[\"reports:view\",\"cash.edit\"]", scopes: "[\"reports\",\"cash\"]" };
const noAccessRole = { id: "role-3", name: "No access", permissions: "not-json", scopes: "not-json" };
const user = { id: "user-1", name: "Alice", username: "alice", roleId: "role-1", role: { name: "Admin" } };

function renderManager(props: Partial<React.ComponentProps<typeof UsersManager>> = {}) {
  return renderWithProviders(
    <UsersManager
      users={props.users ?? [user] as never}
      roles={props.roles ?? [adminRole, viewerRole, noAccessRole] as never}
    />,
  );
}

function sheet() {
  return document.querySelector(".fixed.inset-0.z-50") as HTMLElement;
}

function sheetSaveButton() {
  return within(sheet()).getByText("Lưu").closest("button") as HTMLButtonElement;
}

function addRoleButton() {
  return screen.getAllByRole("button", { name: "Thêm" }).at(-1) as HTMLButtonElement;
}

function addUserButton() {
  return screen.getAllByRole("button", { name: "Thêm" })[0];
}

describe("UsersManager", () => {
  it("renders user and role tabs, including empty states", async () => {
    const userEventSetup = userEvent.setup();

    renderManager({ users: [], roles: [adminRole, viewerRole, noAccessRole] as never });
    expect(screen.getByText("Danh sách người dùng")).toBeInTheDocument();

    await userEventSetup.click(screen.getByRole("tab", { name: /Vai trò/ }));
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByText("Viewer")).toBeInTheDocument();
    expect(screen.getByText("No access")).toBeInTheDocument();
    expect(screen.getByText("Toàn quyền")).toBeInTheDocument();
    expect(screen.getByText("Chưa có quyền nào")).toBeInTheDocument();
  });

  it("creates, edits, and deletes users", async () => {
    const userEventSetup = userEvent.setup();

    renderManager();
    await userEventSetup.click(addUserButton());
    await userEventSetup.type(within(sheet()).getAllByRole("textbox")[0], "Bob");
    await userEventSetup.type(within(sheet()).getAllByRole("textbox")[1], "bob");
    await userEventSetup.type(document.querySelector("input[type='password']") as HTMLInputElement, "secret");
    await userEventSetup.click(sheetSaveButton());
    await waitFor(() => expect(createUserMock).toHaveBeenCalledWith({
      name: "Bob",
      username: "bob",
      password: "secret",
      roleId: "role-1",
    }));

    const aliceRow = screen.getByText("Alice").closest("tr") as HTMLTableRowElement;
    await userEventSetup.click(within(aliceRow).getAllByRole("button")[0]);
    await userEventSetup.clear(within(sheet()).getAllByRole("textbox")[0]);
    await userEventSetup.type(within(sheet()).getAllByRole("textbox")[0], "Alice Updated");
    await userEventSetup.click(sheetSaveButton());
    await waitFor(() => expect(updateUserMock).toHaveBeenCalledWith("user-1", { name: "Alice Updated", roleId: "role-1" }));

    await userEventSetup.click(within(aliceRow).getAllByRole("button")[1]);
    await waitFor(() => expect(deleteUserMock).toHaveBeenCalledWith("user-1"));
  });

  it("creates and edits roles with permission presets and module actions", async () => {
    const userEventSetup = userEvent.setup();

    renderManager();
    await userEventSetup.click(screen.getByRole("tab", { name: /Vai trò/ }));
    await userEventSetup.click(addRoleButton());
    await userEventSetup.type(within(sheet()).getByRole("textbox"), "Cashier");
    await userEventSetup.click(screen.getByRole("button", { name: /Chỉ xem/ }));
    await userEventSetup.click(sheetSaveButton());
    await waitFor(() => expect(createRoleMock).toHaveBeenCalledWith(expect.objectContaining({
      name: "Cashier",
      permissions: expect.stringContaining("order:view"),
      scopes: expect.stringContaining("settings"),
    })));

    await userEventSetup.click(screen.getByText("Viewer"));
    await userEventSetup.click(within(sheet()).getByRole("button", { name: "Bỏ hết" }));
    await userEventSetup.click(within(sheet()).getAllByTitle("Toàn bộ quyền")[0]);
    await userEventSetup.click(sheetSaveButton());
    await waitFor(() => expect(updateRoleMock).toHaveBeenCalledWith("role-2", expect.objectContaining({
      name: "Viewer",
      permissions: "[\"order.*\"]",
      scopes: "[\"order\"]",
    })));
  });

  it("deletes roles and reports action errors", async () => {
    createRoleMock.mockRejectedValueOnce(new Error("failed"));
    const userEventSetup = userEvent.setup();

    renderManager();
    await userEventSetup.click(screen.getByRole("tab", { name: /Vai trò/ }));
    await userEventSetup.click(addRoleButton());
    await userEventSetup.type(within(sheet()).getByRole("textbox"), "Broken");
    await userEventSetup.click(sheetSaveButton());
    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());

    const viewerCard = screen.getByText("Viewer").closest(".group") as HTMLElement;
    await userEventSetup.click(within(viewerCard).getAllByRole("button")[1]);
    await waitFor(() => expect(deleteRoleMock).toHaveBeenCalledWith("role-2"));
  });
});
