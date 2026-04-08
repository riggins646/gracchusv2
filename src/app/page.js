"use client";

// The main dashboard component is the same React app we built,
// now importing data from separate JSON files.
// Main dashboard component importing data from separate JSON files
// with imports from src/data/*.json

import Dashboard from "../components/Dashboard";

export default function Home() {
  return <Dashboard />;
}
