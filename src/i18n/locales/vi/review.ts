/**
 * Namespace "review": strings for the review & publish view (src/review/**).
 * Vietnamese is the source of truth: add keys here first, then the same keys
 * in ../en/review.ts — TypeScript reports missing/extra keys there.
 */
import { plural, type Messages } from "../../types";

const review = {
  title: "Duyệt & xuất bản",
  backToLibrary: "Thư viện",
  noLesson: "Hãy chọn một bài học trong thư viện trước.",
  openLibrary: "Mở thư viện",
  noPlan: {
    title: "Bài học chưa có kế hoạch dựng",
    description:
      "Hậu kỳ tự động chưa chạy cho bản quay đã chọn. Hãy chạy hậu kỳ trong thư viện, kế hoạch dựng sẽ xuất hiện ở đây.",
  },
  loadError: "Không tải được kế hoạch dựng: {message}",

  save: {
    saving: "Đang lưu…",
    saved: "Đã lưu mọi thay đổi",
    failed: "Lưu thất bại — đã khôi phục",
    unsaved: "Có thay đổi chưa lưu",
  },

  summary: {
    label: "Tóm tắt bài học",
    final: "Thời lượng sau dựng",
    raw: "Bản gốc {raw}",
    removed: "bớt {removed} ({percent})",
    total: "Cả video {total} (gồm mở đầu/kết thúc)",
    cuts: "Đoạn cắt",
    acceptedCuts: plural({ zero: "Chưa cắt đoạn nào", other: "{count} đoạn đã cắt" }),
    pending: plural({ zero: "Không còn gợi ý", other: "{count} gợi ý chờ duyệt" }),
    chapters: "Chương",
    chapterCount: plural({ zero: "Chưa có chương", other: "{count} chương" }),
    transcript: "Phụ đề",
    words: plural({ zero: "Chưa có từ nào", other: "{count} từ" }),
    noTranscript: "Chưa có phụ đề",
    status: "Trạng thái",
    next: {
      record: "Tiếp theo: quay bài học",
      production: "Tiếp theo: chạy hậu kỳ",
      review: "Tiếp theo: duyệt rồi xuất bản",
      render: "Tiếp theo: xuất video",
      none: "Đã hoàn tất",
      automatic: "tự động",
      rendering: "Đang xuất video…",
    },
  },

  preview: {
    label: "Xem trước",
    loading: "Đang tải bản xem trước…",
    error: "Không tạo được bản xem trước: {message}",
  },

  timeline: {
    label: "Dòng thời gian bản quay gốc",
    hint: "Nhấn vào thanh để tua; nhấn vào một đoạn gạch chéo để cắt hoặc giữ lại.",
    legend: {
      kept: "Giữ lại",
      cut: "Đã cắt",
      suggested: "Gợi ý cắt",
      chapter: "Chương",
      playhead: "Vị trí phát",
    },
    cutAccepted: "{reason} {start}–{end}: đã cắt. Nhấn để giữ lại.",
    cutSuggested: "{reason} {start}–{end}: gợi ý. Nhấn để cắt.",
    chapter: "Chương: {title} ({time})",
  },

  reason: {
    silence: "Khoảng lặng",
    marker: "Đánh dấu cắt",
    trim: "Cắt đầu/cuối",
  },

  tabs: {
    label: "Bảng chỉnh sửa",
    cuts: "Đoạn cắt",
    chapters: "Chương",
    transcript: "Phụ đề",
    settings: "Cài đặt",
    unsaved: "Chưa lưu",
  },

  cuts: {
    title: "Đoạn cắt",
    empty: "Không có đoạn cắt nào được đề xuất.",
    acceptAllSilence: "Cắt mọi khoảng lặng",
    rejectAllSilence: "Giữ mọi khoảng lặng",
    reset: "Về kế hoạch tự động",
    resetHint: "Trả mọi đoạn cắt về quyết định của hậu kỳ tự động",
    removedTotal: "Các đoạn đã chọn bị bỏ khỏi video (tổng {duration}).",
    accept: "Cắt đoạn {index}",
    stateCut: "Cắt",
    stateKeep: "Giữ",
    seek: "Xem đoạn này",
    focusedHint: "Đang chọn — nhấn A để cắt/giữ, ← → để chuyển đoạn",
  },

  chapters: {
    title: "Chương",
    empty: "Chưa có chương nào. Thêm chương tại vị trí phát.",
    addAtPlayhead: "Thêm tại vị trí phát",
    defaultTitle: "Chương {index}",
    time: "Thời điểm chương {index}",
    titleLabel: "Tên chương {index}",
    seek: "Tua tới chương",
    delete: "Xoá chương",
    save: "Lưu chương",
    discard: "Huỷ thay đổi",
    hint: "Thời điểm tính trên bản quay gốc (mm:ss). Chương được sắp xếp theo thời gian.",
    errors: {
      invalidTime: "Thời điểm không hợp lệ (dùng mm:ss)",
      emptyTitle: "Tên chương đang trống",
      duplicateTime: "Trùng thời điểm với chương khác",
      outOfRange: "Nằm ngoài bản quay",
    },
    insideCut: "Nằm trong đoạn đã cắt — sẽ chuyển tới {time}",
    insideCutDropped: "Nằm trong đoạn đã cắt ở cuối — chương sẽ bị bỏ",
    fixErrors: "Sửa các lỗi trước khi lưu",
    copyYouTube: "Chép chương cho YouTube",
    copyYouTubeHint: "Dán vào phần mô tả video YouTube (cần ít nhất 3 chương, mỗi chương ≥ 10 giây).",
    copied: "Đã chép {count} dòng",
  },

  transcript: {
    title: "Phụ đề",
    empty: "Bản quay này chưa có phụ đề. Bật phiên âm trong cài đặt bài học rồi chạy lại hậu kỳ.",
    search: "Tìm trong phụ đề",
    searchPlaceholder: "Tìm từ, câu…",
    results: plural({ zero: "Không tìm thấy", other: "{count} dòng khớp" }),
    lines: plural({ other: "{count} dòng" }),
    edit: "Sửa dòng",
    editLine: "Sửa dòng {index}",
    seekLine: "Tua tới {time}",
    saveLine: "Lưu dòng",
    cancelEdit: "Huỷ",
    editHint: "Enter để lưu, Esc để huỷ. Chỉ sửa chữ, thời gian giữ nguyên.",
    saving: "Đang lưu…",
    saved: "Đã lưu",
    lowConfidence: "Độ tin cậy thấp — nên kiểm tra",
    glossaryTerm: "Thuật ngữ: {term}",
    aliasOf: "Có thể là \"{term}\" — nhấn để sửa",
    fixAll: "Sửa {count} thuật ngữ",
    legend: {
      glossary: "Thuật ngữ",
      alias: "Có thể nhận sai",
      lowConfidence: "Độ tin cậy thấp",
    },
  },

  settings: {
    title: "Bố cục, mở đầu và kết thúc",
    layout: "Bố cục",
    screenOnly: "Chỉ màn hình",
    screenWebcam: "Màn hình + webcam",
    noWebcam: "Bản quay này không có webcam.",
    intro: "Thẻ mở đầu",
    introTitle: "Tiêu đề mở đầu",
    introSubtitle: "Phụ đề mở đầu (không bắt buộc)",
    outro: "Thẻ kết thúc",
    save: "Lưu cài đặt",
    discard: "Huỷ thay đổi",
    style: {
      title: "Phong cách video của khoá học",
      description:
        "Bảng màu, kiểu mở đầu và hiệu ứng chuyển cảnh được đặt cho cả khoá học trong Thư viện (Cài đặt khoá học), không chỉnh ở đây.",
      open: "Mở trong Thư viện",
      palette: "Bảng màu",
      intro: "Kiểu mở đầu",
      transition: "Chuyển cảnh",
      chapterCards: "Thẻ chương",
      lowerThird: "Tên bài ở góc dưới",
      backgroundMusic: "Nhạc nền",
      progressBar: "Thanh tiến độ",
      introStyle: {
        minimal: "Tối giản",
        gradient: "Chuyển sắc",
        starburst: "Toả sáng",
      },
      transitionStyle: {
        none: "Không",
        fade: "Mờ dần",
        slide: "Trượt",
        "light-leak": "Vệt sáng",
      },
    },
  },

  export: {
    approve: "Duyệt & xuất bản",
    approveHint: "Lưu kế hoạch dựng và xuất video, phụ đề, chương vào thư mục published",
    title: "Xuất bản",
    rendering: "Đang xuất video",
    production: "Đang chạy hậu kỳ",
    queued: "Đang chờ trong hàng đợi",
    eta: "Còn khoảng {time}",
    cancel: "Huỷ xuất",
    cancelling: "Đang huỷ…",
    failed: "Xuất video thất bại",
    productionFailed: "Hậu kỳ thất bại",
    cancelled: "Đã huỷ xuất video.",
    productionCancelled: "Đã huỷ hậu kỳ.",
    retry: "Xuất lại",
    success: "Đã xuất bản xong!",
    successHint: "Video và các tệp đi kèm đã nằm trong thư mục published.",
    locked: "Đang có tác vụ chạy — tạm khoá chỉnh sửa.",
  },

  jobStatus: {
    QUEUED: "Đang chờ",
    ANALYZING: "Đang phân tích",
    TRANSCRIBING: "Đang phiên âm",
    EDITING: "Đang dựng",
    RENDERING: "Đang xuất",
    COMPLETED: "Hoàn tất",
    FAILED: "Thất bại",
    CANCELLED: "Đã huỷ",
  },

  published: {
    title: "Tệp đã xuất bản",
    empty: "Chưa có tệp nào được xuất.",
    thumbnail: "Ảnh thu nhỏ",
    play: "Xem video",
    openInTab: "Mở trong tab mới",
    download: "Tải {name}",
    copyPath: "Chép đường dẫn",
    pathCopied: "Đã chép đường dẫn",
    files: {
      mp4: "Video (MP4)",
      srt: "Phụ đề (SRT)",
      vtt: "Phụ đề (VTT)",
      chapters: "Chương (JSON)",
      transcript: "Bản ghi lời (Markdown)",
      thumbnail: "Ảnh thu nhỏ (JPG)",
    },
    copyYouTube: "Chép chương cho YouTube",
    copyFailed: "Không chép được vào bộ nhớ tạm",
    videoTitle: "Video đã xuất",
  },

  shortcuts: {
    button: "Phím tắt",
    title: "Phím tắt",
    playPause: "Phát / tạm dừng",
    back: "Lùi 5 giây",
    forward: "Tới 5 giây",
    toggleCut: "Cắt / giữ đoạn đang chọn",
    prevNext: "Đoạn cắt trước / sau",
    help: "Hiện phím tắt",
  },

  unsaved: {
    title: "Bỏ các thay đổi chưa lưu?",
    description:
      "Bạn có thay đổi ở {panels} chưa được lưu. Nếu tiếp tục, các thay đổi này sẽ bị mất.",
    stay: "Ở lại",
    discard: "Bỏ thay đổi và tiếp tục",
  },

  units: {
    seconds: "{value} giây",
  },
};

export default review;
export type ReviewMessages = Messages<typeof review>;
