function generateCommandId() {
  // Short, sortable-ish, unique-enough for in-memory v1.
  // Later, swap to UUID v7 or DB-generated IDs without touching controllers.
  const rand = Math.random().toString(36).slice(2, 10);
  return `cmd_${Date.now()}_${rand}`;
}

module.exports = { generateCommandId };

