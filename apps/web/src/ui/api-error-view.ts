import { ApiError, type ApiErrorKind } from "../api/api-error";
import { paths } from "../router/routes";
import { createMessageView } from "./message-view";

const MESSAGES: Record<ApiErrorKind, { title: string; text: string }> = {
  network: {
    title: "Sin conexión",
    text: "No pudimos comunicarnos con el servidor. Revisá tu internet e intentá de nuevo.",
  },
  rate_limited: { title: "Demasiados pedidos", text: "Esperá un minuto e intentá de nuevo." },
  invalid: { title: "Búsqueda no válida", text: "Revisá lo que escribiste e intentá de nuevo." },
  not_found: { title: "No encontrado", text: "No hay nada para esa consulta." },
  server: { title: "Algo salió mal", text: "El servidor tuvo un problema. Intentá de nuevo en un rato." },
};

/** The message for a failed request, with a retry and a way back home. */
export function createApiErrorView(error: unknown, onRetry: () => void): HTMLElement {
  const kind = error instanceof ApiError ? error.kind : "server";
  return createMessageView({
    ...MESSAGES[kind],
    symbol: "!",
    actions: [
      { label: "Reintentar", onClick: onRetry },
      { label: "Ir al inicio", href: paths.home, variant: "quiet" },
    ],
  });
}
