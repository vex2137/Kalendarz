export interface DownloadProgress {
  receivedBytes: number;
  totalBytes?: number;
  bytesPerSecond?: number;
  remainingSeconds?: number;
}

/** Count bytes actually written; smooth rate over roughly two seconds. */
export function downloadMeter(totalBytes: number | undefined, now = () => performance.now()) {
  let started = false;
  let previousTime = now(), previousBytes = 0, rate: number | undefined;
  return (receivedBytes: number): DownloadProgress => {
    const time = now(), bytes = Math.max(0, receivedBytes);
    if (!started) { previousTime = time; previousBytes = bytes; started = true; }
    if (bytes < previousBytes || time < previousTime) { previousTime = time; previousBytes = bytes; rate = undefined; }
    const seconds = (time - previousTime) / 1000;
    if (seconds >= 0.1) {
      const instant = (bytes - previousBytes) / seconds;
      const weight = 1 - Math.exp(-seconds / 2);
      rate = rate === undefined ? instant : rate + weight * (instant - rate);
      previousTime = time; previousBytes = bytes;
    }
    return {
      receivedBytes: bytes,
      ...(totalBytes && totalBytes > 0 ? {totalBytes} : {}),
      ...(rate !== undefined ? {bytesPerSecond: rate} : {}),
      ...(rate && totalBytes && totalBytes >= bytes ? {remainingSeconds: (totalBytes - bytes) / rate} : {}),
    };
  };
}

export function downloadSummary(progress: DownloadProgress, language: string) {
  const number = new Intl.NumberFormat(language, {maximumFractionDigits: 1});
  const mb = (bytes: number) => number.format(bytes / 1_000_000);
  return `${mb(progress.receivedBytes)}${progress.totalBytes ? ` / ${mb(progress.totalBytes)}` : ''} MB` +
    (progress.bytesPerSecond !== undefined ? ` · ${mb(progress.bytesPerSecond)} MB/s` : '') +
    (progress.remainingSeconds !== undefined ? ` · ~${Math.ceil(progress.remainingSeconds)} s` : '');
}
