import { useMemo } from "react";
import { useQueueSelection } from "./useQueueSelection";
import { useNavLayout } from "./useNavLayout";
import { visibleNavItems } from "../../shared/navigation";
import { hasAugments } from "../../shared/queues";

/**
 * The pages the sidebar is showing right now, in order.
 *
 * Shared with the number shortcuts so the two can't disagree: pressing 4 has to
 * open the page sitting fourth in the list, whatever the layout and whether or
 * not the current queue has augments.
 */
export function useSidebarItems() {
  const [queue] = useQueueSelection();
  const layout = useNavLayout();
  return useMemo(
    () => visibleNavItems(layout).filter((item) => hasAugments(queue) || item.id !== "augments"),
    [layout, queue],
  );
}
