import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { createCandidateSession, getCandidateSession, updateCandidateSession, addConversationMessage, getConversationHistory, trackBehavior, createRecruiterNotification } from "../db";
import { nanoid } from "nanoid";
import { AXIOM_SYSTEM_PROMPT, AXIOM_INITIAL_MESSAGE, AXIOM_SYNTHESIS_PROMPT, MATCHING_SYSTEM_PROMPT, MATCHING_PROMPT } from "../../shared/prompts";

const AXIOM_BLOCS = [
  { num: 1, title: "Fondamentaux Professionnels", prompt: "Raconte-moi : Quel a été ton premier vrai job, et qu'est-ce qui t'a marqué chez toi pendant cette période ?" },
  { num: 2, title: "Moteurs & Valeurs", prompt: "Pense à un moment où tu t'es senti(e) vraiment vivant(e) au travail — pas forcément heureux, mais vivant. Qu'est-ce qui se passait ?" },
  { num: 3, title: "Rapport à l'Autonomie", prompt: "Décris-moi une situation où tu as dû prendre une décision importante sans avoir d'instructions claires. Comment tu as géré ça ?" },
  { num: 4, title: "Rapport à l'Échec & l'Erreur", prompt: "Raconte-moi un moment où tu as échoué ou fait une grosse erreur. Comment tu l'as vécu ?" },
  { num: 5, title: "Rapport à l'Autorité & la Hiérarchie", prompt: "Décris-moi un manager que tu as respecté (ou non). Qu'est-ce qu'il faisait qui changeait quelque chose pour toi ?" },
  { num: 6, title: "Rapport à la Vente & la Prospection", prompt: "Comment tu te sens face à l'idée de convaincre quelqu'un, de vendre une idée, un produit, ou toi-même ?" },
  { num: 7, title: "Rapport à la Stabilité & au Risque", prompt: "Qu'est-ce qui te fait peur professionnellement ? Qu'est-ce que tu cherches à sécuriser ?" },
  { num: 8, title: "Projection & Ambition", prompt: "Où tu te vois dans 5 ans ? Pas en termes de titre ou de salaire, mais en termes de ce que tu fais vraiment." },
  { num: 9, title: "Cohérence Globale", prompt: "Si tu devais résumer en une phrase ce qui te pousse vraiment au travail — pas ce que tu crois devoir dire, mais ce qui est vrai pour toi — qu'est-ce que ce serait ?" },
];

