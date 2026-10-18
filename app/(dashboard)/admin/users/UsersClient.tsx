"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { SYSTEM_PERMISSIONS } from "@/lib/permissions";
import PaywallModal from "@/components/PaywallModal";

function IconShield({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function IconUsers({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconPlus({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" x2="12" y1="5" y2="19" />
      <line x1="5" x2="19" y1="12" y2="12" />
    </svg>
  );
}

function IconEdit({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function IconTrash({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function IconCheck({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

interface UserType {
  id: string;
  name: string;
  email: string;
  role: string;
  customRoleId?: string | null;
  customRole?: { id: string; name: string; permissions?: string[] };
  permissions: string[];
  isActive: boolean;
  createdAt: string;
  userOutlets?: Array<{
    outletId: string;
    role: string;
    outlet?: { id: string; name: string; icon: string };
  }>;
  templateAccess?: Array<{
    templateId: string;
    canSubmit: boolean;
    canVerify: boolean;
    template?: { id: string; title: string; icon: string };
  }>;
}

interface UsersClientProps {
  initialUsers: UserType[];
  outlets: Array<{ id: string; name: string; icon: string }>;
  templates: Array<{ id: string; title: string; icon: string; category: string; slug: string }>;
  customRoles: Array<{ id: string; name: string; description?: string; permissions: string[] }>;
}

export default function UsersClient({
  initialUsers,
  outlets,
  templates,
  customRoles: initialCustomRoles,
}: UsersClientProps) {
  const router = useRouter();
  const [users, setUsers] = useState<UserType[]>(initialUsers);
  const [customRoles, setCustomRoles] = useState(initialCustomRoles);
  const [activeTab, setActiveTab] = useState<"users" | "roles">("users");

  // User modal state
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [baseRole, setBaseRole] = useState("OPERATOR");
  const [selectedCustomRole, setSelectedCustomRole] = useState<string>("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(["submit_checklists"]);
  const [selectedOutlets, setSelectedOutlets] = useState<string[]>(outlets.map((o) => o.id));
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>(templates.map((t) => t.id));

  // Role modal state
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<any | null>(null);
  const [roleName, setRoleName] = useState("");
  const [roleDesc, setRoleDesc] = useState("");
  const [rolePerms, setRolePerms] = useState<string[]>(["submit_checklists"]);

  const [saving, setSaving] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const handleOpenCreateRole = () => {
    setEditingRole(null);
    setRoleName("");
    setRoleDesc("");
    setRolePerms(["submit_checklists"]);
    setShowRoleModal(true);
  };

  const handleOpenEditRole = (role: any) => {
    setEditingRole(role);
    setRoleName(role.name);
    setRoleDesc(role.description || "");
    setRolePerms(role.permissions || ["submit_checklists"]);
    setShowRoleModal(true);
  };

  const handleDeleteRole = async (roleId: string, roleName: string) => {
    if (!confirm(`Are you sure you want to delete role "${roleName}"? Any users assigned to this role will revert to their base tier.`)) {
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/roles?id=${roleId}`, { method: "DELETE" });
      const json = await res.json();
      if (res.status === 402 || json.paywall) {
        setShowPaywall(true);
        return;
      }
      if (!res.ok) throw new Error(json.error || "Failed to delete role");

      setCustomRoles((prev) => prev.filter((r) => r.id !== roleId));
      setAlert({ type: "success", msg: `✅ Role "${roleName}" deleted.` });
    } catch (err: any) {
      setAlert({ type: "error", msg: err.message || "Failed to delete role" });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenCreateUser = () => {
    setEditingUser(null);
    setUserName("");
    setUserEmail("");
    setUserPassword("");
    setBaseRole("OPERATOR");
    setSelectedCustomRole("");
    setSelectedPermissions(["submit_checklists"]);
    setSelectedOutlets(outlets.map((o) => o.id));
    setSelectedTemplates(templates.map((t) => t.id));
    setShowUserModal(true);
    setAlert(null);
  };

  const handleOpenEditUser = (u: UserType) => {
    setEditingUser(u);
    setUserName(u.name);
    setUserEmail(u.email);
    setUserPassword("");
    setBaseRole(u.role);
    setSelectedCustomRole(u.customRoleId || "");
    setSelectedPermissions(u.permissions || ["submit_checklists"]);
    setSelectedOutlets((u.userOutlets || []).map((uo) => uo.outletId));
    
    // If templateAccess is empty, default to all, else map granted template IDs
    const grantedTemplateIds = (u.templateAccess || []).map((ta) => ta.templateId);
    setSelectedTemplates(grantedTemplateIds.length > 0 ? grantedTemplateIds : templates.map((t) => t.id));
    
    setShowUserModal(true);
    setAlert(null);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setAlert(null);

    const payload = {
      id: editingUser?.id,
      name: userName,
      email: userEmail,
      password: userPassword || undefined,
      role: baseRole,
      customRoleId: selectedCustomRole || null,
      permissions: selectedPermissions,
      outletIds: selectedOutlets,
      templateAccess: selectedTemplates.map((tId) => ({
        templateId: tId,
        canSubmit: true,
        canVerify: selectedPermissions.includes("supervisor_signoff"),
      })),
    };

    try {
      const url = "/api/admin/users";
      const method = editingUser ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.status === 402 || data.paywall) {
        setShowPaywall(true);
        setAlert({ type: "error", msg: "Active Dodo Payments subscription required to manage team members or roles." });
        return;
      }
      if (!res.ok) throw new Error(data.error || "Failed to save user");

      setAlert({
        type: "success",
        msg: `✅ User "${userName}" ${editingUser ? "updated" : "created"} successfully!`,
      });
      setShowUserModal(false);
      router.refresh();

      const refreshRes = await fetch("/api/admin/users");
      if (refreshRes.ok) {
        const uList = await refreshRes.json();
        setUsers(uList);
      }
    } catch (err: any) {
      setAlert({ type: "error", msg: err.message || "Failed to save user" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setAlert(null);

    try {
      const url = "/api/admin/roles";
      const method = editingRole ? "PUT" : "POST";
      const payload: any = {
        name: roleName.trim(),
        description: roleDesc.trim(),
        permissions: rolePerms,
      };
      if (editingRole) {
        payload.id = editingRole.id;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.status === 402 || json.paywall) {
        setShowPaywall(true);
        setAlert({ type: "error", msg: "Active Dodo Payments subscription required to customize roles." });
        return;
      }
      if (!res.ok) throw new Error(json.error || "Failed to save role");

      if (editingRole) {
        setCustomRoles((prev) => prev.map((r) => (r.id === editingRole.id ? json.role : r)));
        setAlert({ type: "success", msg: `✅ Role "${json.role.name}" updated successfully!` });
      } else {
        setCustomRoles([...customRoles, json.role]);
        setAlert({ type: "success", msg: `✅ Role "${json.role.name}" created!` });
      }

      setShowRoleModal(false);
      setEditingRole(null);
      setRoleName("");
      setRoleDesc("");
      router.refresh();
    } catch (err: any) {
      setAlert({ type: "error", msg: err.message || "Failed to save role" });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isActive: !current }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.status === 402 || json.paywall) {
      setShowPaywall(true);
      return;
    }
    if (res.ok) {
      setUsers((u) => u.map((x) => (x.id === id ? { ...x, isActive: !current } : x)));
    }
  };

  return (
    <div className="admin-page-container">
      {/* Header */}
      <div className="admin-header-row">
        <div>
          <h1 className="admin-page-title">Team & Roles</h1>
          <p className="admin-page-subtitle">
            Manage team members, roles, and facility access permissions.
          </p>
        </div>

        <div className="header-actions-group">
          <button
            onClick={handleOpenCreateRole}
            className="btn-secondary-action"
          >
            <IconShield />
            <span>Add Role</span>
          </button>
          <button
            onClick={handleOpenCreateUser}
            className="btn-create-primary"
          >
            <IconPlus />
            <span>Add Member</span>
          </button>
        </div>
      </div>

      {alert && (
        <div className={`notification-toast ${alert.type}`}>
          <span>{alert.type === "success" ? "✓" : "⚠️"}</span>
          <span>{alert.msg}</span>
          <button onClick={() => setAlert(null)} className="toast-close">
            ✕
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="nav-tabs-bar">
        <button
          onClick={() => setActiveTab("users")}
          className={`tab-btn ${activeTab === "users" ? "active" : ""}`}
        >
          <IconUsers />
          <span>Team Members ({users.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("roles")}
          className={`tab-btn ${activeTab === "roles" ? "active" : ""}`}
        >
          <IconShield />
          <span>Dynamic Custom Roles ({customRoles.length})</span>
        </button>
      </div>

      {activeTab === "users" ? (
        <div className="table-card">
          <div className="table-header-bar">
            <h3>Active Team Directory</h3>
          </div>
          <div className="table-responsive">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Employee / Member</th>
                  <th>Assigned Role</th>
                  <th>Assigned Facilities</th>
                  <th>Checklist Access</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const assignedOutlets = (u.userOutlets || []).map((uo) => uo.outlet?.name).filter(Boolean);
                  const assignedTemplates = (u.templateAccess || []).map((ta) => ta.template?.title).filter(Boolean);
                  const roleDisplayName = u.customRole?.name || u.role;

                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="user-name-cell">
                          <div className="user-mini-avatar">
                            {u.name
                              .split(" ")
                              .filter(Boolean)
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase() || "U"}
                          </div>
                          <div>
                            <div className="font-semibold">{u.name}</div>
                            <span className="user-email-sub">{u.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`role-badge ${u.role.toLowerCase()}`}>
                          {roleDisplayName}
                        </span>
                      </td>
                      <td>
                        {assignedOutlets.length === 0 ? (
                          <span className="muted-text">All Facilities</span>
                        ) : (
                          <div className="facility-tags-list">
                            {assignedOutlets.map((name, i) => (
                              <span key={i} className="facility-tag">
                                {name}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>
                        {assignedTemplates.length === 0 ? (
                          <span className="badge-freq">All Checklists</span>
                        ) : (
                          <span className="badge-category">{assignedTemplates.length} Sheets</span>
                        )}
                      </td>
                      <td>
                        <span className={`status-pill ${u.isActive ? "submitted" : "flagged"}`}>
                          {u.isActive ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions-inline">
                          <button
                            onClick={() => handleOpenEditUser(u)}
                            className="btn-edit-small"
                          >
                            <IconEdit />
                            <span>Permissions</span>
                          </button>
                          <button
                            onClick={() => toggleActive(u.id, u.isActive)}
                            className={`status-toggle-btn ${u.isActive ? "breach" : "done"}`}
                          >
                            {u.isActive ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Custom Roles Grid */
        <div className="templates-grid">
          {customRoles.map((role) => (
            <div key={role.id} className="template-card">
              <div className="template-card-header">
                <div className="template-icon-circle">
                  <IconShield />
                </div>
                <span className="badge-category">{role.permissions.length} Permissions</span>
              </div>
              <h3 className="template-title">{role.name}</h3>
              <p className="template-desc">{role.description || "Custom organization role"}</p>

              <div className="permissions-chips-box">
                <span className="section-label">Granted Access:</span>
                <div className="template-chips-wrap">
                  {role.permissions.map((p: string) => {
                    const def = SYSTEM_PERMISSIONS.find((sp) => sp.key === p);
                    return (
                      <span key={p} className="template-chip">
                        <IconCheck />
                        <span>{def?.label || p}</span>
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="template-actions-row" style={{ marginTop: "1rem" }}>
                <button
                  type="button"
                  onClick={() => handleOpenEditRole(role)}
                  className="btn-action-edit"
                >
                  <IconEdit />
                  <span>Edit Role & Permissions</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteRole(role.id, role.name)}
                  className="btn-action-delete"
                >
                  <IconTrash />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* User Create/Edit Modal with Granular Access */}
      {showUserModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h2>{editingUser ? `Edit Permissions: ${editingUser.name}` : "Add New Employee"}</h2>
              <button onClick={() => setShowUserModal(false)} className="modal-close-btn">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="modal-form">
              <div className="form-group">
                <label>Employee Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bharti Patil"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Work Email Address *</label>
                  <input
                    type="email"
                    required
                    disabled={!!editingUser}
                    placeholder="user@restaurant.com"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>{editingUser ? "Change Password (optional)" : "Password *"}</label>
                  <input
                    type="password"
                    required={!editingUser}
                    placeholder={editingUser ? "Leave blank to keep current" : "••••••••"}
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>System Role Tier</label>
                  <select
                    value={baseRole}
                    onChange={(e) => setBaseRole(e.target.value)}
                    className="form-select"
                  >
                    <option value="OPERATOR">👷 Worker / Operator (Fill checklists)</option>
                    <option value="SUPERVISOR">🔍 Supervisor (Verify & digital sign-off)</option>
                    <option value="OUTLET_MANAGER">🏢 Facility / Branch Manager</option>
                    <option value="ORG_ADMIN">👑 Organization Administrator</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Custom Job Role Title</label>
                  <select
                    value={selectedCustomRole}
                    onChange={(e) => {
                      const rId = e.target.value;
                      setSelectedCustomRole(rId);
                      const targetRole = customRoles.find((r) => r.id === rId);
                      if (targetRole) {
                        setSelectedPermissions(targetRole.permissions);
                      }
                    }}
                    className="form-select"
                  >
                    <option value="">Default (From Base Role)</option>
                    {customRoles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Granular Permission Toggles */}
              <div className="form-group">
                <label>Granular Dynamic Permissions</label>
                <div className="permissions-selection-groups">
                  {[
                    { cat: "EXECUTION", title: "⚡ Execution & Floor Checklists", desc: "Shift checklist logging & entries" },
                    { cat: "AUDIT", title: "📋 Audit, Sign-Off & Regulatory Exports", desc: "Digital verification & reporting" },
                    { cat: "MANAGEMENT", title: "⚙️ Facility, Team & Template Management", desc: "System setup, RBAC & custom tabs" },
                  ].map((grp) => {
                    const groupPerms = SYSTEM_PERMISSIONS.filter((p) => p.category === grp.cat);
                    if (groupPerms.length === 0) return null;
                    return (
                      <div key={grp.cat} className="perm-domain-group" style={{ marginBottom: "0.85rem" }}>
                        <div style={{ marginBottom: "0.35rem" }}>
                          <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-primary)" }}>{grp.title}</span>
                          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginLeft: "0.4rem" }}>({grp.desc})</span>
                        </div>
                        <div className="permissions-selection-grid">
                          {groupPerms.map((perm) => (
                            <label key={perm.key} className="perm-checkbox-card">
                              <input
                                type="checkbox"
                                checked={selectedPermissions.includes(perm.key)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedPermissions([...selectedPermissions, perm.key]);
                                  } else {
                                    setSelectedPermissions(selectedPermissions.filter((k) => k !== perm.key));
                                  }
                                }}
                              />
                              <div>
                                <span className="perm-label">{perm.label}</span>
                                <span className="perm-desc">{perm.description}</span>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Facility Access Checkboxes */}
              <div className="form-group">
                <label>Allowed Facilities / Outlets</label>
                <div className="outlet-checkboxes-grid">
                  {outlets.map((o) => (
                    <label key={o.id} className="outlet-checkbox-item">
                      <input
                        type="checkbox"
                        checked={selectedOutlets.includes(o.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedOutlets([...selectedOutlets, o.id]);
                          } else {
                            setSelectedOutlets(selectedOutlets.filter((id) => id !== o.id));
                          }
                        }}
                      />
                      <span>
                        {o.icon} {o.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Specific Template Access Checkboxes */}
              <div className="form-group">
                <label>Allowed Report Tabs & Checklists</label>
                <div className="outlet-checkboxes-grid">
                  {templates.map((t) => (
                    <label key={t.id} className="outlet-checkbox-item">
                      <input
                        type="checkbox"
                        checked={selectedTemplates.includes(t.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTemplates([...selectedTemplates, t.id]);
                          } else {
                            setSelectedTemplates(selectedTemplates.filter((id) => id !== t.id));
                          }
                        }}
                      />
                      <span>
                        {t.icon} {t.title}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="modal-actions-bar">
                <button type="button" onClick={() => setShowUserModal(false)} className="btn-cancel">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary-save">
                  {saving ? "Saving..." : editingUser ? "Save Permissions" : "Add Employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Role Creation & Editing Modal */}
      {showRoleModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h2>{editingRole ? `🛡️ Edit Dynamic Role: ${editingRole.name}` : "🛡️ Create Dynamic Role"}</h2>
              <button onClick={() => setShowRoleModal(false)} className="modal-close-btn">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRole} className="modal-form">
              {/* Presets for quick start if creating */}
              {!editingRole && (
                <div style={{ marginBottom: "1rem" }}>
                  <span className="field-hint" style={{ display: "block", marginBottom: "0.4rem" }}>
                    ⚡ Quick Role Templates:
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                    {[
                      {
                        name: "Shift Supervisor",
                        desc: "Reviews checklists, logs corrective actions, signs off",
                        perms: ["submit_checklists", "supervisor_signoff", "view_reports"],
                      },
                      {
                        name: "Head Chef / Kitchen Lead",
                        desc: "Food safety oversight, temperature logging and hygiene checklists",
                        perms: ["submit_checklists", "supervisor_signoff", "view_reports"],
                      },
                      {
                        name: "Sanitation Supervisor",
                        desc: "Sanitization standards, pest inspections, equipment logs",
                        perms: ["submit_checklists", "supervisor_signoff", "view_reports"],
                      },
                      {
                        name: "Line Worker / Cleaner",
                        desc: "Daily checklists, equipment cleaning and cleaning SOPs",
                        perms: ["submit_checklists"],
                      },
                      {
                        name: "Facility Manager",
                        desc: "Full facility access, reports export, team management",
                        perms: [
                          "submit_checklists",
                          "supervisor_signoff",
                          "view_reports",
                          "export_audit_pack",
                          "manage_outlets",
                          "manage_team",
                        ],
                      },
                      {
                        name: "Quality Assurance Auditor",
                        desc: "Third party or internal auditor with export and review permissions",
                        perms: ["view_reports", "export_audit_pack"],
                      },
                    ].map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => {
                          setRoleName(preset.name);
                          setRoleDesc(preset.desc);
                          setRolePerms(preset.perms);
                        }}
                        className="preset-btn"
                        style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem" }}
                      >
                        + {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="form-group">
                <label>Role Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hygiene Auditor, Head Chef, Shift Supervisor"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>Role Description</label>
                <input
                  type="text"
                  placeholder="Responsibilities and access scope..."
                  value={roleDesc}
                  onChange={(e) => setRoleDesc(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <label style={{ margin: 0 }}>Role Security & Operational Permissions ({rolePerms.length} selected)</label>
                  <div style={{ display: "flex", gap: "0.5rem", fontSize: "0.75rem" }}>
                    <button
                      type="button"
                      onClick={() => setRolePerms(SYSTEM_PERMISSIONS.map((p) => p.key))}
                      className="btn-link-small"
                    >
                      Select All
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => setRolePerms([])}
                      className="btn-link-small"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
                <div className="permissions-selection-groups">
                  {[
                    { cat: "EXECUTION", title: "⚡ Execution & Floor Checklists", desc: "Shift checklist logging & entries" },
                    { cat: "AUDIT", title: "📋 Audit, Sign-Off & Regulatory Exports", desc: "Digital verification & reporting" },
                    { cat: "MANAGEMENT", title: "⚙️ Facility, Team & Template Management", desc: "System setup, RBAC & custom tabs" },
                  ].map((grp) => {
                    const groupPerms = SYSTEM_PERMISSIONS.filter((p) => p.category === grp.cat);
                    if (groupPerms.length === 0) return null;
                    return (
                      <div key={grp.cat} className="perm-domain-group" style={{ marginBottom: "1rem" }}>
                        <div style={{ marginBottom: "0.4rem" }}>
                          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-primary)" }}>{grp.title}</span>
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "0.5rem" }}>({grp.desc})</span>
                        </div>
                        <div className="permissions-selection-grid">
                          {groupPerms.map((perm) => (
                            <label key={perm.key} className="perm-checkbox-card">
                              <input
                                type="checkbox"
                                checked={rolePerms.includes(perm.key)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setRolePerms([...rolePerms, perm.key]);
                                  } else {
                                    setRolePerms(rolePerms.filter((k) => k !== perm.key));
                                  }
                                }}
                              />
                              <div>
                                <span className="perm-label">{perm.label}</span>
                                <span className="perm-desc">{perm.description}</span>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="modal-actions-bar">
                <button type="button" onClick={() => setShowRoleModal(false)} className="btn-cancel">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary-save">
                  {saving ? "Saving..." : editingRole ? "Update Role" : "Create Role"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <PaywallModal
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        title="Team Management Paywalled"
        description="Adding kitchen team members, assigning custom roles, and managing checklist permissions requires an active OVYRO FDA subscription via Dodo Payments."
      />
    </div>
  );
}
