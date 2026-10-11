// src/pages/apiV1DocsData.ts
// BỘ DỮ LIỆU ĐẶC TẢ CHI TIẾT 100% CỔNG API V1 DỰ ÁN MYERP
// BAO QUÁT ĐẦY ĐỦ 25 PHÂN HỆ NGHIỆP VỤ - TOÀN DIỆN CRUD (GET, POST, PUT, DELETE)

export interface QueryParamDoc {
  name: string;
  type: string;
  required: boolean;
  default?: string;
  desc: string;
  enumOptions?: (string | number)[];
}

export interface BodyParamDoc {
  name: string;
  type: string;
  required: boolean;
  default?: string;
  desc: string;
  enumOptions?: (string | number)[];
}

export interface ErrorResponseDoc {
  status: number;
  title: string;
  desc: string;
  response: any;
}

export interface ApiV1Endpoint {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  title: string;
  description: string;
  category: string;
  authRequired: boolean;
  rateLimit: string;
  scopes: string[];
  headers?: Record<string, string>;
  queryParams?: QueryParamDoc[];
  bodyParams?: BodyParamDoc[];
  sampleBody?: any;
  sampleResponse: any;
  errorResponses: ErrorResponseDoc[];
}

export interface ApiV1Category {
  id: string;
  title: string;
  iconName: string;
  description: string;
  endpoints: ApiV1Endpoint[];
}

