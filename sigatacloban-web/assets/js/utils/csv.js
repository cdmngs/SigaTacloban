const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export function toCsv(headers, rows) {
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export function downloadCsv(filename, headers, rows) {
  const blob = new Blob([toCsv(headers, rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
