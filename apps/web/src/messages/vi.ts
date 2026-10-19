import type { ApiErrorCode, Role } from '@meal/shared';

/**
 * Every user-facing string lives here (plan 7.1 rule 9). Routes are English; copy is Vietnamese.
 * Use `t('path.to.key', { name: 'value' })` from ./index; placeholders look like {name}.
 */
export const vi = {
  app: {
    name: 'Đặt cơm PNJP',
    factory: 'PNJP Gò Vấp',
    tagline: 'Đăng ký suất ăn trưa',
  },
  common: {
    loading: 'Đang tải…',
    signOut: 'Đăng xuất',
    back: 'Quay lại',
    menu: 'Mở menu',
    closeMenu: 'Đóng menu',
    requiredField: 'Trường này là bắt buộc',
  },
  nav: {
    label: 'Điều hướng chính',
    groups: {
      mine: 'Của tôi',
      admin: 'Quản trị',
    },
    items: {
      today: 'Hôm nay',
      week: 'Đăng ký tuần',
      team: 'Đơn vị của tôi',
      history: 'Lịch sử',
      adminToday: 'Hôm nay (quản trị)',
      registrations: 'Đăng ký tuần (quản trị)',
      print: 'In phiếu đăng ký',
      dishes: 'Thư viện món',
      menu: 'Thực đơn tuần',
      reconciliation: 'Đối soát',
      delivery: 'Giao nhận',
      reports: 'Báo cáo',
      master: 'Nhà ăn, tầng, trung tâm chi phí',
      org: 'Cơ cấu tổ chức',
      employees: 'Nhân viên',
      settings: 'Cài đặt',
      audit: 'Nhật ký hoạt động',
      system: 'Hệ thống',
    },
  },
  roles: {
    EMPLOYEE: 'Nhân viên',
    DEPT_ADMIN: 'Quản trị bộ phận',
    HC_ADMIN: 'Quản trị Hành chánh',
    SYS_ADMIN: 'Quản trị hệ thống',
  } satisfies Record<Role, string>,
  banners: {
    label: 'Thông báo hệ thống',
  },
  login: {
    title: 'Đăng nhập',
    subtitle: 'Hệ thống đặt cơm trưa PNJP Gò Vấp',
    microsoft: 'Đăng nhập bằng Microsoft',
    or: 'hoặc dùng mã nhân viên',
    employeeCode: 'Mã nhân viên',
    employeeCodePlaceholder: 'Ví dụ: PNJP000001',
    pin: 'Mã PIN (6 chữ số)',
    submit: 'Đăng nhập',
    submitting: 'Đang đăng nhập…',
    pinFormat: 'Mã PIN gồm đúng 6 chữ số',
    ssoFailed: 'Đăng nhập Microsoft không thành công. Vui lòng thử lại hoặc dùng mã nhân viên.',
    lockedUntil: 'Tài khoản tạm khóa do nhập sai nhiều lần. Thử lại sau {time}.',
    help: 'Quên mã PIN? Liên hệ quản trị bộ phận hoặc phòng Hành chánh để được cấp lại.',
  },
  changePin: {
    title: 'Đổi mã PIN',
    forcedIntro:
      'Đây là lần đăng nhập đầu tiên hoặc mã PIN của bạn vừa được cấp lại. Vui lòng đặt mã PIN mới để tiếp tục.',
    intro: 'Nhập mã PIN hiện tại và mã PIN mới gồm 6 chữ số.',
    currentPin: 'Mã PIN hiện tại',
    newPin: 'Mã PIN mới',
    confirmPin: 'Nhập lại mã PIN mới',
    mismatch: 'Hai mã PIN mới không giống nhau',
    submit: 'Đổi mã PIN',
    submitting: 'Đang lưu…',
    cancel: 'Để sau',
    success: 'Đã đổi mã PIN.',
  },
  notLinked: {
    title: 'Tài khoản chưa được liên kết',
    body: 'Email Microsoft của bạn chưa khớp với nhân viên nào trong hệ thống. Vui lòng liên hệ phòng Hành chánh để được liên kết tài khoản, hoặc đăng nhập bằng mã nhân viên.',
    backToLogin: 'Về trang đăng nhập',
  },
  placeholder: {
    title: 'Chức năng đang được xây dựng',
    body: 'Màn hình này sẽ có ở giai đoạn {phase}.',
    forbidden: 'Bạn không có quyền truy cập màn hình này.',
  },
  errors: {
    UNAUTHENTICATED: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
    NOT_FOUND: 'Không tìm thấy dữ liệu yêu cầu.',
    VALIDATION_FAILED: 'Dữ liệu chưa hợp lệ. Vui lòng kiểm tra lại.',
    INVALID_CREDENTIALS: 'Mã nhân viên hoặc mã PIN không đúng.',
    PIN_LOCKED: 'Tài khoản tạm khóa do nhập sai nhiều lần.',
    PIN_CHANGE_REQUIRED: 'Bạn cần đổi mã PIN trước khi tiếp tục.',
    PIN_UNCHANGED: 'Mã PIN mới phải khác mã PIN hiện tại.',
    SSO_NOT_LINKED: 'Tài khoản Microsoft chưa được liên kết với nhân viên.',
    SSO_FAILED: 'Đăng nhập Microsoft không thành công.',
    INTERNAL: 'Hệ thống gặp sự cố. Vui lòng thử lại sau.',
  } satisfies Record<ApiErrorCode, string>,
  network: 'Không kết nối được tới máy chủ. Vui lòng kiểm tra mạng nội bộ và thử lại.',
} as const;

export type Messages = typeof vi;
