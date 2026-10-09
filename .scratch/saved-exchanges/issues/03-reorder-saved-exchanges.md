# 03 — Reorder saved exchanges

**What to build:** In the list of saved exchanges, the user can move an exchange up or down. Each row has up and down buttons, so the phrases used most can be brought to the top. The order is kept between sessions.

Deleting a saved exchange was part of this ticket and has moved to ticket 04.

The full design is in `docs/specs/saved-exchanges.md`; read "The list" and "Storage". Terms are defined in `CONTEXT.md`.

**Blocked by:** None. Ticket 02 is done.

**Status:** on hold

This ticket was built once and then held back: it is not clear that reordering is needed, and the arrows made the list confusing. Do not start it without a decision to go ahead. The earlier work is on the local branch `feat/reorder-delete-saved`, commit `5e217c1`, which was never merged. That commit also contains the delete button that now belongs to ticket 04.

- [ ] Each row has buttons named `Mou amunt` and `Mou avall`, visible whether the row is open or closed.
- [ ] `Mou amunt` moves the saved exchange one place up and `Mou avall` one place down.
- [ ] `Mou amunt` is disabled on the first row and `Mou avall` on the last. Both are disabled when there is one saved exchange.
- [ ] Pressing a move button does not open or close the row.
- [ ] A row that is open stays open when it is moved, and when another row is moved past it.
- [ ] After a move, the keyboard's focus stays on the button that was pressed, or goes to the other move button of that row when the pressed one has become disabled.
- [ ] The order is the same after the chat is unmounted and rendered afresh.
- [ ] An exchange saved after reordering still goes to the top.
- [ ] If ticket 04 is done: a sound started in the list carries on when rows are moved.
- [ ] If ticket 05 is done: a move in this tab keeps an exchange that another tab has saved, and a move whose target another tab has removed changes nothing.
- [ ] Moves go through the storage module, which identifies the exchange by its message and reply text.
- [ ] Tests are added to the existing chat component tests and drive the chat as a user would.
- [ ] `npm test` and `npm run lint` pass.
