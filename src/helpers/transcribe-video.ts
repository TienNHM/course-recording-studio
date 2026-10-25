import { makeStreamer } from "@remotion/streaming";
import { TRANSCRIBE_VIDEO } from "../../scripts/server/constants";
import {
  MessageTypeId,
  StreamingMessage,
  formatMap,
  messageTypeIdToMessageType,
} from "../../scripts/server/streaming";
import { ProcessStatus } from "../components/ProcessingStatus";
import { cancelTranscribeOnServer } from "./cancel-transcribe";
import { parseJsonOrThrowSource } from "./upload-file";

export const transcribeVideoOnServer = async ({
  onProgress,
  endDate,
  selectedFolder,
}: {
  onProgress: (status: ProcessStatus) => void;
  endDate: number;
  selectedFolder: string;
}) => {
  const url = new URL(TRANSCRIBE_VIDEO, window.location.origin);

  url.search = new URLSearchParams({
    folder: selectedFolder,
    endDateAsString: endDate.toString(),
  }).toString();

  const streamer = makeStreamer((status, messageTypeId, data) => {
    const messageType = messageTypeIdToMessageType(
      messageTypeId as MessageTypeId,
    );
    const innerPayload =
      formatMap[messageType] === "json"
        ? parseJsonOrThrowSource(data, messageType)
        : data;

    const { message }: StreamingMessage = {
      successType: status,
      message: {
        type: messageType,
        payload: innerPayload,
      },
    };

    if (message.type === "transcribing-progress") {
      onProgress({
        step: "transcribing",
        file: message.payload.filename,
        progress: message.payload.progress / 100,
        abort: () => cancelTranscribeOnServer(),
      });
    }
    if (message.type === "install-whisper-progress") {
      onProgress({
        step: "installingWhisper",
        file: null,
        progress: null,
        abort: () => cancelTranscribeOnServer(),
      });
    }
    if (message.type === "downloading-whisper-model-progress") {
      onProgress({
        step: "downloadingModel",
        file: null,
        progress: message.payload.progressInPercent / 100,
        abort: () => cancelTranscribeOnServer(),
      });
    }
    if (message.type === "whisper-abort") {
      throw new Error("aborted by user");
    }
  });

  const res = await fetch(url, {});
  if (!res.body) {
    throw new Error("No body");
  }

  const reader = res.body.getReader();

  while (true) {
    const { value, done } = await reader.read();
    if (value) {
      streamer.onData(value);
    }
    if (done) break;
  }
};
