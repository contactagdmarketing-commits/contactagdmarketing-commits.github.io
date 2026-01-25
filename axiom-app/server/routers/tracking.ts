import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { trackBehavior as recordBehavior } from "../db";

export const trackingRouter = router({
  trackBehavior: publicProcedure
    .input(z.object({
      sessionId: z.string(),
      eventType: z.enum(["page_view", "scroll", "message_sent", "bloc_completed", "page_left", "time_spent"]),
      eventData: z.record(z.string(), z.any()).optional(),
    }))
    .mutation(async ({ input }) => {
      await recordBehavior({
        sessionId: input.sessionId,
        eventType: input.eventType,
        eventData: input.eventData ? JSON.stringify(input.eventData) : undefined,
      });
      return { success: true };
    }),
});
