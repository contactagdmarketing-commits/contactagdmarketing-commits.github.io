import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import {
  createCandidateSession,
  getCandidateSession,
  updateCandidateSession,
  addConversationMessage,
  getConversationHistory,
  trackBehavior,
  createRecruiterNotification,
} from "../db";
import { nanoid } from "nanoid";
import {
  AXIOM_SYSTEM_PROMPT,
  AXIOM_INITIAL_MESSAGE,
  AXIOM_SYNTHESIS_PROMPT,
  MATCHING_SYSTEM_PROMPT,
  MATCHING_PROMPT,
  AXIOM_BLOC_1_QUESTIONS,
  AXIOM_BLOC_2A_QUESTIONS,
  AXIOM_BLOC_3_QUESTIONS,
} from "../../shared/prompts";

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

// ========================================================================
// Logique spécifique BLOC 1 - Questions QCM déterministes (A/B/C/D)
// ========================================================================

const BLOC_1_ORDER: Array<keyof typeof AXIOM_BLOC_1_QUESTIONS> = [
  "q1",
  "q2",
  "q3",
  "q4",
  "q5_open",
];

function getAskedBloc1Questions(
  history: Awaited<ReturnType<typeof getConversationHistory>>
) {
  const asked: Array<keyof typeof AXIOM_BLOC_1_QUESTIONS> = [];

  for (const key of BLOC_1_ORDER) {
    const def = AXIOM_BLOC_1_QUESTIONS[key];
    const text = typeof def === "string" ? def : def.text;
    const alreadyAsked = history.some(
      (msg) => msg.role === "assistant" && msg.content.includes(text)
    );
    if (alreadyAsked) {
      asked.push(key);
    }
  }

  return asked;
}

function buildBloc1QuestionMessage(
  key: keyof typeof AXIOM_BLOC_1_QUESTIONS
): string {
  const def = AXIOM_BLOC_1_QUESTIONS[key];

  // Question ouverte (q5_open)
  if (typeof def === "string") {
    return `🔷 BLOC 1 — ÉNERGIE & MOTEURS INTERNES\n\n${def}\n\nRéponds librement, avec tes mots.`;
  }

  const { text, options } = def;
  const entries = Object.entries(options) as Array<[string, string]>;

  const lines = entries.map(([letter, label]) => `${letter}. ${label}`);

  return [
    "🔷 BLOC 1 — ÉNERGIE & MOTEURS INTERNES",
    "",
    text,
    "",
    ...lines,
    "",
    "👉 Réponds en choisissant UNE seule lettre (A, B, C, D...).",
  ].join("\n");
}

// ========================================================================
// Logique spécifique BLOC 2A - Films et séries (collecte uniquement)
// ========================================================================

const BLOC_2A_ORDER: Array<keyof typeof AXIOM_BLOC_2A_QUESTIONS> = [
  "q1_medium",
  "q2_preferences",
  "q3_core",
];

function getAskedBloc2AQuestions(
  history: Awaited<ReturnType<typeof getConversationHistory>>
) {
  const asked: Array<keyof typeof AXIOM_BLOC_2A_QUESTIONS> = [];

  // Vérifier q1_medium
  const q1Text = AXIOM_BLOC_2A_QUESTIONS.q1_medium.text;
  if (history.some((msg) => msg.role === "assistant" && msg.content.includes(q1Text))) {
    asked.push("q1_medium");
  }

  // Vérifier q2_preferences (séries ou films)
  const q2SeriesText = AXIOM_BLOC_2A_QUESTIONS.q2_preferences.text_series;
  const q2FilmsText = AXIOM_BLOC_2A_QUESTIONS.q2_preferences.text_films;
  if (
    history.some(
      (msg) =>
        msg.role === "assistant" &&
        (msg.content.includes(q2SeriesText) || msg.content.includes(q2FilmsText))
    )
  ) {
    asked.push("q2_preferences");
  }

  // Vérifier q3_core
  const q3Text = AXIOM_BLOC_2A_QUESTIONS.q3_core;
  if (history.some((msg) => msg.role === "assistant" && msg.content.includes(q3Text))) {
    asked.push("q3_core");
  }

  return asked;
}