export const apiV1Categories: ApiV1Category[] = [
  {
    "id": "auth",
    "title": "01. Xác Thực, Tài Khoản & Phân Quyền Hạt Nhân (Auth & RBAC)",
    "iconName": "Shield",
    "description": "Quản trị định danh người dùng, cấp phát JWT Bearer Token, làm mới phiên, đăng nhập SSO và phân quyền ma trận hạt nhân theo vai trò và chi nhánh.",
    "endpoints": [
      {
        "id": "auth-login",
        "method": "POST",
        "path": "/api/v1/auth/login",
        "title": "Đăng Nhập Hệ Thống & Cấp Phát JWT Token",
        "description": "Xác thực tài khoản qua username/email và mật khẩu. Trả về Access Token (hạn 2 giờ) và Refresh Token (hạn 7 ngày) kèm thông tin phân quyền RBAC.",
        "category": "auth",
        "authRequired": false,
        "rateLimit": "10 requests / phút / IP",
        "scopes": [
          "public"
        ],
        "headers": {
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "username",
            "type": "string",
            "required": true,
            "desc": "Tên đăng nhập hoặc email doanh nghiệp (@ideas.edu.vn)"
          },
          {
            "name": "password",
            "type": "string",
            "required": true,
            "desc": "Mật khẩu tài khoản (tối thiểu 8 ký tự)"
          },
          {
            "name": "remember_me",
            "type": "boolean",
            "required": false,
            "default": "false",
            "desc": "Duy trì phiên đăng nhập 30 ngày trên thiết bị tin cậy"
          }
        ],
        "sampleBody": {
          "username": "sale.leader@ideas.edu.vn",
          "password": "Password#2026@Secure",
          "remember_me": true
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Đăng nhập thành công",
          "data": {
            "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            "refresh_token": "d9a1f28b4c5e7810aa39c4f102938475...",
            "token_type": "Bearer",
            "expires_in": 7200,
            "user": {
              "id": 1042,
              "full_name": "Nguyễn Thị Lan",
              "email": "sale.leader@ideas.edu.vn",
              "phone": "0901234567",
              "role": "sale",
              "tenant_id": 1,
              "branch_id": 2,
              "branch_name": "Cơ sở Tân Bình - TP.HCM",
              "permissions": [
                "leads.view_own",
                "leads.create",
                "deals.view",
                "quotes.create"
              ]
            }
          },
          "timestamp": "2026-10-08T09:00:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "auth-refresh",
        "method": "POST",
        "path": "/api/v1/auth/refresh",
        "title": "Làm Mới Phiên Đăng Nhập (Refresh Access Token)",
        "description": "Sử dụng Refresh Token còn hiệu lực để cấp phát cặp Token mới mà người dùng không cần nhập lại mật khẩu.",
        "category": "auth",
        "authRequired": false,
        "rateLimit": "30 requests / phút / IP",
        "scopes": [
          "public"
        ],
        "headers": {
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "refresh_token",
            "type": "string",
            "required": true,
            "desc": "Mã refresh token đã được cấp phát từ endpoint login"
          }
        ],
        "sampleBody": {
          "refresh_token": "d9a1f28b4c5e7810aa39c4f102938475..."
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Làm mới phiên đăng nhập thành công",
          "data": {
            "access_token": "eyJhbGciOiJIUzI1Ni...",
            "expires_in": 7200,
            "token_type": "Bearer"
          },
          "timestamp": "2026-10-08T09:01:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "auth-me",
        "method": "GET",
        "path": "/api/v1/auth/me",
        "title": "Truy Vấn Hồ Sơ Tài Khoản & Quyền Hạn (Me Profile)",
        "description": "Trích xuất hồ sơ cá nhân của tài khoản đang sở hữu Bearer Token, kiểm tra trạng thái kích hoạt, chi nhánh phụ trách và danh mục RBAC permissions.",
        "category": "auth",
        "authRequired": true,
        "rateLimit": "120 requests / phút",
        "scopes": [
          "profile.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Truy vấn hồ sơ cá nhân thành công",
          "data": {
            "id": 1042,
            "full_name": "Nguyễn Thị Lan",
            "email": "sale.leader@ideas.edu.vn",
            "phone": "0901234567",
            "role": "sale",
            "branch_id": 2,
            "branch_name": "Cơ sở Tân Bình - TP.HCM",
            "permissions": [
              "leads.view_own",
              "leads.create",
              "deals.view",
              "quotes.create",
              "deposits.view"
            ]
          },
          "timestamp": "2026-10-08T09:02:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "auth-profile-update",
        "method": "PUT",
        "path": "/api/v1/auth/profile",
        "title": "Cập Nhật Thông Tin Hồ Sơ Cá Nhân",
        "description": "Cho phép người dùng tự cập nhật số điện thoại, ảnh đại diện avatar và tiểu sử cá nhân.",
        "category": "auth",
        "authRequired": true,
        "rateLimit": "30 requests / phút",
        "scopes": [
          "profile.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "phone",
            "type": "string",
            "required": false,
            "desc": "Số điện thoại liên lạc mới"
          },
          {
            "name": "avatar_url",
            "type": "string",
            "required": false,
            "desc": "Đường dẫn URL ảnh đại diện"
          },
          {
            "name": "bio",
            "type": "string",
            "required": false,
            "desc": "Tiểu sử / giới thiệu cá nhân"
          }
        ],
        "sampleBody": {
          "phone": "0909888999",
          "avatar_url": "https://myerp.ideas.edu.vn/uploads/avatars/user_1042_new.jpg",
          "bio": "Trưởng nhóm tư vấn tuyển sinh cơ sở Tân Bình"
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Cập nhật hồ sơ cá nhân thành công",
          "data": {
            "id": 1042,
            "updated_at": "2026-10-08 09:05:00"
          },
          "timestamp": "2026-10-08T09:05:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "auth-change-password",
        "method": "POST",
        "path": "/api/v1/auth/change-password",
        "title": "Đổi Mật Khẩu Tài Khoản",
        "description": "Thay đổi mật khẩu đăng nhập, yêu cầu xác thực mật khẩu hiện tại và tự động thu hồi token cũ trên các thiết bị khác.",
        "category": "auth",
        "authRequired": true,
        "rateLimit": "5 requests / phút",
        "scopes": [
          "profile.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "old_password",
            "type": "string",
            "required": true,
            "desc": "Mật khẩu hiện tại đang dùng"
          },
          {
            "name": "new_password",
            "type": "string",
            "required": true,
            "desc": "Mật khẩu mới (tối thiểu 8 ký tự, có chữ hoa, số và ký tự đặc biệt)"
          }
        ],
        "sampleBody": {
          "old_password": "Password#2026@Secure",
          "new_password": "NewPassword#2026@UltraSecure"
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Đổi mật khẩu thành công. Các phiên đăng nhập trên thiết bị khác đã được thu hồi.",
          "timestamp": "2026-10-08T09:06:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "auth-logout",
        "method": "POST",
        "path": "/api/v1/auth/logout",
        "title": "Đăng Xuất & Hủy Phiên Làm Việc (Revoke Token)",
        "description": "Đưa Token hiện tại vào danh sách đen (Blacklist Redis/DB) và hủy bỏ hoàn toàn phiên đăng nhập hiện hành.",
        "category": "auth",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "profile.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Đăng xuất tài khoản thành công. Token đã bị vô hiệu hóa.",
          "timestamp": "2026-10-08T09:07:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "auth-permissions",
        "method": "GET",
        "path": "/api/v1/auth/permissions",
        "title": "Danh Mục Ma Trận Quyền Hạn Toàn Hệ Thống",
        "description": "Truy vấn danh mục đầy đủ các quyền hạn (permissions) và nhóm quyền (roles) được cấu hình trong hệ thống MYERP.",
        "category": "auth",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "admin"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Lấy ma trận quyền hạn thành công",
          "data": [
            {
              "module": "contacts",
              "permissions": [
                "contacts.view",
                "contacts.create",
                "contacts.edit",
                "contacts.delete",
                "contacts.export"
              ]
            },
            {
              "module": "deals",
              "permissions": [
                "deals.view",
                "deals.create",
                "deals.edit",
                "deals.delete"
              ]
            },
            {
              "module": "finance",
              "permissions": [
                "finance.view",
                "finance.create_expense",
                "finance.approve_expense"
              ]
            }
          ],
          "timestamp": "2026-10-08T09:08:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "contacts",
    "title": "02. Quản Lý Khách Hàng, Học Viên & Lead 360 (Contacts CRM)",
    "iconName": "Users",
    "description": "Quản trị cơ sở dữ liệu khách hàng tiềm năng, học viên, lịch sử tương tác, phân luồng tư vấn, nhãn tag phân loại và lịch sử giao dịch toàn diện.",
    "endpoints": [
      {
        "id": "contacts-list",
        "method": "GET",
        "path": "/api/v1/contacts",
        "title": "Truy Vấn Danh Sách Khách Hàng / Học Viên (Có Phân Trang & Bộ Lọc)",
        "description": "Lấy danh sách khách hàng và lead theo chi nhánh hoặc quyền sở hữu. Hỗ trợ tìm kiếm theo họ tên, SĐT, email, trạng thái tư vấn và nguồn tiếp cận.",
        "category": "contacts",
        "authRequired": true,
        "rateLimit": "100 requests / phút",
        "scopes": [
          "contacts.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [
          {
            "name": "page",
            "type": "integer",
            "required": false,
            "default": "1",
            "desc": "Số thứ tự trang kết quả"
          },
          {
            "name": "limit",
            "type": "integer",
            "required": false,
            "default": "25",
            "desc": "Số lượng bản ghi mỗi trang (tối đa 100)"
          },
          {
            "name": "search",
            "type": "string",
            "required": false,
            "desc": "Từ khóa tìm kiếm theo họ tên, số điện thoại hoặc email"
          },
          {
            "name": "stage_id",
            "type": "integer",
            "required": false,
            "desc": "Lọc theo ID giai đoạn phễu tư vấn"
          },
          {
            "name": "branch_id",
            "type": "integer",
            "required": false,
            "desc": "Lọc theo cơ sở / chi nhánh phụ trách"
          },
          {
            "name": "assigned_to",
            "type": "integer",
            "required": false,
            "desc": "Lọc theo ID tư vấn viên đang phụ trách"
          },
          {
            "name": "source",
            "type": "string",
            "required": false,
            "desc": "Lọc theo nguồn: 'facebook_ads', 'google_search', 'referral', 'zalo_oa'"
          }
        ],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Truy vấn danh sách khách hàng thành công",
          "data": {
            "items": [
              {
                "id": 5012,
                "full_name": "Trần Thị Mai Phương",
                "phone": "0987654321",
                "email": "maiphuong.tran@gmail.com",
                "gender": "female",
                "stage_id": 3,
                "stage_name": "Đã Hẹn Tư Vấn Trực Tiếp",
                "source": "facebook_ads",
                "branch_id": 2,
                "branch_name": "Cơ sở Tân Bình - TP.HCM",
                "assigned_to": 1042,
                "assigned_to_name": "Nguyễn Thị Lan",
                "tags": [
                  "bba_international",
                  "hot_lead"
                ],
                "created_at": "2026-10-06 14:20:10"
              }
            ],
            "pagination": {
              "current_page": 1,
              "per_page": 25,
              "total_items": 1420,
              "total_pages": 57
            }
          },
          "timestamp": "2026-10-08T09:10:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi khách hàng không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu khách hàng theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "contacts-detail",
        "method": "GET",
        "path": "/api/v1/contacts/:id",
        "title": "Truy Vấn Chi Tiết Hồ Sơ Khách Hàng 360 Độ",
        "description": "Lấy thông tin chi tiết toàn diện của một khách hàng: thông tin cá nhân, lịch sử cuộc gọi/ghi chú, cơ hội bán hàng (deals), báo giá, đơn hàng và các phiếu thu/chi liên quan.",
        "category": "contacts",
        "authRequired": true,
        "rateLimit": "100 requests / phút",
        "scopes": [
          "contacts.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Truy vấn chi tiết khách hàng thành công",
          "data": {
            "id": 5012,
            "full_name": "Trần Thị Mai Phương",
            "phone": "0987654321",
            "email": "maiphuong.tran@gmail.com",
            "address": "123 Cộng Hòa, Phường 12, Quận Tân Bình, TP.HCM",
            "birth_date": "2006-05-18",
            "guardian_name": "Trần Văn Hùng (Bố)",
            "guardian_phone": "0912345678",
            "stage_name": "Đã Hẹn Tư Vấn Trực Tiếp",
            "source": "facebook_ads",
            "deals_count": 1,
            "quotes_count": 2,
            "total_deposited": 5000000,
            "assigned_to_name": "Nguyễn Thị Lan",
            "created_at": "2026-10-06 14:20:10"
          },
          "timestamp": "2026-10-08T09:11:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi khách hàng không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu khách hàng theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "contacts-create",
        "method": "POST",
        "path": "/api/v1/contacts",
        "title": "Tạo Mới Khách Hàng / Học Viên Tiềm Năng (Lead Inbound)",
        "description": "Thêm mới hồ sơ khách hàng vào cơ sở dữ liệu. Tự động kiểm tra trùng số điện thoại (Anti-Duplicate Check) và kích hoạt phân luồng chia lead nếu không chỉ định tư vấn viên.",
        "category": "contacts",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "contacts.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "full_name",
            "type": "string",
            "required": true,
            "desc": "Họ và tên khách hàng hoặc học viên"
          },
          {
            "name": "phone",
            "type": "string",
            "required": true,
            "desc": "Số điện thoại di động hợp lệ (10 chữ số)"
          },
          {
            "name": "email",
            "type": "string",
            "required": false,
            "desc": "Địa chỉ email liên hệ"
          },
          {
            "name": "branch_id",
            "type": "integer",
            "required": true,
            "desc": "ID cơ sở đăng ký quan tâm"
          },
          {
            "name": "source",
            "type": "string",
            "required": false,
            "default": "direct",
            "desc": "Nguồn tiếp cận: 'facebook_ads', 'landing_page', 'event'"
          },
          {
            "name": "course_interest",
            "type": "string",
            "required": false,
            "desc": "Khóa học quan tâm, ví dụ: 'BBA Quản Trị Kinh Doanh'"
          },
          {
            "name": "notes",
            "type": "string",
            "required": false,
            "desc": "Ghi chú ban đầu từ biểu mẫu đăng ký"
          }
        ],
        "sampleBody": {
          "full_name": "Lê Hoàng Nam",
          "phone": "0934567890",
          "email": "hoangnam.le@gmail.com",
          "branch_id": 2,
          "source": "landing_page",
          "course_interest": "BBA Digital Marketing K2026",
          "notes": "Quan tâm học phí và chính sách học bổng đầu vào"
        },
        "sampleResponse": {
          "success": true,
          "code": 201,
          "message": "Tạo khách hàng mới thành công",
          "data": {
            "id": 5013,
            "full_name": "Lê Hoàng Nam",
            "phone": "0934567890",
            "status": "new",
            "assigned_to": 1042,
            "created_at": "2026-10-08 09:12:00"
          },
          "timestamp": "2026-10-08T09:12:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi khách hàng không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu khách hàng theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "PHONE_DUPLICATED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "contacts-update",
        "method": "PUT",
        "path": "/api/v1/contacts/:id",
        "title": "Cập Nhật Hồ Sơ Thông Tin Khách Hàng",
        "description": "Chỉnh sửa thông tin cá nhân, địa chỉ, số điện thoại phụ huynh, hoặc cập nhật giai đoạn chăm sóc của khách hàng.",
        "category": "contacts",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "contacts.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "full_name",
            "type": "string",
            "required": false,
            "desc": "Họ và tên cập nhật"
          },
          {
            "name": "email",
            "type": "string",
            "required": false,
            "desc": "Địa chỉ email mới"
          },
          {
            "name": "address",
            "type": "string",
            "required": false,
            "desc": "Địa chỉ thường trú"
          },
          {
            "name": "stage_id",
            "type": "integer",
            "required": false,
            "desc": "ID giai đoạn chăm sóc mới"
          },
          {
            "name": "guardian_phone",
            "type": "string",
            "required": false,
            "desc": "Số điện thoại phụ huynh"
          }
        ],
        "sampleBody": {
          "address": "456 Lê Văn Sỹ, Phường 10, Quận Phú Nhuận, TP.HCM",
          "stage_id": 4,
          "guardian_phone": "0988776655"
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Cập nhật thông tin khách hàng thành công",
          "data": {
            "id": 5012,
            "updated_at": "2026-10-08 09:13:00"
          },
          "timestamp": "2026-10-08T09:13:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi khách hàng không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu khách hàng theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "contacts-delete",
        "method": "DELETE",
        "path": "/api/v1/contacts/:id",
        "title": "Xóa Khách Hàng / Di Chuyển Vào Thùng Rác (Soft Delete)",
        "description": "Đưa hồ sơ khách hàng vào trạng thái lưu trữ/thùng rác. Dữ liệu lịch sử giao dịch và tài chính vẫn được bảo toàn nguyên vẹn trong hệ thống.",
        "category": "contacts",
        "authRequired": true,
        "rateLimit": "30 requests / phút",
        "scopes": [
          "contacts.delete"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Hồ sơ khách hàng đã được chuyển vào thùng rác thành công",
          "data": {
            "id": 5012,
            "deleted_at": "2026-10-08 09:14:00"
          },
          "timestamp": "2026-10-08T09:14:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi khách hàng không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu khách hàng theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "contacts-assign",
        "method": "POST",
        "path": "/api/v1/contacts/:id/assign",
        "title": "Điều Phối / Bàn Giao Khách Hàng Cho Tư Vấn Viên",
        "description": "Chuyển giao quyền chăm sóc khách hàng cho tư vấn viên mới. Hệ thống sẽ gửi thông báo tức thì đến tài khoản được chỉ định.",
        "category": "contacts",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "contacts.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "assigned_to",
            "type": "integer",
            "required": true,
            "desc": "ID nhân viên tư vấn nhận bàn giao"
          },
          {
            "name": "reason",
            "type": "string",
            "required": false,
            "desc": "Lý do bàn giao (vd: đổi cơ sở, phụ trách khu vực mới)"
          }
        ],
        "sampleBody": {
          "assigned_to": 1055,
          "reason": "Chuyển giao cơ sở Tân Bình sang cơ sở Quận 1"
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Bàn giao khách hàng thành công",
          "data": {
            "id": 5012,
            "assigned_to": 1055,
            "assigned_to_name": "Vũ Hoàng Minh"
          },
          "timestamp": "2026-10-08T09:15:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi khách hàng không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu khách hàng theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "contacts-bulk-delete",
        "method": "POST",
        "path": "/api/v1/contacts/bulk-delete",
        "title": "Xóa Hàng Loạt Khách Hàng (Bulk Delete)",
        "description": "Thực hiện xóa hàng loạt danh sách khách hàng không tiềm năng hoặc rác theo mảng ID.",
        "category": "contacts",
        "authRequired": true,
        "rateLimit": "10 requests / phút",
        "scopes": [
          "contacts.delete"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "ids",
            "type": "array",
            "required": true,
            "desc": "Mảng danh sách các ID khách hàng cần xóa"
          }
        ],
        "sampleBody": {
          "ids": [
            5015,
            5016,
            5017
          ]
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Đã xóa thành công 3 hồ sơ khách hàng",
          "data": {
            "deleted_count": 3,
            "ids": [
              5015,
              5016,
              5017
            ]
          },
          "timestamp": "2026-10-08T09:16:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "contacts-notes-list",
        "method": "GET",
        "path": "/api/v1/contacts/:id/notes",
        "title": "Truy Vấn Lịch Sử Ghi Chú & Tương Tác Của Khách Hàng",
        "description": "Lấy toàn bộ dòng thời gian ghi chú, nội dung cuộc gọi tư vấn và biên bản làm việc của khách hàng.",
        "category": "contacts",
        "authRequired": true,
        "rateLimit": "100 requests / phút",
        "scopes": [
          "contacts.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Lấy lịch sử ghi chú thành công",
          "data": [
            {
              "id": 892,
              "contact_id": 5012,
              "author_name": "Nguyễn Thị Lan",
              "content": "Phụ huynh đã đồng ý cho con theo học chương trình Quốc Tế, hẹn thứ 7 lên văn phòng làm hồ sơ",
              "created_at": "2026-10-07 10:15:00"
            }
          ],
          "timestamp": "2026-10-08T09:17:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi khách hàng không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu khách hàng theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "contacts-notes-create",
        "method": "POST",
        "path": "/api/v1/contacts/:id/notes",
        "title": "Thêm Ghi Chú Chăm Sóc Mới Cho Khách Hàng",
        "description": "Lưu lại biên bản tương tác, kết quả cuộc gọi hoặc thỏa thuận học phí với phụ huynh/học viên.",
        "category": "contacts",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "contacts.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "content",
            "type": "string",
            "required": true,
            "desc": "Nội dung ghi chú tương tác chăm sóc"
          },
          {
            "name": "next_action_date",
            "type": "string",
            "required": false,
            "desc": "Lịch hẹn liên hệ tiếp theo (YYYY-MM-DD HH:mm:ss)"
          }
        ],
        "sampleBody": {
          "content": "Đã gọi điện tư vấn học bổng 30%, khách hàng yêu cầu gửi file brochure qua Zalo",
          "next_action_date": "2026-10-10 09:00:00"
        },
        "sampleResponse": {
          "success": true,
          "code": 201,
          "message": "Thêm ghi chú tương tác thành công",
          "data": {
            "id": 893,
            "contact_id": 5012,
            "created_at": "2026-10-08 09:18:00"
          },
          "timestamp": "2026-10-08T09:18:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi khách hàng không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu khách hàng theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "deals",
    "title": "03. Cơ Hội Bán Hàng & Pipeline Tuyển Sinh (Deals Pipeline)",
    "iconName": "TrendingUp",
    "description": "Quản lý phễu cơ hội tư vấn, giá trị hợp đồng dự kiến, tỷ lệ chốt thành công (Win Rate) và quy trình kéo thả Kanban giai đoạn tuyển sinh.",
    "endpoints": [
      {
        "id": "deals-list",
        "method": "GET",
        "path": "/api/v1/deals",
        "title": "Truy Vấn Danh Sách Cơ Hội Bán Hàng / Tuyển Sinh",
        "description": "Lấy danh sách các cơ hội bán hàng theo phễu, lọc theo giai đoạn (stage_id), tư vấn viên (assigned_to) và khoảng giá trị dự kiến.",
        "category": "deals",
        "authRequired": true,
        "rateLimit": "100 requests / phút",
        "scopes": [
          "deals.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [
          {
            "name": "page",
            "type": "integer",
            "required": false,
            "default": "1",
            "desc": "Số thứ tự trang kết quả"
          },
          {
            "name": "limit",
            "type": "integer",
            "required": false,
            "default": "25",
            "desc": "Số lượng bản ghi mỗi trang"
          },
          {
            "name": "pipeline_id",
            "type": "integer",
            "required": false,
            "desc": "Lọc theo ID phễu tuyển sinh"
          },
          {
            "name": "stage_id",
            "type": "integer",
            "required": false,
            "desc": "Lọc theo ID giai đoạn Kanban"
          },
          {
            "name": "assigned_to",
            "type": "integer",
            "required": false,
            "desc": "Lọc theo ID nhân viên phụ trách"
          }
        ],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Lấy danh sách cơ hội thành công",
          "data": {
            "items": [
              {
                "id": 1205,
                "title": "Học Bổng BBA Quốc Tế - Trần Thị Mai Phương",
                "contact_id": 5012,
                "contact_name": "Trần Thị Mai Phương",
                "pipeline_id": 1,
                "stage_id": 3,
                "stage_name": "Hẹn Phỏng Vấn Học Bổng",
                "expected_revenue": 145000000,
                "probability": 70,
                "expected_close_date": "2026-10-25",
                "assigned_to": 1042,
                "assigned_to_name": "Nguyễn Thị Lan",
                "created_at": "2026-10-06 15:00:00"
              }
            ],
            "pagination": {
              "current_page": 1,
              "per_page": 25,
              "total_items": 340,
              "total_pages": 14
            }
          },
          "timestamp": "2026-10-08T09:20:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi cơ hội bán hàng không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu cơ hội bán hàng theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "deals-detail",
        "method": "GET",
        "path": "/api/v1/deals/:id",
        "title": "Truy Vấn Chi Tiết Cơ Hội Bán Hàng & Danh Mục Khóa Học",
        "description": "Lấy toàn bộ thông tin cơ hội, lịch sử thay đổi giai đoạn phễu và danh mục khóa học hoặc sản phẩm đính kèm trong cơ hội.",
        "category": "deals",
        "authRequired": true,
        "rateLimit": "100 requests / phút",
        "scopes": [
          "deals.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Truy vấn chi tiết cơ hội thành công",
          "data": {
            "id": 1205,
            "title": "Học Bổng BBA Quốc Tế - Trần Thị Mai Phương",
            "contact_id": 5012,
            "contact_phone": "0987654321",
            "pipeline_name": "Tuyển Sinh Đại Học 2026",
            "stage_name": "Hẹn Phỏng Vấn Học Bổng",
            "expected_revenue": 145000000,
            "probability": 70,
            "products": [
              {
                "product_id": 101,
                "product_name": "Khóa Học BBA K2026 Toàn Phần",
                "quantity": 1,
                "unit_price": 145000000
              }
            ],
            "created_at": "2026-10-06 15:00:00"
          },
          "timestamp": "2026-10-08T09:21:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi cơ hội bán hàng không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu cơ hội bán hàng theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "deals-create",
        "method": "POST",
        "path": "/api/v1/deals",
        "title": "Tạo Mới Cơ Hội Bán Hàng / Tuyển Sinh",
        "description": "Khởi tạo cơ hội bán hàng mới gắn liền với khách hàng tiềm năng, phễu tuyển sinh và giá trị dự thu.",
        "category": "deals",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "deals.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "title",
            "type": "string",
            "required": true,
            "desc": "Tên cơ hội bán hàng"
          },
          {
            "name": "contact_id",
            "type": "integer",
            "required": true,
            "desc": "ID khách hàng gắn với cơ hội"
          },
          {
            "name": "pipeline_id",
            "type": "integer",
            "required": true,
            "desc": "ID phễu bán hàng"
          },
          {
            "name": "stage_id",
            "type": "integer",
            "required": true,
            "desc": "ID giai đoạn khởi tạo trong phễu"
          },
          {
            "name": "expected_revenue",
            "type": "number",
            "required": true,
            "desc": "Doanh thu dự kiến (VNĐ)"
          },
          {
            "name": "probability",
            "type": "integer",
            "required": false,
            "default": "50",
            "desc": "Xác suất chốt thành công (%)"
          },
          {
            "name": "expected_close_date",
            "type": "string",
            "required": false,
            "desc": "Ngày dự kiến chốt (YYYY-MM-DD)"
          }
        ],
        "sampleBody": {
          "title": "Khóa Học BBA Digital Marketing K2026 - Lê Hoàng Nam",
          "contact_id": 5013,
          "pipeline_id": 1,
          "stage_id": 2,
          "expected_revenue": 120000000,
          "probability": 60,
          "expected_close_date": "2026-11-15"
        },
        "sampleResponse": {
          "success": true,
          "code": 201,
          "message": "Tạo cơ hội bán hàng thành công",
          "data": {
            "id": 1206,
            "title": "Khóa Học BBA Digital Marketing K2026 - Lê Hoàng Nam",
            "created_at": "2026-10-08 09:22:00"
          },
          "timestamp": "2026-10-08T09:22:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi cơ hội bán hàng không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu cơ hội bán hàng theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "deals-update",
        "method": "PUT",
        "path": "/api/v1/deals/:id",
        "title": "Cập Nhật Thông Tin Cơ Hội Bán Hàng",
        "description": "Chỉnh sửa tên cơ hội, doanh thu dự thu, xác suất thành công hoặc ngày dự kiến chốt đơn.",
        "category": "deals",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "deals.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "title",
            "type": "string",
            "required": false,
            "desc": "Tiêu đề cơ hội"
          },
          {
            "name": "expected_revenue",
            "type": "number",
            "required": false,
            "desc": "Doanh thu dự kiến mới"
          },
          {
            "name": "probability",
            "type": "integer",
            "required": false,
            "desc": "Tỷ lệ chốt % mới"
          },
          {
            "name": "expected_close_date",
            "type": "string",
            "required": false,
            "desc": "Ngày dự kiến chốt cập nhật"
          }
        ],
        "sampleBody": {
          "expected_revenue": 130000000,
          "probability": 85,
          "expected_close_date": "2026-10-20"
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Cập nhật cơ hội thành công",
          "data": {
            "id": 1205,
            "updated_at": "2026-10-08 09:23:00"
          },
          "timestamp": "2026-10-08T09:23:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi cơ hội bán hàng không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu cơ hội bán hàng theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "deals-delete",
        "method": "DELETE",
        "path": "/api/v1/deals/:id",
        "title": "Xóa Cơ Hội Bán Hàng",
        "description": "Xóa bỏ cơ hội bán hàng khỏi phễu tư vấn khi khách hàng từ bỏ hoặc bị tạo nhầm.",
        "category": "deals",
        "authRequired": true,
        "rateLimit": "30 requests / phút",
        "scopes": [
          "deals.delete"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Xóa cơ hội bán hàng thành công",
          "data": {
            "id": 1205,
            "deleted_at": "2026-10-08 09:24:00"
          },
          "timestamp": "2026-10-08T09:24:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi cơ hội bán hàng không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu cơ hội bán hàng theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "deals-stage-move",
        "method": "PUT",
        "path": "/api/v1/deals/:id/stage",
        "title": "Chuyển Giai Đoạn Phễu Bán Hàng (Kanban Drag-Drop)",
        "description": "Kéo thả chuyển cơ hội sang bước tiếp theo trong quy trình bán hàng, tự động kích hoạt tính toán xác suất và cập nhật thống kê báo cáo phễu.",
        "category": "deals",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "deals.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "stage_id",
            "type": "integer",
            "required": true,
            "desc": "ID giai đoạn phễu đích"
          },
          {
            "name": "loss_reason",
            "type": "string",
            "required": false,
            "desc": "Lý do thất bại nếu chuyển vào giai đoạn 'Thất Bại / Won-Lost'"
          }
        ],
        "sampleBody": {
          "stage_id": 4,
          "loss_reason": null
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Chuyển giai đoạn cơ hội thành công",
          "data": {
            "id": 1205,
            "stage_id": 4,
            "stage_name": "Đã Nộp Hồ Sơ Đăng Ký",
            "updated_at": "2026-10-08 09:25:00"
          },
          "timestamp": "2026-10-08T09:25:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi cơ hội bán hàng không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu cơ hội bán hàng theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "deals-stages-list",
        "method": "GET",
        "path": "/api/v1/deals/stages",
        "title": "Danh Mục Các Giai Đoạn Pipeline Bán Hàng",
        "description": "Lấy danh mục các bước chuẩn trong phễu bán hàng (vd: Mới tiếp cận, Đã tư vấn, Hẹn lịch, Nộp hồ sơ, Thành công, Thất bại).",
        "category": "deals",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "deals.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Lấy danh mục giai đoạn thành công",
          "data": [
            {
              "id": 1,
              "name": "Lead Mới Nhận",
              "order": 1,
              "default_probability": 20
            },
            {
              "id": 2,
              "name": "Đã Liên Hệ Tư Vấn",
              "order": 2,
              "default_probability": 40
            },
            {
              "id": 3,
              "name": "Hẹn Lên Cơ Sở",
              "order": 3,
              "default_probability": 60
            },
            {
              "id": 4,
              "name": "Đã Nộp Hồ Sơ / Đặt Cọc",
              "order": 4,
              "default_probability": 80
            },
            {
              "id": 5,
              "name": "Nhập Học Thành Công (Won)",
              "order": 5,
              "default_probability": 100
            }
          ],
          "timestamp": "2026-10-08T09:26:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "lead-distribution",
    "title": "04. Phân Phối Lead Đa Chi Nhánh & Thu Hồi (Lead Distribution)",
    "iconName": "Share2",
    "description": "Cơ chế phân bổ khách hàng tiềm năng tự động theo thuật toán Round-Robin, trọng số năng lực, giới hạn chỉ tiêu (Quota) và thu hồi lead bị giam quá hạn.",
    "endpoints": [
      {
        "id": "lead-rounds-list",
        "method": "GET",
        "path": "/api/v1/lead-distribution/rounds",
        "title": "Truy Vấn Danh Sách Vòng Chia Lead & Quota Tư Vấn Viên",
        "description": "Lấy danh sách các tư vấn viên trong hàng đợi chia lead hôm nay, quota tối đa, số lead đã nhận và trạng thái sẵn sàng trực tuyến.",
        "category": "lead-distribution",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "lead_distribution.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [
          {
            "name": "branch_id",
            "type": "integer",
            "required": false,
            "desc": "Lọc theo cơ sở / chi nhánh"
          }
        ],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Lấy danh sách vòng chia lead thành công",
          "data": [
            {
              "consultant_id": 1042,
              "full_name": "Nguyễn Thị Lan",
              "daily_quota": 10,
              "received_today": 4,
              "is_active": true,
              "vacation_mode": false
            },
            {
              "consultant_id": 1055,
              "full_name": "Vũ Hoàng Minh",
              "daily_quota": 8,
              "received_today": 3,
              "is_active": true,
              "vacation_mode": false
            }
          ],
          "timestamp": "2026-10-08T09:30:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "lead-held-leads",
        "method": "GET",
        "path": "/api/v1/lead-distribution/held-leads",
        "title": "Danh Sách Lead Đang Bị Tạm Giữ Quá Hạn Chưa Tương Tác",
        "description": "Truy vấn các lead đã bàn giao nhưng quá thời gian SLA quy định (thường là 30 phút) mà tư vấn viên chưa phát sinh cuộc gọi hoặc ghi chú tương tác.",
        "category": "lead-distribution",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "lead_distribution.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [
          {
            "name": "sla_exceeded_minutes",
            "type": "integer",
            "required": false,
            "default": "30",
            "desc": "Số phút vượt ngưỡng SLA"
          }
        ],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Truy vấn danh sách lead bị giữ quá hạn thành công",
          "data": [
            {
              "contact_id": 5012,
              "full_name": "Trần Thị Mai Phương",
              "assigned_to": 1042,
              "assigned_at": "2026-10-08 08:15:00",
              "idle_minutes": 75
            }
          ],
          "timestamp": "2026-10-08T09:31:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "lead-assign-manual",
        "method": "POST",
        "path": "/api/v1/lead-distribution/assign",
        "title": "Phân Phối Thủ Công Lead Cho Tư Vấn Viên",
        "description": "Trưởng nhóm hoặc Admin trực tiếp gán khách hàng tiềm năng cho nhân viên tư vấn xác định mà không cần chờ thuật toán tự động.",
        "category": "lead-distribution",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "lead_distribution.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "contact_id",
            "type": "integer",
            "required": true,
            "desc": "ID khách hàng cần gán"
          },
          {
            "name": "consultant_id",
            "type": "integer",
            "required": true,
            "desc": "ID tư vấn viên được nhận lead"
          }
        ],
        "sampleBody": {
          "contact_id": 5012,
          "consultant_id": 1055
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Phân phối lead thành công",
          "data": {
            "contact_id": 5012,
            "assigned_to": 1055,
            "assigned_at": "2026-10-08 09:32:00"
          },
          "timestamp": "2026-10-08T09:32:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi lead không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu lead theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "lead-release-held",
        "method": "POST",
        "path": "/api/v1/lead-distribution/release-held",
        "title": "Thu Hồi Lead Bị Giam Quá Hạn Trả Về Bể Chung",
        "description": "Thu hồi quyền chăm sóc của tư vấn viên vi phạm SLA chăm sóc, đưa lead trở lại hàng đợi phân phối hoặc bể chung cho nhân viên khác nhận.",
        "category": "lead-distribution",
        "authRequired": true,
        "rateLimit": "30 requests / phút",
        "scopes": [
          "lead_distribution.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "contact_id",
            "type": "integer",
            "required": true,
            "desc": "ID khách hàng cần thu hồi"
          },
          {
            "name": "reason",
            "type": "string",
            "required": false,
            "desc": "Lý do thu hồi (vd: quá hạn SLA 30 phút không gọi)"
          }
        ],
        "sampleBody": {
          "contact_id": 5012,
          "reason": "Quá hạn 60 phút chưa phát sinh tương tác"
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Thu hồi lead về bể chung thành công",
          "data": {
            "contact_id": 5012,
            "previous_consultant_id": 1042,
            "status": "returned_to_pool"
          },
          "timestamp": "2026-10-08T09:33:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi lead không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu lead theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "lead-distribution-config",
        "method": "PUT",
        "path": "/api/v1/lead-distribution/config",
        "title": "Cập Nhật Cấu Hình Thuật Toán Chia Lead",
        "description": "Cập nhật tham số chia lead: chuyển đổi giữa thuật toán vòng tròn (Round Robin) và thuật toán trọng số (Weighted), thời hạn SLA (phút).",
        "category": "lead-distribution",
        "authRequired": true,
        "rateLimit": "20 requests / phút",
        "scopes": [
          "lead_distribution.admin"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "algorithm",
            "type": "string",
            "required": true,
            "desc": "'round_robin' hoặc 'weighted'"
          },
          {
            "name": "sla_timeout_minutes",
            "type": "integer",
            "required": true,
            "desc": "Thời gian tối đa để liên hệ lead (phút)"
          },
          {
            "name": "auto_revoke_enabled",
            "type": "boolean",
            "required": true,
            "desc": "Tự động thu hồi khi quá hạn SLA"
          }
        ],
        "sampleBody": {
          "algorithm": "round_robin",
          "sla_timeout_minutes": 30,
          "auto_revoke_enabled": true
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Cập nhật cấu hình phân phối lead thành công",
          "data": {
            "updated_at": "2026-10-08 09:34:00"
          },
          "timestamp": "2026-10-08T09:34:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "lead-queue-delete",
        "method": "DELETE",
        "path": "/api/v1/lead-distribution/queue/:id",
        "title": "Xóa Tư Vấn Viên Khỏi Hàng Đợi Chia Lead Hôm Nay",
        "description": "Tạm dừng chia lead cho một nhân viên cụ thể trong ca làm việc khi có sự cố phát sinh hoặc xin nghỉ đột xuất.",
        "category": "lead-distribution",
        "authRequired": true,
        "rateLimit": "30 requests / phút",
        "scopes": [
          "lead_distribution.admin"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Đã loại nhân viên khỏi hàng đợi chia lead",
          "data": {
            "consultant_id": 1055,
            "removed_at": "2026-10-08 09:35:00"
          },
          "timestamp": "2026-10-08T09:35:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi hàng đợi không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu hàng đợi theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "consultant-shifts",
    "title": "05. Đăng Ký & Quản Trị Ca Trực Tư Vấn (Consultant Shifts)",
    "iconName": "Calendar",
    "description": "Hệ thống lịch trực tư vấn tuyển sinh: ca ngày, ca tối, ca trực cuối tuần, duyệt phân ca và cơ chế bật/tắt chế độ nghỉ phép không nhận lead.",
    "endpoints": [
      {
        "id": "shifts-list",
        "method": "GET",
        "path": "/api/v1/consultant-shifts",
        "title": "Truy Vấn Lịch Trực Ca Tuyển Sinh (Theo Tuần / Tháng)",
        "description": "Lấy danh sách các ca trực tư vấn đã được lên lịch, phân bổ nhân sự phụ trách và số lượng tư vấn viên trực mỗi ca.",
        "category": "consultant-shifts",
        "authRequired": true,
        "rateLimit": "100 requests / phút",
        "scopes": [
          "shifts.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [
          {
            "name": "branch_id",
            "type": "integer",
            "required": false,
            "desc": "Lọc theo cơ sở"
          },
          {
            "name": "from_date",
            "type": "string",
            "required": false,
            "desc": "Từ ngày (YYYY-MM-DD)"
          },
          {
            "name": "to_date",
            "type": "string",
            "required": false,
            "desc": "Đến ngày (YYYY-MM-DD)"
          }
        ],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Lấy lịch trực ca thành công",
          "data": [
            {
              "id": 101,
              "shift_name": "Ca Tối 18h-21h",
              "shift_date": "2026-10-08",
              "consultant_id": 1042,
              "consultant_name": "Nguyễn Thị Lan",
              "status": "approved"
            }
          ],
          "timestamp": "2026-10-08T09:36:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "shifts-detail",
        "method": "GET",
        "path": "/api/v1/consultant-shifts/:id",
        "title": "Chi Tiết Thông Tin Ca Trực & Danh Sách Nhân Sự",
        "description": "Lấy thông tin chi tiết một ca trực cụ thể, ghi chú bàn giao và các chỉ tiêu tuyển sinh yêu cầu trong ca.",
        "category": "consultant-shifts",
        "authRequired": true,
        "rateLimit": "100 requests / phút",
        "scopes": [
          "shifts.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Truy vấn chi tiết ca trực thành công",
          "data": {
            "id": 101,
            "shift_name": "Ca Tối 18h-21h",
            "branch_name": "Cơ sở Tân Bình",
            "consultants": [
              "Nguyễn Thị Lan",
              "Vũ Hoàng Minh"
            ]
          },
          "timestamp": "2026-10-08T09:37:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi ca trực không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu ca trực theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "shifts-register",
        "method": "POST",
        "path": "/api/v1/consultant-shifts/register",
        "title": "Đăng Ký Ca Trực Tư Vấn (Ca Tối, Ca Cuối Tuần)",
        "description": "Tư vấn viên chủ động gửi phiếu đăng ký trực ca trong tuần tới để cấp quản lý phê duyệt.",
        "category": "consultant-shifts",
        "authRequired": true,
        "rateLimit": "30 requests / phút",
        "scopes": [
          "shifts.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "shift_type",
            "type": "string",
            "required": true,
            "desc": "'night' (ca tối), 'weekend' (cuối tuần), 'holiday' (lễ)"
          },
          {
            "name": "shift_date",
            "type": "string",
            "required": true,
            "desc": "Ngày trực (YYYY-MM-DD)"
          },
          {
            "name": "note",
            "type": "string",
            "required": false,
            "desc": "Ghi chú đề xuất ca trực"
          }
        ],
        "sampleBody": {
          "shift_type": "night",
          "shift_date": "2026-10-12",
          "note": "Đăng ký trực tối thứ 2"
        },
        "sampleResponse": {
          "success": true,
          "code": 201,
          "message": "Đăng ký ca trực thành công, đang chờ quản lý duyệt",
          "data": {
            "registration_id": 504,
            "status": "pending"
          },
          "timestamp": "2026-10-08T09:38:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi ca trực không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu ca trực theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "shifts-update",
        "method": "PUT",
        "path": "/api/v1/consultant-shifts/:id",
        "title": "Quản Quản Lý Phê Duyệt / Điều Chỉnh Ca Trực",
        "description": "Quản lý tuyển sinh phê duyệt (approved) hoặc từ chối (rejected) ca trực đăng ký của tư vấn viên.",
        "category": "consultant-shifts",
        "authRequired": true,
        "rateLimit": "30 requests / phút",
        "scopes": [
          "shifts.manage"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "status",
            "type": "string",
            "required": true,
            "desc": "'approved' hoặc 'rejected'"
          },
          {
            "name": "manager_note",
            "type": "string",
            "required": false,
            "desc": "Ghi chú của quản lý khi duyệt/từ chối"
          }
        ],
        "sampleBody": {
          "status": "approved",
          "manager_note": "Đã duyệt ca trực tối thứ 2"
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Cập nhật trạng thái ca trực thành công",
          "data": {
            "id": 101,
            "status": "approved"
          },
          "timestamp": "2026-10-08T09:39:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi ca trực không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu ca trực theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "shifts-delete",
        "method": "DELETE",
        "path": "/api/v1/consultant-shifts/:id",
        "title": "Hủy Đăng Ký Ca Trực Tư Vấn",
        "description": "Hủy bỏ ca trực đã đăng ký khi chưa đến thời điểm trực ca hoặc do đổi lịch.",
        "category": "consultant-shifts",
        "authRequired": true,
        "rateLimit": "30 requests / phút",
        "scopes": [
          "shifts.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Đã hủy ca trực thành công",
          "data": {
            "id": 101,
            "status": "cancelled"
          },
          "timestamp": "2026-10-08T09:40:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi ca trực không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu ca trực theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "consultant-toggle-vacation",
        "method": "POST",
        "path": "/api/v1/consultant-shifts/toggle-vacation",
        "title": "Bật / Tắt Chế Độ Nghỉ Phép Không Nhận Lead (Vacation Mode)",
        "description": "Tư vấn viên chủ động bật chế độ tạm dừng nhận lead khi đi du lịch hoặc nghỉ ốm, tự động bỏ qua khi chia lead.",
        "category": "consultant-shifts",
        "authRequired": true,
        "rateLimit": "20 requests / phút",
        "scopes": [
          "shifts.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "vacation_mode",
            "type": "boolean",
            "required": true,
            "desc": "true = Nghỉ phép (không nhận lead), false = Sẵn sàng nhận lead"
          },
          {
            "name": "reason",
            "type": "string",
            "required": false,
            "desc": "Lý do xin nghỉ phép"
          }
        ],
        "sampleBody": {
          "vacation_mode": true,
          "reason": "Nghỉ phép thường niên đến hết ngày 12/10"
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Đã kích hoạt chế độ nghỉ phép thành công. Hệ thống sẽ tạm dừng chia lead.",
          "data": {
            "consultant_id": 1042,
            "vacation_mode": true
          },
          "timestamp": "2026-10-08T09:41:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "quotes-orders",
    "title": "06. Báo Giá, Đơn Hàng & Hợp Đồng Bán (Quotes & Orders)",
    "iconName": "FileText",
    "description": "Quy trình lập báo giá chi tiết, áp dụng chính sách học bổng / chiết khấu, chuyển đổi báo giá thành Đơn hàng bán chính thức (Sales Order) và quản trị hợp đồng.",
    "endpoints": [
      {
        "id": "quotes-list",
        "method": "GET",
        "path": "/api/v1/quotes",
        "title": "Truy Vấn Danh Sách Báo Giá Tuyển Sinh / Đào Tạo",
        "description": "Lấy danh sách các bản báo giá, lọc theo khách hàng, cơ hội bán hàng hoặc trạng thái duyệt.",
        "category": "quotes-orders",
        "authRequired": true,
        "rateLimit": "100 requests / phút",
        "scopes": [
          "quotes.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [
          {
            "name": "page",
            "type": "integer",
            "required": false,
            "default": "1",
            "desc": "Trang kết quả"
          },
          {
            "name": "status",
            "type": "string",
            "required": false,
            "desc": "'draft', 'sent', 'accepted', 'rejected', 'converted'"
          }
        ],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Lấy danh sách báo giá thành công",
          "data": [
            {
              "id": 302,
              "quote_code": "BG-2026-0042",
              "contact_id": 5012,
              "contact_name": "Trần Thị Mai Phương",
              "total_amount": 145000000,
              "status": "sent"
            }
          ],
          "timestamp": "2026-10-08T09:42:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "quotes-detail",
        "method": "GET",
        "path": "/api/v1/quotes/:id",
        "title": "Truy Vấn Chi Tiết Báo Giá & Dòng Sản Phẩm / Học Phí",
        "description": "Lấy toàn bộ chi tiết báo giá, danh mục khóa học, mức học bổng chiết khấu, thuế VAT và các điều khoản thanh toán.",
        "category": "quotes-orders",
        "authRequired": true,
        "rateLimit": "100 requests / phút",
        "scopes": [
          "quotes.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Truy vấn chi tiết báo giá thành công",
          "data": {
            "id": 302,
            "quote_code": "BG-2026-0042",
            "contact_id": 5012,
            "total_amount": 145000000,
            "discount_amount": 15000000,
            "final_amount": 130000000,
            "items": [
              {
                "product_id": 101,
                "product_name": "BBA K2026 Toàn Phần",
                "quantity": 1,
                "price": 145000000
              }
            ]
          },
          "timestamp": "2026-10-08T09:43:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi báo giá không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu báo giá theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "quotes-create",
        "method": "POST",
        "path": "/api/v1/quotes",
        "title": "Lập Báo Giá Tuyển Sinh / Đào Tạo Mới",
        "description": "Khởi tạo báo giá mới gửi phụ huynh hoặc học viên với chi tiết khóa học, lộ trình học phí và các mức ưu đãi học bổng.",
        "category": "quotes-orders",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "quotes.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "contact_id",
            "type": "integer",
            "required": true,
            "desc": "ID khách hàng nhận báo giá"
          },
          {
            "name": "deal_id",
            "type": "integer",
            "required": false,
            "desc": "ID cơ hội bán hàng gắn kèm"
          },
          {
            "name": "items",
            "type": "array",
            "required": true,
            "desc": "Danh sách các sản phẩm/khóa học trong báo giá"
          },
          {
            "name": "discount_amount",
            "type": "number",
            "required": false,
            "default": "0",
            "desc": "Số tiền chiết khấu hoặc học bổng giảm trừ"
          }
        ],
        "sampleBody": {
          "contact_id": 5012,
          "deal_id": 1205,
          "items": [
            {
              "product_id": 101,
              "quantity": 1,
              "price": 145000000
            }
          ],
          "discount_amount": 15000000
        },
        "sampleResponse": {
          "success": true,
          "code": 201,
          "message": "Tạo báo giá thành công",
          "data": {
            "id": 303,
            "quote_code": "BG-2026-0043",
            "final_amount": 130000000
          },
          "timestamp": "2026-10-08T09:44:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi báo giá không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu báo giá theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "quotes-update",
        "method": "PUT",
        "path": "/api/v1/quotes/:id",
        "title": "Chỉnh Sửa Thông Tin Báo Giá",
        "description": "Cập nhật lại số tiền, mức chiết khấu hoặc danh mục sản phẩm trước khi khách hàng chốt duyệt.",
        "category": "quotes-orders",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "quotes.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "discount_amount",
            "type": "number",
            "required": false,
            "desc": "Điều chỉnh mức học bổng giảm trừ"
          },
          {
            "name": "note",
            "type": "string",
            "required": false,
            "desc": "Ghi chú điều khoản thanh toán"
          }
        ],
        "sampleBody": {
          "discount_amount": 20000000,
          "note": "Học bổng tài năng 20 triệu"
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Cập nhật báo giá thành công",
          "data": {
            "id": 303,
            "updated_at": "2026-10-08 09:45:00"
          },
          "timestamp": "2026-10-08T09:45:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi báo giá không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu báo giá theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "quotes-delete",
        "method": "DELETE",
        "path": "/api/v1/quotes/:id",
        "title": "Xóa Báo Giá Nháp",
        "description": "Xóa bản báo giá nháp chưa gửi khách hoặc bị hủy bỏ.",
        "category": "quotes-orders",
        "authRequired": true,
        "rateLimit": "30 requests / phút",
        "scopes": [
          "quotes.delete"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Xóa báo giá thành công",
          "data": {
            "id": 303,
            "deleted_at": "2026-10-08 09:46:00"
          },
          "timestamp": "2026-10-08T09:46:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi báo giá không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu báo giá theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "quotes-convert-to-order",
        "method": "POST",
        "path": "/api/v1/quotes/:id/convert-to-order",
        "title": "Chuyển Đổi Báo Giá Thành Đơn Hàng Bán Chính Thức (SO)",
        "description": "Khi phụ huynh/học viên đồng ý chốt đăng ký, chuyển đổi trạng thái báo giá sang Đơn hàng chính thức (Sales Order) để chuyển sang Kế toán thu tiền.",
        "category": "quotes-orders",
        "authRequired": true,
        "rateLimit": "30 requests / phút",
        "scopes": [
          "quotes.write",
          "orders.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Chuyển đổi báo giá thành Đơn hàng bán thành công",
          "data": {
            "order_id": 801,
            "order_code": "SO-2026-0021",
            "total_amount": 125000000,
            "status": "confirmed"
          },
          "timestamp": "2026-10-08T09:47:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi báo giá không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu báo giá theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "orders-list",
        "method": "GET",
        "path": "/api/v1/orders",
        "title": "Truy Vấn Danh Sách Đơn Hàng Bán / Hợp Đồng",
        "description": "Lấy danh sách các đơn hàng bán (Sales Orders), tình trạng thanh toán, công nợ và trạng thái bàn giao đào tạo.",
        "category": "quotes-orders",
        "authRequired": true,
        "rateLimit": "100 requests / phút",
        "scopes": [
          "orders.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [
          {
            "name": "page",
            "type": "integer",
            "required": false,
            "default": "1",
            "desc": "Trang kết quả"
          },
          {
            "name": "status",
            "type": "string",
            "required": false,
            "desc": "'pending', 'approved', 'paid', 'cancelled'"
          }
        ],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Lấy danh sách đơn hàng thành công",
          "data": [
            {
              "id": 801,
              "order_code": "SO-2026-0021",
              "contact_name": "Trần Thị Mai Phương",
              "total_amount": 125000000,
              "paid_amount": 5000000,
              "remaining_debt": 120000000,
              "status": "pending_payment"
            }
          ],
          "timestamp": "2026-10-08T09:48:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "orders-detail",
        "method": "GET",
        "path": "/api/v1/orders/:id",
        "title": "Chi Tiết Đơn Hàng Bán & Lịch Trình Công Nợ",
        "description": "Xem chi tiết toàn bộ điều khoản đơn hàng bán, lịch sử các đợt đóng học phí và số tiền còn lại phải thanh toán.",
        "category": "quotes-orders",
        "authRequired": true,
        "rateLimit": "100 requests / phút",
        "scopes": [
          "orders.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Truy vấn chi tiết đơn hàng thành công",
          "data": {
            "id": 801,
            "order_code": "SO-2026-0021",
            "total_amount": 125000000,
            "payments": [
              {
                "date": "2026-10-07",
                "amount": 5000000,
                "type": "deposit"
              }
            ]
          },
          "timestamp": "2026-10-08T09:49:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi đơn hàng không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu đơn hàng theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "orders-update-status",
        "method": "PUT",
        "path": "/api/v1/orders/:id/status",
        "title": "Cập Nhật Trạng Thái Đơn Hàng Bán",
        "description": "Quản lý / Kế toán cập nhật trạng thái duyệt đơn hàng (Approved/Cancelled).",
        "category": "quotes-orders",
        "authRequired": true,
        "rateLimit": "30 requests / phút",
        "scopes": [
          "orders.manage"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "status",
            "type": "string",
            "required": true,
            "desc": "'approved', 'cancelled'"
          },
          {
            "name": "reason",
            "type": "string",
            "required": false,
            "desc": "Lý do thay đổi trạng thái"
          }
        ],
        "sampleBody": {
          "status": "approved",
          "reason": "Đã đối soát tiền cọc"
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Cập nhật trạng thái đơn hàng thành công",
          "data": {
            "id": 801,
            "status": "approved"
          },
          "timestamp": "2026-10-08T09:50:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi đơn hàng không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu đơn hàng theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "orders-delete",
        "method": "DELETE",
        "path": "/api/v1/orders/:id",
        "title": "Hủy / Xóa Đơn Hàng Bán Chưa Thanh Toán",
        "description": "Hủy đơn hàng bán khi khách hàng không tiếp tục đăng ký và chưa phát sinh phiếu thu tiền.",
        "category": "quotes-orders",
        "authRequired": true,
        "rateLimit": "20 requests / phút",
        "scopes": [
          "orders.delete"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Đã hủy đơn hàng bán thành công",
          "data": {
            "id": 801,
            "status": "deleted"
          },
          "timestamp": "2026-10-08T09:51:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi đơn hàng không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu đơn hàng theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "deposits",
    "title": "07. Quản Trị Đặt Cọc, Giữ Chỗ & Xác Thực UNC (Deposits & Booking)",
    "iconName": "CreditCard",
    "description": "Quản trị phiếu cọc giữ chỗ nhập học, tải lên ảnh chụp ủy nhiệm chi (UNC), kế toán xác nhận vào tiền quỹ và quy trình hoàn trả cọc.",
    "endpoints": [
      {
        "id": "deposits-list",
        "method": "GET",
        "path": "/api/v1/deposits",
        "title": "Truy Vấn Danh Sách Phiếu Đặt Cọc Giữ Chỗ",
        "description": "Lấy danh sách các phiếu cọc của học viên, lọc theo trạng thái duyệt của kế toán (chờ duyệt, đã khớp UNC, hoàn cọc).",
        "category": "deposits",
        "authRequired": true,
        "rateLimit": "100 requests / phút",
        "scopes": [
          "deposits.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [
          {
            "name": "page",
            "type": "integer",
            "required": false,
            "default": "1",
            "desc": "Trang"
          },
          {
            "name": "status",
            "type": "string",
            "required": false,
            "desc": "'pending', 'confirmed', 'refunded', 'cancelled'"
          }
        ],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Lấy danh sách phiếu đặt cọc thành công",
          "data": [
            {
              "id": 401,
              "deposit_code": "DC-2026-0015",
              "contact_name": "Trần Thị Mai Phương",
              "amount": 5000000,
              "status": "pending_confirmation",
              "payment_method": "bank_transfer"
            }
          ],
          "timestamp": "2026-10-08T09:52:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "deposits-detail",
        "method": "GET",
        "path": "/api/v1/deposits/:id",
        "title": "Chi Tiết Phiếu Cọc & Ảnh Chụp Ủy Nhiệm Chi (UNC)",
        "description": "Xem chi tiết phiếu cọc, đường dẫn ảnh chụp UNC ngân hàng, thông tin tài khoản chuyển đến và người lập phiếu.",
        "category": "deposits",
        "authRequired": true,
        "rateLimit": "100 requests / phút",
        "scopes": [
          "deposits.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Truy vấn chi tiết phiếu cọc thành công",
          "data": {
            "id": 401,
            "amount": 5000000,
            "unc_image_url": "https://myerp.ideas.edu.vn/uploads/unc/unc_401.jpg",
            "bank_account": "Techcombank - 1903..."
          },
          "timestamp": "2026-10-08T09:53:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi phiếu cọc không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu phiếu cọc theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "deposits-create",
        "method": "POST",
        "path": "/api/v1/deposits",
        "title": "Tạo Phiếu Đặt Cọc Giữ Chỗ Mới",
        "description": "Tư vấn viên lập phiếu cọc khi khách hàng chuyển khoản giữ chỗ học bổng hoặc suất nhập học.",
        "category": "deposits",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "deposits.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "contact_id",
            "type": "integer",
            "required": true,
            "desc": "ID khách hàng/học viên đặt cọc"
          },
          {
            "name": "amount",
            "type": "number",
            "required": true,
            "desc": "Số tiền đặt cọc (VNĐ)"
          },
          {
            "name": "payment_method",
            "type": "string",
            "required": true,
            "desc": "'bank_transfer', 'cash', 'pos_card'"
          },
          {
            "name": "unc_image_url",
            "type": "string",
            "required": false,
            "desc": "Đường dẫn ảnh chứng từ chuyển khoản UNC"
          }
        ],
        "sampleBody": {
          "contact_id": 5012,
          "amount": 5000000,
          "payment_method": "bank_transfer",
          "unc_image_url": "https://myerp.ideas.edu.vn/uploads/unc/sample.jpg"
        },
        "sampleResponse": {
          "success": true,
          "code": 201,
          "message": "Tạo phiếu đặt cọc thành công",
          "data": {
            "id": 402,
            "deposit_code": "DC-2026-0016",
            "status": "pending_confirmation"
          },
          "timestamp": "2026-10-08T09:54:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi phiếu cọc không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu phiếu cọc theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "deposits-update",
        "method": "PUT",
        "path": "/api/v1/deposits/:id",
        "title": "Chỉnh Sửa Thông Tin Phiếu Đặt Cọc",
        "description": "Cập nhật lại số tiền hoặc tải lên ảnh UNC rõ nét hơn trước khi kế toán duyệt.",
        "category": "deposits",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "deposits.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "amount",
            "type": "number",
            "required": false,
            "desc": "Số tiền hiệu chỉnh"
          },
          {
            "name": "unc_image_url",
            "type": "string",
            "required": false,
            "desc": "URL ảnh chứng từ mới"
          }
        ],
        "sampleBody": {
          "amount": 5000000,
          "unc_image_url": "https://myerp.ideas.edu.vn/uploads/unc/unc_cleared.jpg"
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Cập nhật phiếu cọc thành công",
          "data": {
            "id": 401,
            "updated_at": "2026-10-08 09:55:00"
          },
          "timestamp": "2026-10-08T09:55:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi phiếu cọc không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu phiếu cọc theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "deposits-delete",
        "method": "DELETE",
        "path": "/api/v1/deposits/:id",
        "title": "Hủy Bỏ Phiếu Cọc Chưa Xác Nhận",
        "description": "Xóa phiếu cọc bị lập nhầm hoặc khách hàng không thực hiện chuyển khoản.",
        "category": "deposits",
        "authRequired": true,
        "rateLimit": "30 requests / phút",
        "scopes": [
          "deposits.delete"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Xóa phiếu cọc thành công",
          "data": {
            "id": 401,
            "deleted_at": "2026-10-08 09:56:00"
          },
          "timestamp": "2026-10-08T09:56:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi phiếu cọc không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu phiếu cọc theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "deposits-confirm-payment",
        "method": "POST",
        "path": "/api/v1/deposits/:id/confirm-payment",
        "title": "Kế Toán Xác Nhận Khớp UNC & Vào Tiền Quỹ",
        "description": "Kế toán kiểm tra sao kê ngân hàng và bấm xác nhận khớp tiền, tự động cập nhật số dư quỹ tài khoản và biến động công nợ.",
        "category": "deposits",
        "authRequired": true,
        "rateLimit": "30 requests / phút",
        "scopes": [
          "finance.approve"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "bank_account_id",
            "type": "integer",
            "required": true,
            "desc": "ID tài khoản ngân hàng nhận tiền"
          },
          {
            "name": "transaction_reference",
            "type": "string",
            "required": false,
            "desc": "Mã giao dịch thực tế trên Internet Banking"
          }
        ],
        "sampleBody": {
          "bank_account_id": 1,
          "transaction_reference": "FT262810992819"
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Khớp tiền cọc thành công. Sổ quỹ tài khoản đã được ghi nhận.",
          "data": {
            "id": 401,
            "status": "confirmed",
            "confirmed_by": "Kế toán Nguyễn Mai"
          },
          "timestamp": "2026-10-08T09:57:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi phiếu cọc không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu phiếu cọc theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "deposits-refund",
        "method": "POST",
        "path": "/api/v1/deposits/:id/refund",
        "title": "Tạo Yêu Cầu Hoàn Cọc Cho Khách Hàng",
        "description": "Lập phiếu đề xuất hoàn cọc khi học viên không đủ điều kiện nhập học theo chính sách bảo đảm.",
        "category": "deposits",
        "authRequired": true,
        "rateLimit": "20 requests / phút",
        "scopes": [
          "deposits.refund"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "refund_amount",
            "type": "number",
            "required": true,
            "desc": "Số tiền hoàn trả (VNĐ)"
          },
          {
            "name": "reason",
            "type": "string",
            "required": true,
            "desc": "Lý do hoàn cọc cụ thể"
          }
        ],
        "sampleBody": {
          "refund_amount": 5000000,
          "reason": "Học sinh chuyển định cư nước ngoài theo gia đình"
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Tạo đề xuất hoàn cọc thành công, chờ Kế toán trưởng phê duyệt chi",
          "data": {
            "id": 401,
            "status": "refund_requested"
          },
          "timestamp": "2026-10-08T09:58:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi phiếu cọc không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu phiếu cọc theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "finance",
    "title": "08. Kế Toán Doanh Nghiệp, Thu Chi & Sổ Quỹ (Finance & Cashflow)",
    "iconName": "DollarSign",
    "description": "Quản trị dòng tiền doanh nghiệp: phiếu thu học phí, đề nghị chi tiền, quy trình duyệt chi 2 cấp, số dư quỹ tiền mặt và tài khoản ngân hàng.",
    "endpoints": [
      {
        "id": "finance-invoices-list",
        "method": "GET",
        "path": "/api/v1/finance/invoices",
        "title": "Truy Vấn Danh Sách Hóa Đơn / Phiếu Thu Tiền",
        "description": "Lấy danh sách các phiếu thu tiền học phí hoặc dịch vụ, lọc theo khoảng thời gian và tài khoản nhận.",
        "category": "finance",
        "authRequired": true,
        "rateLimit": "100 requests / phút",
        "scopes": [
          "finance.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [
          {
            "name": "page",
            "type": "integer",
            "required": false,
            "default": "1",
            "desc": "Trang"
          },
          {
            "name": "from_date",
            "type": "string",
            "required": false,
            "desc": "Từ ngày (YYYY-MM-DD)"
          },
          {
            "name": "to_date",
            "type": "string",
            "required": false,
            "desc": "Đến ngày (YYYY-MM-DD)"
          }
        ],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Lấy danh sách phiếu thu thành công",
          "data": [
            {
              "id": 901,
              "invoice_code": "PT-2026-0105",
              "payer_name": "Trần Thị Mai Phương",
              "amount": 25000000,
              "status": "paid",
              "created_at": "2026-10-07"
            }
          ],
          "timestamp": "2026-10-08T09:59:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "finance-invoices-detail",
        "method": "GET",
        "path": "/api/v1/finance/invoices/:id",
        "title": "Chi Tiết Phiếu Thu Tiền",
        "description": "Xem chi tiết phiếu thu, người nộp tiền, lý do thu, tài khoản thụ hưởng và chứng từ kế toán đính kèm.",
        "category": "finance",
        "authRequired": true,
        "rateLimit": "100 requests / phút",
        "scopes": [
          "finance.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Lấy chi tiết phiếu thu thành công",
          "data": {
            "id": 901,
            "amount": 25000000,
            "description": "Thu học phí Đợt 1 Khóa BBA 2026"
          },
          "timestamp": "2026-10-08T10:00:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi phiếu thu không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu phiếu thu theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "finance-invoices-create",
        "method": "POST",
        "path": "/api/v1/finance/invoices",
        "title": "Lập Phiếu Thu Tiền Mới",
        "description": "Ghi nhận phiếu thu tiền học phí hoặc các khoản thu khác vào sổ quỹ hệ thống.",
        "category": "finance",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "finance.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "contact_id",
            "type": "integer",
            "required": true,
            "desc": "ID khách hàng/học viên nộp tiền"
          },
          {
            "name": "amount",
            "type": "number",
            "required": true,
            "desc": "Số tiền thu (VNĐ)"
          },
          {
            "name": "account_id",
            "type": "integer",
            "required": true,
            "desc": "ID tài khoản ngân hàng hoặc quỹ tiền mặt nhận"
          },
          {
            "name": "description",
            "type": "string",
            "required": true,
            "desc": "Nội dung thu tiền"
          }
        ],
        "sampleBody": {
          "contact_id": 5012,
          "amount": 25000000,
          "account_id": 1,
          "description": "Thu học phí Học kỳ 1"
        },
        "sampleResponse": {
          "success": true,
          "code": 201,
          "message": "Tạo phiếu thu thành công",
          "data": {
            "id": 902,
            "invoice_code": "PT-2026-0106",
            "amount": 25000000
          },
          "timestamp": "2026-10-08T10:01:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi phiếu thu không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu phiếu thu theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "finance-invoices-delete",
        "method": "DELETE",
        "path": "/api/v1/finance/invoices/:id",
        "title": "Hủy Bỏ Phiếu Thu Tiền Chưa Quyết Toán",
        "description": "Hủy phiếu thu do lập sai hoặc sai số tiền khi chưa kết chuyển sổ sách tháng.",
        "category": "finance",
        "authRequired": true,
        "rateLimit": "20 requests / phút",
        "scopes": [
          "finance.admin"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Đã hủy phiếu thu thành công",
          "data": {
            "id": 902,
            "status": "void"
          },
          "timestamp": "2026-10-08T10:02:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi phiếu thu không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu phiếu thu theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "finance-expenses-list",
        "method": "GET",
        "path": "/api/v1/finance/expenses",
        "title": "Truy Vấn Danh Sách Phiếu Đề Nghị Chi Tiền",
        "description": "Lấy danh sách các khoản chi phí hoạt động, mua sắm vật tư, quảng cáo và hoa hồng đối tác.",
        "category": "finance",
        "authRequired": true,
        "rateLimit": "100 requests / phút",
        "scopes": [
          "finance.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [
          {
            "name": "page",
            "type": "integer",
            "required": false,
            "default": "1",
            "desc": "Trang"
          },
          {
            "name": "status",
            "type": "string",
            "required": false,
            "desc": "'pending', 'approved', 'rejected', 'paid'"
          }
        ],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Lấy danh sách phiếu chi thành công",
          "data": [
            {
              "id": 612,
              "expense_code": "PC-2026-0089",
              "title": "Chi phí chạy Ads Facebook Tuyển Sinh Tháng 10",
              "amount": 18000000,
              "status": "pending_approval"
            }
          ],
          "timestamp": "2026-10-08T10:03:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "finance-expenses-detail",
        "method": "GET",
        "path": "/api/v1/finance/expenses/:id",
        "title": "Chi Tiết Phiếu Chi Tiền",
        "description": "Xem chi tiết mục đích chi, người đề xuất, các cấp phê duyệt và chứng từ hóa đơn đỏ đính kèm.",
        "category": "finance",
        "authRequired": true,
        "rateLimit": "100 requests / phút",
        "scopes": [
          "finance.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Lấy chi tiết phiếu chi thành công",
          "data": {
            "id": 612,
            "amount": 18000000,
            "requester": "Marketing Team",
            "status": "pending_approval"
          },
          "timestamp": "2026-10-08T10:04:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi phiếu chi không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu phiếu chi theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "finance-expenses-create",
        "method": "POST",
        "path": "/api/v1/finance/expenses",
        "title": "Tạo Phiếu Đề Nghị Chi Tiền Mới",
        "description": "Nhân viên / phòng ban khởi tạo phiếu đề nghị chi tiền hoạt động để cấp quản lý và giám đốc phê duyệt.",
        "category": "finance",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "finance.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "title",
            "type": "string",
            "required": true,
            "desc": "Nội dung mục đích chi tiền"
          },
          {
            "name": "amount",
            "type": "number",
            "required": true,
            "desc": "Số tiền đề nghị chi (VNĐ)"
          },
          {
            "name": "category_id",
            "type": "integer",
            "required": true,
            "desc": "ID danh mục chi phí (vd: Marketing, Hành chính, Lương)"
          },
          {
            "name": "account_id",
            "type": "integer",
            "required": true,
            "desc": "ID quỹ/tài khoản nguồn tiền chi"
          }
        ],
        "sampleBody": {
          "title": "Chi phí in ấn tờ rơi ngày hội Open Day",
          "amount": 4500000,
          "category_id": 2,
          "account_id": 1
        },
        "sampleResponse": {
          "success": true,
          "code": 201,
          "message": "Tạo phiếu đề nghị chi tiền thành công",
          "data": {
            "id": 613,
            "expense_code": "PC-2026-0090",
            "status": "pending_approval"
          },
          "timestamp": "2026-10-08T10:05:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi phiếu chi không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu phiếu chi theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "finance-expenses-approve",
        "method": "PUT",
        "path": "/api/v1/finance/expenses/:id/approve",
        "title": "Phê Duyệt Xuất Quỹ Phiếu Chi Tiền",
        "description": "Giám đốc / Kế toán trưởng duyệt lệnh chi tiền, hệ thống trừ tiền quỹ và ghi nhật ký giao dịch tài chính.",
        "category": "finance",
        "authRequired": true,
        "rateLimit": "30 requests / phút",
        "scopes": [
          "finance.approve"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "approval_note",
            "type": "string",
            "required": false,
            "desc": "Ghi chú phê duyệt của cấp thẩm quyền"
          }
        ],
        "sampleBody": {
          "approval_note": "Duyệt chi theo hạn mức ngân sách quý 4"
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Phê duyệt xuất quỹ phiếu chi thành công",
          "data": {
            "id": 612,
            "status": "approved",
            "approved_at": "2026-10-08 10:06:00"
          },
          "timestamp": "2026-10-08T10:06:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi phiếu chi không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu phiếu chi theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "finance-expenses-reject",
        "method": "PUT",
        "path": "/api/v1/finance/expenses/:id/reject",
        "title": "Từ Chối Phê Duyệt Phiếu Chi",
        "description": "Từ chối đề xuất chi tiền kèm lý do không phù hợp định mức chi tiêu.",
        "category": "finance",
        "authRequired": true,
        "rateLimit": "30 requests / phút",
        "scopes": [
          "finance.approve"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "reason",
            "type": "string",
            "required": true,
            "desc": "Lý do từ chối chi"
          }
        ],
        "sampleBody": {
          "reason": "Chi phí vượt quá định mức quy định, yêu cầu lập lại dự toán"
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Từ chối duyệt phiếu chi thành công",
          "data": {
            "id": 612,
            "status": "rejected"
          },
          "timestamp": "2026-10-08T10:07:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi phiếu chi không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu phiếu chi theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "finance-expenses-delete",
        "method": "DELETE",
        "path": "/api/v1/finance/expenses/:id",
        "title": "Hủy Bỏ Phiếu Chi Nháp Chưa Duyệt",
        "description": "Xóa phiếu đề xuất chi tiền khi nhân viên rút lại yêu cầu hoặc bị hủy.",
        "category": "finance",
        "authRequired": true,
        "rateLimit": "30 requests / phút",
        "scopes": [
          "finance.delete"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Đã hủy phiếu đề nghị chi tiền",
          "data": {
            "id": 613,
            "status": "cancelled"
          },
          "timestamp": "2026-10-08T10:08:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi phiếu chi không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu phiếu chi theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "finance-accounts-list",
        "method": "GET",
        "path": "/api/v1/finance/accounts",
        "title": "Truy Vấn Danh Sách Tài Khoản & Số Dư Quỹ Thực Tế",
        "description": "Lấy danh sách các tài khoản ngân hàng doanh nghiệp và két tiền mặt chi nhánh kèm số dư khả dụng thực tế.",
        "category": "finance",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "finance.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Lấy danh sách tài khoản quỹ thành công",
          "data": [
            {
              "id": 1,
              "account_name": "Quỹ Tiền Mặt Tân Bình",
              "balance": 12500000,
              "type": "cash"
            },
            {
              "id": 2,
              "account_name": "Techcombank Tuyển Sinh - 190382910...",
              "balance": 485200000,
              "type": "bank"
            }
          ],
          "timestamp": "2026-10-08T10:09:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "cooperation",
    "title": "09. Đối Tác Tuyển Sinh & Hoa Hồng Đại Lý (Cooperation & Agent)",
    "iconName": "Briefcase",
    "description": "Quản trị mạng lưới đối tác liên kết tuyển sinh, hợp tác đại lý giới thiệu học viên, tính toán tỷ lệ chia sẻ hoa hồng và thanh toán chiết khấu.",
    "endpoints": [
      {
        "id": "coop-slips-list",
        "method": "GET",
        "path": "/api/v1/cooperation/slips",
        "title": "Truy Vấn Danh Sách Phiếu Ghi Nhận Doanh Số Đối Tác",
        "description": "Lấy danh sách các phiếu tính hoa hồng cho đối tác, cộng tác viên tuyển sinh và các trường THPT liên kết.",
        "category": "cooperation",
        "authRequired": true,
        "rateLimit": "100 requests / phút",
        "scopes": [
          "cooperation.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [
          {
            "name": "page",
            "type": "integer",
            "required": false,
            "default": "1",
            "desc": "Trang"
          },
          {
            "name": "partner_id",
            "type": "integer",
            "required": false,
            "desc": "Lọc theo ID đối tác"
          }
        ],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Lấy danh sách phiếu đối tác thành công",
          "data": [
            {
              "id": 701,
              "partner_name": "Trường THPT Marie Curie",
              "total_leads": 12,
              "enrolled_count": 3,
              "commission_amount": 15000000,
              "status": "approved"
            }
          ],
          "timestamp": "2026-10-08T10:10:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "coop-slips-detail",
        "method": "GET",
        "path": "/api/v1/cooperation/slips/:id",
        "title": "Chi Tiết Phiếu Hoa Hồng Tuyển Sinh Đối Tác",
        "description": "Xem chi tiết danh sách học viên do đối tác giới thiệu, số tiền học phí đã thu và tỷ lệ % hoa hồng được hưởng.",
        "category": "cooperation",
        "authRequired": true,
        "rateLimit": "100 requests / phút",
        "scopes": [
          "cooperation.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Truy vấn chi tiết phiếu đối tác thành công",
          "data": {
            "id": 701,
            "commission_rate": "10%",
            "students": [
              "Trần Thị Mai Phương",
              "Lê Văn Hùng"
            ]
          },
          "timestamp": "2026-10-08T10:11:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi phiếu đối tác không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu phiếu đối tác theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "coop-slips-create",
        "method": "POST",
        "path": "/api/v1/cooperation/slips",
        "title": "Tạo Phiếu Hoa Hồng Tuyển Sinh Đối Tác Mới",
        "description": "Khởi tạo phiếu tính hoa hồng cho đối tác khi học viên nhập học thành công và hoàn thành nghĩa vụ học phí.",
        "category": "cooperation",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "cooperation.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "partner_id",
            "type": "integer",
            "required": true,
            "desc": "ID đối tác liên kết"
          },
          {
            "name": "contact_id",
            "type": "integer",
            "required": true,
            "desc": "ID học viên được giới thiệu"
          },
          {
            "name": "commission_amount",
            "type": "number",
            "required": true,
            "desc": "Số tiền hoa hồng tính toán (VNĐ)"
          }
        ],
        "sampleBody": {
          "partner_id": 12,
          "contact_id": 5012,
          "commission_amount": 5000000
        },
        "sampleResponse": {
          "success": true,
          "code": 201,
          "message": "Tạo phiếu hoa hồng đối tác thành công",
          "data": {
            "id": 702,
            "status": "pending_approval"
          },
          "timestamp": "2026-10-08T10:12:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi phiếu đối tác không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu phiếu đối tác theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "coop-slips-update",
        "method": "PUT",
        "path": "/api/v1/cooperation/slips/:id",
        "title": "Cập Nhật Tỷ Lệ Hoa Hồng & Số Tiền Chi Trả",
        "description": "Điều chỉnh số tiền hoặc chính sách % chiết khấu đối tác trước khi duyệt chi.",
        "category": "cooperation",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "cooperation.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "commission_amount",
            "type": "number",
            "required": false,
            "desc": "Số tiền hoa hồng mới"
          },
          {
            "name": "note",
            "type": "string",
            "required": false,
            "desc": "Ghi chú điều chỉnh tỷ lệ"
          }
        ],
        "sampleBody": {
          "commission_amount": 6000000,
          "note": "Thưởng thêm vượt chỉ tiêu 5 hồ sơ"
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Cập nhật phiếu hoa hồng thành công",
          "data": {
            "id": 701,
            "updated_at": "2026-10-08 10:13:00"
          },
          "timestamp": "2026-10-08T10:13:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi phiếu đối tác không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu phiếu đối tác theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "coop-slips-delete",
        "method": "DELETE",
        "path": "/api/v1/cooperation/slips/:id",
        "title": "Hủy Bỏ Phiếu Hoa Hồng Đối Tác",
        "description": "Xóa phiếu tính hoa hồng khi học viên rút hồ sơ hoàn học phí hoặc bị tạo trùng lặp.",
        "category": "cooperation",
        "authRequired": true,
        "rateLimit": "30 requests / phút",
        "scopes": [
          "cooperation.delete"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Hủy phiếu hoa hồng đối tác thành công",
          "data": {
            "id": 701,
            "status": "deleted"
          },
          "timestamp": "2026-10-08T10:14:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi phiếu đối tác không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu phiếu đối tác theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "coop-slips-approve",
        "method": "POST",
        "path": "/api/v1/cooperation/slips/:id/approve",
        "title": "Phê Duyệt Chi Trả Hoa Hồng Đối Tác",
        "description": "Giám đốc phê duyệt phiếu chi trả hoa hồng để kế toán tiến hành chuyển khoản cho đối tác.",
        "category": "cooperation",
        "authRequired": true,
        "rateLimit": "30 requests / phút",
        "scopes": [
          "cooperation.approve"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Duyệt chi trả hoa hồng đối tác thành công",
          "data": {
            "id": 701,
            "status": "approved"
          },
          "timestamp": "2026-10-08T10:15:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi phiếu đối tác không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu phiếu đối tác theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "hrm-checkin",
    "title": "10. Chấm Công GPS/WiFi, Thiết Bị & Ca Kíp (HRM Time Attendance)",
    "iconName": "Clock",
    "description": "Hệ thống chấm công thông minh: toạ độ GPS, BSSID WiFi văn phòng, nhận diện thiết bị tin cậy và báo cáo đi muộn, về sớm tự động.",
    "endpoints": [
      {
        "id": "checkin-logs-list",
        "method": "GET",
        "path": "/api/v1/hrm/checkin/logs",
        "title": "Truy Vấn Lịch Sử Chấm Công Vào / Ra",
        "description": "Lấy danh sách các lượt chấm công của nhân viên theo ngày, tháng và chi nhánh.",
        "category": "hrm-checkin",
        "authRequired": true,
        "rateLimit": "100 requests / phút",
        "scopes": [
          "checkin.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [
          {
            "name": "user_id",
            "type": "integer",
            "required": false,
            "desc": "Lọc theo nhân viên"
          },
          {
            "name": "date",
            "type": "string",
            "required": false,
            "desc": "Ngày chấm công (YYYY-MM-DD)"
          }
        ],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Lấy lịch sử chấm công thành công",
          "data": [
            {
              "id": 9210,
              "user_name": "Nguyễn Thị Lan",
              "checkin_time": "2026-10-08 08:28:15",
              "type": "in",
              "status": "on_time",
              "device_name": "iPhone 15 Pro"
            }
          ],
          "timestamp": "2026-10-08T10:16:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "checkin-logs-detail",
        "method": "GET",
        "path": "/api/v1/hrm/checkin/logs/:id",
        "title": "Chi Tiết Bản Ghi Chấm Công (Tọa Độ & Địa Chỉ IP)",
        "description": "Xem chi tiết lượt chấm công: vĩ độ, kinh độ GPS, sai số mét, tên mạng WiFi và địa chỉ IP kết nối.",
        "category": "hrm-checkin",
        "authRequired": true,
        "rateLimit": "100 requests / phút",
        "scopes": [
          "checkin.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Lấy chi tiết chấm công thành công",
          "data": {
            "id": 9210,
            "latitude": 10.7989,
            "longitude": 106.6541,
            "wifi_ssid": "IDEAS_OFFICE_5G",
            "distance_meters": 12.5
          },
          "timestamp": "2026-10-08T10:17:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi bản ghi chấm công không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu bản ghi chấm công theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "checkin-submit",
        "method": "POST",
        "path": "/api/v1/hrm/checkin",
        "title": "Thực Hiện Chấm Công Check-in / Check-out",
        "description": "Nhân viên bấm chấm công từ ứng dụng. Server xác thực vị trí GPS trong bán kính cho phép (dưới 100m) và BSSID mạng WiFi văn phòng.",
        "category": "hrm-checkin",
        "authRequired": true,
        "rateLimit": "20 requests / phút",
        "scopes": [
          "checkin.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "type",
            "type": "string",
            "required": true,
            "desc": "'check_in' hoặc 'check_out'"
          },
          {
            "name": "latitude",
            "type": "number",
            "required": true,
            "desc": "Vĩ độ GPS thiết bị"
          },
          {
            "name": "longitude",
            "type": "number",
            "required": true,
            "desc": "Kinh độ GPS thiết bị"
          },
          {
            "name": "wifi_bssid",
            "type": "string",
            "required": false,
            "desc": "Địa chỉ MAC WiFi thiết bị đang kết nối"
          }
        ],
        "sampleBody": {
          "type": "check_in",
          "latitude": 10.7989,
          "longitude": 106.6541,
          "wifi_bssid": "ac:84:c6:28:11:02"
        },
        "sampleResponse": {
          "success": true,
          "code": 201,
          "message": "Chấm công thành công! Đúng giờ làm việc.",
          "data": {
            "id": 9211,
            "check_time": "2026-10-08 08:29:00",
            "status": "valid"
          },
          "timestamp": "2026-10-08T10:18:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi chấm công không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu chấm công theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "LOCATION_OUT_OF_RANGE",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "checkin-update",
        "method": "PUT",
        "path": "/api/v1/hrm/checkin/:id",
        "title": "Quản Lý / Nhân Sự Hiệu Chỉnh Giờ Chấm Công",
        "description": "Điều chỉnh bổ sung giờ chấm công cho nhân viên khi quên bấm hoặc có đơn giải trình hợp lệ.",
        "category": "hrm-checkin",
        "authRequired": true,
        "rateLimit": "30 requests / phút",
        "scopes": [
          "checkin.manage"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "check_time",
            "type": "string",
            "required": true,
            "desc": "Giờ điều chỉnh (YYYY-MM-DD HH:mm:ss)"
          },
          {
            "name": "reason",
            "type": "string",
            "required": true,
            "desc": "Lý do hiệu chỉnh giờ công"
          }
        ],
        "sampleBody": {
          "check_time": "2026-10-08 08:30:00",
          "reason": "Giải trình sự cố mạng WiFi chi nhánh Tân Bình"
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Hiệu chỉnh chấm công thành công",
          "data": {
            "id": 9210,
            "status": "manually_adjusted"
          },
          "timestamp": "2026-10-08T10:19:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi bản ghi chấm công không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu bản ghi chấm công theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "checkin-delete",
        "method": "DELETE",
        "path": "/api/v1/hrm/checkin/:id",
        "title": "Xóa Lượt Chấm Công Bị Trùng Hoặc Bất Thường",
        "description": "Xóa lượt chấm công rác khi nhân viên bấm liên tiếp nhiều lần.",
        "category": "hrm-checkin",
        "authRequired": true,
        "rateLimit": "30 requests / phút",
        "scopes": [
          "checkin.manage"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Xóa bản ghi chấm công thành công",
          "data": {
            "id": 9210,
            "deleted_at": "2026-10-08 10:20:00"
          },
          "timestamp": "2026-10-08T10:20:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi bản ghi chấm công không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu bản ghi chấm công theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "checkin-stats",
        "method": "GET",
        "path": "/api/v1/hrm/checkin/stats",
        "title": "Báo Cáo Tổng Hợp Ngày Công & Đi Muộn Trong Tháng",
        "description": "Xuất báo cáo tổng số ngày công thực tế, số phút đi muộn, về sớm và số ngày nghỉ phép có/không phép.",
        "category": "hrm-checkin",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "checkin.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [
          {
            "name": "month",
            "type": "string",
            "required": true,
            "desc": "Tháng thống kê (YYYY-MM)"
          }
        ],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Lấy thống kê chấm công thành công",
          "data": {
            "standard_days": 26,
            "actual_worked_days": 24.5,
            "late_count": 1,
            "late_minutes": 15
          },
          "timestamp": "2026-10-08T10:21:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "hrm-payroll",
    "title": "11. Bảng Lương, Thưởng KPI & Giảm Trừ Thuế (HRM Payroll)",
    "iconName": "PieChart",
    "description": "Tự động tính toán bảng lương: lương cơ bản, công chuẩn, hoa hồng chốt tuyển sinh, thưởng KPI, bảo hiểm bắt buộc và thuế TNCN.",
    "endpoints": [
      {
        "id": "payroll-list",
        "method": "GET",
        "path": "/api/v1/hrm/payroll",
        "title": "Truy Vấn Danh Sách Bảng Lương Tháng Toàn Đơn Vị",
        "description": "Lấy danh sách các bảng lương theo tháng, lọc theo chi nhánh và trạng thái khóa/duyệt bảng lương.",
        "category": "hrm-payroll",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "payroll.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [
          {
            "name": "month",
            "type": "string",
            "required": true,
            "desc": "Tháng lương (YYYY-MM)"
          }
        ],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Lấy bảng lương thành công",
          "data": [
            {
              "id": 501,
              "month": "2026-09",
              "total_employees": 48,
              "total_net_salary": 680500000,
              "status": "approved"
            }
          ],
          "timestamp": "2026-10-08T10:22:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "payroll-detail",
        "method": "GET",
        "path": "/api/v1/hrm/payroll/:id",
        "title": "Chi Tiết Phiếu Lương Nhân Viên (Payslip Chi Tiết)",
        "description": "Xem chi tiết phiếu lương cá nhân: lương cơ bản, số ngày công, hoa hồng tuyển sinh, phụ cấp ăn trưa/đi lại, trừ BHXH và thực lĩnh.",
        "category": "hrm-payroll",
        "authRequired": true,
        "rateLimit": "100 requests / phút",
        "scopes": [
          "payroll.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Truy vấn phiếu lương thành công",
          "data": {
            "employee_name": "Nguyễn Thị Lan",
            "base_salary": 12000000,
            "commission": 8500000,
            "allowance": 1500000,
            "deduction_insurance": 1260000,
            "net_salary": 20740000
          },
          "timestamp": "2026-10-08T10:23:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi phiếu lương không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu phiếu lương theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "payroll-calculate",
        "method": "POST",
        "path": "/api/v1/hrm/payroll/calculate",
        "title": "Chạy Lệnh Tự Động Tính Bảng Lương Tháng (Calculation Job)",
        "description": "Khởi động tiến trình quét dữ liệu chấm công, hoa hồng cơ hội đã chốt và thưởng phạt để kết xuất bảng lương tháng tự động.",
        "category": "hrm-payroll",
        "authRequired": true,
        "rateLimit": "5 requests / phút",
        "scopes": [
          "payroll.manage"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "month",
            "type": "string",
            "required": true,
            "desc": "Tháng cần tính toán (YYYY-MM)"
          }
        ],
        "sampleBody": {
          "month": "2026-10"
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Bảng lương đã được tính toán thành công",
          "data": {
            "month": "2026-10",
            "processed_employees": 48,
            "status": "draft"
          },
          "timestamp": "2026-10-08T10:24:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "payroll-adjust",
        "method": "PUT",
        "path": "/api/v1/hrm/payroll/:id/adjust",
        "title": "Hiệu Chỉnh Phụ Cấp, Thưởng Phạt Trên Phiếu Lương",
        "description": "Nhân sự điều chỉnh số tiền thưởng đột xuất hoặc phạt vi phạm nội quy trước khi trình giám đốc duyệt.",
        "category": "hrm-payroll",
        "authRequired": true,
        "rateLimit": "30 requests / phút",
        "scopes": [
          "payroll.manage"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "bonus_amount",
            "type": "number",
            "required": false,
            "desc": "Số tiền thưởng thêm (VNĐ)"
          },
          {
            "name": "penalty_amount",
            "type": "number",
            "required": false,
            "desc": "Số tiền trừ phạt (VNĐ)"
          },
          {
            "name": "note",
            "type": "string",
            "required": true,
            "desc": "Lý do điều chỉnh"
          }
        ],
        "sampleBody": {
          "bonus_amount": 1000000,
          "note": "Thưởng nóng dự án Open Day"
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Hiệu chỉnh phiếu lương thành công",
          "data": {
            "id": 501,
            "net_salary": 21740000
          },
          "timestamp": "2026-10-08T10:25:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi phiếu lương không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu phiếu lương theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "payroll-approve",
        "method": "POST",
        "path": "/api/v1/hrm/payroll/approve",
        "title": "Giám Đốc Phê Duyệt & Khóa Bảng Lương Tháng",
        "description": "Phê duyệt chính thức và đóng băng số liệu bảng lương, kích hoạt gửi phiếu lương (Payslip) qua email cho nhân sự.",
        "category": "hrm-payroll",
        "authRequired": true,
        "rateLimit": "10 requests / phút",
        "scopes": [
          "payroll.approve"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "payroll_id",
            "type": "integer",
            "required": true,
            "desc": "ID bảng lương tháng"
          }
        ],
        "sampleBody": {
          "payroll_id": 501
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Bảng lương tháng đã được duyệt và khóa sổ thành công",
          "data": {
            "id": 501,
            "status": "approved",
            "locked": true
          },
          "timestamp": "2026-10-08T10:26:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi bảng lương không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu bảng lương theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "payroll-delete",
        "method": "DELETE",
        "path": "/api/v1/hrm/payroll/:id",
        "title": "Hủy Bảng Lương Nháp Để Tính Lại",
        "description": "Xóa bảng lương nháp khi có sai sót lớn về dữ liệu công chấm hoặc hoa hồng để chạy lại tiến trình tính toán.",
        "category": "hrm-payroll",
        "authRequired": true,
        "rateLimit": "10 requests / phút",
        "scopes": [
          "payroll.manage"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Đã hủy bảng lương nháp thành công",
          "data": {
            "id": 501,
            "status": "deleted"
          },
          "timestamp": "2026-10-08T10:27:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi bảng lương không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu bảng lương theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "projects-tasks",
    "title": "12. Dự Án, Công Việc & Phân Công Nhiệm Vụ (Projects & Tasks)",
    "iconName": "CheckSquare",
    "description": "Quản lý dự án doanh nghiệp, giao việc, phân công nhiệm vụ, theo dõi tiến độ hoàn thành, thời hạn deadline và trao đổi công việc theo thời gian thực.",
    "endpoints": [
      {
        "id": "tasks-list",
        "method": "GET",
        "path": "/api/v1/tasks",
        "title": "Truy Vấn Danh Sách Công Việc (Tasks)",
        "description": "Lấy danh sách các công việc được giao, lọc theo trạng thái (todo, in_progress, review, done), mức độ ưu tiên hoặc dự án.",
        "category": "projects-tasks",
        "authRequired": true,
        "rateLimit": "100 requests / phút",
        "scopes": [
          "tasks.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [
          {
            "name": "project_id",
            "type": "integer",
            "required": false,
            "desc": "Lọc theo ID dự án"
          },
          {
            "name": "status",
            "type": "string",
            "required": false,
            "desc": "'todo', 'in_progress', 'review', 'done'"
          },
          {
            "name": "assignee_id",
            "type": "integer",
            "required": false,
            "desc": "Lọc theo người thực hiện"
          }
        ],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Lấy danh sách công việc thành công",
          "data": [
            {
              "id": 305,
              "title": "Thiết kế Standee và Backdrop Ngày Hội Open Day",
              "status": "in_progress",
              "priority": "high",
              "due_date": "2026-10-15",
              "progress": 60
            }
          ],
          "timestamp": "2026-10-08T10:28:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "tasks-detail",
        "method": "GET",
        "path": "/api/v1/tasks/:id",
        "title": "Chi Tiết Công Việc & Danh Sách Checklist Con",
        "description": "Xem chi tiết mô tả công việc, người giao, người thực hiện, các tiêu chí checklist và tệp tin đính kèm.",
        "category": "projects-tasks",
        "authRequired": true,
        "rateLimit": "100 requests / phút",
        "scopes": [
          "tasks.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Truy vấn chi tiết công việc thành công",
          "data": {
            "id": 305,
            "title": "Thiết kế Standee",
            "checklist": [
              {
                "id": 1,
                "text": "Duyệt nội dung",
                "done": true
              }
            ]
          },
          "timestamp": "2026-10-08T10:29:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi công việc không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu công việc theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "tasks-create",
        "method": "POST",
        "path": "/api/v1/tasks",
        "title": "Tạo Mới & Giao Việc Cho Nhân Viên (Create Task)",
        "description": "Khởi tạo công việc mới, chỉ định người chịu trách nhiệm, người theo dõi, hạn chót và mức độ ưu tiên.",
        "category": "projects-tasks",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "tasks.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "title",
            "type": "string",
            "required": true,
            "desc": "Tiêu đề công việc"
          },
          {
            "name": "description",
            "type": "string",
            "required": false,
            "desc": "Mô tả chi tiết yêu cầu"
          },
          {
            "name": "assignee_id",
            "type": "integer",
            "required": true,
            "desc": "ID người nhận việc"
          },
          {
            "name": "due_date",
            "type": "string",
            "required": true,
            "desc": "Hạn chót hoàn thành (YYYY-MM-DD)"
          },
          {
            "name": "priority",
            "type": "string",
            "required": false,
            "default": "medium",
            "desc": "'low', 'medium', 'high', 'urgent'"
          }
        ],
        "sampleBody": {
          "title": "Gọi điện xác nhận danh sách 50 phụ huynh dự Open Day",
          "assignee_id": 1042,
          "due_date": "2026-10-12",
          "priority": "high"
        },
        "sampleResponse": {
          "success": true,
          "code": 201,
          "message": "Tạo và giao việc thành công",
          "data": {
            "id": 306,
            "status": "todo"
          },
          "timestamp": "2026-10-08T10:30:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi công việc không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu công việc theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "tasks-update",
        "method": "PUT",
        "path": "/api/v1/tasks/:id",
        "title": "Cập Nhật Thông Tin & Tiến Độ Công Việc",
        "description": "Cập nhật tiến độ hoàn thành (0-100%), gia hạn thời gian deadline hoặc bổ sung người phối hợp.",
        "category": "projects-tasks",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "tasks.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "progress",
            "type": "integer",
            "required": false,
            "desc": "Tiến độ % hoàn thành (0 - 100)"
          },
          {
            "name": "due_date",
            "type": "string",
            "required": false,
            "desc": "Hạn chót mới"
          }
        ],
        "sampleBody": {
          "progress": 80,
          "due_date": "2026-10-14"
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Cập nhật công việc thành công",
          "data": {
            "id": 305,
            "progress": 80
          },
          "timestamp": "2026-10-08T10:31:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi công việc không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu công việc theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "tasks-delete",
        "method": "DELETE",
        "path": "/api/v1/tasks/:id",
        "title": "Xóa Công Việc",
        "description": "Xóa công việc khi kế hoạch bị hủy hoặc nhiệm vụ không còn cần thiết.",
        "category": "projects-tasks",
        "authRequired": true,
        "rateLimit": "30 requests / phút",
        "scopes": [
          "tasks.delete"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Đã xóa công việc thành công",
          "data": {
            "id": 305,
            "status": "deleted"
          },
          "timestamp": "2026-10-08T10:32:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi công việc không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu công việc theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "tasks-status-update",
        "method": "PUT",
        "path": "/api/v1/tasks/:id/status",
        "title": "Chuyển Trạng Thái Công Việc (Kanban Task Move)",
        "description": "Cập nhật nhanh trạng thái công việc: Sang đang làm (in_progress), chờ duyệt (review) hoặc hoàn thành (done).",
        "category": "projects-tasks",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "tasks.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "status",
            "type": "string",
            "required": true,
            "desc": "'todo', 'in_progress', 'review', 'done'"
          }
        ],
        "sampleBody": {
          "status": "done"
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Chuyển trạng thái công việc thành công",
          "data": {
            "id": 305,
            "status": "done",
            "completed_at": "2026-10-08 10:33:00"
          },
          "timestamp": "2026-10-08T10:33:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi công việc không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu công việc theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "tasks-comments-create",
        "method": "POST",
        "path": "/api/v1/tasks/:id/comments",
        "title": "Thêm Bình Luận Trao Đổi Trong Công Việc",
        "description": "Gửi bình luận phản hồi, báo cáo vướng mắc hoặc tag đồng nghiệp trong thẻ công việc.",
        "category": "projects-tasks",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "tasks.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "content",
            "type": "string",
            "required": true,
            "desc": "Nội dung bình luận trao đổi"
          }
        ],
        "sampleBody": {
          "content": "Đã gọi được 42/50 phụ huynh, 35 phụ huynh xác nhận sẽ tham gia Open Day"
        },
        "sampleResponse": {
          "success": true,
          "code": 201,
          "message": "Đã gửi bình luận thành công",
          "data": {
            "comment_id": 912,
            "task_id": 305
          },
          "timestamp": "2026-10-08T10:34:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi công việc không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu công việc theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "marketing-capi",
    "title": "13. Tiếp Thị Số, Meta CAPI & Chiến Dịch (Marketing & Conversion)",
    "iconName": "Target",
    "description": "Quản trị chiến dịch quảng cáo đa kênh, đo lường chi phí trên mỗi Lead (CPL) và bắn sự kiện chuyển đổi trực tiếp lên Meta Conversions API Server-Side.",
    "endpoints": [
      {
        "id": "marketing-campaigns-list",
        "method": "GET",
        "path": "/api/v1/marketing/campaigns",
        "title": "Truy Vấn Danh Sách Chiến Dịch Tiếp Thị (Campaigns)",
        "description": "Lấy danh sách các chiến dịch quảng cáo Facebook Ads, Google Ads, TikTok Ads và hiệu quả chuyển đổi.",
        "category": "marketing-capi",
        "authRequired": true,
        "rateLimit": "100 requests / phút",
        "scopes": [
          "marketing.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [
          {
            "name": "status",
            "type": "string",
            "required": false,
            "desc": "'active', 'paused', 'completed'"
          }
        ],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Lấy danh sách chiến dịch thành công",
          "data": [
            {
              "id": 88,
              "name": "Chuyển Đổi Lead Khóa BBA Tuyển Sinh Đợt 4",
              "budget": 50000000,
              "spent": 32000000,
              "leads_count": 420,
              "cpl": 76190,
              "status": "active"
            }
          ],
          "timestamp": "2026-10-08T10:35:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "marketing-campaigns-detail",
        "method": "GET",
        "path": "/api/v1/marketing/campaigns/:id",
        "title": "Chi Tiết Chiến Dịch & Hiệu Quả Doanh Thu Mang Lại (ROAS)",
        "description": "Xem chi tiết ngân sách chiến dịch, tổng số học viên nhập học từ chiến dịch và chỉ số lợi tức đầu tư tiếp thị ROAS.",
        "category": "marketing-capi",
        "authRequired": true,
        "rateLimit": "100 requests / phút",
        "scopes": [
          "marketing.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Truy vấn chi tiết chiến dịch thành công",
          "data": {
            "id": 88,
            "name": "Chuyển Đổi Lead BBA",
            "roas": "4.2x",
            "enrolled_revenue": 134400000
          },
          "timestamp": "2026-10-08T10:36:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi chiến dịch không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu chiến dịch theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "marketing-campaigns-create",
        "method": "POST",
        "path": "/api/v1/marketing/campaigns",
        "title": "Tạo Mới Chiến Dịch Tiếp Thị Đa Kênh",
        "description": "Tạo chiến dịch mới để theo dõi UTM Source, gắn Pixel và ngân sách truyền thông.",
        "category": "marketing-capi",
        "authRequired": true,
        "rateLimit": "30 requests / phút",
        "scopes": [
          "marketing.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "name",
            "type": "string",
            "required": true,
            "desc": "Tên chiến dịch quảng cáo"
          },
          {
            "name": "platform",
            "type": "string",
            "required": true,
            "desc": "'facebook', 'google', 'tiktok', 'offline'"
          },
          {
            "name": "budget",
            "type": "number",
            "required": true,
            "desc": "Ngân sách dự kiến (VNĐ)"
          }
        ],
        "sampleBody": {
          "name": "Tuyển Sinh Thạc Sĩ MBA Quốc Tế K2026",
          "platform": "facebook",
          "budget": 80000000
        },
        "sampleResponse": {
          "success": true,
          "code": 201,
          "message": "Tạo chiến dịch tiếp thị thành công",
          "data": {
            "id": 89,
            "status": "active"
          },
          "timestamp": "2026-10-08T10:37:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi chiến dịch không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu chiến dịch theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "marketing-campaigns-update",
        "method": "PUT",
        "path": "/api/v1/marketing/campaigns/:id",
        "title": "Cập Nhật Thông Tin & Ngân Sách Chiến Dịch",
        "description": "Điều chỉnh ngân sách hoặc trạng thái tạm dừng/tiếp tục chạy của chiến dịch tiếp thị.",
        "category": "marketing-capi",
        "authRequired": true,
        "rateLimit": "30 requests / phút",
        "scopes": [
          "marketing.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "budget",
            "type": "number",
            "required": false,
            "desc": "Ngân sách mới (VNĐ)"
          },
          {
            "name": "status",
            "type": "string",
            "required": false,
            "desc": "'active', 'paused', 'completed'"
          }
        ],
        "sampleBody": {
          "budget": 100000000,
          "status": "active"
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Cập nhật chiến dịch thành công",
          "data": {
            "id": 88,
            "budget": 100000000
          },
          "timestamp": "2026-10-08T10:38:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi chiến dịch không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu chiến dịch theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "marketing-campaigns-delete",
        "method": "DELETE",
        "path": "/api/v1/marketing/campaigns/:id",
        "title": "Xóa Chiến Dịch Tiếp Thị",
        "description": "Xóa chiến dịch thử nghiệm không còn sử dụng.",
        "category": "marketing-capi",
        "authRequired": true,
        "rateLimit": "20 requests / phút",
        "scopes": [
          "marketing.delete"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Đã xóa chiến dịch thành công",
          "data": {
            "id": 89,
            "status": "deleted"
          },
          "timestamp": "2026-10-08T10:39:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi chiến dịch không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu chiến dịch theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "capi-events-post",
        "method": "POST",
        "path": "/api/v1/marketing/capi/events",
        "title": "Bắn Sự Kiện Chuyển Đổi Server-Side Lên Meta CAPI",
        "description": "Gửi sự kiện chuyển đổi chuẩn (Lead, Purchase, CompleteRegistration) trực tiếp từ máy chủ ERP lên máy chủ Meta Graph API (v21.0), vượt qua các rào cản AdBlock và iOS 14.5 ATT.",
        "category": "marketing-capi",
        "authRequired": true,
        "rateLimit": "200 requests / phút",
        "scopes": [
          "marketing.capi"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "event_name",
            "type": "string",
            "required": true,
            "desc": "'Lead', 'Purchase', 'CompleteRegistration'"
          },
          {
            "name": "event_time",
            "type": "integer",
            "required": false,
            "desc": "Unix timestamp thời điểm sự kiện phát sinh"
          },
          {
            "name": "user_data",
            "type": "object",
            "required": true,
            "desc": "Thông tin định danh người dùng đã băm SHA-256 (email, phone, fbp, fbc)"
          },
          {
            "name": "custom_data",
            "type": "object",
            "required": false,
            "desc": "Giá trị đơn hàng (currency, value, content_name)"
          }
        ],
        "sampleBody": {
          "event_name": "Lead",
          "event_time": 1760000000,
          "user_data": {
            "em": "6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b",
            "ph": "d4735e3a265e16eee03f59718b9b5d03019c07d8b6c51f90da3a666eec13ab35",
            "fbp": "fb.1.1760000000.12345678"
          },
          "custom_data": {
            "value": 5000000,
            "currency": "VND",
            "content_name": "BBA Deposit"
          }
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Sự kiện CAPI đã được truyền thành công tới Meta Graph API",
          "data": {
            "events_received": 1,
            "fbtrace_id": "AbCdEf123456"
          },
          "timestamp": "2026-10-08T10:40:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi sự kiện CAPI không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu sự kiện CAPI theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "capi-logs-list",
        "method": "GET",
        "path": "/api/v1/marketing/capi/logs",
        "title": "Tra Cứu Lịch Sử Bắn Sự Kiện Chuyển Đổi Meta CAPI",
        "description": "Kiểm tra danh sách các gói dữ liệu sự kiện đã bắn lên Meta, mã phản hồi HTTP và chất lượng khớp người dùng (Event Match Quality - EMQ).",
        "category": "marketing-capi",
        "authRequired": true,
        "rateLimit": "100 requests / phút",
        "scopes": [
          "marketing.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Lấy nhật ký CAPI thành công",
          "data": [
            {
              "id": 5510,
              "event_name": "Lead",
              "status": "success",
              "meta_response_code": 200,
              "event_match_quality": "8.5/10",
              "created_at": "2026-10-08 10:39:50"
            }
          ],
          "timestamp": "2026-10-08T10:41:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "connectors",
    "title": "14. Tích Hợp Webhook, Google Sheets & Đồng Bộ (Connectors & Sync)",
    "iconName": "Layers",
    "description": "Kết nối hai chiều dữ liệu: kéo dữ liệu biểu mẫu từ Google Sheets về MYERP, nhận Webhook từ landing page và đẩy dữ liệu sang các hệ thống CRM vệ tinh.",
    "endpoints": [
      {
        "id": "connectors-list",
        "method": "GET",
        "path": "/api/v1/connectors",
        "title": "Truy Vấn Danh Sách Luồng Kết Nối Đang Hoạt Động",
        "description": "Lấy danh sách các luồng tích hợp Google Sheets, Webhook Inbound và thông tin trạng thái hoạt động.",
        "category": "connectors",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "connectors.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Lấy danh sách kết nối thành công",
          "data": [
            {
              "id": 14,
              "name": "Google Sheet Landing Page BBA 2026",
              "type": "google_sheets",
              "status": "active",
              "last_synced_at": "2026-10-08 09:30:00",
              "synced_rows": 1820
            }
          ],
          "timestamp": "2026-10-08T10:45:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "connectors-detail",
        "method": "GET",
        "path": "/api/v1/connectors/:id",
        "title": "Chi Tiết Cấu Hình Kết Nối & Ánh Xạ Cột (Column Mapping)",
        "description": "Xem chi tiết bảng tính Google Sheets ID, khoảng cột (Range), quy tắc mapping giữa cột Sheet và trường dữ liệu Lead trong CRM.",
        "category": "connectors",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "connectors.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Truy vấn chi tiết kết nối thành công",
          "data": {
            "id": 14,
            "sheet_id": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
            "column_mapping": {
              "Họ và tên": "full_name",
              "Số điện thoại": "phone",
              "Email": "email"
            }
          },
          "timestamp": "2026-10-08T10:46:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi luồng kết nối không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu luồng kết nối theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "connectors-create",
        "method": "POST",
        "path": "/api/v1/connectors",
        "title": "Thêm Mới Luồng Kết Nối Google Sheet / Webhook",
        "description": "Đăng ký luồng tích hợp mới để tự động kéo lead định kỳ vào hệ thống MYERP.",
        "category": "connectors",
        "authRequired": true,
        "rateLimit": "20 requests / phút",
        "scopes": [
          "connectors.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "name",
            "type": "string",
            "required": true,
            "desc": "Tên định danh luồng kết nối"
          },
          {
            "name": "type",
            "type": "string",
            "required": true,
            "desc": "'google_sheets' hoặc 'webhook_inbound'"
          },
          {
            "name": "sheet_id",
            "type": "string",
            "required": true,
            "desc": "Mã Google Spreadsheet ID"
          },
          {
            "name": "branch_id",
            "type": "integer",
            "required": true,
            "desc": "Chi nhánh thụ hưởng lead đổ về"
          }
        ],
        "sampleBody": {
          "name": "Google Sheet Form Hội Thảo",
          "type": "google_sheets",
          "sheet_id": "1BxiMVs0...",
          "branch_id": 2
        },
        "sampleResponse": {
          "success": true,
          "code": 201,
          "message": "Đăng ký luồng kết nối thành công",
          "data": {
            "id": 15,
            "status": "active"
          },
          "timestamp": "2026-10-08T10:47:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi kết nối không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu kết nối theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "connectors-update",
        "method": "PUT",
        "path": "/api/v1/connectors/:id",
        "title": "Cập Nhật Cấu Hình & Ánh Xạ Cột (Column Mapping)",
        "description": "Hiệu chỉnh lại ánh xạ cột khi biểu mẫu Google Sheet thêm cột mới hoặc đổi tên tiêu đề cột.",
        "category": "connectors",
        "authRequired": true,
        "rateLimit": "30 requests / phút",
        "scopes": [
          "connectors.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "column_mapping",
            "type": "object",
            "required": true,
            "desc": "Dictionary ánh xạ: { Tên Cột Sheet: Trường DB }"
          }
        ],
        "sampleBody": {
          "column_mapping": {
            "Họ tên": "full_name",
            "SĐT": "phone",
            "Ghi chú": "notes"
          }
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Cập nhật ánh xạ cột thành công",
          "data": {
            "id": 14,
            "updated_at": "2026-10-08 10:48:00"
          },
          "timestamp": "2026-10-08T10:48:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi kết nối không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu kết nối theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "connectors-delete",
        "method": "DELETE",
        "path": "/api/v1/connectors/:id",
        "title": "Ngắt Kết Nối & Xóa Luồng Đồng Bộ",
        "description": "Xóa cấu hình đồng bộ khi chiến dịch kết thúc hoặc sheet không còn sử dụng.",
        "category": "connectors",
        "authRequired": true,
        "rateLimit": "20 requests / phút",
        "scopes": [
          "connectors.delete"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Đã ngắt kết nối và xóa luồng đồng bộ thành công",
          "data": {
            "id": 15,
            "status": "deleted"
          },
          "timestamp": "2026-10-08T10:49:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi kết nối không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu kết nối theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "sheets-sync-trigger",
        "method": "POST",
        "path": "/api/v1/connectors/:id/sync",
        "title": "Kích Hoạt Kéo Dữ Liệu Tức Thì (Instant Pull Sync)",
        "description": "Lập tức gọi Google Sheets API để quét các dòng mới phát sinh kể từ lần đồng bộ gần nhất, tự động tạo mới Lead và phân luồng chia cho tư vấn viên.",
        "category": "connectors",
        "authRequired": true,
        "rateLimit": "10 requests / phút",
        "scopes": [
          "connectors.sync"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Đồng bộ hoàn tất thành công",
          "data": {
            "connector_id": 14,
            "new_records_imported": 12,
            "duplicates_skipped": 3,
            "synced_at": "2026-10-08 10:50:00"
          },
          "timestamp": "2026-10-08T10:50:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi kết nối không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu kết nối theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "omnichannel",
    "title": "15. Giao Tiếp Đa Kênh, Zalo ZNS & SMS Gateway (Omnichannel & Zalo)",
    "iconName": "MessageSquare",
    "description": "Tích hợp Zalo Official Account (OA), gửi tin nhắn thông báo chăm sóc khách hàng qua ZNS (Zalo Notification Service), SMS Brandname và tổng đài VoIP.",
    "endpoints": [
      {
        "id": "omnichannel-templates-list",
        "method": "GET",
        "path": "/api/v1/omnichannel/templates",
        "title": "Danh Mục Mẫu Tin Nhắn Zalo ZNS Đã Được Phê Duyệt",
        "description": "Lấy danh sách các mẫu thông báo ZNS (mã xác nhận cọc, lịch khai giảng, thông báo học phí) đã được Zalo kiểm duyệt kèm bảng tham số.",
        "category": "omnichannel",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "omnichannel.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Lấy danh mục mẫu tin nhắn thành công",
          "data": [
            {
              "template_id": "zns_deposit_confirm_01",
              "name": "Thông Báo Xác Nhận Đặt Cọc Thành Công",
              "status": "approved",
              "params": [
                "customer_name",
                "amount",
                "deposit_code",
                "course_name"
              ]
            }
          ],
          "timestamp": "2026-10-08T10:51:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "omnichannel-templates-detail",
        "method": "GET",
        "path": "/api/v1/omnichannel/templates/:id",
        "title": "Chi Tiết Nội Dung Mẫu Tin Nhắn ZNS & Bố Cục Thẻ",
        "description": "Xem chi tiết nội dung văn bản mẫu, bố cục hiển thị và các nút bấm hành động (Call-to-Action) kèm mẫu tin.",
        "category": "omnichannel",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "omnichannel.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Lấy chi tiết mẫu tin nhắn thành công",
          "data": {
            "template_id": "zns_deposit_confirm_01",
            "preview_html": "<div>Kính gửi Quý phụ huynh...</div>"
          },
          "timestamp": "2026-10-08T10:52:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi mẫu tin không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu mẫu tin theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "zalo-send-message",
        "method": "POST",
        "path": "/api/v1/omnichannel/zalo/send",
        "title": "Gửi Tin Nhắn Zalo OA Cho Khách Hàng (Tương Tác 1-1)",
        "description": "Gửi tin nhắn phản hồi trực tiếp cho người dùng đã quan tâm Zalo Official Account trong khung giờ 24h.",
        "category": "omnichannel",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "omnichannel.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "zalo_user_id",
            "type": "string",
            "required": true,
            "desc": "Mã ID người dùng Zalo (UID)"
          },
          {
            "name": "message",
            "type": "string",
            "required": true,
            "desc": "Nội dung tin nhắn văn bản"
          }
        ],
        "sampleBody": {
          "zalo_user_id": "84901234567_zalo_uid",
          "message": "Chào bạn, Viện Đào Tạo IDEAS gửi bạn lịch phỏng vấn học bổng vào sáng thứ 7 nhé!"
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Gửi tin nhắn Zalo thành công",
          "data": {
            "message_id": "msg_zalo_991823",
            "status": "sent"
          },
          "timestamp": "2026-10-08T10:53:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi tin nhắn không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu tin nhắn theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "omnichannel-zns-send",
        "method": "POST",
        "path": "/api/v1/omnichannel/zns/send",
        "title": "Bắn Tin Nhắn Mẫu Zalo ZNS Thông Báo Tự Động",
        "description": "Bắn tin ZNS trực tiếp theo mẫu được duyệt đến số điện thoại học viên/phụ huynh.",
        "category": "omnichannel",
        "authRequired": true,
        "rateLimit": "100 requests / phút",
        "scopes": [
          "omnichannel.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "phone",
            "type": "string",
            "required": true,
            "desc": "Số điện thoại người nhận (định dạng 84xxx)"
          },
          {
            "name": "template_id",
            "type": "string",
            "required": true,
            "desc": "Mã mẫu tin ZNS"
          },
          {
            "name": "template_data",
            "type": "object",
            "required": true,
            "desc": "Object chứa các giá trị tham số cần điền vào mẫu"
          }
        ],
        "sampleBody": {
          "phone": "84987654321",
          "template_id": "zns_deposit_confirm_01",
          "template_data": {
            "customer_name": "Trần Thị Mai Phương",
            "amount": "5,000,000 VNĐ",
            "deposit_code": "DC-2026-0015",
            "course_name": "BBA K2026"
          }
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Gửi tin nhắn ZNS thành công",
          "data": {
            "msg_id": "zns_msg_448102",
            "status": "delivered"
          },
          "timestamp": "2026-10-08T10:54:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi tin nhắn ZNS không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu tin nhắn ZNS theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "omnichannel-logs-list",
        "method": "GET",
        "path": "/api/v1/omnichannel/logs",
        "title": "Tra Cứu Lịch Sử & Trạng Thái Gửi Tin Đa Kênh",
        "description": "Xem danh sách các tin nhắn đã gửi qua Zalo, SMS, trạng thái thành công, thất bại và chi phí phát sinh.",
        "category": "omnichannel",
        "authRequired": true,
        "rateLimit": "100 requests / phút",
        "scopes": [
          "omnichannel.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Lấy nhật ký tin nhắn thành công",
          "data": [
            {
              "id": 1024,
              "channel": "zalo_zns",
              "phone": "0987654321",
              "status": "delivered",
              "sent_at": "2026-10-08 10:53:30"
            }
          ],
          "timestamp": "2026-10-08T10:55:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "omnichannel-logs-delete",
        "method": "DELETE",
        "path": "/api/v1/omnichannel/logs/:id",
        "title": "Xóa Bản Ghi Nhật Ký Gửi Tin Nhắn",
        "description": "Dọn dẹp các bản ghi nhật ký gửi tin nhắn đã lưu trữ quá thời hạn quy định.",
        "category": "omnichannel",
        "authRequired": true,
        "rateLimit": "20 requests / phút",
        "scopes": [
          "omnichannel.admin"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Xóa bản ghi nhật ký tin nhắn thành công",
          "data": {
            "id": 1024,
            "deleted": true
          },
          "timestamp": "2026-10-08T10:56:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi bản ghi không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu bản ghi theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "ai-analytics",
    "title": "16. Trí Tuệ Nhân Tạo & Dự Báo Tuyển Sinh (AI Assistant & RAG)",
    "iconName": "Cpu",
    "description": "Trợ lý AI chuyên biệt cho đào tạo: trả lời nghiệp vụ tuyển sinh dựa trên kho tri thức RAG (Retrieval-Augmented Generation) và dự báo khả năng chốt hợp đồng.",
    "endpoints": [
      {
        "id": "ai-chat-rag",
        "method": "POST",
        "path": "/api/v1/ai/chat",
        "title": "Hỏi Đáp Với AI RAG Trợ Lý Tuyển Sinh & Đào Tạo",
        "description": "Gửi câu hỏi nghiệp vụ hoặc hỏi chính sách học bổng. AI tự động trích xuất các đoạn văn bản tương đồng từ Vector Database tài liệu trường và sinh câu trả lời chính xác.",
        "category": "ai-analytics",
        "authRequired": true,
        "rateLimit": "30 requests / phút",
        "scopes": [
          "ai.chat"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "message",
            "type": "string",
            "required": true,
            "desc": "Nội dung câu hỏi của tư vấn viên hoặc học viên"
          },
          {
            "name": "conversation_id",
            "type": "string",
            "required": false,
            "desc": "Mã ngữ cảnh cuộc trò chuyện để ghi nhớ lịch sử"
          }
        ],
        "sampleBody": {
          "message": "Điều kiện để nhận học bổng 50% chương trình BBA K2026 là gì?"
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "AI đã sinh câu trả lời thành công",
          "data": {
            "answer": "Để đạt học bổng 50% BBA K2026, thí sinh cần có điểm trung bình THPT 3 năm từ 8.5 trở lên HOẶC đạt chứng chỉ IELTS từ 6.5 trở lên và vượt qua vòng phỏng vấn của Hội đồng Khoa học.",
            "sources": [
              "Quy_che_hoc_bong_2026.pdf - Trang 4"
            ]
          },
          "timestamp": "2026-10-08T10:57:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi hệ thống AI không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu hệ thống AI theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "ai-knowledge-list",
        "method": "GET",
        "path": "/api/v1/ai/knowledge",
        "title": "Danh Mục Tài Liệu & Tri Thức Đã Huấn Luyện Cho AI",
        "description": "Lấy danh sách các tài liệu PDF, DOCX, quy chế tuyển sinh đã được nhúng (Embedding) vào cơ sở dữ liệu Vector của hệ thống.",
        "category": "ai-analytics",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "ai.manage"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Lấy danh mục tri thức AI thành công",
          "data": [
            {
              "id": 55,
              "file_name": "Quy_che_tuyen_sinh_2026.pdf",
              "chunks_count": 86,
              "status": "embedded",
              "updated_at": "2026-10-01"
            }
          ],
          "timestamp": "2026-10-08T10:58:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "ai-knowledge-detail",
        "method": "GET",
        "path": "/api/v1/ai/knowledge/:id",
        "title": "Chi Tiết Nội Dung Đoạn Vector Tri Thức",
        "description": "Xem chi tiết các đoạn phân đoạn văn bản (chunks) và chỉ số vector embedding của một tài liệu.",
        "category": "ai-analytics",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "ai.manage"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Lấy chi tiết tài liệu thành công",
          "data": {
            "id": 55,
            "file_name": "Quy_che_tuyen_sinh_2026.pdf",
            "total_tokens": 34500
          },
          "timestamp": "2026-10-08T10:59:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi tài liệu tri thức không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu tài liệu tri thức theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "ai-knowledge-create",
        "method": "POST",
        "path": "/api/v1/ai/knowledge",
        "title": "Nạp Thêm Tài Liệu Mới Vào Kho Tri Thức AI (Ingestion)",
        "description": "Tải lên tệp tài liệu mới hoặc văn bản để hệ thống tự động băm chunk và vector hóa phục vụ truy vấn RAG.",
        "category": "ai-analytics",
        "authRequired": true,
        "rateLimit": "10 requests / phút",
        "scopes": [
          "ai.manage"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "title",
            "type": "string",
            "required": true,
            "desc": "Tiêu đề tài liệu"
          },
          {
            "name": "content",
            "type": "string",
            "required": true,
            "desc": "Nội dung văn bản quy chế cần nạp vào AI"
          }
        ],
        "sampleBody": {
          "title": "Chính sách ưu đãi học phí đóng sớm Early Bird",
          "content": "Giảm ngay 10% học phí khi hoàn tất học phí trước ngày 30/11..."
        },
        "sampleResponse": {
          "success": true,
          "code": 201,
          "message": "Nạp tài liệu vào kho tri thức AI thành công",
          "data": {
            "id": 56,
            "status": "vectorized"
          },
          "timestamp": "2026-10-08T11:00:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi tri thức AI không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu tri thức AI theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "ai-knowledge-delete",
        "method": "DELETE",
        "path": "/api/v1/ai/knowledge/:id",
        "title": "Xóa Tài Liệu Khỏi Kho Bộ Nhớ Vector AI",
        "description": "Gỡ bỏ các quy chế cũ hết hiệu lực khỏi cơ sở dữ liệu Vector để AI không trả lời thông tin lỗi thời.",
        "category": "ai-analytics",
        "authRequired": true,
        "rateLimit": "20 requests / phút",
        "scopes": [
          "ai.manage"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Đã xóa tài liệu khỏi kho tri thức AI",
          "data": {
            "id": 55,
            "status": "removed"
          },
          "timestamp": "2026-10-08T11:01:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi tài liệu không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu tài liệu theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "ai-analytics-predictions",
        "method": "GET",
        "path": "/api/v1/ai/analytics/predictions",
        "title": "Báo Cáo AI Dự Báo Xác Suất Chốt Đơn & Doanh Thu Tuyển Sinh",
        "description": "Sử dụng mô hình học máy phân tích dữ liệu tương tác để chấm điểm chấm Lead (Lead Scoring) và dự báo doanh số tuyển sinh tháng.",
        "category": "ai-analytics",
        "authRequired": true,
        "rateLimit": "30 requests / phút",
        "scopes": [
          "ai.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Lấy báo cáo dự báo AI thành công",
          "data": {
            "predicted_enrolled_leads": 85,
            "estimated_revenue": 11050000000,
            "confidence_score": 0.88
          },
          "timestamp": "2026-10-08T11:02:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "enterprise-feed",
    "title": "17. Bảng Tin Doanh Nghiệp & Tương Tác Nội Bộ (Enterprise Feed)",
    "iconName": "Rss",
    "description": "Bảng tin thông tin nội bộ: thông báo quyết định của ban lãnh đạo, vinh danh cá nhân xuất sắc, tương tác bình luận và thả cảm xúc.",
    "endpoints": [
      {
        "id": "feed-posts-list",
        "method": "GET",
        "path": "/api/v1/feed/posts",
        "title": "Truy Vấn Danh Sách Bài Viết Bảng Tin Doanh Nghiệp",
        "description": "Lấy các bài đăng thông báo, tin tức nội bộ công ty có phân trang, danh sách người thả tim và số lượng bình luận.",
        "category": "enterprise-feed",
        "authRequired": true,
        "rateLimit": "100 requests / phút",
        "scopes": [
          "feed.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [
          {
            "name": "page",
            "type": "integer",
            "required": false,
            "default": "1",
            "desc": "Trang"
          }
        ],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Lấy bảng tin thành công",
          "data": [
            {
              "id": 142,
              "author_name": "Ban Giám Đốc",
              "title": "Vinh Danh Best Seller Tuyển Sinh Tháng 9/2026",
              "likes_count": 34,
              "comments_count": 12,
              "created_at": "2026-10-01 08:00:00"
            }
          ],
          "timestamp": "2026-10-08T11:03:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "feed-posts-detail",
        "method": "GET",
        "path": "/api/v1/feed/posts/:id",
        "title": "Chi Tiết Bài Đăng Bảng Tin & Danh Sách Bình Luận",
        "description": "Xem chi tiết toàn bộ nội dung bài viết, hình ảnh đính kèm và chuỗi bình luận của nhân viên.",
        "category": "enterprise-feed",
        "authRequired": true,
        "rateLimit": "100 requests / phút",
        "scopes": [
          "feed.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Truy vấn chi tiết bài đăng thành công",
          "data": {
            "id": 142,
            "content": "Chúc mừng bạn Nguyễn Thị Lan đạt doanh số 1.2 tỷ VNĐ...",
            "images": [
              "https://myerp.../banner_bestseller.jpg"
            ]
          },
          "timestamp": "2026-10-08T11:04:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi bài đăng không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu bài đăng theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "feed-posts-create",
        "method": "POST",
        "path": "/api/v1/feed/posts",
        "title": "Đăng Bài Viết Mới Lên Bảng Tin Nội Bộ",
        "description": "Nhân viên hoặc ban truyền thông nội bộ đăng thông báo, quyết định mới hoặc chia sẻ thành tích.",
        "category": "enterprise-feed",
        "authRequired": true,
        "rateLimit": "20 requests / phút",
        "scopes": [
          "feed.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "title",
            "type": "string",
            "required": true,
            "desc": "Tiêu đề bài viết"
          },
          {
            "name": "content",
            "type": "string",
            "required": true,
            "desc": "Nội dung bài viết (hỗ trợ markdown/HTML)"
          },
          {
            "name": "pinned",
            "type": "boolean",
            "required": false,
            "default": "false",
            "desc": "Ghim bài viết lên đầu trang"
          }
        ],
        "sampleBody": {
          "title": "Thông báo lịch nghỉ lễ và kế hoạch trực tư vấn",
          "content": "Toàn thể cán bộ nhân viên chú ý lịch trực...",
          "pinned": true
        },
        "sampleResponse": {
          "success": true,
          "code": 201,
          "message": "Đăng bài viết lên bảng tin thành công",
          "data": {
            "id": 143,
            "created_at": "2026-10-08 11:05:00"
          },
          "timestamp": "2026-10-08T11:05:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi bài viết không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu bài viết theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "feed-posts-update",
        "method": "PUT",
        "path": "/api/v1/feed/posts/:id",
        "title": "Chỉnh Sửa Bài Viết Bảng Tin",
        "description": "Tác giả chỉnh sửa nội dung bài viết đã đăng.",
        "category": "enterprise-feed",
        "authRequired": true,
        "rateLimit": "30 requests / phút",
        "scopes": [
          "feed.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "content",
            "type": "string",
            "required": true,
            "desc": "Nội dung cập nhật"
          }
        ],
        "sampleBody": {
          "content": "Nội dung thông báo đã được bổ sung thêm danh sách trực ca tối..."
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Cập nhật bài viết thành công",
          "data": {
            "id": 142,
            "updated_at": "2026-10-08 11:06:00"
          },
          "timestamp": "2026-10-08T11:06:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi bài viết không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu bài viết theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "feed-posts-delete",
        "method": "DELETE",
        "path": "/api/v1/feed/posts/:id",
        "title": "Xóa Bài Viết Khỏi Bảng Tin",
        "description": "Tác giả hoặc Admin xóa bài viết khỏi bảng tin nội bộ.",
        "category": "enterprise-feed",
        "authRequired": true,
        "rateLimit": "20 requests / phút",
        "scopes": [
          "feed.delete"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Đã xóa bài viết thành công",
          "data": {
            "id": 143,
            "status": "deleted"
          },
          "timestamp": "2026-10-08T11:07:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi bài viết không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu bài viết theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "feed-posts-comment",
        "method": "POST",
        "path": "/api/v1/feed/posts/:id/comments",
        "title": "Bình Luận Vào Bài Đăng Bảng Tin",
        "description": "Gửi bình luận chúc mừng, trao đổi ý kiến dưới bài viết.",
        "category": "enterprise-feed",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "feed.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "content",
            "type": "string",
            "required": true,
            "desc": "Nội dung bình luận"
          }
        ],
        "sampleBody": {
          "content": "Chúc mừng chị Lan và team Tân Bình nhé! Quá xuất sắc!"
        },
        "sampleResponse": {
          "success": true,
          "code": 201,
          "message": "Gửi bình luận thành công",
          "data": {
            "comment_id": 880,
            "post_id": 142
          },
          "timestamp": "2026-10-08T11:08:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi bình luận không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu bình luận theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "feed-posts-like",
        "method": "POST",
        "path": "/api/v1/feed/posts/:id/like",
        "title": "Thả Cảm Xúc Like / Yêu Thích Bài Đăng",
        "description": "Tương tác thả tim, vỗ tay hoặc thích bài đăng trên bảng tin.",
        "category": "enterprise-feed",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "feed.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "reaction_type",
            "type": "string",
            "required": false,
            "default": "like",
            "desc": "'like', 'love', 'celebrate'"
          }
        ],
        "sampleBody": {
          "reaction_type": "love"
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Thả cảm xúc thành công",
          "data": {
            "post_id": 142,
            "liked": true
          },
          "timestamp": "2026-10-08T11:09:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi bài viết không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu bài viết theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "live-chat",
    "title": "18. Hệ Thống Tin Nhắn Trực Tuyến & Thảo Luận Nhóm (Internal Chat)",
    "iconName": "Send",
    "description": "Tin nhắn tức thời nội bộ: chat 1-1 giữa các nhân viên, chat nhóm dự án theo phòng ban, chia sẻ tệp tin và thông báo tin nhắn mới qua WebSocket.",
    "endpoints": [
      {
        "id": "chat-conversations-list",
        "method": "GET",
        "path": "/api/v1/chat/conversations",
        "title": "Truy Vấn Danh Sách Cuộc Hội Thoại & Nhóm Chat",
        "description": "Lấy danh sách các phòng trò chuyện cá nhân và nhóm mà tài khoản đang tham gia kèm tin nhắn mới nhất và số tin chưa đọc.",
        "category": "live-chat",
        "authRequired": true,
        "rateLimit": "100 requests / phút",
        "scopes": [
          "chat.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Lấy danh sách hội thoại thành công",
          "data": [
            {
              "id": 48,
              "name": "Team Tuyển Sinh Tân Bình",
              "type": "group",
              "unread_count": 2,
              "last_message": {
                "sender": "Vũ Hoàng Minh",
                "text": "Hôm nay ai trực ca tối vậy?",
                "time": "11:00"
              }
            }
          ],
          "timestamp": "2026-10-08T11:10:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "chat-messages-list",
        "method": "GET",
        "path": "/api/v1/chat/conversations/:id/messages",
        "title": "Truy Vấn Lịch Sử Tin Nhắn Trong Phòng Chat",
        "description": "Lấy danh sách tin nhắn theo phòng chat có phân trang cuộn ngược thời gian.",
        "category": "live-chat",
        "authRequired": true,
        "rateLimit": "120 requests / phút",
        "scopes": [
          "chat.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [
          {
            "name": "limit",
            "type": "integer",
            "required": false,
            "default": "50",
            "desc": "Số tin nhắn lấy mỗi lần"
          }
        ],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Lấy lịch sử tin nhắn thành công",
          "data": [
            {
              "id": 1940,
              "sender_id": 1042,
              "sender_name": "Nguyễn Thị Lan",
              "message": "Em trực ca tối nay nhé anh!",
              "created_at": "2026-10-08 11:02:15"
            }
          ],
          "timestamp": "2026-10-08T11:11:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi phòng chat không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu phòng chat theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "chat-conversations-create",
        "method": "POST",
        "path": "/api/v1/chat/conversations",
        "title": "Tạo Phòng Hội Thoại Cá Nhân Hoặc Nhóm Chat Mới",
        "description": "Tạo nhóm chat mới với danh sách thành viên hoặc khởi tạo cuộc hội thoại 1-1.",
        "category": "live-chat",
        "authRequired": true,
        "rateLimit": "30 requests / phút",
        "scopes": [
          "chat.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "name",
            "type": "string",
            "required": false,
            "desc": "Tên nhóm chat (đối với nhóm)"
          },
          {
            "name": "type",
            "type": "string",
            "required": true,
            "desc": "'direct' (1-1) hoặc 'group' (nhóm)"
          },
          {
            "name": "participant_ids",
            "type": "array",
            "required": true,
            "desc": "Mảng danh sách các User ID tham gia"
          }
        ],
        "sampleBody": {
          "name": "Dự Án Open Day Tháng 10",
          "type": "group",
          "participant_ids": [
            1042,
            1055,
            1088
          ]
        },
        "sampleResponse": {
          "success": true,
          "code": 201,
          "message": "Tạo phòng chat thành công",
          "data": {
            "id": 49,
            "type": "group"
          },
          "timestamp": "2026-10-08T11:12:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi phòng chat không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu phòng chat theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "chat-send-message",
        "method": "POST",
        "path": "/api/v1/chat/messages",
        "title": "Gửi Tin Nhắn Mới Vào Phòng Chat",
        "description": "Gửi tin nhắn văn bản hoặc tệp tin vào cuộc hội thoại, tự động kích hoạt đẩy thông báo realtime qua WebSocket.",
        "category": "live-chat",
        "authRequired": true,
        "rateLimit": "120 requests / phút",
        "scopes": [
          "chat.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "conversation_id",
            "type": "integer",
            "required": true,
            "desc": "ID phòng chat"
          },
          {
            "name": "message",
            "type": "string",
            "required": true,
            "desc": "Nội dung tin nhắn"
          },
          {
            "name": "attachment_url",
            "type": "string",
            "required": false,
            "desc": "Đường dẫn tệp tin đính kèm"
          }
        ],
        "sampleBody": {
          "conversation_id": 48,
          "message": "Em đã hoàn tất gọi danh sách phụ huynh sáng nay rồi ạ!"
        },
        "sampleResponse": {
          "success": true,
          "code": 201,
          "message": "Gửi tin nhắn thành công",
          "data": {
            "message_id": 1941,
            "created_at": "2026-10-08 11:13:00"
          },
          "timestamp": "2026-10-08T11:13:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi tin nhắn không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu tin nhắn theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "chat-mark-read",
        "method": "PUT",
        "path": "/api/v1/chat/conversations/:id/read",
        "title": "Đánh Dấu Đã Đọc Toàn Bộ Tin Nhắn",
        "description": "Xóa thông báo số tin nhắn chưa đọc của phòng chat khi người dùng mở giao diện xem tin.",
        "category": "live-chat",
        "authRequired": true,
        "rateLimit": "100 requests / phút",
        "scopes": [
          "chat.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Đã đánh dấu đã đọc",
          "data": {
            "conversation_id": 48,
            "unread_count": 0
          },
          "timestamp": "2026-10-08T11:14:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi phòng chat không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu phòng chat theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "chat-messages-delete",
        "method": "DELETE",
        "path": "/api/v1/chat/messages/:id",
        "title": "Thu Hồi Tin Nhắn Đã Gửi",
        "description": "Người gửi thu hồi tin nhắn trong vòng 15 phút kể từ khi gửi tin.",
        "category": "live-chat",
        "authRequired": true,
        "rateLimit": "30 requests / phút",
        "scopes": [
          "chat.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Đã thu hồi tin nhắn thành công",
          "data": {
            "message_id": 1941,
            "recalled": true
          },
          "timestamp": "2026-10-08T11:15:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi tin nhắn không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu tin nhắn theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "tickets",
    "title": "19. Tiếp Nhận & Xử Lý Sự Cố CSKH (Customer Support Tickets)",
    "iconName": "LifeBuoy",
    "description": "Quản trị phiếu khiếu nại, hỗ trợ kỹ thuật, yêu cầu bảo lưu học tập từ học viên và phụ huynh theo tiêu chuẩn cam kết dịch vụ (SLA).",
    "endpoints": [
      {
        "id": "tickets-list",
        "method": "GET",
        "path": "/api/v1/tickets",
        "title": "Truy Vấn Danh Sách Phiếu Hỗ Trợ Khách Hàng (Tickets)",
        "description": "Lấy danh sách các ticket hỗ trợ, lọc theo trạng thái (open, pending, resolved, closed), mức độ khẩn cấp và nhân sự được phân công.",
        "category": "tickets",
        "authRequired": true,
        "rateLimit": "100 requests / phút",
        "scopes": [
          "tickets.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [
          {
            "name": "status",
            "type": "string",
            "required": false,
            "desc": "'open', 'pending', 'resolved', 'closed'"
          },
          {
            "name": "priority",
            "type": "string",
            "required": false,
            "desc": "'low', 'normal', 'high', 'urgent'"
          }
        ],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Lấy danh sách ticket thành công",
          "data": [
            {
              "id": 204,
              "ticket_code": "TK-2026-0081",
              "subject": "Hỗ trợ đổi lớp học phần Digital Marketing",
              "contact_name": "Trần Thị Mai Phương",
              "priority": "high",
              "status": "open",
              "created_at": "2026-10-08 08:30:00"
            }
          ],
          "timestamp": "2026-10-08T11:20:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "tickets-detail",
        "method": "GET",
        "path": "/api/v1/tickets/:id",
        "title": "Chi Tiết Phiếu Hỗ Trợ & Lịch Sử Phản Hồi CSKH",
        "description": "Xem chi tiết nội dung khiếu nại của học viên, người tiếp nhận xử lý, thời gian đếm ngược SLA và toàn bộ lịch sử trao đổi phản hồi.",
        "category": "tickets",
        "authRequired": true,
        "rateLimit": "100 requests / phút",
        "scopes": [
          "tickets.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Truy vấn chi tiết ticket thành công",
          "data": {
            "id": 204,
            "subject": "Đổi lớp học phần",
            "sla_remaining_minutes": 180,
            "replies": [
              {
                "sender": "Phòng Đào Tạo",
                "message": "Đã ghi nhận yêu cầu và xếp lớp thứ 3-5",
                "time": "09:15"
              }
            ]
          },
          "timestamp": "2026-10-08T11:21:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi phiếu hỗ trợ không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu phiếu hỗ trợ theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "tickets-create",
        "method": "POST",
        "path": "/api/v1/tickets",
        "title": "Tiếp Nhận & Khởi Tạo Ticket CSKH Mới",
        "description": "Tạo mới phiếu tiếp nhận sự cố khi học viên gọi hotline hoặc nhắn tin phản ánh.",
        "category": "tickets",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "tickets.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "contact_id",
            "type": "integer",
            "required": true,
            "desc": "ID học viên/phụ huynh gửi yêu cầu"
          },
          {
            "name": "subject",
            "type": "string",
            "required": true,
            "desc": "Tiêu đề yêu cầu hỗ trợ"
          },
          {
            "name": "content",
            "type": "string",
            "required": true,
            "desc": "Nội dung chi tiết khiếu nại / yêu cầu"
          },
          {
            "name": "priority",
            "type": "string",
            "required": false,
            "default": "normal",
            "desc": "'low', 'normal', 'high', 'urgent'"
          }
        ],
        "sampleBody": {
          "contact_id": 5012,
          "subject": "Yêu cầu cấp lại bảng điểm học kỳ 1",
          "content": "Học viên cần bảng điểm công chứng nộp bổ sung hồ sơ",
          "priority": "normal"
        },
        "sampleResponse": {
          "success": true,
          "code": 201,
          "message": "Tạo ticket thành công",
          "data": {
            "id": 205,
            "ticket_code": "TK-2026-0082",
            "status": "open"
          },
          "timestamp": "2026-10-08T11:22:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi ticket không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu ticket theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "tickets-update",
        "method": "PUT",
        "path": "/api/v1/tickets/:id",
        "title": "Cập Nhật Thông Tin & Điều Chuyển Nhân Sự Xử Lý",
        "description": "Điều chuyển ticket cho chuyên viên phụ trách hoặc nâng cấp mức độ ưu tiên xử lý.",
        "category": "tickets",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "tickets.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "assigned_to",
            "type": "integer",
            "required": false,
            "desc": "ID nhân viên tiếp nhận xử lý"
          },
          {
            "name": "priority",
            "type": "string",
            "required": false,
            "desc": "Mức độ ưu tiên mới"
          }
        ],
        "sampleBody": {
          "assigned_to": 1088,
          "priority": "urgent"
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Cập nhật thông tin ticket thành công",
          "data": {
            "id": 204,
            "assigned_to": 1088
          },
          "timestamp": "2026-10-08T11:23:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi ticket không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu ticket theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "tickets-delete",
        "method": "DELETE",
        "path": "/api/v1/tickets/:id",
        "title": "Xóa Phiếu Hỗ Trợ Rác / Bị Trùng Lặp",
        "description": "Xóa ticket được tạo trùng lặp hoặc tin nhắn spam.",
        "category": "tickets",
        "authRequired": true,
        "rateLimit": "30 requests / phút",
        "scopes": [
          "tickets.delete"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Đã xóa ticket thành công",
          "data": {
            "id": 205,
            "status": "deleted"
          },
          "timestamp": "2026-10-08T11:24:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi ticket không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu ticket theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "tickets-replies-create",
        "method": "POST",
        "path": "/api/v1/tickets/:id/replies",
        "title": "Nhân Viên Gửi Phản Hồi Xử Lý Cho Khách Hàng",
        "description": "Gửi thông điệp phản hồi kết quả giải quyết cho học viên, tự động đồng bộ gửi SMS hoặc thông báo Zalo.",
        "category": "tickets",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "tickets.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "content",
            "type": "string",
            "required": true,
            "desc": "Nội dung phản hồi giải quyết"
          }
        ],
        "sampleBody": {
          "content": "Phòng Đào Tạo đã in bảng điểm công chứng, mời bạn ghé văn phòng tầng 2 để nhận nhé!"
        },
        "sampleResponse": {
          "success": true,
          "code": 201,
          "message": "Gửi phản hồi ticket thành công",
          "data": {
            "reply_id": 992,
            "ticket_id": 204
          },
          "timestamp": "2026-10-08T11:25:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi ticket không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu ticket theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "tickets-status-update",
        "method": "PUT",
        "path": "/api/v1/tickets/:id/status",
        "title": "Đóng Ticket Hoặc Đổi Trạng Thái Giải Quyết",
        "description": "Chuyển trạng thái ticket sang Đã giải quyết (resolved) hoặc Đóng phiếu (closed).",
        "category": "tickets",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "tickets.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "status",
            "type": "string",
            "required": true,
            "desc": "'resolved', 'closed', 'reopened'"
          },
          {
            "name": "resolution_note",
            "type": "string",
            "required": false,
            "desc": "Ghi chú kết luận giải quyết"
          }
        ],
        "sampleBody": {
          "status": "resolved",
          "resolution_note": "Đã trao bảng điểm cho học viên"
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Cập nhật trạng thái đóng ticket thành công",
          "data": {
            "id": 204,
            "status": "resolved",
            "closed_at": "2026-10-08 11:26:00"
          },
          "timestamp": "2026-10-08T11:26:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi ticket không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu ticket theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "inventory",
    "title": "20. Quản Lý Kho Vận, Sản Phẩm & Vật Tư (Inventory & Products)",
    "iconName": "Package",
    "description": "Quản trị danh mục giáo trình, đồng phục, quà tặng tuyển sinh và ấn phẩm marketing: nhập kho, xuất kho cấp phát, kiểm kê và cảnh báo tồn tối thiểu.",
    "endpoints": [
      {
        "id": "inventory-items-list",
        "method": "GET",
        "path": "/api/v1/inventory/items",
        "title": "Truy Vấn Danh Mục Hàng Hóa & Tồn Kho Hiện Tại",
        "description": "Lấy danh sách các vật tư, quà tặng tuyển sinh trong kho kèm số lượng tồn thực tế và điểm đặt hàng lại.",
        "category": "inventory",
        "authRequired": true,
        "rateLimit": "100 requests / phút",
        "scopes": [
          "inventory.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [
          {
            "name": "category_id",
            "type": "integer",
            "required": false,
            "desc": "Lọc theo loại vật tư"
          }
        ],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Lấy danh mục kho thành công",
          "data": [
            {
              "id": 77,
              "sku": "VT-BALO-IDEAS-01",
              "name": "Balo Cao Cấp Quà Tặng Tân Học Viên",
              "stock": 250,
              "min_stock": 50,
              "unit": "Chiếc",
              "cost_price": 180000
            }
          ],
          "timestamp": "2026-10-08T11:27:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "inventory-items-detail",
        "method": "GET",
        "path": "/api/v1/inventory/items/:id",
        "title": "Chi Tiết Sản Phẩm & Tồn Kho Từng Chi Nhánh",
        "description": "Xem chi tiết tồn kho vật tư phân bổ theo từng cơ sở (Tân Bình, Quận 1) và thông tin nhà cung cấp.",
        "category": "inventory",
        "authRequired": true,
        "rateLimit": "100 requests / phút",
        "scopes": [
          "inventory.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Lấy chi tiết vật tư thành công",
          "data": {
            "id": 77,
            "name": "Balo Quà Tặng",
            "branches": [
              {
                "branch": "Tân Bình",
                "stock": 150
              },
              {
                "branch": "Quận 1",
                "stock": 100
              }
            ]
          },
          "timestamp": "2026-10-08T11:28:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi vật tư không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu vật tư theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "inventory-items-create",
        "method": "POST",
        "path": "/api/v1/inventory/items",
        "title": "Thêm Mới Mặt Hàng / Vật Tư Vào Danh Mục",
        "description": "Khai báo mã hàng hóa mới, giá vốn dự kiến và ngưỡng cảnh báo hết hàng.",
        "category": "inventory",
        "authRequired": true,
        "rateLimit": "30 requests / phút",
        "scopes": [
          "inventory.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "sku",
            "type": "string",
            "required": true,
            "desc": "Mã SKU quản lý duy nhất"
          },
          {
            "name": "name",
            "type": "string",
            "required": true,
            "desc": "Tên mặt hàng/vật tư"
          },
          {
            "name": "unit",
            "type": "string",
            "required": true,
            "desc": "Đơn vị tính (Chiếc, Quyển, Bộ)"
          },
          {
            "name": "min_stock",
            "type": "integer",
            "required": false,
            "default": "10",
            "desc": "Ngưỡng tồn kho tối thiểu cảnh báo"
          }
        ],
        "sampleBody": {
          "sku": "GT-BBA-QTKD-01",
          "name": "Giáo Trình Quản Trị Học Căn Bản 2026",
          "unit": "Quyển",
          "min_stock": 30
        },
        "sampleResponse": {
          "success": true,
          "code": 201,
          "message": "Thêm mặt hàng mới thành công",
          "data": {
            "id": 78,
            "sku": "GT-BBA-QTKD-01"
          },
          "timestamp": "2026-10-08T11:29:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi vật tư không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu vật tư theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "inventory-items-update",
        "method": "PUT",
        "path": "/api/v1/inventory/items/:id",
        "title": "Cập Nhật Thông Tin Mặt Hàng",
        "description": "Hiệu chỉnh tên sản phẩm, giá vốn hoặc ngưỡng tồn kho tối thiểu.",
        "category": "inventory",
        "authRequired": true,
        "rateLimit": "30 requests / phút",
        "scopes": [
          "inventory.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "name",
            "type": "string",
            "required": false,
            "desc": "Tên cập nhật"
          },
          {
            "name": "min_stock",
            "type": "integer",
            "required": false,
            "desc": "Ngưỡng cảnh báo tồn mới"
          }
        ],
        "sampleBody": {
          "min_stock": 50
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Cập nhật mặt hàng thành công",
          "data": {
            "id": 77,
            "min_stock": 50
          },
          "timestamp": "2026-10-08T11:30:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi vật tư không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu vật tư theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "inventory-items-delete",
        "method": "DELETE",
        "path": "/api/v1/inventory/items/:id",
        "title": "Xóa Hoặc Ngừng Sử Dụng Mặt Hàng",
        "description": "Xóa mặt hàng khỏi danh mục khi không còn sử dụng và tồn kho bằng 0.",
        "category": "inventory",
        "authRequired": true,
        "rateLimit": "20 requests / phút",
        "scopes": [
          "inventory.delete"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Đã ngừng sử dụng mặt hàng thành công",
          "data": {
            "id": 78,
            "status": "inactive"
          },
          "timestamp": "2026-10-08T11:31:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi vật tư không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu vật tư theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "inventory-stock-in",
        "method": "POST",
        "path": "/api/v1/inventory/stock-in",
        "title": "Lập Phiếu Nhập Kho Hàng Hóa / Vật Tư (Stock In)",
        "description": "Ghi nhận phiếu nhập hàng hóa từ nhà cung cấp về kho cơ sở và tự động tăng số lượng tồn.",
        "category": "inventory",
        "authRequired": true,
        "rateLimit": "30 requests / phút",
        "scopes": [
          "inventory.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "item_id",
            "type": "integer",
            "required": true,
            "desc": "ID mặt hàng nhập kho"
          },
          {
            "name": "quantity",
            "type": "integer",
            "required": true,
            "desc": "Số lượng nhập"
          },
          {
            "name": "unit_cost",
            "type": "number",
            "required": true,
            "desc": "Đơn giá nhập (VNĐ)"
          },
          {
            "name": "branch_id",
            "type": "integer",
            "required": true,
            "desc": "Kho cơ sở tiếp nhận"
          }
        ],
        "sampleBody": {
          "item_id": 77,
          "quantity": 100,
          "unit_cost": 175000,
          "branch_id": 2
        },
        "sampleResponse": {
          "success": true,
          "code": 201,
          "message": "Lập phiếu nhập kho thành công",
          "data": {
            "receipt_code": "NK-2026-0045",
            "new_stock": 350
          },
          "timestamp": "2026-10-08T11:32:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi vật tư không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu vật tư theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "inventory-stock-out",
        "method": "POST",
        "path": "/api/v1/inventory/stock-out",
        "title": "Lập Phiếu Xuất Kho Cấp Phát Cho Học Viên (Stock Out)",
        "description": "Xuất quà tặng, balo hoặc giáo trình cấp phát cho học viên mới nhập học.",
        "category": "inventory",
        "authRequired": true,
        "rateLimit": "30 requests / phút",
        "scopes": [
          "inventory.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "item_id",
            "type": "integer",
            "required": true,
            "desc": "ID mặt hàng xuất"
          },
          {
            "name": "quantity",
            "type": "integer",
            "required": true,
            "desc": "Số lượng xuất"
          },
          {
            "name": "recipient_name",
            "type": "string",
            "required": true,
            "desc": "Tên người nhận (học viên/nhân viên)"
          },
          {
            "name": "reason",
            "type": "string",
            "required": true,
            "desc": "Mục đích xuất cấp phát"
          }
        ],
        "sampleBody": {
          "item_id": 77,
          "quantity": 1,
          "recipient_name": "Trần Thị Mai Phương",
          "reason": "Cấp phát quà tặng tân học viên nhập học"
        },
        "sampleResponse": {
          "success": true,
          "code": 201,
          "message": "Lập phiếu xuất kho thành công",
          "data": {
            "slip_code": "XK-2026-0129",
            "remaining_stock": 349
          },
          "timestamp": "2026-10-08T11:33:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi vật tư không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu vật tư theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "INSUFFICIENT_STOCK",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "inventory-transactions-list",
        "method": "GET",
        "path": "/api/v1/inventory/transactions",
        "title": "Tra Cứu Lịch Sử Thẻ Kho Biến Động Nhập - Xuất - Tồn",
        "description": "Xem chi tiết nhật ký mọi biến động xuất nhập tồn của từng mặt hàng để phục vụ kiểm kê đối soát.",
        "category": "inventory",
        "authRequired": true,
        "rateLimit": "100 requests / phút",
        "scopes": [
          "inventory.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [
          {
            "name": "item_id",
            "type": "integer",
            "required": false,
            "desc": "Lọc theo mặt hàng"
          }
        ],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Lấy nhật ký thẻ kho thành công",
          "data": [
            {
              "id": 501,
              "item_sku": "VT-BALO-IDEAS-01",
              "type": "out",
              "quantity": 1,
              "balance_after": 349,
              "created_at": "2026-10-08 11:33:00"
            }
          ],
          "timestamp": "2026-10-08T11:34:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "pos",
    "title": "21. Điểm Bán Hàng & Thu Ngân Trực Tiếp (Point of Sale - POS)",
    "iconName": "ShoppingBag",
    "description": "Phân hệ thu ngân tại quầy: mở ca thu tiền, quét mã vạch bán giáo trình, thu cọc tại chỗ bằng quẹt thẻ POS/tiền mặt và chốt két kết ca.",
    "endpoints": [
      {
        "id": "pos-sessions-list",
        "method": "GET",
        "path": "/api/v1/pos/sessions",
        "title": "Truy Vấn Danh Sách Phiên Ca Thu Ngân POS",
        "description": "Lấy danh sách các ca mở bán hàng tại quầy lễ tân chi nhánh và doanh thu thu được theo ca.",
        "category": "pos",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "pos.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Lấy danh sách phiên thu ngân thành công",
          "data": [
            {
              "id": 12,
              "cashier_name": "Lê Thị Hồng",
              "branch_name": "Cơ sở Tân Bình",
              "opened_at": "2026-10-08 08:00:00",
              "opening_cash": 2000000,
              "status": "open"
            }
          ],
          "timestamp": "2026-10-08T11:35:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "pos-sessions-detail",
        "method": "GET",
        "path": "/api/v1/pos/sessions/:id",
        "title": "Chi Tiết Ca Thu Ngân & Danh Sách Hóa Đơn Trong Ca",
        "description": "Xem chi tiết tiền mặt đầu ca, tổng tiền quẹt thẻ POS, chuyển khoản và danh sách các hóa đơn phát sinh.",
        "category": "pos",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "pos.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Truy vấn chi tiết ca bán hàng thành công",
          "data": {
            "id": 12,
            "total_sales": 15400000,
            "orders_count": 8
          },
          "timestamp": "2026-10-08T11:36:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi phiên thu ngân không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu phiên thu ngân theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "pos-sessions-open",
        "method": "POST",
        "path": "/api/v1/pos/sessions/open",
        "title": "Mở Ca Thu Ngân POS Mới Đầu Ngày",
        "description": "Thu ngân khai báo số tiền mặt lẻ đầu ca trong két để bắt đầu bán hàng và thu cọc.",
        "category": "pos",
        "authRequired": true,
        "rateLimit": "10 requests / phút",
        "scopes": [
          "pos.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "branch_id",
            "type": "integer",
            "required": true,
            "desc": "ID chi nhánh mở quầy"
          },
          {
            "name": "opening_cash",
            "type": "number",
            "required": true,
            "desc": "Số tiền mặt ban đầu trong két (VNĐ)"
          }
        ],
        "sampleBody": {
          "branch_id": 2,
          "opening_cash": 2000000
        },
        "sampleResponse": {
          "success": true,
          "code": 201,
          "message": "Mở ca thu ngân thành công",
          "data": {
            "session_id": 13,
            "status": "open"
          },
          "timestamp": "2026-10-08T11:37:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi phiên thu ngân không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu phiên thu ngân theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "pos-create-order",
        "method": "POST",
        "path": "/api/v1/pos/orders",
        "title": "Tạo Đơn Bán Hàng Trực Tiếp Tại Quầy & Thanh Toán",
        "description": "Thu tiền học phí, bán giáo trình hoặc thu cọc trực tiếp tại quầy lễ tân, in hóa đơn nhiệt tức thì.",
        "category": "pos",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "pos.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "session_id",
            "type": "integer",
            "required": true,
            "desc": "ID ca thu ngân đang mở"
          },
          {
            "name": "contact_id",
            "type": "integer",
            "required": false,
            "desc": "ID học viên (nếu có)"
          },
          {
            "name": "items",
            "type": "array",
            "required": true,
            "desc": "Danh sách mặt hàng: [{ item_id, quantity, price }]"
          },
          {
            "name": "payment_method",
            "type": "string",
            "required": true,
            "desc": "'cash', 'card_pos', 'qr_transfer'"
          }
        ],
        "sampleBody": {
          "session_id": 12,
          "contact_id": 5012,
          "items": [
            {
              "item_id": 78,
              "quantity": 2,
              "price": 150000
            }
          ],
          "payment_method": "qr_transfer"
        },
        "sampleResponse": {
          "success": true,
          "code": 201,
          "message": "Thanh toán hóa đơn POS thành công",
          "data": {
            "order_id": 612,
            "order_code": "POS-2026-0044",
            "total_amount": 300000,
            "status": "completed"
          },
          "timestamp": "2026-10-08T11:38:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi đơn POS không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu đơn POS theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "pos-orders-detail",
        "method": "GET",
        "path": "/api/v1/pos/orders/:id",
        "title": "Chi Tiết Hóa Đơn Bán Lẻ POS",
        "description": "Xem chi tiết các mặt hàng đã mua trên hóa đơn và phương thức thanh toán.",
        "category": "pos",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "pos.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Truy vấn hóa đơn POS thành công",
          "data": {
            "id": 612,
            "order_code": "POS-2026-0044",
            "total_amount": 300000
          },
          "timestamp": "2026-10-08T11:39:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi hóa đơn POS không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu hóa đơn POS theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "pos-orders-delete",
        "method": "DELETE",
        "path": "/api/v1/pos/orders/:id",
        "title": "Hủy Hóa Đơn POS & Hoàn Lại Tồn Kho",
        "description": "Hủy giao dịch tại quầy khi khách trả lại hàng hoặc thu ngân nhập nhầm.",
        "category": "pos",
        "authRequired": true,
        "rateLimit": "20 requests / phút",
        "scopes": [
          "pos.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Đã hủy hóa đơn POS và hoàn trả tồn kho",
          "data": {
            "id": 612,
            "status": "void"
          },
          "timestamp": "2026-10-08T11:40:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi hóa đơn POS không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu hóa đơn POS theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "pos-sessions-close",
        "method": "POST",
        "path": "/api/v1/pos/sessions/:id/close",
        "title": "Kết Thúc Ca Thu Ngân & Chốt Két Tiền Cuối Ngày",
        "description": "Kiểm đếm tiền mặt thực tế trong két, đối soát chênh lệch và bàn giao cho quản lý chi nhánh.",
        "category": "pos",
        "authRequired": true,
        "rateLimit": "10 requests / phút",
        "scopes": [
          "pos.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "closing_cash",
            "type": "number",
            "required": true,
            "desc": "Số tiền mặt thực tế kiểm đếm trong két (VNĐ)"
          },
          {
            "name": "note",
            "type": "string",
            "required": false,
            "desc": "Ghi chú bàn giao ca"
          }
        ],
        "sampleBody": {
          "closing_cash": 17400000,
          "note": "Khớp số liệu đầy đủ"
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Đóng ca thu ngân thành công. Báo cáo ca đã được gửi tới Kế toán.",
          "data": {
            "session_id": 12,
            "status": "closed",
            "closed_at": "2026-10-08 17:30:00"
          },
          "timestamp": "2026-10-08T11:41:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi phiên thu ngân không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu phiên thu ngân theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "hrm-assets",
    "title": "22. Quản Lý Tài Sản & Bàn Giao Thiết Bị (Asset Management)",
    "iconName": "HardDrive",
    "description": "Quản trị cơ sở vật chất, máy móc, laptop, máy chiếu phòng học: cấp phát bàn giao cho nhân viên, theo dõi khấu hao và thu hồi tài sản.",
    "endpoints": [
      {
        "id": "assets-list",
        "method": "GET",
        "path": "/api/v1/hrm/assets",
        "title": "Truy Vấn Danh Mục Trang Thiết Bị & Tài Sản Doanh Nghiệp",
        "description": "Lấy danh mục tài sản, trang thiết bị theo chi nhánh, trạng thái sử dụng (đang rảnh, đã bàn giao, đang sửa chữa).",
        "category": "hrm-assets",
        "authRequired": true,
        "rateLimit": "100 requests / phút",
        "scopes": [
          "assets.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [
          {
            "name": "status",
            "type": "string",
            "required": false,
            "desc": "'available', 'assigned', 'maintenance', 'disposed'"
          }
        ],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Lấy danh mục tài sản thành công",
          "data": [
            {
              "id": 102,
              "asset_code": "TS-LAPTOP-0012",
              "name": "Laptop Dell Latitude 5440",
              "assigned_to_name": "Nguyễn Thị Lan",
              "status": "assigned",
              "purchase_date": "2025-06-10"
            }
          ],
          "timestamp": "2026-10-08T11:42:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "assets-detail",
        "method": "GET",
        "path": "/api/v1/hrm/assets/:id",
        "title": "Chi Tiết Tài Sản, Số Serial & Lịch Sử Bàn Giao",
        "description": "Xem chi tiết số Serial, cấu hình phần cứng, nguyên giá mua, giá trị còn lại và toàn bộ lịch sử qua tay các nhân viên.",
        "category": "hrm-assets",
        "authRequired": true,
        "rateLimit": "100 requests / phút",
        "scopes": [
          "assets.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Truy vấn chi tiết tài sản thành công",
          "data": {
            "id": 102,
            "serial_number": "DL5440-998821",
            "original_price": 22000000,
            "current_value": 17500000
          },
          "timestamp": "2026-10-08T11:43:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi tài sản không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu tài sản theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "assets-create",
        "method": "POST",
        "path": "/api/v1/hrm/assets",
        "title": "Khai Báo Tài Sản Mới Mua Vào Hệ Thống",
        "description": "Thêm mới tài sản cố định, dán mã QR/Barcode quản lý.",
        "category": "hrm-assets",
        "authRequired": true,
        "rateLimit": "30 requests / phút",
        "scopes": [
          "assets.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "name",
            "type": "string",
            "required": true,
            "desc": "Tên tài sản/thiết bị"
          },
          {
            "name": "serial_number",
            "type": "string",
            "required": true,
            "desc": "Số Serial nhà sản xuất"
          },
          {
            "name": "price",
            "type": "number",
            "required": true,
            "desc": "Nguyên giá mua vào (VNĐ)"
          },
          {
            "name": "branch_id",
            "type": "integer",
            "required": true,
            "desc": "Cơ sở bố trí tài sản"
          }
        ],
        "sampleBody": {
          "name": "Máy chiếu Epson EB-E01",
          "serial_number": "EP-EB-881290",
          "price": 11500000,
          "branch_id": 2
        },
        "sampleResponse": {
          "success": true,
          "code": 201,
          "message": "Thêm tài sản mới thành công",
          "data": {
            "id": 103,
            "asset_code": "TS-PROJ-0005"
          },
          "timestamp": "2026-10-08T11:44:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi tài sản không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu tài sản theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "assets-update",
        "method": "PUT",
        "path": "/api/v1/hrm/assets/:id",
        "title": "Cập Nhật Thông Tin & Trạng Thái Kỹ Thuật Của Tài Sản",
        "description": "Cập nhật tình trạng hao mòn, ghi chú bảo dưỡng định kỳ.",
        "category": "hrm-assets",
        "authRequired": true,
        "rateLimit": "30 requests / phút",
        "scopes": [
          "assets.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "status",
            "type": "string",
            "required": false,
            "desc": "'available', 'assigned', 'maintenance', 'disposed'"
          },
          {
            "name": "note",
            "type": "string",
            "required": false,
            "desc": "Ghi chú bảo trì"
          }
        ],
        "sampleBody": {
          "status": "maintenance",
          "note": "Thay bóng đèn máy chiếu phòng 301"
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Cập nhật trạng thái tài sản thành công",
          "data": {
            "id": 103,
            "status": "maintenance"
          },
          "timestamp": "2026-10-08T11:45:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi tài sản không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu tài sản theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "assets-delete",
        "method": "DELETE",
        "path": "/api/v1/hrm/assets/:id",
        "title": "Thanh Lý & Hủy Tài Sản Khỏi Hệ Thống",
        "description": "Thanh lý tài sản hư hỏng không thể sửa chữa hoặc hết hạn khấu hao.",
        "category": "hrm-assets",
        "authRequired": true,
        "rateLimit": "20 requests / phút",
        "scopes": [
          "assets.delete"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Đã thanh lý tài sản thành công",
          "data": {
            "id": 103,
            "status": "disposed"
          },
          "timestamp": "2026-10-08T11:46:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi tài sản không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu tài sản theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "assets-handover",
        "method": "POST",
        "path": "/api/v1/hrm/assets/:id/handover",
        "title": "Lập Biên Bản Bàn Giao Thiết Bị Cho Nhân Viên Mới",
        "description": "Bàn giao laptop, điện thoại công ty cho nhân viên khi nhận việc kèm biên bản điện tử.",
        "category": "hrm-assets",
        "authRequired": true,
        "rateLimit": "30 requests / phút",
        "scopes": [
          "assets.manage"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "assigned_to",
            "type": "integer",
            "required": true,
            "desc": "ID nhân viên tiếp nhận sử dụng"
          },
          {
            "name": "condition",
            "type": "string",
            "required": true,
            "desc": "Tình trạng thiết bị lúc bàn giao"
          }
        ],
        "sampleBody": {
          "assigned_to": 1042,
          "condition": "Máy mới 99%, hoạt động tốt, kèm sạc và chuột"
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Bàn giao tài sản thành công",
          "data": {
            "id": 102,
            "status": "assigned",
            "assigned_to": 1042
          },
          "timestamp": "2026-10-08T11:47:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi tài sản không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu tài sản theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "assets-recall",
        "method": "POST",
        "path": "/api/v1/hrm/assets/:id/recall",
        "title": "Thu Hồi Tài Sản Khi Nhân Viên Nghỉ Việc Hoặc Đổi Thiết Bị",
        "description": "Lập biên bản thu hồi thiết bị về kho tài sản dùng chung.",
        "category": "hrm-assets",
        "authRequired": true,
        "rateLimit": "30 requests / phút",
        "scopes": [
          "assets.manage"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "reason",
            "type": "string",
            "required": true,
            "desc": "Lý do thu hồi thiết bị"
          }
        ],
        "sampleBody": {
          "reason": "Nhân viên nghỉ việc bàn giao lại tài sản"
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Thu hồi tài sản về kho thành công",
          "data": {
            "id": 102,
            "status": "available",
            "assigned_to": null
          },
          "timestamp": "2026-10-08T11:48:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi tài sản không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu tài sản theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "custom-fields",
    "title": "23. Trường Tùy Chỉnh & Siêu Dữ Liệu Thực Thể (Custom Fields Metadata)",
    "iconName": "Sliders",
    "description": "Mở rộng mô hình dữ liệu động: thêm các trường thông tin tùy biến cho Khách hàng, Cơ hội, Hóa đơn (text, number, select, date) mà không cần can thiệp cấu trúc bảng CSDL.",
    "endpoints": [
      {
        "id": "custom-fields-list",
        "method": "GET",
        "path": "/api/v1/custom-fields",
        "title": "Truy Vấn Danh Mục Trường Tùy Biến Của Thực Thể",
        "description": "Lấy danh sách các trường tùy biến được định nghĩa cho module 'contacts', 'deals', 'tickets'.",
        "category": "custom-fields",
        "authRequired": true,
        "rateLimit": "100 requests / phút",
        "scopes": [
          "custom_fields.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [
          {
            "name": "entity_type",
            "type": "string",
            "required": false,
            "desc": "'contacts', 'deals', 'orders'"
          }
        ],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Lấy danh mục trường tùy biến thành công",
          "data": [
            {
              "id": 18,
              "entity_type": "contacts",
              "field_key": "ielts_score",
              "field_label": "Điểm IELTS Đã Có",
              "field_type": "number",
              "is_required": false
            }
          ],
          "timestamp": "2026-10-08T11:49:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "custom-fields-detail",
        "method": "GET",
        "path": "/api/v1/custom-fields/:id",
        "title": "Chi Tiết Định Nghĩa Trường Tùy Biến & Danh Sách Lựa Chọn (Options)",
        "description": "Xem chi tiết kiểu dữ liệu, các giá trị trong danh sách thả xuống (Select Options) và quy tắc kiểm tra tính hợp lệ.",
        "category": "custom-fields",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "custom_fields.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Truy vấn chi tiết trường tùy biến thành công",
          "data": {
            "id": 18,
            "field_key": "ielts_score",
            "options": []
          },
          "timestamp": "2026-10-08T11:50:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi trường tùy biến không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu trường tùy biến theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "custom-fields-create",
        "method": "POST",
        "path": "/api/v1/custom-fields",
        "title": "Tạo Mới Trường Tùy Biến Cho Thực Thể",
        "description": "Thêm trường dữ liệu nghiệp vụ mới phục vụ chiến dịch tuyển sinh.",
        "category": "custom-fields",
        "authRequired": true,
        "rateLimit": "20 requests / phút",
        "scopes": [
          "custom_fields.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "entity_type",
            "type": "string",
            "required": true,
            "desc": "'contacts', 'deals', 'orders'"
          },
          {
            "name": "field_key",
            "type": "string",
            "required": true,
            "desc": "Mã khóa trường viết thường không dấu (vd: ielts_score)"
          },
          {
            "name": "field_label",
            "type": "string",
            "required": true,
            "desc": "Tên nhãn hiển thị trên giao diện"
          },
          {
            "name": "field_type",
            "type": "string",
            "required": true,
            "desc": "'text', 'number', 'select', 'date', 'checkbox'"
          }
        ],
        "sampleBody": {
          "entity_type": "contacts",
          "field_key": "target_major",
          "field_label": "Ngành Học Nguyện Vọng 1",
          "field_type": "select"
        },
        "sampleResponse": {
          "success": true,
          "code": 201,
          "message": "Tạo trường tùy biến thành công",
          "data": {
            "id": 19,
            "field_key": "target_major"
          },
          "timestamp": "2026-10-08T11:51:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi trường tùy biến không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu trường tùy biến theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "custom-fields-update",
        "method": "PUT",
        "path": "/api/v1/custom-fields/:id",
        "title": "Cập Nhật Nhãn Hiển Thị & Thứ Tự Sắp Xếp Trường",
        "description": "Đổi tên nhãn hiển thị hoặc thứ tự sắp xếp trên biểu mẫu nhập liệu.",
        "category": "custom-fields",
        "authRequired": true,
        "rateLimit": "30 requests / phút",
        "scopes": [
          "custom_fields.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "field_label",
            "type": "string",
            "required": false,
            "desc": "Nhãn mới"
          },
          {
            "name": "sort_order",
            "type": "integer",
            "required": false,
            "desc": "Thứ tự sắp xếp"
          }
        ],
        "sampleBody": {
          "field_label": "Chuyên Ngành Dự Tuyển Ưu Tiên"
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Cập nhật trường tùy biến thành công",
          "data": {
            "id": 19,
            "field_label": "Chuyên Ngành Dự Tuyển Ưu Tiên"
          },
          "timestamp": "2026-10-08T11:52:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi trường tùy biến không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu trường tùy biến theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "custom-fields-delete",
        "method": "DELETE",
        "path": "/api/v1/custom-fields/:id",
        "title": "Xóa Trường Tùy Biến Khỏi Hệ Thống",
        "description": "Gỡ bỏ trường tùy biến và siêu dữ liệu gắn với thực thể.",
        "category": "custom-fields",
        "authRequired": true,
        "rateLimit": "20 requests / phút",
        "scopes": [
          "custom_fields.delete"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Xóa trường tùy biến thành công",
          "data": {
            "id": 19,
            "status": "deleted"
          },
          "timestamp": "2026-10-08T11:53:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi trường tùy biến không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu trường tùy biến theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "crons",
    "title": "24. Tác Vụ Định Kỳ & Tự Động Hóa Vận Hành (Crons & Automation)",
    "iconName": "RotateCw",
    "description": "Điều phối các tiến trình nền tự động: quét đồng bộ Google Sheets định kỳ 10 phút, gửi email cảnh báo SLA, tự động khóa bảng công và sao lưu dữ liệu ban đêm.",
    "endpoints": [
      {
        "id": "crons-list",
        "method": "GET",
        "path": "/api/v1/crons",
        "title": "Truy Vấn Danh Sách Các Tác Vụ Định Kỳ (Cron Jobs)",
        "description": "Lấy danh sách các tiến trình chạy ngầm, lịch trình Cron Expression, thời điểm chạy gần nhất và trạng thái (healthy/failing).",
        "category": "crons",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "crons.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Lấy danh sách tác vụ cron thành công",
          "data": [
            {
              "id": 1,
              "task_name": "Google Sheets Lead Sync Worker",
              "cron_expression": "*/10 * * * *",
              "last_run": "2026-10-08 11:40:00",
              "status": "success",
              "duration_seconds": 3.4
            }
          ],
          "timestamp": "2026-10-08T11:54:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "crons-logs-list",
        "method": "GET",
        "path": "/api/v1/crons/:id/logs",
        "title": "Tra Cứu Lịch Sử & Nhật Ký Thực Thi Của Cron Job",
        "description": "Xem chi tiết nhật ký log từng lần chạy, thời gian thực thi (milliseconds), số bản ghi được xử lý và thông báo lỗi (nếu có).",
        "category": "crons",
        "authRequired": true,
        "rateLimit": "60 requests / phút",
        "scopes": [
          "crons.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Lấy nhật ký cron thành công",
          "data": [
            {
              "run_id": 8812,
              "executed_at": "2026-10-08 11:40:00",
              "exit_code": 0,
              "output": "Imported 12 rows successfully"
            }
          ],
          "timestamp": "2026-10-08T11:55:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi tác vụ cron không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu tác vụ cron theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "crons-academic-trigger",
        "method": "POST",
        "path": "/api/v1/crons/:id/run",
        "title": "Kích Hoạt Chạy Ngay Lập Tức Tác Vụ Định Kỳ (Force Trigger)",
        "description": "Lập trình viên hoặc Quản trị viên kích hoạt chạy ngay một cron job mà không cần đợi đến khung giờ lịch trình.",
        "category": "crons",
        "authRequired": true,
        "rateLimit": "10 requests / phút",
        "scopes": [
          "crons.manage"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Đã kích hoạt tiến trình chạy thành công",
          "data": {
            "task_id": 1,
            "task_name": "Google Sheets Lead Sync Worker",
            "status": "running"
          },
          "timestamp": "2026-10-08T11:56:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi tác vụ cron không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu tác vụ cron theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "crons-update-schedule",
        "method": "PUT",
        "path": "/api/v1/crons/:id/schedule",
        "title": "Điều Chỉnh Lịch Trình Tần Suất Cron (Cron Expression)",
        "description": "Thay đổi tần suất chạy (ví dụ từ 10 phút sang 5 phút một lần hoặc chạy vào lúc 02:00 sáng).",
        "category": "crons",
        "authRequired": true,
        "rateLimit": "10 requests / phút",
        "scopes": [
          "crons.manage"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "cron_expression",
            "type": "string",
            "required": true,
            "desc": "Chuỗi biểu thức cron 5 trường (vd: '*/5 * * * *')"
          }
        ],
        "sampleBody": {
          "cron_expression": "*/5 * * * *"
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Cập nhật lịch trình cron thành công",
          "data": {
            "id": 1,
            "cron_expression": "*/5 * * * *"
          },
          "timestamp": "2026-10-08T11:57:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi tác vụ cron không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu tác vụ cron theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "crons-logs-delete",
        "method": "DELETE",
        "path": "/api/v1/crons/:id/logs",
        "title": "Dọn Dẹp & Làm Sạch Nhật Ký Log Cron Cũ",
        "description": "Giải phóng dung lượng database bằng cách xóa các bản ghi log cron thực thi cũ hơn 30 ngày.",
        "category": "crons",
        "authRequired": true,
        "rateLimit": "10 requests / phút",
        "scopes": [
          "crons.manage"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Đã làm sạch nhật ký log cron cũ",
          "data": {
            "deleted_rows": 1420
          },
          "timestamp": "2026-10-08T11:58:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi tác vụ cron không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu tác vụ cron theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      }
    ]
  },
  {
    "id": "presence",
    "title": "25. Giám Sát Trạng Thái & Realtime Ping (Presence & Socket)",
    "iconName": "Radio",
    "description": "Giám sát trạng thái hoạt động trực tuyến thời gian thực: nhịp tim kết nối (Heartbeat Ping), danh sách nhân viên đang online theo cơ sở và phát sóng thông báo khẩn cấp.",
    "endpoints": [
      {
        "id": "presence-online-users",
        "method": "GET",
        "path": "/api/v1/presence/online-users",
        "title": "Truy Vấn Danh Sách Nhân Sự Đang Trực Tuyến Thời Gian Thực",
        "description": "Lấy danh sách các tài khoản nhân viên đang online trên hệ thống, phân loại theo cơ sở chi nhánh và phòng ban.",
        "category": "presence",
        "authRequired": true,
        "rateLimit": "120 requests / phút",
        "scopes": [
          "presence.read"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [
          {
            "name": "branch_id",
            "type": "integer",
            "required": false,
            "desc": "Lọc theo chi nhánh"
          }
        ],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Lấy danh sách nhân sự trực tuyến thành công",
          "data": [
            {
              "user_id": 1042,
              "full_name": "Nguyễn Thị Lan",
              "role": "sale",
              "branch_name": "Tân Bình",
              "last_active_at": "2026-10-08 11:58:45",
              "device": "Chrome Windows"
            }
          ],
          "timestamp": "2026-10-08T11:59:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "presence-ping",
        "method": "POST",
        "path": "/api/v1/presence/ping",
        "title": "Gửi Nhịp Tim Duy Trì Trạng Thái Trực Tuyến (Heartbeat Ping)",
        "description": "Client định kỳ gửi tín hiệu mỗi 30 giây để xác nhận phiên làm việc còn hoạt động và nhận về các thông báo khẩn từ hệ thống.",
        "category": "presence",
        "authRequired": true,
        "rateLimit": "200 requests / phút",
        "scopes": [
          "presence.write"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "current_route",
            "type": "string",
            "required": false,
            "desc": "Màn hình người dùng đang mở (vd: /contacts)"
          }
        ],
        "sampleBody": {
          "current_route": "/contacts"
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Heartbeat ghi nhận thành công",
          "data": {
            "status": "online",
            "unread_notifications": 3,
            "server_time": "2026-10-08T11:59:30Z"
          },
          "timestamp": "2026-10-08T11:59:30Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "presence-broadcast",
        "method": "POST",
        "path": "/api/v1/presence/broadcast",
        "title": "Phát Sóng Thông Báo Khẩn Cấp Toàn Màn Hình (Emergency Broadcast)",
        "description": "Admin gửi thông báo khẩn cấp (thông báo bảo trì hệ thống, lịch họp đột xuất) hiển thị tức thì trên màn hình tất cả người dùng đang online.",
        "category": "presence",
        "authRequired": true,
        "rateLimit": "10 requests / phút",
        "scopes": [
          "presence.admin"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>",
          "Content-Type": "application/json"
        },
        "queryParams": [],
        "bodyParams": [
          {
            "name": "title",
            "type": "string",
            "required": true,
            "desc": "Tiêu đề thông báo khẩn"
          },
          {
            "name": "message",
            "type": "string",
            "required": true,
            "desc": "Nội dung cảnh báo"
          },
          {
            "name": "level",
            "type": "string",
            "required": false,
            "default": "info",
            "desc": "'info', 'warning', 'critical'"
          }
        ],
        "sampleBody": {
          "title": "Bảo trì cập nhật tính năng mới lúc 12:30",
          "message": "Hệ thống sẽ cập nhật trong 10 phút. Vui lòng lưu lại dữ liệu đang làm dở.",
          "level": "warning"
        },
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Phát sóng thông báo khẩn cấp thành công",
          "data": {
            "recipients_count": 48
          },
          "timestamp": "2026-10-08T12:00:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      },
      {
        "id": "presence-force-logout",
        "method": "DELETE",
        "path": "/api/v1/presence/force-logout/:user_id",
        "title": "Buộc Đăng Xuất Tài Khoản Từ Xa (Admin Kill Session)",
        "description": "Quản trị viên ngắt phiên làm việc của tài khoản nghi ngờ bị xâm nhập hoặc nhân viên vi phạm kỷ luật bảo mật.",
        "category": "presence",
        "authRequired": true,
        "rateLimit": "20 requests / phút",
        "scopes": [
          "presence.admin"
        ],
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        },
        "queryParams": [],
        "bodyParams": [],
        "sampleResponse": {
          "success": true,
          "code": 200,
          "message": "Đã ngắt phiên đăng nhập của người dùng thành công",
          "data": {
            "user_id": 1055,
            "status": "terminated"
          },
          "timestamp": "2026-10-08T12:01:00Z"
        },
        "errorResponses": [
          {
            "status": 401,
            "title": "401 Unauthorized",
            "desc": "Thiếu Bearer Token hoặc Token đã hết hạn / không hợp lệ.",
            "response": {
              "success": false,
              "code": 401,
              "error": "UNAUTHORIZED",
              "message": "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 403,
            "title": "403 Forbidden",
            "desc": "Tài khoản không đủ quyền hạn RBAC hoặc truy cập ngoài phạm vi chi nhánh.",
            "response": {
              "success": false,
              "code": 403,
              "error": "FORBIDDEN_SCOPE",
              "message": "Bạn không có quyền thực hiện thao tác này trên tài nguyên được chỉ định.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 404,
            "title": "404 Not Found",
            "desc": "Bản ghi phiên người dùng không tồn tại hoặc đã bị xóa khỏi hệ thống.",
            "response": {
              "success": false,
              "code": 404,
              "error": "RESOURCE_NOT_FOUND",
              "message": "Không tìm thấy dữ liệu phiên người dùng theo mã ID cung cấp.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          },
          {
            "status": 422,
            "title": "422 Unprocessable Entity",
            "desc": "Dữ liệu payload gửi lên vi phạm quy tắc ràng buộc nghiệp vụ hoặc thiếu trường bắt buộc.",
            "response": {
              "success": false,
              "code": 422,
              "error": "VALIDATION_FAILED",
              "message": "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin gửi lên.",
              "timestamp": "2026-10-08T09:00:00Z"
            }
          }
        ]
      }
    ]
  }
];
