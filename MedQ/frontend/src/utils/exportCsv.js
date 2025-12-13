export function exportToCsv(filename, rows) {
  if (!rows || rows.length === 0) {
    alert("No data to export");
    return;
  }

  // Get column names from keys of first row
  const headers = Object.keys(rows[0]);

  const escapeValue = value => {
    if (value === null || value === undefined) return "";
    const str = String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvContent = [
    headers.join(","),                       // header row
    ...rows.map(row => headers.map(h => escapeValue(row[h])).join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}