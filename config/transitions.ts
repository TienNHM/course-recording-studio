export const SCENE_TRANSITION_DURATION = 15;
export const B_ROLL_TRANSITION_DURATION = 10;

// --- "lesson" composition (course.videoStyle) ---
// Length of the intro / outro title cards.
export const LESSON_INTRO_SECONDS = 3.5;
export const LESSON_OUTRO_SECONDS = 4;
// fade / slide between intro → lesson → outro. These overlap both scenes and
// therefore shorten the video (see computeLessonTimeline()).
export const LESSON_TRANSITION_SECONDS = 0.6;
// light-leak is an overlay centered on the cut; it does not change timing.
export const LESSON_LIGHT_LEAK_SECONDS = 1.4;
// Chapter card overlay shown when a chapter starts.
export const LESSON_CHAPTER_CARD_SECONDS = 3.2;
// Lower third (course + lesson title) at the start of the lesson.
export const LESSON_LOWER_THIRD_DELAY_SECONDS = 0.6;
export const LESSON_LOWER_THIRD_SECONDS = 5;
