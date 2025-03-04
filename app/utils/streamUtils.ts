import { DataStreamWriter } from 'ai';

export async function handleTextStream(
  textStream: ReadableStream<string>,
  dataStream: DataStreamWriter
): Promise<void> {
  const reader = textStream.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = value as unknown as {
        type: string;
        textDelta?: string;
      };

      const deltaContent = chunk.textDelta || chunk;
      if (deltaContent) {
        dataStream.writeData(deltaContent.toString());
      }
    }
  } finally {
    reader.releaseLock();
  }
}