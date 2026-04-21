import { IAccountInfo } from '../IAccountInfo';
import { ILoginResult } from '../ILoginResult';

export interface IAccountService {
  /**
   * User login
   * @param {IAccountInfo} accountInfo - account information
   * @returns {Promise<ILoginResult>}
   */
  login(accountInfo: IAccountInfo): Promise<ILoginResult>;

  /**
   * Check user exists
   * @param {IAccountInfo} userInfo - user info
   * @returns {Promise<boolean>}
   */
  authUser(userInfo: IAccountInfo): Promise<boolean>;

  /**
   * User register
   * @param {IAccountInfo} accountInfo - account information
   * @returns {Promise<string>}
   */
  register(accountInfo: IAccountInfo): Promise<string>;

  /**
   * Send email verification code
   * @param {string} email - email address
   * @returns {Promise<string>}
   */
  sendEmailVerificationCode(email: string): Promise<string>;

  /**
   * verify by admin
   * @param {string} verify_id
   * @returns {Promise<string>}
   */
  verify(verify_id: string, emailCode: string): Promise<string>;
}
