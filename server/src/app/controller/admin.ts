import { Controller, Get, Put, Del, Provide, Inject } from '@midwayjs/core';
import { Context } from '@midwayjs/web';
import { IUserService } from '../../interface/service/IUserService';
import BaseController from '../../lib/baseController';

@Provide()
@Controller('/node/admin/')
export class AdminController extends BaseController {
  @Inject()
  ctx: Context;

  @Inject('UserService')
  user: IUserService;

  private checkAdmin(): boolean {
    const user = this.ctx.state?.user?.user;
    return user && user.isAdmin === 1;
  }

  @Get('/users')
  async getUsers() {
    try {
      if (!this.checkAdmin()) {
        this.fail('Permission denied');
        return;
      }
      const page = Number(this.ctx.query.page) || 1;
      const pageSize = Number(this.ctx.query.pageSize) || 20;
      const result = await this.user.findAllUsers(page, pageSize);
      this.success(result);
    } catch (e: any) {
      this.ctx.logger.error('admin getUsers:', e);
      this.fail(e.message || 'server error');
    }
  }

  @Put('/users/:id')
  async updateUser() {
    try {
      if (!this.checkAdmin()) {
        this.fail('Permission denied');
        return;
      }
      const id = Number(this.ctx.params.id);
      const { body } = this.getRequestBody();
      const updates = body;
      const result = await this.user.updateUser(id, updates);
      this.success(result);
    } catch (e: any) {
      this.ctx.logger.error('admin updateUser:', e);
      this.fail(e.message || 'server error');
    }
  }

  @Del('/users/:id')
  async deleteUser() {
    try {
      if (!this.checkAdmin()) {
        this.fail('Permission denied');
        return;
      }
      const id = Number(this.ctx.params.id);
      const result = await this.user.deleteUser(id);
      this.success(result);
    } catch (e: any) {
      this.ctx.logger.error('admin deleteUser:', e);
      this.fail(e.message || 'server error');
    }
  }
}
