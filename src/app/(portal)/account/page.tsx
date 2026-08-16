import { ChangePasswordForm } from "./change-password-form";

export default function AccountPage() {
  return (
    <div className="space-y-5">
      <div className="portal-page-heading">
        <div>
          <h1 className="portal-page-title">Tài khoản</h1>
          <p className="portal-page-subtitle">Đổi mật khẩu đăng nhập của bạn.</p>
        </div>
      </div>
      <div className="portal-table-card p-6">
        <ChangePasswordForm />
      </div>
    </div>
  );
}
