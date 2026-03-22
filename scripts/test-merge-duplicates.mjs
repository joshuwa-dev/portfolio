import assert from "assert";
import { mergeDocsArray } from "../src/lib/mergeDuplicates.js";

function makeDoc(id, email, createdAt, messages = []) {
  return {
    id,
    data: {
      email,
      createdAt,
      messages,
      lastMessage: messages.length ? messages[messages.length - 1].text : null,
      name: `Name ${id}`,
    },
  };
}

function ts(ms) {
  return new Date(ms);
}

async function run() {
  // create three docs with same email
  const docs = [
    makeDoc("a", "dup@example.com", ts(1000), [
      { text: "first", timestamp: ts(1000) },
    ]),
    makeDoc("b", "dup@example.com", ts(2000), [
      { text: "second", timestamp: ts(2000) },
    ]),
    makeDoc("c", "dup@example.com", ts(1500), [
      { text: "between", timestamp: ts(1500) },
    ]),
  ];

  const { merged, toDelete } = mergeDocsArray(docs);

  // primary should be id 'a' (earliest createdAt)
  assert.strictEqual(merged.id, "a");
  // messages should be three in chronological order
  assert.strictEqual(merged.messages.length, 3);
  assert.strictEqual(merged.messages[0].text, "first");
  assert.strictEqual(merged.messages[1].text, "between");
  assert.strictEqual(merged.messages[2].text, "second");
  // toDelete should include b and c
  assert.deepStrictEqual(new Set(toDelete), new Set(["b", "c"]));

  console.log("merge-docs unit tests passed");
}

run().catch((err) => {
  console.error("merge tests failed", err);
  process.exit(1);
});
