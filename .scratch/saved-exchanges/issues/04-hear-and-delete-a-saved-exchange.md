# 04 — Hear and delete a saved exchange

**What to build:** In the list of saved exchanges, an open row gains two buttons under its reply: one to hear the reply spoken, and one to delete the saved exchange.

*Deleting.* The delete button sits inside the open row, so that it takes two taps to reach. Deletion is immediate, with no confirmation and no undo. Today a saved exchange can only be removed by unsaving it from the conversation, which needs the same reply to be on screen; after a reload it usually is not. Deleting moved here from ticket 03, which is on hold. A working delete button with tests exists on the local branch `feat/reorder-delete-saved`, commit `5e217c1`, alongside the reordering this ticket does not want; lift the delete from there and leave the move buttons behind.

*Hearing.* The speaker button is shown in the open row with no further tap needed. The sound behaves by the same rule as in the conversation: it plays until it ends, until another sound is started, or until a mute button is pressed. So a reply started in the list keeps speaking when the user goes back to the conversation, and a reply started in the conversation keeps speaking when the user opens the list. The header mute button from ticket 01 is the way to stop it from wherever the user is.

Speech is fetched through the existing speak route each time; no audio is stored. This is the one part of the list that needs the network.

The full design is in `docs/specs/saved-exchanges.md`; read "The list" and "Sound". Terms are defined in `CONTEXT.md`.

**Blocked by:** None — can start immediately. Tickets 01 and 02 are done.

**Status:** done

Deleting

- [x] The open row has a button named `Suprimeix` under the reply. A closed row has none.
- [x] Pressing `Suprimeix` removes the saved exchange at once, with no confirmation and no undo. No row is open afterwards.
- [x] After a delete, the keyboard's focus goes to the row that takes the deleted one's place, or to the last row if the deleted one was last.
- [x] Deleting the last saved exchange shows the empty-list text.
- [x] A deleted exchange is still gone after a remount, and its reply in the conversation shows an outline bookmark when tapped.
- [x] Deletes go through the storage module, which identifies the exchange by its message and reply text. Deleting a saved exchange and unsaving it are the same operation.
- [x] No file in the app folder is named `icon`: Next treats that name as the route for the site icon. A shared icon component needs another name.

Hearing

- [x] An open row in the list has a speaker button named `Escolta` under the reply. Tapping it speaks the reply.
- [x] The button reads `Carregant…` while the audio is prepared, and `No s'ha pogut reproduir l'àudio.` is shown when it fails, as in the conversation.
- [x] While a saved reply is speaking, its row shows a mute button in place of the speaker button whenever the row is open, and the header shows its mute button in both views.
- [x] Either mute button ends the sound. Both are removed when the speech ends.
- [x] A sound started in the list carries on when the user returns to the conversation, and one started in the conversation carries on when the user opens the list.
- [x] A sound started in the list carries on when its row is closed and when another row is opened.
- [x] A sound asked for in one view takes over from a sound started in the other once it has loaded, and not before. There is one audio player and one sound at a time.
- [x] A saved reply that was muted or has ended is spoken again from the audio already loaded, with no second request, as in the conversation.
- [x] A sound requested in one view starts when it is ready even if the user has since switched view.
- [x] What is speaking identifies the one place the sound was started. The same text in the other view (a reply in the conversation that is also saved) shows an ordinary speaker button there, and tapping it starts a new sound.
- [x] The sound stops when the saved exchange it was started from leaves the list, for whatever reason. Deleting it with `Suprimeix` is the case to test.
- [x] Unsaving a reply from the conversation does not stop a sound that was started on that reply in the conversation.
- [x] `Nova conversa` stops a sound started in the conversation and does not stop one started in the list.
- [x] Hearing a saved reply works before a session has started.

Tests

- [x] Tests are added to the existing chat component tests, using the existing fake audio player and fake network. Where two mute buttons are on screen, tests tell them apart by where they sit.
- [ ] `npm test` and `npm run lint` pass.
