// Stores a recording in the Origin Private File System.
//
// Every chunk emitted by the MediaRecorder is written to its own small file
// inside a directory named after the recording. A FileSystemWritableFileStream
// only commits its data on close(), so writing everything into one long-lived
// stream would lose the whole take if the tab crashes. Closing a small file per
// chunk makes every chunk durable, which is what take recovery relies on.

const partsDirName = (filename: string) => `${filename}.parts`;
const chunkName = (index: number) => `${String(index).padStart(6, "0")}.chunk`;

const getPartsDir = async (filename: string, create: boolean) => {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(partsDirName(filename), { create });
};

const listChunkFiles = async (dir: FileSystemDirectoryHandle) => {
  const names: string[] = [];
  // Async iteration of directory handles is not in the default DOM typings
  const iterable = dir as unknown as {
    entries: () => AsyncIterable<[string, FileSystemHandle]>;
  };
  for await (const [name, handle] of iterable.entries()) {
    if (handle.kind === "file" && name.endsWith(".chunk")) {
      names.push(name);
    }
  }

  names.sort();
  return Promise.all(
    names.map(async (name) => (await dir.getFileHandle(name)).getFile()),
  );
};

// Reads back a stored recording as one File (cheap: the parts stay on disk).
export const readStoredFile = async (
  filename: string,
  mimeType: string,
): Promise<File | null> => {
  try {
    const dir = await getPartsDir(filename, false);
    const parts = await listChunkFiles(dir);
    if (parts.length === 0) {
      return null;
    }

    return new File(parts, filename, { type: mimeType });
  } catch {
    return null;
  }
};

export const deleteStoredFile = async (filename: string) => {
  const root = await navigator.storage.getDirectory();
  try {
    await root.removeEntry(partsDirName(filename), { recursive: true });
  } catch {
    // Already gone
  }

  try {
    // Recordings made before chunked storage existed
    await root.removeEntry(filename);
  } catch {
    // Did not exist
  }
};

export const createFileStorage = async (filename: string, mimeType = "") => {
  const dir = await getPartsDir(filename, true);

  let written = 0;
  let index = 0;
  let writePromise = Promise.resolve();

  const write = async (data: Blob) => {
    if (data.size === 0) {
      return;
    }

    const handle = await dir.getFileHandle(chunkName(index), { create: true });
    index++;
    const writable = await handle.createWritable();
    await writable.write(data);
    await writable.close();
    written += data.size;
  };

  return {
    write: async (data: Blob) => {
      writePromise = writePromise.then(() => write(data));
      return writePromise;
    },
    save: async (): Promise<File> => {
      await writePromise;
      const parts = await listChunkFiles(dir);
      return new File(parts, filename, { type: mimeType });
    },
    getBytesWritten: () => written,
    release: async () => {
      await writePromise.catch(() => undefined);
      await deleteStoredFile(filename);
    },
  };
};
