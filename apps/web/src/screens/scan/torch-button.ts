import type { Torch } from "../../scanner/torch";
import { h } from "../../ui/dom";
import { createFlashIcon } from "../../ui/icons";

/** A round button that turns the phone's flash on and off; lit yellow while the flash is on. */
export function createTorchButton(torch: Torch): HTMLElement {
  const button = h("button", {
    class: "scan__torch",
    type: "button",
    "aria-label": "Encender la linterna",
    "aria-pressed": "false",
    onclick: async () => {
      try {
        const on = await torch.toggle();
        button.setAttribute("aria-pressed", String(on));
        button.setAttribute("aria-label", on ? "Apagar la linterna" : "Encender la linterna");
      } catch {
        // the camera refused: the button simply stays as it was
      }
    },
  });
  button.append(createFlashIcon());
  return button;
}
