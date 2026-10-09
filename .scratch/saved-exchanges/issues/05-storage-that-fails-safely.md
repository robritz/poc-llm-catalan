# 05 — Storage that fails safely

**What to build:** Saved exchanges behave sensibly when storage does not. If the browser refuses a write, because storage is full or blocked, the user is told and the bookmark does not claim a save that did not happen. If what is stored cannot be read, the list is shown as empty and the chat keeps working. If the app is open in two tabs, a change in one appears in the other, and no save or delete in one tab erases a save made in the other.

The full design is in `docs/specs/saved-exchanges.md`; read "Storage" and the storage paragraph of "Testing Decisions". Terms are defined in `CONTEXT.md`.

**Blocked by:** 04 — Hear and delete a saved exchange, for the rules about deleting. Ticket 03, reordering, is on hold; its rules about moving are listed in that ticket and are not part of this one.

**Status:** done

A write that fails

- [x] When saving fails, `No s'ha pogut desar.` is shown in the row under the reply, styled as the audio failure message is, and the bookmark stays an outline.
- [x] A failed write leaves the stored list as it was.
- [x] The message is gone once a later save on that reply succeeds, or the row is dismissed.

Storage that cannot be read

- [x] Stored data that is missing, cannot be parsed, has an unknown format version, or is not the expected shape is shown as an empty list. The chat works as usual.
- [x] Such data is left untouched until the user's next save, which replaces it with a list holding that one exchange.

Other tabs

- [x] Every write reads the stored list at that moment, applies its one change, and writes the result. It never writes back a list the page is holding in memory.
- [x] An exchange saved in another tab appears in an open list in this tab without a reload, and its reply in this tab's conversation shows a filled bookmark when next tapped.
- [x] After another tab has saved an exchange, a save or delete in this tab keeps that exchange.
- [x] A delete whose target another tab has already removed changes nothing.
- [x] When another tab deletes the row that is open in this tab, the row goes and no row is open.

Tests

- [x] Tests are added to the existing chat component tests and drive the chat as a user would. A failed write is simulated by making the storage write throw. Unreadable storage is simulated by placing junk under the key before rendering. Another tab is simulated by changing storage directly and dispatching a `storage` event.
- [ ] `npm test` and `npm run lint` pass.
