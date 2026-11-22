import "server-only";

// Neutralise spreadsheet formula injection and quote every field.
const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

export function csvResponse(filename: string, header: string[], rows: unknown[][]) {
  const csv = [header, ...rows].map((r) => r.map(cell).join(",")).join("\n");
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" },
  });
}
