console.log("=== ALL ENVIRONMENT KEYS ===");
for (const k of Object.keys(process.env)) {
  if (k.startsWith("npm_") || k.startsWith("NODE_") || k.includes("COLOR") || k.includes("TERM") || k.includes("PATH") || k.includes("HOME")) {
    continue; // Skip noise
  }
  const val = process.env[k] || "";
  let display = val;
  if (val.length > 20) {
    display = val.substring(0, 10) + "..." + val.substring(val.length - 10);
  }
  if (k.toUpperCase().includes("PASS") || k.toUpperCase().includes("KEY") || k.toUpperCase().includes("SECRET") || k.toUpperCase().includes("TOKEN") || k.toUpperCase().includes("URL") || k.toUpperCase().includes("DB") || k.toUpperCase().includes("CONN")) {
    display = `REDACTED (length: ${val.length})`;
  }
  console.log(`- ${k}: ${display}`);
}
