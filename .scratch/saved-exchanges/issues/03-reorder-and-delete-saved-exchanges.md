# 03 — Reorder and delete saved exchanges

**What to build:** In the list of saved exchanges, the user can move an exchange up or down and can delete it. Each collapsed row has up and down buttons, so the phrases used most can be brought to the top. The delete button sits inside the open row, under the reply, so that it takes two taps to reach and is not hit by accident while reordering. Deletion is immediate. The order is kept between sessions.

The full design is in `docs/specs/saved-exchanges.md`; read "The list" and "Storage". Terms are defined in `CONTEXT.md`.

**Blocked by:** 02 — Save an exchange and find it in the list.

**Status:** ready-for-agent

- [ ] Each row has buttons named `Mou amunt` and `Mou avall`, visible whether the row is open or closed.
- [ ] `Mou amunt` moves the saved exchange one place up and `Mou avall` one place down.
- [ ] `Mou amunt` is disabled on the first row and `Mou avall` on the last. Both are disabled when there is one saved exchange.
- [ ] Pressing a move button does not open or close the row.
- [ ] A row that is open stays open when it is moved, and when another row is moved past it.
- [ ] The order is the same after the chat is unmounted and rendered afresh.
- [ ] An exchange saved after reordering still goes to the top.
- [ ] The open row has a button named `Suprimeix` under the reply. A closed row has none.
- [ ] Pressing `Suprimeix` removes the saved exchange at once, with no confirmation and no undo. No row is open afterwards.
- [ ] Deleting the last saved exchange shows the empty-list text.
- [ ] A deleted exchange is still gone after a remount, and its reply in the conversation shows an outline bookmark when tapped.
- [ ] Moves and deletes go through the storage module, which identifies the exchange by its message and reply text.
- [ ] Tests are added to the existing chat component tests and drive the chat as a user would.
- [ ] `npm test` and `npm run lint` pass.
