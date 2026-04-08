/**
 * UK Civil Service Statistics Ingestion Script
 *
 * Downloads and parses the Cabinet Office civil service statistics CSV
 * and updates src/data/civil-service.json.
 *
 * Data source: https://www.gov.uk/government/statistics/civil-service-statistics
 *
 * Usage:
 *   node scripts/ingest-civil-service.mjs
 *   node scripts/ingest-civil-service.mjs --csv path/to/downloaded.csv
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "src", "data");

// ============================================================================
// CSV PARSER (lightweight, no dependencies)
// ============================================================================

function parseCSV(text) {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return [];

  const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = [];
    let current = "";
    let inQuotes = false;

    for (const ch of lines[i]) {
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    values.push(current.trim());

    const row = {};
    headers.forEach((h, j) => {
      row[h] = values[j] || "";
    });
    rows.push(row);
  }

  return rows;
}

// ============================================================================
// DATA PROCESSING
// ============================================================================

/**
 * Process raw civil service CSV data into our format.
 * Expected columns vary by source, but typically include:
 * - Organisation, Headcount, FTE, Grade, Region, etc.
 */
function processDepartmentData(rows) {
  const deptMap = {};

  for (const row of rows) {
    const dept = row["Organisation"] || row["Department"] || "";
    const headcount = parseInt(row["Headcount"] || "0", 10);
    const fte = parseInt(row["FTE"] || "0", 10);

    if (!dept || isNaN(headcount)) continue;

    if (!deptMap[dept]) {
      deptMap[dept] = { dept, headcount: 0, fte: 0 };
    }
    deptMap[dept].headcount += headcount;
    deptMap[dept].fte += fte;
  }

  return Object.values(deptMap)
    .sort((a, b) => b.headcount - a.headcount)
    .slice(0, 20);
}

function processGradeData(rows) {
  const gradeMap = {};

  for (const row of rows) {
    const grade = row["Grade"] || row["Responsibility Level"] || "";
    const headcount = parseInt(row["Headcount"] || "0", 10);
    const salary = parseFloat(row["Median Salary"] || "0");

    if (!grade || isNaN(headcount)) continue;

    if (!gradeMap[grade]) {
      gradeMap[grade] = { grade, headcount: 0, totalSalary: 0, count: 0 };
    }
    gradeMap[grade].headcount += headcount;
    if (salary > 0) {
      gradeMap[grade].totalSalary += salary;
      gradeMap[grade].count++;
    }
  }

  return Object.values(gradeMap).map((g) => ({
    grade: g.grade,
    headcount: g.headcount,
    medianSalary: g.count > 0 ? Math.round(g.totalSalary / g.count) : 0,
  }));
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log("UK Civil Service Statistics Ingestion");
  console.log("=====================================\n");

  const csvPath = process.argv.find((a) => a.startsWith("--csv="));
  const csvFile = csvPath
    ? csvPath.split("=")[1]
    : null;

  if (csvFile) {
    console.log(`Reading CSV from: ${csvFile}`);
    const text = fs.readFileSync(csvFile, "utf-8");
    const rows = parseCSV(text);
    console.log(`Parsed ${rows.length} rows`);

    const departments = processDepartmentData(rows);
    const grades = processGradeData(rows);

    // Update the civil service JSON
    const existing = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, "civil-service.json"), "utf-8")
    );

    if (departments.length > 0) {
      existing.departments = departments;
      console.log(`Updated ${departments.length} departments`);
    }
    if (grades.length > 0) {
      existing.payGrades = grades;
      console.log(`Updated ${grades.length} pay grades`);
    }

    fs.writeFileSync(
      path.join(DATA_DIR, "civil-service.json"),
      JSON.stringify(existing, null, 2)
    );
    console.log("Saved updated civil-service.json");
  } else {
    console.log("No CSV provided. To update civil service data:");
    console.log("");
    console.log("1. Download the latest CSV from:");
    console.log("   https://www.gov.uk/government/statistics/civil-service-statistics");
    console.log("");
    console.log("2. Run:");
    console.log("   node scripts/ingest-civil-service.mjs --csv=path/to/file.csv");
    console.log("");
    console.log("Current data summary:");

    const data = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, "civil-service.json"), "utf-8")
    );
    const latest = data.timeline[data.timeline.length - 1];
    console.log(`  Latest year: ${latest.year}`);
    console.log(`  Headcount: ${latest.headcount.toLocaleString()}`);
    console.log(`  FTE: ${latest.fte.toLocaleString()}`);
    console.log(`  Departments tracked: ${data.departments.length}`);
  }
}

main();
