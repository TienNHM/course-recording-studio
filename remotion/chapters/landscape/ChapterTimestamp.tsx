import { measureText } from "@remotion/layout-utils";
import React, { useMemo } from "react";
import { useVideoConfig } from "remotion";
import { TITLE_FONT } from "../../../config/fonts";
import { formatMilliseconds } from "../../../src/helpers/format-time";
import { ChapterType } from "../make-chapters";

const chapterFontSize = 32;

const getChapterWidth = (text: string) => {
  return measureText({
    text,
    fontFamily: TITLE_FONT.fontFamily as string,
    fontWeight: TITLE_FONT.fontWeight as string,
    fontSize: chapterFontSize,
  }).width;
};

const PADDING_VERTICAL = 12;
const PADDING_HORIZONTAL = 18;

export const ChapterTimestamp: React.FC<{
  chapter: ChapterType;
  timestampOfLastChapter: number;
}> = ({ chapter, timestampOfLastChapter }) => {
  const { fps } = useVideoConfig();
  const biggestWidth = getChapterWidth(
    formatMilliseconds((timestampOfLastChapter / fps) * 1000),
  );

  const style: React.CSSProperties = useMemo(() => {
    return {
      backgroundColor: "black",
      color: "white",
      padding: `${PADDING_VERTICAL}px 0px`,
      fontSize: chapterFontSize,
      ...TITLE_FONT,
      width: biggestWidth + PADDING_HORIZONTAL * 2,
      textAlign: "center",
      height: "100%",
      justifyContent: "center",
      alignItems: "center",
      display: "flex",
    };
  }, [biggestWidth]);

  return (
    <div style={style}>{formatMilliseconds((chapter.start / fps) * 1000)}</div>
  );
};
