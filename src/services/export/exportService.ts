export function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportSessionCSV(session: {
  name: string;
  samples: number[];
}) {
  const headers = ["Index", "Amplitude"];
  const rows = session.samples.map((sample, i) => `${i},${sample.toFixed(4)}`);
  const csv = [headers.join(","), ...rows].join("\n");
  downloadFile(`${session.name.replace(/\s+/g, "_")}.csv`, csv, "text/csv");
}

export function exportSessionJSON(session: {
  name: string;
  start: string;
  durationSec: number;
  sampleCount: number;
  summary: unknown;
  samples: number[];
}) {
  const data = {
    name: session.name,
    start: session.start,
    duration: session.durationSec,
    sampleCount: session.sampleCount,
    summary: session.summary,
    samples: session.samples
  };
  const json = JSON.stringify(data, null, 2);
  downloadFile(`${session.name.replace(/\s+/g, "_")}.json`, json, "application/json");
}