function getBloc2AMediumChoice(
  history: Awaited<ReturnType<typeof getConversationHistory>>
): "series" | "films" | null {
  // Chercher la réponse de l'utilisateur à q1_medium
  const q1Text = AXIOM_BLOC_2A_QUESTIONS.q1_medium.text;
  const q1Index = history.findIndex(
    (msg) => msg.role === "assistant" && msg.content.includes(q1Text)
  );
  if (q1Index === -1) return null;

  // Chercher la réponse de l'utilisateur après q1
  for (let i = q1Index + 1; i < history.length; i++) {
    const msg = history[i];
    if (msg.role === "user") {
      const content = msg.content.trim().toUpperCase();
      if (content === "A" || content.includes("SÉRIE") || content.includes("SERIE")) {
        return "series";
      }
      if (content === "B" || content.includes("FILM")) {
        return "films";
      }
    }
  }
  return null;
}

function buildBloc2AQuestionMessage(
  key: keyof typeof AXIOM_BLOC_2A_QUESTIONS,
  mediumChoice: "series" | "films" | null = null
): string {
  if (key === "q1_medium") {
    const { text, options } = AXIOM_BLOC_2A_QUESTIONS.q1_medium;
    const entries = Object.entries(options) as Array<[string, string]>;
    const lines = entries.map(([letter, label]) => `${letter}. ${label}`);

    return [
      "🔷 BLOC 2A — PROJECTIONS NARRATIVES",
      "",
      "⚠️ Bloc NON interprétatif",
      "⚠️ Aucune analyse avant le Bloc 2B",
      "⚠️ Collecte uniquement",
      "",
      text,
      "",
      ...lines,
      "",
      "👉 Réponds en choisissant UNE seule lettre (A ou B).",
    ].join("\n");
  }

  if (key === "q2_preferences") {
    const text =
      mediumChoice === "series"
        ? AXIOM_BLOC_2A_QUESTIONS.q2_preferences.text_series
        : AXIOM_BLOC_2A_QUESTIONS.q2_preferences.text_films;

    return [
      "🔷 BLOC 2A — PROJECTIONS NARRATIVES",
      "",
      text,
      "",
      "Règles :",
      "• réponse libre",
      "• 3 maximum",
      "• orthographe approximative acceptée",
    ].join("\n");
  }

  if (key === "q3_core") {
    return [
      "🔷 BLOC 2A — PROJECTIONS NARRATIVES",
      "",
      AXIOM_BLOC_2A_QUESTIONS.q3_core,
      "",
      "Règles :",
      "• 1 seule œuvre",
      "• film OU série",
      "• réponse libre",
    ].join("\n");
  }

  return "";
}

// ========================================================================
// Logique spécifique BLOC 3 - Valeurs profondes & fonctionnement cognitif
// ========================================================================

const BLOC_3_ORDER: Array<keyof typeof AXIOM_BLOC_3_QUESTIONS> = [
  "q1",
  "q2",
  "q3_open",
];

function getAskedBloc3Questions(
  history: Awaited<ReturnType<typeof getConversationHistory>>
) {
  const asked: Array<keyof typeof AXIOM_BLOC_3_QUESTIONS> = [];

  for (const key of BLOC_3_ORDER) {
    const def = AXIOM_BLOC_3_QUESTIONS[key];
    const text = typeof def === "string" ? def : def.text;
    const alreadyAsked = history.some(
      (msg) => msg.role === "assistant" && msg.content.includes(text)
    );
    if (alreadyAsked) {
      asked.push(key);
    }
  }

  return asked;
}

