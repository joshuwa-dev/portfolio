// Pure JS utilities to merge duplicate documents grouped by email.
export function normalizeTimestamp(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  const n = Date.parse(val);
  if (!isNaN(n)) return new Date(n);
  if (typeof val === "number") return new Date(val);
  return null;
}

export function mergeDocsArray(docs) {
  // docs: [{ id, data }]
  if (!docs || docs.length === 0) return null;
  // determine primary: doc with earliest createdAt
  const docsWithCreated = docs.map((d) => ({
    ...d,
    _created: normalizeTimestamp(d.data.createdAt) || new Date(0),
  }));
  docsWithCreated.sort((a, b) => a._created - b._created);
  const primary = docsWithCreated[0];

  // aggregate messages
  const allMessages = [];
  for (const d of docs) {
    const msgs = Array.isArray(d.data.messages) ? d.data.messages : [];
    for (const m of msgs) {
      const ts = normalizeTimestamp(m.timestamp) || new Date(0);
      allMessages.push({ text: m.text, timestamp: ts });
    }
  }
  // sort by timestamp
  allMessages.sort((a, b) => a.timestamp - b.timestamp);

  const merged = {
    id: primary.id,
    name: primary.data.name || null,
    email: primary.data.email || null,
    interest: primary.data.interest || null,
    createdAt: primary.data.createdAt || primary._created,
    updatedAt: new Date(),
    messages: allMessages.map((m) => ({
      text: m.text,
      timestamp: m.timestamp,
    })),
    previousMessage: primary.data.lastMessage || null,
    lastMessage: allMessages.length
      ? allMessages[allMessages.length - 1].text
      : null,
  };

  const toDelete = docs.map((d) => d.id).filter((id) => id !== primary.id);

  return { merged, toDelete };
}