export const axiomRouter = router({
  // Initialize a new session
  initSession: publicProcedure
    .input(z.object({
      email: z.string().email(),
      name: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const sessionId = nanoid(32);
      
      const session = await createCandidateSession({
        sessionId,
        email: input.email,
        name: input.name,
        phase: "axiom",
        currentBloc: 1,
      });

      if (!session) {
        throw new Error("Failed to create session");
      }

      // Add initial message to conversation
      await addConversationMessage({
        sessionId,
        role: "assistant",
        content: AXIOM_INITIAL_MESSAGE,
        bloc: 0,
        phase: "axiom",
      });

      // Track session start
      await trackBehavior({
        sessionId,
        eventType: "page_view",
        eventData: JSON.stringify({ action: "session_started" }),
      });

      return {
        sessionId,
        initialMessage: AXIOM_INITIAL_MESSAGE,
      };
    }),

  // Get or restore a session
  getSession: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
      const session = await getCandidateSession(input.sessionId);
      if (!session) {
        throw new Error("Session not found");
      }

      const history = await getConversationHistory(input.sessionId, "axiom");
      
      return {
        session,
        history: history.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
      };
    }),

  // Send a message and get AXIOM response
  sendMessage: publicProcedure
    .input(z.object({
      sessionId: z.string(),
      message: z.string(),
    }))
    .mutation(async ({ input }) => {
      const session = await getCandidateSession(input.sessionId);
      if (!session) {
        throw new Error("Session not found");
      }

      // Save user message
      await addConversationMessage({
        sessionId: input.sessionId,
        role: "user",
        content: input.message,
        bloc: session.currentBloc,
        phase: "axiom",
      });

      // Track message sent
      await trackBehavior({
        sessionId: input.sessionId,
        eventType: "message_sent",
        eventData: JSON.stringify({ bloc: session.currentBloc }),
      });

      // Get conversation history for context
      const history = await getConversationHistory(input.sessionId, "axiom");

      // Build messages for LLM
      const messages = [
        { role: "system" as const, content: AXIOM_SYSTEM_PROMPT },
        ...history.map(msg => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        })),
        { role: "user" as const, content: input.message },
      ];

      // Get AXIOM response with streaming
      const response = await invokeLLM({
        messages,
      });

      const assistantContent = response.choices[0]?.message?.content;
      const assistantMessage = typeof assistantContent === 'string' ? assistantContent : "Je n'ai pas pu générer une réponse.";

      // Save assistant message
      await addConversationMessage({
        sessionId: input.sessionId,
        role: "assistant",
        content: assistantMessage,
        bloc: session.currentBloc,
        phase: "axiom",
      });

      return {
        message: assistantMessage,
        currentBloc: session.currentBloc,
      };
    }),

  // Move to next bloc
  nextBloc: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ input }) => {
      const session = await getCandidateSession(input.sessionId);
      if (!session) {
        throw new Error("Session not found");
      }

      const nextBlocNum = session.currentBloc + 1;

      // Check if we've completed all blocs
      if (nextBlocNum > AXIOM_BLOCS.length) {
        // Generate synthesis and move to matching phase
        return await generateSynthesisAndStartMatching(input.sessionId);
      }

      // Track bloc completion
      await trackBehavior({
        sessionId: input.sessionId,
        eventType: "bloc_completed",
        eventData: JSON.stringify({ bloc: session.currentBloc }),
      });

      // Update session
      await updateCandidateSession(input.sessionId, {
        currentBloc: nextBlocNum,
      });

      const nextBloc = AXIOM_BLOCS[nextBlocNum - 1];
      const blocMessage = `**BLOC ${nextBloc.num} : ${nextBloc.title}**\n\n${nextBloc.prompt}`;

      // Add bloc message to conversation
      await addConversationMessage({
        sessionId: input.sessionId,
        role: "assistant",
        content: blocMessage,
        bloc: nextBlocNum,
        phase: "axiom",
      });

      return {
        blocNum: nextBlocNum,
        blocMessage,
      };
    }),

  // Generate synthesis and start matching phase
  generateSynthesis: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ input }) => {
      return await generateSynthesisAndStartMatching(input.sessionId);
    }),

  // Get matching result
  getMatchingResult: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
      const session = await getCandidateSession(input.sessionId);
      if (!session || !session.matchingResult) {
        throw new Error("Matching result not found");
      }

      return {
        result: session.matchingResult,
      };
    }),

  // Send feedback
  sendFeedback: publicProcedure
    .input(z.object({
      sessionId: z.string(),
      feedback: z.string(),
    }))
    .mutation(async ({ input }) => {
      const session = await getCandidateSession(input.sessionId);
      if (!session) {
        throw new Error("Session not found");
      }

      // Save feedback as a message
      await addConversationMessage({
        sessionId: input.sessionId,
        role: "user",
        content: `[FEEDBACK] ${input.feedback}`,
        phase: "matching",
      });

      return { success: true };
    }),
});

// Helper function to generate synthesis and start matching
async function generateSynthesisAndStartMatching(sessionId: string) {
  const session = await getCandidateSession(sessionId);
  if (!session) {
    throw new Error("Session not found");
  }

  // Get all conversation history for synthesis
  const history = await getConversationHistory(sessionId, "axiom");

  // Build messages for synthesis
  const messages = [
    { role: "system" as const, content: AXIOM_SYSTEM_PROMPT },
    ...history.map(msg => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
    { role: "user" as const, content: AXIOM_SYNTHESIS_PROMPT },
  ];

  // Generate synthesis
  const synthesisResponse = await invokeLLM({
    messages,
  });

  const synthesisContent = synthesisResponse.choices[0]?.message?.content;
  const synthesis = typeof synthesisContent === 'string' ? synthesisContent : '';

  // Save synthesis
  await updateCandidateSession(sessionId, {
    axiomSynthesis: synthesis,
    phase: "matching",
  });

  // Add synthesis to conversation
  await addConversationMessage({
    sessionId,
    role: "assistant",
    content: synthesis,
    phase: "matching",
  });

  // Generate matching result
  const matchingMessages = [
    { role: "system" as const, content: MATCHING_SYSTEM_PROMPT },
    { role: "user" as const, content: `Voici le profil AXIOM du candidat:\n\n${synthesis}\n\n${MATCHING_PROMPT}` },
  ];

  const matchingResponse = await invokeLLM({
    messages: matchingMessages,
  });

  const matchingContent = matchingResponse.choices[0]?.message?.content;
  const matchingResult = typeof matchingContent === 'string' ? matchingContent : '';

  // Save matching result
  await updateCandidateSession(sessionId, {
    matchingResult,
    phase: "completed",
    completedAt: new Date(),
  });

  // Add matching result to conversation
  await addConversationMessage({
    sessionId,
    role: "assistant",
    content: matchingResult,
    phase: "matching",
  });

  // Create recruiter notification
  await createRecruiterNotification({
    sessionId,
    candidateEmail: session.email,
    candidateName: session.name,
    notificationType: "profile_completed",
    status: "pending",
  });

  return {
    synthesis,
    matchingResult,
    phase: "completed",
  };
}

// Add trackBehavior procedure to axiomRouter (before closing brace)
// Note: This is added via shell to avoid JSON escaping issues
