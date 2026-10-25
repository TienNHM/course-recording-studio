/**
 * Namespace "common": strings shared by every view (actions, statuses, units,
 * navigation). Vietnamese is the source of truth: add keys here first, then
 * the same keys in ../en/common.ts (TypeScript reports anything missing).
 */
import { plural, type Messages } from "../../types";

const common = {
  appName: "Course Recording Studio",
  appTagline: "Quay, dựng và xuất bản bài giảng",

  nav: {
    library: "Thư viện",
    record: "Quay",
    review: "Duyệt & xuất bản",
    styleguide: "Hệ thống thiết kế",
  },

  actions: {
    save: "Lưu",
    saving: "Đang lưu…",
    cancel: "Huỷ",
    close: "Đóng",
    confirm: "Xác nhận",
    delete: "Xoá",
    edit: "Sửa",
    create: "Tạo",
    add: "Thêm",
    back: "Quay lại",
    next: "Tiếp",
    retry: "Thử lại",
    refresh: "Làm mới",
    open: "Mở",
    copy: "Sao chép",
    copied: "Đã sao chép",
    download: "Tải xuống",
    upload: "Tải lên",
    search: "Tìm kiếm",
    settings: "Cài đặt",
    more: "Thêm tuỳ chọn",
  },

  state: {
    loading: "Đang tải…",
    empty: "Chưa có dữ liệu",
    error: "Đã xảy ra lỗi",
    errorWithMessage: "Đã xảy ra lỗi: {message}",
    unsavedChanges: "Có thay đổi chưa lưu",
    optional: "Không bắt buộc",
    required: "Bắt buộc",
    yes: "Có",
    no: "Không",
    on: "Bật",
    off: "Tắt",
    none: "Không có",
    unknown: "Không rõ",
  },

  /** Lesson lifecycle — keys match LessonStatus in config/course.ts. */
  lessonStatus: {
    DRAFT: "Nháp",
    READY_TO_RECORD: "Sẵn sàng quay",
    RECORDED: "Đã quay",
    PROCESSING: "Đang xử lý",
    REVIEW: "Chờ duyệt",
    PUBLISHED: "Đã xuất bản",
    ARCHIVED: "Lưu trữ",
  },

  recordingBadge: {
    live: "REC",
    paused: "Tạm dừng",
  },

  count: {
    courses: plural({ zero: "Chưa có khoá học", other: "{count} khoá học" }),
    modules: plural({ zero: "Chưa có chương", other: "{count} chương" }),
    lessons: plural({ zero: "Chưa có bài học", other: "{count} bài học" }),
    takes: plural({ zero: "Chưa có bản quay", other: "{count} bản quay" }),
    files: plural({ other: "{count} tệp" }),
    minutes: plural({ other: "{count} phút" }),
  },

  language: {
    vi: "Tiếng Việt",
    en: "Tiếng Anh",
  },
};

export default common;
export type CommonMessages = Messages<typeof common>;
