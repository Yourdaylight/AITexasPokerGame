<template>
  <div class="admin-container">
    <div class="admin-header">
      <div class="back-btn" @click="$router.replace({ name: 'home' })">&lt; Back</div>
      <h2>User Management</h2>
    </div>

    <div class="admin-body">
      <table class="user-table" v-if="users.length > 0">
        <thead>
          <tr>
            <th>ID</th>
            <th>Account</th>
            <th>NickName</th>
            <th>Email</th>
            <th>Active</th>
            <th>Admin</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id">
            <td>{{ user.id }}</td>
            <td>{{ user.account }}</td>
            <td>
              <input class="inline-edit" v-model="user.nickName" />
            </td>
            <td>{{ user.email || '-' }}</td>
            <td>
              <input type="checkbox" v-model="user.is_active" :true-value="1" :false-value="0" />
            </td>
            <td>
              <input type="checkbox" v-model="user.is_admin" :true-value="1" :false-value="0" />
            </td>
            <td class="action-btns">
              <button class="btn-save" @click="saveUser(user)">Save</button>
              <button class="btn-delete" @click="deleteUser(user)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty-state">No users found.</div>

      <div class="pagination" v-if="total > pageSize">
        <button :disabled="page <= 1" @click="loadUsers(page - 1)">Prev</button>
        <span>Page {{ page }} of {{ totalPages }}</span>
        <button :disabled="page >= totalPages" @click="loadUsers(page + 1)">Next</button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import Component from 'vue-class-component';
import { Vue } from 'vue-property-decorator';
import service from '../service';

interface IAdminUser {
  id: number;
  account: string;
  nickName: string;
  email: string;
  is_active: number;
  is_admin: number;
}

@Component
export default class AdminPanel extends Vue {
  public users: IAdminUser[] = [];
  public page = 1;
  public pageSize = 20;
  public total = 0;

  get totalPages() {
    return Math.ceil(this.total / this.pageSize);
  }

  public async mounted() {
    await this.loadUsers(1);
  }

  public async loadUsers(page: number) {
    try {
      const result = await service.getAdminUsers(page, this.pageSize);
      this.users = result.data.users || [];
      this.total = result.data.total || 0;
      this.page = page;
    } catch (e) {
      this.$plugin.toast('Failed to load users');
    }
  }

  public async saveUser(user: IAdminUser) {
    try {
      await service.updateAdminUser(user.id, {
        nickName: user.nickName,
        is_active: user.is_active,
        is_admin: user.is_admin,
      });
      this.$plugin.toast('User updated');
    } catch (e) {
      this.$plugin.toast('Failed to update user');
    }
  }

  public async deleteUser(user: IAdminUser) {
    if (!confirm(`Delete user ${user.account}?`)) return;
    try {
      await service.deleteAdminUser(user.id);
      this.$plugin.toast('User deleted');
      await this.loadUsers(this.page);
    } catch (e) {
      this.$plugin.toast('Failed to delete user');
    }
  }
}
</script>

<style lang="less" scoped>
.admin-container {
  background: linear-gradient(135deg, #0a0a0a 0%, #0a3d28 50%, #0d2e1e 100%);
  min-height: 100vh;
  padding: 20px;
  color: #e0e0e0;

  .admin-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 20px;

    .back-btn {
      color: #d4af37;
      cursor: pointer;
      font-size: 14px;
      padding: 4px 12px;
      border: 1px solid rgba(212, 175, 55, 0.3);
      border-radius: 4px;

      &:hover {
        background: rgba(212, 175, 55, 0.1);
      }
    }

    h2 {
      color: #d4af37;
      font-size: 20px;
      margin: 0;
    }
  }

  .admin-body {
    max-width: 900px;
    margin: 0 auto;
  }

  .user-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;

    th, td {
      padding: 8px 6px;
      border-bottom: 1px solid rgba(212, 175, 55, 0.15);
      text-align: left;
    }

    th {
      color: #d4af37;
      font-weight: 600;
      background: rgba(212, 175, 55, 0.05);
    }

    .inline-edit {
      background: transparent;
      border: 1px solid rgba(212, 175, 55, 0.2);
      border-radius: 4px;
      color: #e0e0e0;
      padding: 2px 6px;
      width: 80px;
      font-size: 12px;

      &:focus {
        border-color: #d4af37;
        outline: none;
      }
    }

    input[type="checkbox"] {
      accent-color: #d4af37;
    }

    .action-btns {
      white-space: nowrap;
    }

    .btn-save {
      background: linear-gradient(135deg, #d4af37, #c49b2a);
      color: #0a0a0a;
      border: none;
      border-radius: 4px;
      padding: 4px 10px;
      font-size: 11px;
      cursor: pointer;
      font-weight: 600;
      margin-right: 4px;

      &:hover {
        background: linear-gradient(135deg, #e5c349, #d4af37);
      }
    }

    .btn-delete {
      background: transparent;
      color: #e8050a;
      border: 1px solid rgba(232, 5, 10, 0.4);
      border-radius: 4px;
      padding: 4px 10px;
      font-size: 11px;
      cursor: pointer;

      &:hover {
        background: rgba(232, 5, 10, 0.1);
      }
    }
  }

  .empty-state {
    text-align: center;
    padding: 40px;
    color: rgba(255, 255, 255, 0.4);
  }

  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px;
    margin-top: 20px;

    button {
      background: transparent;
      border: 1px solid rgba(212, 175, 55, 0.3);
      color: #d4af37;
      padding: 6px 14px;
      border-radius: 4px;
      cursor: pointer;

      &:hover:not(:disabled) {
        background: rgba(212, 175, 55, 0.1);
      }

      &:disabled {
        opacity: 0.3;
        cursor: not-allowed;
      }
    }

    span {
      font-size: 13px;
      color: rgba(255, 255, 255, 0.6);
    }
  }
}
</style>
