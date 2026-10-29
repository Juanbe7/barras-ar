import { hasValidCheckDigit } from "../../domain/barcode";
import { paths } from "../../router/routes";
import { CameraError, toCameraError } from "../../scanner/camera";
import { createScanner } from "../../scanner/create-scanner";
import { findTorch } from "../../scanner/torch";
import type { BarcodeScanner } from "../../scanner/barcode-scanner";
import { h } from "../../ui/dom";
import { createCloseIcon } from "../../ui/icons";
import { createMessageView } from "../../ui/message-view";
import type { ScreenFactory } from "../screen";
import { createTorchButton } from "./torch-button";
import "./scan-screen.css";

const CAMERA_MESSAGES: Record<CameraError["kind"], { title: string; text: string }> = {
  denied: {
    title: "Falta permiso para la cámara",
    text: "Permití el acceso a la cámara en el navegador para poder escanear.",
  },
  unavailable: {
    title: "No encontramos una cámara",
    text: "Este dispositivo no tiene cámara disponible. Podés buscar por nombre o escribir el código.",
  },
};

export const createScanScreen: ScreenFactory = (ctx) => {
  const video = h("video", { class: "scan__video", playsinline: true, muted: true, autoplay: true });
  const closeLink = h("a", { class: "scan__close", href: `#${paths.home}`, "aria-label": "Cerrar" });
  closeLink.append(createCloseIcon());
  const bar = h("div", { class: "scan__bar" }, closeLink);
  const element = h(
    "main",
    { class: "screen scan" },
    bar,
    video,
    h("div", { class: "scan__guide", "aria-hidden": true }),
    h("p", { class: "scan__hint" }, "Apuntá al código de barras"),
  );

  let scanner: BarcodeScanner | null = null;
  let disposed = false;

  function showCameraError(error: unknown): void {
    element.className = "screen";
    element.replaceChildren(
      createMessageView({
        ...CAMERA_MESSAGES[toCameraError(error).kind],
        symbol: "!",
        actions: [{ label: "Buscar por nombre o código", href: paths.home }],
      }),
    );
  }

  function onCode(code: string): void {
    // a misread has a wrong check digit; ignore it and keep scanning
    if (disposed || !hasValidCheckDigit(code)) return;
    ctx.navigate(paths.product(code), { replace: true });
  }

  async function begin(): Promise<void> {
    try {
      scanner = await createScanner();
      if (disposed) return;
      await scanner.start(video, onCode);
      if (disposed) return scanner.stop();
      // only phones with a flash get the button; the camera must be running to ask
      const torch = findTorch(video);
      if (torch) bar.append(createTorchButton(torch));
    } catch (error) {
      if (!disposed) showCameraError(error);
    }
  }
  void begin();

  return {
    element,
    dispose: () => {
      disposed = true;
      scanner?.stop();
    },
  };
};