function buildBloc3QuestionMessage(
  key: keyof typeof AXIOM_BLOC_3_QUESTIONS
): string {
  const def = AXIOM_BLOC_3_QUESTIONS[key];

  // Question ouverte (q3_open)
  if (typeof def === "string") {
    return [
      "🔷 BLOC 3 — VALEURS PROFONDES & FONCTIONNEMENT COGNITIF",
      "",
      def,
      "",
      "⚠️ 1 phrase. Pas d'exemple. Pas d'explication.",
    ].join("\n");
  }

  const { text, options } = def;
  const entries = Object.entries(options) as Array<[string, string]>;
  const lines = entries.map(([letter, label]) => `${letter}. ${label}`);

  return [
    "🔷 BLOC 3 — VALEURS PROFONDES & FONCTIONNEMENT COGNITIF",
    "",
    text,
    "",
    ...lines,
    "",
    "👉 Réponds en choisissant UNE seule lettre (A, B, C, D...).",
  ].join("\n");
}

export const axiomRouter = router({
  // Initialize a new session
  initSession: publicProcedure
    .input(z.object({
      email: z.string().email(),
      name: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const sessionId = nanoid(32);
        
        console.log("[AXIOM] Creating session for:", input.email);
        const session = await createCandidateSession({
          sessionId,
          email: input.email,
          name: input.name,
          phase: "axiom",
          currentBloc: 1,
        });

        console.log("[AXIOM] Session created:", session ? "SUCCESS" : "FAILED");
        if (!session) {
          console.error("[AXIOM] Session creation returned null");
          throw new Error("Failed to create session");
        }

        // Add initial message to conversation
        console.log("[AXIOM] Adding initial message");
        await addConversationMessage({
          sessionId,
          role: "assistant",
          content: AXIOM_INITIAL_MESSAGE,
          bloc: 0,
          phase: "axiom",
        });

        // Track session start
        console.log("[AXIOM] Tracking behavior");
        await trackBehavior({
          sessionId,
          eventType: "page_view",
          eventData: JSON.stringify({ action: "session_started" }),
        });

        console.log("[AXIOM] Session initialization complete");
        return {
          sessionId,
          initialMessage: AXIOM_INITIAL_MESSAGE,
        };
      } catch (error) {
        console.error("[AXIOM] Error in initSession:", error);
        throw error;
      }
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
      try {
        console.log("[AXIOM] sendMessage - Session:", input.sessionId, "Message:", input.message.substring(0, 50));
        
        const session = await getCandidateSession(input.sessionId);
        if (!session) {
          console.error("[AXIOM] Session not found:", input.sessionId);
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

        // ----------------------------------------------------------------
        // BLOC 1 : gestion déterministe des questions QCM (A / B / C / D…)
        // ----------------------------------------------------------------
        if (session.currentBloc === 1) {
          const asked = getAskedBloc1Questions(history);

          // Tant que toutes les questions du bloc 1 n'ont pas été posées,
          // on ne fait PAS appel au LLM : on enchaîne les questions prévues.
          if (asked.length < BLOC_1_ORDER.length) {
            const nextKey = BLOC_1_ORDER[asked.length];
            const bloc1Message = buildBloc1QuestionMessage(nextKey);

            console.log(
              "[AXIOM] BLOC 1 - Next deterministic question:",
              nextKey
            );

            await addConversationMessage({
              sessionId: input.sessionId,
              role: "assistant",
              content: bloc1Message,
              bloc: session.currentBloc,
              phase: "axiom",
            });

            return {
              message: bloc1Message,
              currentBloc: session.currentBloc,
            };
          }
        }

        // ----------------------------------------------------------------
        // BLOC 2A : gestion déterministe des questions films/séries
        // ----------------------------------------------------------------
        if (session.currentBloc === 2) {
          const asked = getAskedBloc2AQuestions(history);

          // Si toutes les questions du BLOC 2A ne sont pas posées, on continue
          if (asked.length < BLOC_2A_ORDER.length) {
            const nextKey = BLOC_2A_ORDER[asked.length];
            const mediumChoice = getBloc2AMediumChoice(history);
            const bloc2AMessage = buildBloc2AQuestionMessage(nextKey, mediumChoice);

            console.log(
              "[AXIOM] BLOC 2A - Next deterministic question:",
              nextKey,
              "Medium choice:",
              mediumChoice
            );

            await addConversationMessage({
              sessionId: input.sessionId,
              role: "assistant",
              content: bloc2AMessage,
              bloc: session.currentBloc,
              phase: "axiom",
            });

            return {
              message: bloc2AMessage,
              currentBloc: session.currentBloc,
            };
          }

          // Si toutes les questions du BLOC 2A sont posées, on passe au BLOC 2B
          // Vérifier si on a déjà envoyé le message de transition
          const hasTransitionMessage = history.some(
            (msg) =>
              msg.role === "assistant" &&
              msg.content.includes("BLOC 2B") &&
              msg.content.includes("ANALYSE PROJECTIVE")
          );

          if (!hasTransitionMessage) {
            // Envoyer le message de transition vers BLOC 2B
            const transitionMessage = [
              "🧠 FIN DU BLOC 2A — PROJECTIONS NARRATIVES",
              "",
              "Les préférences sont collectées.",
              "Aucune analyse n'a été produite.",
              "",
              "On passe maintenant au BLOC 2B — Analyse projective des œuvres retenues.",
              "",
              "🔷 BLOC 2B — ANALYSE PROJECTIVE DES 3 ŒUVRES",
              "",
              "Je vais maintenant analyser les œuvres que tu as choisies pour comprendre ce qui t'attire vraiment.",
            ].join("\n");

            await addConversationMessage({
              sessionId: input.sessionId,
              role: "assistant",
              content: transitionMessage,
              bloc: session.currentBloc,
              phase: "axiom",
            });

            return {
              message: transitionMessage,
              currentBloc: session.currentBloc,
            };
          }

          // Le BLOC 2B nécessite le LLM pour générer des questions personnalisées
          // selon les œuvres choisies, donc on continue vers l'appel LLM ci-dessous
        }

        // ----------------------------------------------------------------
        // BLOC 3 : gestion déterministe des questions QCM (A / B / C / D…)
        // ----------------------------------------------------------------
        if (session.currentBloc === 3) {
          const asked = getAskedBloc3Questions(history);

          // Tant que toutes les questions du bloc 3 n'ont pas été posées,
          // on ne fait PAS appel au LLM : on enchaîne les questions prévues.
          if (asked.length < BLOC_3_ORDER.length) {
            const nextKey = BLOC_3_ORDER[asked.length];
            const bloc3Message = buildBloc3QuestionMessage(nextKey);

            console.log(
              "[AXIOM] BLOC 3 - Next deterministic question:",
              nextKey
            );

            await addConversationMessage({
              sessionId: input.sessionId,
              role: "assistant",
              content: bloc3Message,
              bloc: session.currentBloc,
              phase: "axiom",
            });

            return {
              message: bloc3Message,
              currentBloc: session.currentBloc,
            };
          }
        }

        // ========================================================================
        // VÉRIFICATION : Toutes les questions déterministes sont-elles posées ?
        // Si oui, on force le LLM à générer UNIQUEMENT le miroir interprétatif
        // ========================================================================
        let allDeterministicQuestionsAsked = false;
        let blocContextPrompt = "";

        if (session.currentBloc === 1) {
          const asked = getAskedBloc1Questions(history);
          allDeterministicQuestionsAsked = asked.length >= BLOC_1_ORDER.length;
          if (allDeterministicQuestionsAsked) {
            blocContextPrompt = `\n\n⚠️ CONTEXTE CRITIQUE - BLOC 1 TERMINÉ\nToutes les questions déterministes du BLOC 1 ont été posées et le candidat y a répondu.\n\nTU DOIS MAINTENANT :\n1. Générer UNIQUEMENT le MIROIR INTERPRÉTATIF du BLOC 1 (format : Lecture implicite + Déduction personnalisée + Validation ouverte)\n2. Annoncer explicitement la fin du BLOC 1\n3. Annoncer le BLOC 2 et son nom\n4. Poser la première question du BLOC 2A\n\nTU NE DOIS PAS :\n- Poser d'autres questions du BLOC 1\n- Faire une lecture globale\n- Passer à un autre bloc sans miroir interprétatif`;
          }
        } else if (session.currentBloc === 3) {
          const asked = getAskedBloc3Questions(history);
          allDeterministicQuestionsAsked = asked.length >= BLOC_3_ORDER.length;
          if (allDeterministicQuestionsAsked) {
            blocContextPrompt = `\n\n⚠️ CONTEXTE CRITIQUE - BLOC 3 TERMINÉ\nToutes les questions déterministes du BLOC 3 ont été posées et le candidat y a répondu.\n\nTU DOIS MAINTENANT :\n1. Générer UNIQUEMENT le MIROIR INTERPRÉTATIF du BLOC 3 (format : Lecture implicite + Déduction personnalisée + Validation ouverte)\n2. Annoncer explicitement la fin du BLOC 3\n3. Annoncer le BLOC 4 et son nom\n4. Poser la première question du BLOC 4\n\nTU NE DOIS PAS :\n- Poser d'autres questions du BLOC 3\n- Faire une lecture globale\n- Passer à un autre bloc sans miroir interprétatif`;
          }
        }

        // Build messages for LLM avec contexte dynamique
        const systemPromptWithContext = AXIOM_SYSTEM_PROMPT + blocContextPrompt;
        
        // Si toutes les questions déterministes sont posées, ajouter un message explicite
        const explicitInstructions: Array<{ role: "system" | "assistant"; content: string }> = [];
        if (allDeterministicQuestionsAsked && blocContextPrompt) {
          explicitInstructions.push({
            role: "assistant",
            content: "✅ Toutes les questions de ce bloc ont été posées et répondues. Je dois maintenant générer le miroir interprétatif.",
          });
        }

        const messages = [
          { role: "system" as const, content: systemPromptWithContext },
          ...history.map(msg => ({
            role: msg.role as "user" | "assistant",
            content: msg.content,
          })),
          ...explicitInstructions,
          { role: "user" as const, content: input.message },
        ];

        // Get AXIOM response with streaming
        console.log("[AXIOM] Invoking LLM...");
        console.log("[AXIOM] Messages count:", messages.length);
        let response;
        try {
          response = await invokeLLM({
            messages,
          });
        } catch (llmError: any) {
          console.error("[AXIOM] LLM Error:", llmError);
          console.error("[AXIOM] LLM Error message:", llmError.message);
          console.error("[AXIOM] LLM Error stack:", llmError.stack);
          // Si l'erreur concerne la clé API manquante, retourner un message clair
          if (llmError.message?.includes("BUILT_IN_FORGE_API_KEY") || llmError.message?.includes("not configured") || llmError.message?.includes("Clé API")) {
            throw new Error("La clé API OpenAI n'est pas configurée. Veuillez ajouter OPENAI_API_KEY dans le fichier .env");
          }
          // Si l'erreur vient de l'API OpenAI (401, 429, etc.)
          if (llmError.message?.includes("401") || llmError.message?.includes("Unauthorized")) {
            throw new Error("Clé API OpenAI invalide. Vérifiez que votre clé API est correcte dans le fichier .env");
          }
          if (llmError.message?.includes("429") || llmError.message?.includes("rate limit")) {
            throw new Error("Limite de taux dépassée. Veuillez réessayer dans quelques instants.");
          }
          // Retourner l'erreur complète pour le debug
          throw new Error(`Erreur API: ${llmError.message || JSON.stringify(llmError)}`);
        }

        const assistantContent = response.choices[0]?.message?.content;
        const assistantMessage = typeof assistantContent === 'string' ? assistantContent : "Je n'ai pas pu générer une réponse.";

        console.log("[AXIOM] LLM response received, length:", assistantMessage.length);

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
      } catch (error: any) {
        console.error("[AXIOM] Error in sendMessage:", error);
        throw new Error(error.message || "Une erreur est survenue lors de l'envoi du message. Veuillez réessayer.");
      }
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
