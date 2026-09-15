// The contract between the main process and the page it captures a game card
// from. The card is an ordinary route in the renderer, drawn in a second window
// sized to it, so the two halves only need to agree on where the route lives
// and on how the page says it is done drawing.

export const CARD_ROUTE = "/card";

export const cardRoute = (gameId: number) => `${CARD_ROUTE}/${gameId}`;

// Set on `window` by the card page. The main process has no other way to know
// when the card's data and every one of its icons have landed, and a capture
// taken a moment early is a card with holes in it.
export const CARD_STATUS_KEY = "__mayhemCardStatus";

export interface CardStatus {
  state: "ready" | "error";
  // Height of the card in CSS pixels, which the window is resized to before the
  // capture so the whole thing is on screen at once
  height: number;
  error?: string;
}
