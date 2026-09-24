import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const source = "C:/Users/lenovo/Downloads/Expesne Tracker sheet.xlsx";
const outputDir = "C:/Users/lenovo/Documents/ChatGPT/expense management/previews";
await fs.mkdir(outputDir, { recursive: true });
const wb = await SpreadsheetFile.importXlsx(await FileBlob.load(source));
const summary = await wb.inspect({
  kind: "workbook,sheet,table,definedName,drawing",
  maxChars: 18000,
  tableMaxRows: 8,
  tableMaxCols: 8,
  tableMaxCellChars: 100,
});
await fs.writeFile(`${outputDir}/artifact_inspection.ndjson`, summary.ndjson, "utf8");

const renderSpecs = [
  ["Instructions", "A1:K402", 0.7],
  ["Setup", "A1:P52", 1.2],
  ["Accounts", "A1:N59", 1.1],
  ["Income", "A1:H28", 1.1],
  ["Expenses", "A1:H28", 1.1],
  ["Balance", "A1:G28", 1.1],
  ["Monthly Dashboard", "A1:Z92", 1.0],
  ["Annual Dashboard", "A1:AF172", 0.9],
  ["Custom Dashboard", "A1:Z92", 1.0],
];

for (const [sheetName, range, scale] of renderSpecs) {
  const blob = await wb.render({ sheetName, range, scale, format: "png" });
  const safe = sheetName.replaceAll(" ", "_").toLowerCase();
  await fs.writeFile(`${outputDir}/${safe}.png`, new Uint8Array(await blob.arrayBuffer()));
}
console.log(JSON.stringify({ outputDir, rendered: renderSpecs.map(([s, r]) => `${s}!${r}`) }, null, 2));
