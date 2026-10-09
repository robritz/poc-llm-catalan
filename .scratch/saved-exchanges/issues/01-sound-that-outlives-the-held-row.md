# 01 — Sound that outlives the held row

**What to build:** In the conversation, a reply that is being spoken keeps speaking until it ends, until another reply is spoken, or until a mute button is pressed. Today, holding a second reply stops the first reply's sound, because the row under a reply carries both the speaker button and the mute button and there is only one row. After this ticket, holding another reply only moves the row with the speaker button; the reply that is speaking keeps its own mute button under it, and a second mute button appears in the header for as long as anything is speaking.

This is a prefactor for saved exchanges (see `docs/specs/saved-exchanges.md`, section "Sound"). It changes nothing about saving. Its purpose is to track what is speaking separately from which reply is showing the held row, so that a later ticket can let a sound started in the list of saved exchanges carry on while the user is elsewhere.

Terms are defined in `CONTEXT.md`.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Holding a second reply while a first is speaking shows the speaker button under the second and does not stop the sound.
- [ ] The reply that is speaking shows a mute button under it for as long as it is speaking, even when the held row is under another reply.
- [ ] While a reply is speaking, a mute button named `Silencia` is shown in the header. It is not shown when nothing is speaking.
- [ ] Pressing either mute button ends the sound and removes both.
- [ ] Both mute buttons are removed when the speech ends on its own.
- [ ] Tapping the speaker button under a second reply ends the first reply's sound and speaks the second. Two replies never speak at once.
- [ ] `Nova conversa` still ends the sound.
- [ ] Pressing elsewhere still dismisses a speaker button that has not been used, and still leaves the mute buttons in place.
- [ ] The loading state (`Carregant…`) and the failure message (`No s'ha pogut reproduir l'àudio.`) behave as before.
- [ ] The existing test asserting that holding another reply ends the sound is rewritten to assert that it does not. The part asserting that clearing the conversation ends the sound is kept.
- [ ] New tests are added to the existing chat component tests, driving the chat as a user would. Where two mute buttons are on screen, tests tell them apart by where they sit, not by name alone.
- [ ] `npm test` and `npm run lint` pass.
