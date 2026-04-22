import { IUser } from '../IUser';
import { IAccountInfo } from '../IAccountInfo';

export interface IUserService {
  findById(uid: string): Promise<IUser>;
  findByAccount(account: string): Promise<IUser>;
  addUser(accountInfo: IAccountInfo): Promise<{ succeed: boolean }>;
  activateUser(accountInfo: IAccountInfo): Promise<any>;
  findAllUsers(page?: number, pageSize?: number): Promise<{ users: IUser[], total: number }>;
  updateUser(id: number, updates: Partial<IUser>): Promise<{ succeed: boolean }>;
  deleteUser(id: number): Promise<{ succeed: boolean }>;
}
