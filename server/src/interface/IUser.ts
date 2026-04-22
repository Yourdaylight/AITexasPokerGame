export interface IUser {
  nickName: string;
  account: string;
  password?: string;
  id?: number;
  email?: string;
  is_active?: number;
  is_admin?: number;
}
