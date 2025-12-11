// playerParser.js
function parsePlayerFile(content) {
  const lines = content.split(/\r?\n/);
  const result = {};
  let currentSection = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Skip empty lines or comments
    if (!line || line.startsWith(";") || line.startsWith("#")) {
      continue;
    }

    // Section header: [section]
    const sectionMatch = line.match(/^\[(.+)]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      if (!result[currentSection]) {
        result[currentSection] = {};
      }
      continue;
    }

    // key=value
    const equalIndex = line.indexOf("=");
    if (equalIndex === -1) continue;

    const key = line.slice(0, equalIndex).trim();
    const valueRaw = line.slice(equalIndex + 1).trim();

    let value = valueRaw;

    // Try to parse numbers (but keep dates/times with ':' or '.' as strings)
    if (/^-?\d+(\.\d+)?$/.test(valueRaw)) {
      value = Number(valueRaw);
    }

    if (currentSection) {
      result[currentSection][key] = value;
    } else {
      result[key] = value;
    }
  }

  return result;
}

module.exports = { parsePlayerFile };
