import { Directory, File, Paths } from 'expo-file-system';
import {
  extractSafeReceiptExtension,
  isManagedReceiptUri,
} from '../types/domain';

export async function persistReceiptImage(sourceUri: string): Promise<string> {
  const trimmedSource = sourceUri.trim();
  if (trimmedSource.length === 0) {
    throw new Error('Cannot persist an empty receipt image URI.');
  }

  const receiptsDir = new Directory(Paths.document, 'receipts');
  receiptsDir.create({ intermediates: true, idempotent: true });

  const ext = extractSafeReceiptExtension(trimmedSource);
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  const destFile = new File(
    receiptsDir,
    `receipt_${Date.now()}_${randomSuffix}${ext}`,
  );
  const sourceFile = new File(trimmedSource);

  try {
    await sourceFile.copy(destFile);
    return destFile.uri;
  } catch {
    try {
      const bytes = await sourceFile.bytes();
      destFile.create({ overwrite: true });
      await destFile.write(bytes);
      return destFile.uri;
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown filesystem error';
      throw new Error(`Failed to persist receipt image: ${reason}`);
    }
  }
}

export function deleteReceiptImageQuietly(uri: string | null): void {
  if (!isManagedReceiptUri(uri)) {
    return;
  }
  try {
    const file = new File(uri.trim());
    if (file.exists) {
      file.delete();
    }
  } catch {
    return;
  }
}

export function clearAllReceiptImagesQuietly(): void {
  try {
    const receiptsDir = new Directory(Paths.document, 'receipts');
    if (receiptsDir.exists) {
      receiptsDir.delete();
    }
  } catch {
    return;
  }
}
