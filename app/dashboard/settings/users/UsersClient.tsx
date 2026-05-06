"use client";

import { useEffect, useState } from "react";

interface Store {
  id: string;
  name: string;
}

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
  profile_store_assignments: {
    store_id: string;
    stores: Store;
  }[];
}

export default function UsersClient() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Invite modal state
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [inviteStores, setInviteStores] = useState<string[]>([]);
  const [inviting, setInviting] = useState(false);

  // Edit modal state
  const [editUser, setEditUser] = useState<UserProfile | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editStores, setEditStores] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUsers(data.users);
      setStores(data.stores);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleInvite = async () => {
    setInviting(true);
    setError("");
    try {
      const res = await fetch("/api/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          full_name: inviteName,
          role: inviteRole,
          store_ids: inviteStores,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowInvite(false);
      setInviteEmail("");
      setInviteName("");
      setInviteRole("viewer");
      setInviteStores([]);
      await fetchUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to invite user");
    } finally {
      setInviting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/users/" + editUser.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: editRole,
          store_ids: editStores,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEditUser(null);
      await fetchUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (userId: string, currentlyActive: boolean) => {
    setError("");
    try {
      const res = await fetch("/api/users/" + userId, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !currentlyActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    }
  };

  const toggleStoreSelection = (
    storeId: string,
    selected: string[],
    setSelected: (s: string[]) => void
  ) => {
    if (selected.includes(storeId)) {
      setSelected(selected.filter((s) => s !== storeId));
    } else {
      setSelected([...selected, storeId]);
    }
  };

  const openEdit = (user: UserProfile) => {
    setEditUser(user);
    setEditRole(user.role);
    setEditStores(user.profile_store_assignments.map((a) => a.store_id));
  };

  const roleBadgeColor = (role: string) => {
    switch (role) {
      case "owner": return "bg-purple-100 text-purple-800";
      case "admin": return "bg-blue-100 text-blue-800";
      case "manager": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) return <div className="p-6">Loading users...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">User Management</h1>
        <button
          onClick={() => setShowInvite(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          + Invite User
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-4 font-medium text-gray-600">Name</th>
              <th className="text-left p-4 font-medium text-gray-600">Email</th>
              <th className="text-left p-4 font-medium text-gray-600">Role</th>
              <th className="text-left p-4 font-medium text-gray-600">Stores</th>
              <th className="text-left p-4 font-medium text-gray-600">Status</th>
              <th className="text-right p-4 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="p-4 font-medium">{u.full_name || "—"}</td>
                <td className="p-4 text-gray-600">{u.email}</td>
                <td className="p-4">
                  <span className={"px-2 py-1 rounded-full text-xs font-medium " + roleBadgeColor(u.role)}>
                    {u.role}
                  </span>
                </td>
                <td className="p-4 text-sm text-gray-600">
                  {u.profile_store_assignments.length > 0
                    ? u.profile_store_assignments.map((a) => a.stores?.name).join(", ")
                    : "None"}
                </td>
                <td className="p-4">
                  <span className={u.is_active
                    ? "text-green-600 font-medium text-sm"
                    : "text-red-500 font-medium text-sm"}>
                    {u.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="p-4 text-right space-x-2">
                  <button
                    onClick={() => openEdit(u)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggleActive(u.id, u.is_active)}
                    className="text-gray-500 hover:text-gray-700 text-sm font-medium"
                  >
                    {u.is_active ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Invite User</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full border rounded-lg p-2"
                  placeholder="Bo Smith"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full border rounded-lg p-2"
                  placeholder="bo@bocnyc.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full border rounded-lg p-2"
                >
                  <option value="viewer">Viewer</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                  <option value="owner">Owner</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assign Stores</label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {stores.map((store) => (
                    <label key={store.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={inviteStores.includes(store.id)}
                        onChange={() => toggleStoreSelection(store.id, inviteStores, setInviteStores)}
                      />
                      <span className="text-sm">{store.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowInvite(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                disabled={inviting || !inviteEmail || !inviteName}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {inviting ? "Inviting..." : "Send Invite"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-1">Edit User</h2>
            <p className="text-gray-500 mb-4">{editUser.full_name} ({editUser.email})</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full border rounded-lg p-2"
                >
                  <option value="viewer">Viewer</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                  <option value="owner">Owner</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Stores</label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {stores.map((store) => (
                    <label key={store.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editStores.includes(store.id)}
                        onChange={() => toggleStoreSelection(store.id, editStores, setEditStores)}
                      />
                      <span className="text-sm">{store.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditUser(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
