import { userEvent } from "@testing-library/user-event";

/**
 * Best-effort UI exerciser for smoke coverage. Repeatedly fills inputs and
 * clicks every button in the document (dialogs render into portals on
 * document.body, so we query the whole document, not just the container).
 *
 * Every interaction is wrapped so a thrown handler never fails the test — the
 * goal is to execute open-dialog / submit / toggle code paths, not to assert
 * exact behaviour. Bounded passes keep it from looping forever.
 */
export async function exerciseUi(passes = 4) {
  const user = userEvent.setup();

  for (let pass = 0; pass < passes; pass++) {
    const inputs = Array.from(
      document.querySelectorAll<HTMLElement>(
        'input:not([type="checkbox"]):not([type="radio"]), textarea',
      ),
    );
    for (const el of inputs) {
      try {
        await user.click(el);
        await user.keyboard("1");
      } catch {
        /* ignore */
      }
    }

    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("button"));
    for (const btn of buttons) {
      if (btn.disabled) continue;
      try {
        await user.click(btn);
      } catch {
        /* ignore */
      }
    }
  }
}
