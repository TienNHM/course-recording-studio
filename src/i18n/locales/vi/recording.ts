/**
 * Namespace "recording": strings for the recorder view (src/App.tsx Recorder,
 * src/recording/**, device pickers, permission screens, PiP panel).
 *
 * Vietnamese is the source of truth: add keys here first, then the same keys
 * in ../en/recording.ts — TypeScript reports missing/extra keys there.
 */
import { plural, type Messages } from "../../types";

const recording = {
  title: "Quay bài giảng",

  header: {
    back: "Thư viện",
    noLesson: "Chưa chọn bài học",
    notes: "Ghi chú",
    showNotes: "Hiện ghi chú bài giảng",
    hideNotes: "Ẩn ghi chú bài giảng",
  },

  sources: {
    title: "Nguồn quay",
    label: {
      webcam: "Webcam",
      display: "Màn hình",
      alternative1: "Nguồn phụ 1",
      alternative2: "Nguồn phụ 2",
    },
    hint: {
      webcam: "Camera quay người giảng",
      display: "Màn hình hoặc cửa sổ trình bày",
      alternative1: "Camera hoặc màn hình bổ sung — không lưu vào bài học",
      alternative2: "Camera hoặc màn hình bổ sung — không lưu vào bài học",
    },
    micBadge: "Ghi micro",
    requiredBadge: "Bài học cần",
    live: "Đang quay",
    video: "Hình ảnh",
    audio: "Micro",
    choose: "Chọn nguồn…",
    none: "Không dùng",
    noAudio: "Không ghi micro",
    screen: "Chia sẻ màn hình / cửa sổ",
    screenWithAudio: "Màn hình + âm thanh hệ thống (không kèm micro)",
    screenGroup: "Màn hình",
    cameraGroup: "Camera",
    cameraFallback: "Camera {index}",
    micFallback: "Micro {index}",
    pickScreen: "Chọn màn hình để quay",
    changeScreen: "Đổi màn hình",
    emptyTitle: "Chưa có hình ảnh",
    emptyHint: "Chọn camera hoặc màn hình ở bên dưới.",
    emptyScreenHint:
      "Trình duyệt sẽ hỏi bạn muốn chia sẻ toàn màn hình, cửa sổ hay tab.",
    loading: "Đang mở nguồn…",
    rescan: "Quét lại thiết bị",
    rescanning: "Đang quét…",
    more: "Thêm nguồn phụ",
    fewer: "Ẩn nguồn phụ",
    resolution: "{width}×{height} · {fps} FPS",
    crop: "Hiện khung cắt dọc",
    mirror: "Lật gương",
    rotate: "Quay dọc",
    resolutionSettings: "Độ phân giải & khung hình",
    clear: "Bỏ chọn nguồn",
    webcamOff: {
      title: "Bài học này không dùng webcam",
      body: "Chỉ ghi màn hình và micro. Bạn vẫn có thể bật webcam cho lần quay này.",
      enable: "Bật webcam",
      disable: "Tắt webcam",
    },
    error: {
      notReadable:
        "Không đọc được thiết bị. Có thể một ứng dụng khác đang dùng camera này.",
      overconstrained:
        "Thiết bị không hỗ trợ độ phân giải / khung hình đã chọn. Hãy giảm giới hạn độ phân giải.",
      cancelled: "Bạn đã huỷ chọn màn hình.",
      notAllowed: "Trình duyệt chặn quyền truy cập thiết bị này.",
      notFound: "Không tìm thấy thiết bị. Hãy cắm lại rồi quét lại.",
      generic: "Không mở được nguồn: {message}",
      retry: "Thử lại",
    },
  },

  preflight: {
    title: "Kiểm tra trước khi quay",
    lesson: {
      label: "Bài học",
      ok: "{lesson}",
      missing: "Chưa chọn bài học — bản quay chỉ có thể tải xuống",
      noServer: "Máy chủ cục bộ không chạy — bản quay chỉ có thể tải xuống",
      choose: "Chọn bài học",
    },
    mic: {
      label: "Micro",
      ok: "Nghe rõ",
      missing: "Chọn micro cho nguồn {source}",
      listening: "Hãy nói thử vài câu…",
      silent: "Chưa nghe thấy tiếng — kiểm tra micro hoặc nói to hơn",
      notRequired: "Bài học này không ghi micro",
    },
    screen: {
      label: "Màn hình",
      ok: "Đã chọn",
      missing: "Chọn màn hình hoặc cửa sổ để quay",
      loading: "Đang chờ bạn chọn màn hình…",
      otherVideo: "Không quay màn hình — chỉ dùng camera",
      action: "Chọn màn hình",
    },
    webcam: {
      label: "Webcam",
      ok: "Đã chọn",
      missing: "Bài học cần webcam — hãy chọn camera",
      loading: "Đang mở camera…",
      notRequired: "Không dùng cho bài học này",
      extra: "Sẽ được ghi kèm",
    },
    disk: {
      label: "Dung lượng đĩa",
      ok: "Còn trống {free}",
      low: "Chỉ còn {free} — bản quay dài có thể không đủ chỗ",
      loading: "Đang kiểm tra…",
      unknown: "Không kiểm tra được",
    },
    state: {
      ok: "Đạt",
      warning: "Cần chú ý",
      error: "Chưa sẵn sàng",
      pending: "Đang kiểm tra",
      skipped: "Bỏ qua",
    },
    ready: "Mọi thứ đã sẵn sàng",
    warnings: "Có thể quay, nhưng hãy xem các mục cần chú ý",
    blocked: "Hoàn tất các mục còn thiếu để bắt đầu quay",
    start: "Bắt đầu quay",
    pressKey: "hoặc nhấn",
    autoProcessOn: "Sau khi dừng, bản quay được lưu và hậu kỳ tự động chạy.",
    autoProcessOff:
      "Sau khi dừng, bản quay được lưu. Hậu kỳ tự động đang tắt cho bài này.",
  },

  countdown: {
    title: "Chuẩn bị quay",
    hint: "Bắt đầu sau {seconds} giây",
    cancel: "Huỷ",
  },

  live: {
    rec: "REC",
    paused: "Tạm dừng",
    pause: "Tạm dừng",
    resume: "Tiếp tục",
    stop: "Dừng",
    stopAndSave: "Dừng & lưu",
    markers: "Đánh dấu",
    chapterPlaceholder: "Tên chương tiếp theo (mặc định: {title})",
    chapterInput: "Tên chương cho mốc tiếp theo — Enter để thêm",
    markerCount: plural({ zero: "Chưa có mốc", other: "{count} mốc" }),
    lastMarker: "Mốc gần nhất: {title} · {time}",
    micLevel: "Mức micro",
    pipTitle: "Điều khiển quay",
    pipHint:
      "Bảng điều khiển nổi luôn nằm trên cùng — bạn có thể chuyển sang ứng dụng khác.",
    pipUnsupported:
      "Trình duyệt này không hỗ trợ bảng điều khiển nổi. Dùng các nút ở đây hoặc phím tắt.",
  },

  markers: {
    cut: "Cắt",
    important: "Quan trọng",
    chapter: "Chương",
    add: "Thêm mốc “{type}” ({key})",
    defaultChapter: "Chương {number}",
  },

  announce: {
    countdown: "Bắt đầu quay sau {seconds} giây",
    started: "Đã bắt đầu quay",
    paused: "Đã tạm dừng quay",
    resumed: "Tiếp tục quay",
    stopped: "Đã dừng quay",
    cancelled: "Đã huỷ đếm ngược",
    marker: "Đã thêm mốc {type}",
    saved: "Đã lưu bản quay",
    saveFailed: "Lưu bản quay thất bại",
  },

  take: {
    savingTitle: "Đang lưu bản quay",
    savingHint: "Đừng đóng tab này cho đến khi lưu xong.",
    step: {
      converting: "Đang chuyển đổi {file}",
      copying: "Đang chép {file} vào bài học",
      finishing: "Đang lưu mốc và thông tin phiên quay",
      downloading: "Đang chuẩn bị tệp {file}",
      transcribing: "Đang phiên âm {file}",
      installingWhisper: "Đang cài Whisper",
      downloadingModel: "Đang tải mô hình Whisper",
    },
    abort: "Dừng lưu",
    summary: "{duration} · {markers}",
    savedTitle: "Đã lưu bản quay vào “{lesson}”",
    autoProcessTitle: "Hậu kỳ đã tự động bắt đầu",
    autoProcessBody:
      "Phiên âm, tìm khoảng lặng và chia chương đang chạy nền. Bạn có thể quay bài khác trong lúc chờ.",
    autoPublishNote:
      "Bài học này bật tự động xuất bản: video sẽ được render ngay khi hậu kỳ xong.",
    manualTitle: "Hậu kỳ tự động đang tắt",
    manualBody: "Bấm “Xử lý ngay” khi bạn sẵn sàng.",
    processNow: "Xử lý ngay",
    processStarting: "Đang bắt đầu…",
    processFailed: "Không bắt đầu được hậu kỳ: {message}",
    jobStatus: {
      QUEUED: "Đang chờ",
      ANALYZING: "Đang phân tích",
      TRANSCRIBING: "Đang phiên âm",
      EDITING: "Đang dựng",
      RENDERING: "Đang render",
      COMPLETED: "Đã xong — sẵn sàng duyệt",
      FAILED: "Thất bại",
      CANCELLED: "Đã huỷ",
    },
    backToLibrary: "Về thư viện",
    recordAnother: "Quay bản khác",
    reviewWhenReady: "Duyệt khi xong",
    reviewNow: "Duyệt ngay",
    errorTitle: "Không lưu được bản quay",
    errorBody:
      "{message} — bản quay vẫn được giữ trong trình duyệt. Hãy thử lại hoặc tải xuống.",
    abortedTitle: "Đã dừng lưu",
    unsavedTitle: "Bản quay chưa được lưu",
    noLesson:
      "Chưa chọn bài học. Tải bản quay xuống, hoặc chọn bài học rồi lưu.",
    noServer: "Máy chủ cục bộ không chạy — hãy tải bản quay xuống.",
    save: "Lưu vào bài học",
    retry: "Thử lại",
    download: "Tải xuống (MP4)",
    downloadRaw: "Tải bản gốc (không chuyển đổi)",
    preview: "Xem nguồn {source}",
    moreOptions: "Tuỳ chọn khác",
    discard: "Bỏ bản quay",
    downloadFailed: "Tải xuống thất bại: {message}",
    discardConfirm: {
      title: "Bỏ bản quay này?",
      body: "Bản quay chưa được lưu vào bài học sẽ bị xoá khỏi trình duyệt. Không thể hoàn tác.",
      confirm: "Bỏ bản quay",
    },
  },

  recover: {
    title: "Có bản quay dang dở chưa được lưu",
    meta: "{date} · {duration} · {markers}",
    target: "Sẽ lưu vào {lesson}",
    noTarget: "Chọn bài học để khôi phục",
    noServer: "Cần máy chủ cục bộ để khôi phục",
    more: plural({ other: "+{count} bản khác" }),
    recover: "Khôi phục",
    discard: "Bỏ",
    noData: "Không tìm thấy dữ liệu của bản quay này. Chỉ có thể bỏ nó.",
    failed: "Khôi phục thất bại: {message}",
    discardConfirm: {
      title: "Bỏ bản quay dang dở?",
      body: "Dữ liệu đã quay sẽ bị xoá khỏi trình duyệt. Không thể hoàn tác.",
      confirm: "Bỏ bản quay",
    },
  },

  disk: {
    confirmTitle: "Sắp hết dung lượng đĩa",
    confirmBody:
      "Chỉ còn {free} trống. Một bản quay dài có thể không đủ chỗ và bị lỗi giữa chừng.",
    confirm: "Vẫn quay",
  },

  errors: {
    title: "Đã xảy ra lỗi",
    startFailed: "Không bắt đầu quay được: {message}",
    recordingFailed:
      "Quay thất bại: {message}. Tải lại trang để khôi phục phần đã quay.",
    devices: "Không đọc được danh sách thiết bị: {message}",
    dismiss: "Đóng",
  },

  devices: {
    loading: "Đang tìm thiết bị…",
    failedTitle: "Không đọc được thiết bị",
  },

  permission: {
    title: "Cho phép truy cập thiết bị",
    bodyMic: "Ứng dụng cần quyền dùng micro để ghi giọng nói của bạn.",
    bodyCamera:
      "Bài học này quay cả webcam, nên ứng dụng cần quyền dùng micro và camera.",
    microphone: "Micro",
    camera: "Camera",
    state: {
      initial: "Đang kiểm tra…",
      prompt: "Đang chờ bạn cho phép",
      granted: "Đã cho phép",
      denied: "Bị chặn",
    },
    promptHint:
      "Bấm “Cho phép” trong hộp thoại của trình duyệt (gần thanh địa chỉ).",
    deniedTitle: "Quyền truy cập đang bị chặn",
    steps: {
      one: "Bấm biểu tượng ổ khoá / thông tin bên trái địa chỉ trang.",
      two: "Mở mục “Quyền” hoặc “Cài đặt trang web”.",
      three: "Đặt Micro và Camera thành “Cho phép” hoặc “Hỏi”.",
      four: "Tải lại trang để áp dụng.",
    },
    reload: "Tải lại trang",
    noDeviceTitle: "Không tìm thấy micro hoặc camera",
    noDeviceBody:
      "Thiết bị này có vẻ không ghi được âm thanh / hình ảnh. Hãy kiểm tra micro và camera đã được kết nối chưa.",
  },

  browser: {
    unsupportedTitle: "Trình duyệt chưa được hỗ trợ",
    unsupportedBody:
      "Trình duyệt này không hỗ trợ Web File System API cần cho việc ghi hình. Hãy dùng Chrome hoặc Edge bản mới.",
    securityTitle: "Lỗi bảo mật",
    securityBody:
      "Không dùng được Web File System API — có thể bạn đang ở cửa sổ ẩn danh. Hãy mở ứng dụng trong cửa sổ thường.",
  },

  notes: {
    title: "Ghi chú bài giảng",
    objectives: "Mục tiêu",
    notes: "Ghi chú cho người giảng",
    description: "Mô tả",
    empty:
      "Bài học chưa có mục tiêu hay ghi chú. Thêm chúng trong Thư viện để xem khi quay.",
    noLesson: "Chọn bài học để xem ghi chú khi quay.",
    collapse: "Thu gọn ghi chú",
    expand: "Mở rộng ghi chú",
    larger: "Chữ to hơn",
    smaller: "Chữ nhỏ hơn",
  },

  shortcuts: {
    title: "Phím tắt",
    open: "Xem phím tắt",
    record: "Bắt đầu / dừng quay",
    pause: "Tạm dừng / tiếp tục",
    important: "Đánh dấu đoạn quan trọng",
    cut: "Đánh dấu đoạn cần cắt",
    chapter: "Thêm mốc chương mới",
    cancel: "Huỷ đếm ngược",
    note: "Phím tắt cũng hoạt động trong bảng điều khiển nổi, nhưng không khi đang gõ chữ.",
  },

  resolution: {
    title: "Giới hạn độ phân giải",
    description: "Giảm độ phân giải của {device} nếu video bị rớt khung hình.",
    full: "Độ phân giải tối đa",
    fullWithHeight: "Độ phân giải tối đa ({height}p)",
    limitTo: "Giới hạn {size}",
    fpsTitle: "Khung hình tối thiểu",
    fpsUnknown:
      "{device} có thể quay nhiều khung hình hơn, nhưng độ phân giải có thể giảm.",
    fpsKnown: "{device} quay tối đa {fps} FPS, nhưng độ phân giải có thể giảm.",
    fpsDefault: "Mặc định",
    fpsAtLeast: "Ít nhất {fps} FPS",
    done: "Xong",
  },
};

export default recording;
export type RecordingMessages = Messages<typeof recording>;
