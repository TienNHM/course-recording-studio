/**
 * Namespace "settings": the Settings dialog and the design-system view.
 * Vietnamese is the source of truth; mirror every key in ../en/settings.ts.
 */
import type { Messages } from "../../types";

const settings = {
  title: "Cài đặt",
  description: "Ngôn ngữ, chế độ sáng/tối và bảng màu của giao diện.",
  openSettings: "Mở cài đặt",

  language: {
    label: "Ngôn ngữ",
    hint: "Áp dụng cho giao diện, không ảnh hưởng ngôn ngữ của khoá học.",
  },

  mode: {
    label: "Chế độ hiển thị",
    light: "Sáng",
    dark: "Tối",
    system: "Hệ thống",
    systemHint: "Theo hệ điều hành (hiện đang {mode})",
  },

  palette: {
    label: "Bảng màu",
    hint: "Màu đỏ luôn dành cho trạng thái đang quay và cảnh báo nguy hiểm.",
    selected: "Đang dùng",
    dotnet: {
      name: ".NET Course",
      description: "Tím #7C5CE0, chuyển sắc xanh",
    },
    recorder: { name: "Recorder", description: "Đỏ Remotion Recorder" },
    ocean: { name: "Ocean", description: "Xanh dương" },
    emerald: { name: "Emerald", description: "Xanh ngọc" },
    slate: { name: "Slate", description: "Trung tính, tối giản" },
  },

  viewDesignSystem: "Xem bảng màu",
  savedLocally: "Các tuỳ chọn được lưu trên trình duyệt này.",

  styleguide: {
    title: "Hệ thống thiết kế",
    description:
      "Tất cả token màu, kiểu chữ và thành phần giao diện trong mọi bảng màu và chế độ.",
    backToApp: "Về thư viện",
    sections: {
      palettes: "Bảng màu × chế độ",
      tokens: "Token màu (giao diện hiện tại)",
      typography: "Kiểu chữ",
      spacing: "Bo góc & khoảng cách",
      buttons: "Nút bấm",
      badges: "Nhãn",
      lessonStatus: "Trạng thái bài học",
      forms: "Biểu mẫu",
      feedback: "Phản hồi & tiến trình",
      surfaces: "Thẻ, hộp thoại, menu",
    },
    usePalette: "Dùng bảng màu này",
    contrast: "Độ tương phản {ratio}:1",
    sampleText: "Bài 3: Cài đặt môi trường phát triển .NET",
    sampleParagraph:
      "Ghi hình màn hình và webcam, tự động tạo phụ đề tiếng Việt rồi xuất bản lên khoá học chỉ với vài thao tác.",
    sampleCode: "dotnet new webapi -n CourseApi",
    states: {
      default: "Mặc định",
      hover: "Di chuột",
      disabled: "Vô hiệu",
      loading: "Đang tải",
      invalid: "Không hợp lệ",
    },
    demo: {
      inputPlaceholder: "Tên bài học",
      inputLabel: "Tiêu đề",
      selectPlaceholder: "Chọn chương",
      progressLabel: "Đang xuất video",
      tooltip: "Phím tắt: R để bắt đầu quay",
      dialogTitle: "Xoá bản quay?",
      dialogBody: "Bản quay này sẽ bị xoá vĩnh viễn khỏi ổ đĩa.",
      menu: "Mở menu",
      cardTitle: "Lập trình C# cơ bản",
      cardBody: "12 bài học · cập nhật 2 ngày trước",
    },
  },
};

export default settings;
export type SettingsMessages = Messages<typeof settings>;
