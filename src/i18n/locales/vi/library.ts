/**
 * Namespace "library": strings for the course library view (src/library/**).
 * Vietnamese is the source of truth: add keys here first, then the same keys
 * in ../en/library.ts — TypeScript reports missing/extra keys there.
 *
 * Usage: const t = useT("library"); t("title"); t("key", { name: "…" })
 * See docs/design-system.md → "i18n".
 */
import { plural, type Messages } from "../../types";

const library = {
  title: "Thư viện khoá học",
  continueRecording: "Tiếp tục quay: {lesson}",
  continueRecordingShort: "Tiếp tục quay",
  newCourse: "Khoá học mới",
  automation: "Tự động hoá",
  serverOffline:
    "Máy chủ cục bộ chưa chạy. Hãy chạy “npm run dev” rồi tải lại trang.",
  loadError: "Không tải được thư viện: {message}",

  onboarding: {
    title: "Bắt đầu nhanh",
    intro:
      "Mỗi bài học đi qua 4 bước. Ứng dụng tự làm phần lớn việc — bạn chỉ cần quay và duyệt.",
    dismiss: "Đã hiểu",
    show: "Cách hoạt động",
    steps: {
      record: {
        title: "Quay",
        body: "Quay màn hình + webcam ngay trong ứng dụng, hoặc thả video OBS vào thư mục inbox.",
      },
      process: {
        title: "Xử lý",
        body: "Tự động tạo phụ đề, phát hiện khoảng lặng và chương sau khi lưu bản quay.",
      },
      review: {
        title: "Duyệt",
        body: "Kiểm tra các đoạn cắt, chương và phụ đề trước khi xuất.",
      },
      publish: {
        title: "Xuất bản",
        body: "Xuất MP4, phụ đề SRT/VTT, ảnh bìa và chương. Có thể bật tự xuất bản.",
      },
    },
  },

  sidebar: {
    label: "Khoá học",
    published: "{done}/{total} đã xuất bản",
    pickCourse: "Chọn khoá học",
  },

  empty: {
    noCourses: {
      title: "Chưa có khoá học nào",
      body: "Tạo khoá học đầu tiên, thêm chương và bài học, rồi bắt đầu quay.",
      action: "Tạo khoá học",
    },
    noModules: {
      title: "Khoá học chưa có chương",
      body: "Chương nhóm các bài học lại với nhau, ví dụ “Chương 1: Giới thiệu”.",
    },
    noLessons: "Chương này chưa có bài học.",
    noSelection: {
      title: "Chọn một bài học",
      body: "Chọn bài học bên trái để xem tiến độ, quay hoặc chỉnh sửa thông tin.",
    },
  },

  outline: {
    settings: "Cài đặt khoá học",
    moduleCount: plural({ other: "{count} bài" }),
    modulePublished: "{done}/{total} xong",
    newModulePlaceholder: "Tên chương mới, ví dụ “Chương 1: Giới thiệu”",
    newModule: "Thêm chương",
    newLessonPlaceholder: "Tên bài học mới",
    newLesson: "Thêm bài học",
    current: "Đang quay",
    currentHint: "Bài học đang được chọn để quay",
    lessonNumber: "Bài {number}",
  },

  inlineCreate: {
    required: "Hãy nhập tên.",
    tooLong: "Tên quá dài (tối đa {max} ký tự).",
    failed: "Không tạo được: {message}",
  },

  newCourseDialog: {
    title: "Khoá học mới",
    description:
      "Ngôn ngữ của khoá học được dùng cho phụ đề và tiêu đề trong video.",
    name: "Tên khoá học",
    namePlaceholder: "Lập trình React cơ bản",
    descriptionLabel: "Mô tả",
    descriptionPlaceholder: "Khoá học dành cho ai, học xong làm được gì…",
    language: "Ngôn ngữ khoá học",
    create: "Tạo khoá học",
    creating: "Đang tạo…",
    failed: "Không tạo được khoá học: {message}",
  },

  steps: {
    label: "Tiến độ bài học",
    record: "Quay",
    process: "Xử lý",
    review: "Duyệt",
    publish: "Xuất bản",
    state: {
      done: "Đã xong",
      current: "Bước hiện tại",
      active: "Đang chạy",
      failed: "Lỗi",
      upcoming: "Chưa tới",
    },
  },

  actions: {
    record: "Quay bài học",
    reRecord: "Quay lại",
    process: "Xử lý",
    reProcess: "Xử lý lại",
    review: "Duyệt bản dựng",
    export: "Xuất video",
    reExport: "Xuất lại",
    openPublished: "Mở video đã xuất",
    cancelJob: "Huỷ tác vụ",
    retranscribe: "Tạo lại phụ đề",
    retranscribeHint: "Chạy lại Whisper thay vì dùng phụ đề sẵn có.",
    more: "Thao tác khác",
  },

  primaryHint: {
    record: "Bước tiếp theo: quay bài học.",
    process: "Bước tiếp theo: xử lý bản quay.",
    review: "Bước tiếp theo: duyệt các đoạn cắt, chương và phụ đề.",
    export: "Bước tiếp theo: xuất video.",
    "open-published": "Bài học đã được xuất bản.",
    wait: "Đang xử lý — bạn có thể làm việc khác trong lúc chờ.",
    archived: "Bài học đã được lưu trữ.",
  },

  job: {
    production: "Hậu kỳ",
    render: "Xuất video",
    status: {
      QUEUED: "Đang chờ",
      ANALYZING: "Đang phân tích",
      TRANSCRIBING: "Đang tạo phụ đề",
      EDITING: "Đang dựng",
      RENDERING: "Đang xuất",
      COMPLETED: "Hoàn tất",
      FAILED: "Thất bại",
      CANCELLED: "Đã huỷ",
    },
    progress: "{kind}: {percent}",
    failed: "{kind} thất bại",
    cancelled: "{kind} đã bị huỷ.",
    unknownError: "Lỗi không xác định",
    finishedAt: "Hoàn tất {time}",
  },

  next: {
    title: "Tiếp theo",
    auto: "Tự động",
    manual: "Cần bạn",
    waitingRecordAuto: "Chờ bản quay — sẽ tự xử lý ngay khi lưu bản quay.",
    waitingRecord: "Chờ bản quay. Sau khi quay, bấm “Xử lý”.",
    processingThenPublish: "Đang xử lý — sẽ tự xuất bản sau khi xử lý.",
    processingThenReview: "Đang xử lý — sau đó chờ bạn duyệt.",
    rendering: "Đang xuất video — bài học sẽ được xuất bản khi xong.",
    recorded: "Đã có bản quay. Bấm “Xử lý” để tạo phụ đề và bản dựng.",
    reviewAutoPublish:
      "Sẵn sàng xuất (đã bật tự xuất bản). Bấm “Xuất video” hoặc “Xử lý tất cả việc chờ”.",
    review: "Chờ bạn duyệt bản dựng, sau đó xuất video.",
    published: "Đã xuất bản. Xuất lại bất cứ lúc nào nếu bạn sửa bản dựng.",
    archived: "Bài học đã được lưu trữ.",
    lastFailed: "Lần chạy trước thất bại: {error}",
  },

  published: {
    title: "Tệp đã xuất",
    video: "Video (MP4)",
    srt: "Phụ đề (SRT)",
    vtt: "Phụ đề (VTT)",
    chapters: "Chương",
    transcript: "Bản ghi lời",
    thumbnail: "Ảnh bìa",
    none: "Chưa có tệp nào.",
  },

  detail: {
    takeDuration: "Thời lượng bản quay {duration}",
    keptDuration: "Sau khi cắt {duration}",
    noTake: "Chưa có bản quay",
  },

  form: {
    title: "Thông tin bài học",
    lessonTitle: "Tiêu đề",
    lessonTitlePlaceholder: "Bài 1: Giới thiệu khoá học",
    description: "Mô tả",
    descriptionPlaceholder: "Bài học này nói về điều gì?",
    objectives: "Mục tiêu bài học",
    objectivePlaceholder: "Mục tiêu {number}",
    addObjective: "Thêm mục tiêu",
    removeObjective: "Xoá mục tiêu {number}",
    notes: "Ghi chú cho người quay",
    notesHint: "Hiện trong cửa sổ nổi khi quay.",
    recording: "Khi quay",
    webcam: "Quay webcam",
    webcamHint: "Ghi thêm hình người dạy ở góc video.",
    postProduction: "Hậu kỳ",
    automationSection: "Tự động hoá",
    autoProcess: "Tự xử lý sau khi quay",
    autoProcessHint:
      "Bắt đầu tạo phụ đề và bản dựng ngay khi bản quay được lưu hoặc nhập vào.",
    autoPublish: "Tự xuất bản sau khi xử lý",
    autoPublishHint:
      "Bỏ qua bước duyệt: xuất video ngay khi hậu kỳ hoàn tất. Chỉ nên bật khi bạn tin bản dựng tự động.",
    autoTranscribe: "Tạo phụ đề tự động",
    autoTranscribeHint: "Dùng Whisper chạy trên máy.",
    autoDetectSilence: "Phát hiện khoảng lặng",
    autoDetectSilenceHint: "Đề xuất các đoạn im lặng để cắt.",
    autoRemoveSilence: "Tự cắt khoảng lặng",
    autoRemoveSilenceHint: "Nếu tắt, các đoạn lặng chỉ được đề xuất để bạn duyệt.",
    generateChapters: "Tạo chương từ dấu mốc",
    generateChaptersHint: "Dùng các dấu mốc “chương” bạn đặt khi quay.",
    intro: "Thẻ mở đầu",
    introHint: "Tiêu đề bài học ở đầu video.",
    outro: "Thẻ kết thúc",
    outroHint: "Thẻ cảm ơn ở cuối video.",
    silencePreset: "Mức cắt khoảng lặng",
    silencePresets: {
      conservative: "Nhẹ nhàng",
      balanced: "Cân bằng",
      aggressive: "Mạnh tay",
    },
    validation: {
      titleRequired: "Tiêu đề không được để trống.",
      titleTooLong: "Tiêu đề quá dài (tối đa {max} ký tự).",
      objectiveDuplicate: "Mục tiêu bị trùng.",
    },
    saveState: {
      saved: "Đã lưu",
      saving: "Đang lưu…",
      dirty: "Có thay đổi chưa lưu",
      invalid: "Sửa lỗi để lưu",
      error: "Không lưu được: {message}",
      autosave: "Tự động lưu",
    },
    saveNow: "Lưu ngay",
  },

  courseSettings: {
    title: "Cài đặt khoá học",
    description: "Áp dụng cho mọi bài học của khoá này.",
    sections: {
      general: "Chung",
      glossary: "Thuật ngữ",
      videoStyle: "Phong cách video",
    },
    name: "Tên khoá học",
    descriptionLabel: "Mô tả",
    language: "Ngôn ngữ",
    languageHint: "Dùng cho phụ đề và chữ trong video.",
    outputProfile: "Chất lượng xuất",
    outputProfiles: {
      "course-standard": "Chuẩn",
      "course-hq": "Chất lượng cao",
    },
    outputProfileDetail: "{width}×{height}, {fps} khung hình/giây",
    glossaryHint:
      "Từ đúng và các cách Whisper hay nghe nhầm. Phụ đề sẽ được sửa thành từ đúng.",
    glossaryTerm: "Từ đúng",
    glossaryTermPlaceholder: "ASP.NET Core",
    glossaryAliases: "Cách nghe nhầm",
    glossaryAliasesPlaceholder: "asp dot net core, a s p net",
    glossaryAliasesHint: "Ngăn cách bằng dấu phẩy.",
    glossaryAdd: "Thêm thuật ngữ",
    glossaryRemove: "Xoá thuật ngữ “{term}”",
    glossaryEmpty: "Chưa có thuật ngữ nào.",
    glossaryDuplicate: "Thuật ngữ bị trùng.",
    glossaryCount: plural({ zero: "Chưa có", other: "{count} thuật ngữ" }),
    nameRequired: "Tên khoá học không được để trống.",
    save: "Lưu cài đặt",
    saved: "Đã lưu cài đặt khoá học",
    failed: "Không lưu được: {message}",
    unsaved: "Có thay đổi chưa lưu",
    discardTitle: "Bỏ các thay đổi?",
    discardBody: "Các thay đổi trong cài đặt khoá học sẽ không được lưu.",
    discard: "Bỏ thay đổi",
    keepEditing: "Tiếp tục sửa",
  },

  videoStyle: {
    palette: "Bảng màu video",
    intro: "Kiểu mở đầu",
    intros: {
      minimal: "Tối giản",
      gradient: "Chuyển sắc",
      starburst: "Toả sáng",
    },
    transition: "Chuyển cảnh",
    transitions: {
      none: "Không",
      fade: "Mờ dần",
      slide: "Trượt",
      "light-leak": "Vệt sáng",
    },
    chapterCards: "Thẻ chương",
    chapterCardsHint: "Hiện tên chương khi chương mới bắt đầu.",
    lowerThird: "Tên bài ở góc dưới",
    lowerThirdHint: "Tên khoá học và bài học ở đầu video.",
    backgroundMusic: "Nhạc nền",
    backgroundMusicHint: "Nhạc nhẹ ở thẻ mở đầu và kết thúc.",
    progressBar: "Thanh tiến độ",
    progressBarHint: "Thanh mảnh ở đáy video, có vạch chia chương.",
    preview: "Xem trước",
    previewHint: "Xem trước phần mở đầu của “{lesson}” — chưa lưu cho đến khi bấm Lưu.",
    previewMockHint:
      "Chưa có bài học nào có bản quay, nên đây là hình minh hoạ. Quay một bài để xem trước thật.",
    previewPlay: "Phát xem trước",
    previewLoading: "Đang chuẩn bị bản xem trước…",
    previewError: "Không xem trước được: {message}",
    mockLesson: "Bài 1",
    mockTitle: "Giới thiệu khoá học",
  },

  automationDialog: {
    title: "Tự động hoá",
    description:
      "Thả video vào thư mục, ứng dụng tự nhập, xử lý và (nếu bật) xuất bản.",
    inbox: {
      title: "Thư mục inbox",
      body: "Đặt video theo cấu trúc Khoá học/Chương/Bài học.mp4. Tệp được nhập khi đã ghi xong 5 giây.",
      enabled: "Theo dõi thư mục inbox",
      enabledHint: "Tự nhập video mới vào đúng bài học.",
      folder: "Đường dẫn thư mục",
      folderHint: "Đường dẫn tuyệt đối, nằm ngoài thư mục public/ của ứng dụng.",
      useSuggested: "Dùng thư mục gợi ý",
      suggested: "Gợi ý: {path}",
      save: "Lưu thư mục",
      saved: "Đã lưu",
      failed: "Không lưu được: {message}",
      folderRequired: "Hãy nhập đường dẫn thư mục.",
      folderNotAbsolute: "Đường dẫn phải là đường dẫn tuyệt đối.",
      source: {
        settings: "Từ cài đặt",
        env: "Từ biến môi trường",
        default: "Mặc định",
      },
      layout: "Cấu trúc thư mục",
    },
    watcher: {
      watching: "Đang theo dõi",
      off: "Đang tắt",
      pending: plural({ zero: "Không có tệp đang chờ", other: "{count} tệp đang được ghi" }),
      processing: "Đang nhập: {file}",
    },
    events: {
      title: "Hoạt động gần đây",
      empty: "Chưa có hoạt động nào.",
      types: {
        detected: "Phát hiện",
        imported: "Đã nhập",
        deferred: "Hoãn",
        failed: "Lỗi",
        "auto-production": "Tự xử lý",
        "auto-render": "Tự xuất",
        pipeline: "Quy trình",
        watcher: "Theo dõi",
      },
    },
    pending: {
      title: "Xử lý tất cả việc đang chờ",
      body: "Xử lý mọi bài đã quay và xuất mọi bài đang chờ duyệt có bật tự xuất bản.",
      scope: "Phạm vi",
      scopeAll: "Tất cả khoá học",
      scopeCourse: "Chỉ “{course}”",
      preview: "Xem trước",
      run: "Chạy {count} tác vụ",
      running: "Đang xếp hàng…",
      nothing: "Không có việc nào đang chờ.",
      production: "Sẽ xử lý",
      render: "Sẽ xuất video",
      skipped: "Bỏ qua",
      queued: plural({ zero: "Không có tác vụ nào được xếp hàng.", other: "Đã xếp hàng {count} tác vụ." }),
      failed: "Không chạy được: {message}",
    },
    agent: {
      title: "Kết nối AI agent",
      body: "Cho Claude Code (hoặc ứng dụng MCP khác) điều khiển studio: tạo bài, nhập video, duyệt và xuất bản.",
      mcp: "Thêm máy chủ MCP vào Claude Code",
      cli: "Hoặc dùng dòng lệnh",
      docs: "Chi tiết trong docs/automation.md.",
      copy: "Sao chép lệnh",
      copied: "Đã sao chép",
      copyFailed: "Không sao chép được — hãy chọn và sao chép thủ công.",
    },
    layout: {
      course: "tên khoá học",
      module: "tên chương",
      lesson: "tên bài học",
    },
    loadFailed: "Không tải được cài đặt tự động hoá: {message}",
  },

  confirm: {
    reProcessTitle: "Xử lý lại bài học?",
    reProcessBody:
      "Bản dựng hiện tại (các đoạn cắt và chương bạn đã duyệt) sẽ được tạo lại từ đầu.",
    reProcess: "Xử lý lại",
    runPendingTitle: "Chạy {count} tác vụ?",
    runPendingBody: "Các tác vụ chạy lần lượt trong nền; bạn có thể tiếp tục làm việc.",
  },
};

export default library;
export type LibraryMessages = Messages<typeof library>;
