import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4" ;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    return part;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return {
      role,
      name,
      tool_call_id,
      content,
    };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text,
    };
  }

  return {
    role,
    name,
    content: contentParts,
  };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

const resolveApiUrl = () => {
  // Si une URL personnalisée est définie, l'utiliser
  if (ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0) {
    return `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`;
  }
  
  // Si on utilise une clé OpenAI standard (commence par "sk-"), utiliser l'API OpenAI officielle
  if (ENV.forgeApiKey && ENV.forgeApiKey.startsWith("sk-")) {
    return "https://api.openai.com/v1/chat/completions";
  }
  
  // Sinon, utiliser l'API Forge par défaut (pour les clés Manus)
  return "https://forge.manus.im/v1/chat/completions";
};

const assertApiKey = () => {
  // En mode mock, pas besoin de clé API
  if (ENV.mockLLM) {
    return;
  }
  if (!ENV.forgeApiKey) {
    throw new Error("La clé API OpenAI n'est pas configurée. Veuillez ajouter BUILT_IN_FORGE_API_KEY ou OPENAI_API_KEY dans le fichier .env à la racine de axiom-app/. Ou activez le mode mock avec MOCK_LLM=true pour tester sans payer.");
  }
};

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

// Mode mock : génère des réponses réalistes sans appeler l'API
const generateMockResponse = (messages: Message[]): InvokeResult => {
  const lastUserMessage = messages
    .filter(m => m.role === "user")
    .pop()?.content;
  
  const userText = typeof lastUserMessage === "string" 
    ? lastUserMessage 
    : Array.isArray(lastUserMessage) 
      ? lastUserMessage.find(m => typeof m === "string" || m?.type === "text")?.text || ""
      : "";

  // Réponses mock réalistes pour le questionnaire AXIOM
  const mockResponses = [
    "Intéressant. Peux-tu me dire un peu plus sur ce qui t'a marqué dans cette expérience ?",
    "Je comprends. Et comment as-tu réagi face à cette situation ?",
    "C'est une perspective intéressante. Qu'est-ce que cela révèle sur ta façon de travailler ?",
    "Merci pour cette réponse. Peux-tu approfondir un peu ?",
    "Je vois. Et qu'est-ce que cela t'a appris sur toi-même ?",
    "D'accord. Comment cette expérience a-t-elle influencé tes choix professionnels ?",
    "Intéressant. Y a-t-il d'autres aspects que tu aimerais partager ?",
  ];

  // Sélectionne une réponse basée sur le hash du message pour avoir de la variété
  const hash = userText.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const mockResponse = mockResponses[hash % mockResponses.length];

  return {
    id: `mock-${Date.now()}`,
    created: Math.floor(Date.now() / 1000),
    model: "gpt-4o-mini-mock",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: mockResponse,
        },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
    },
  };
};

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  // Mode mock : retourne une réponse simulée sans appeler l'API
  if (ENV.mockLLM) {
    console.log("[LLM] Mode MOCK activé - réponse simulée (pas d'appel API réel)");
    return generateMockResponse(params.messages);
  }

  assertApiKey();

  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
  } = params;

  const payload: Record<string, unknown> = {
    model: "gpt-4o-mini",
    messages: messages.map(normalizeMessage),
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }

  payload.max_tokens = 16384

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });

  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }

  const apiUrl = resolveApiUrl();
  console.log("[LLM] Calling API:", apiUrl);
  console.log("[LLM] API Key present:", !!ENV.forgeApiKey);
  console.log("[LLM] API Key length:", ENV.forgeApiKey?.length || 0);
  
  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[LLM] API Error Response:", response.status, response.statusText);
      console.error("[LLM] API Error Body:", errorText);
      
      // Erreurs spécifiques
      if (response.status === 401) {
        throw new Error("Clé API OpenAI invalide ou expirée. Vérifiez votre clé dans le fichier .env");
      }
      if (response.status === 429) {
        throw new Error("Limite de taux dépassée. Vous avez consommé trop de jetons. Réessayez plus tard.");
      }
      if (response.status === 400) {
        throw new Error(`Requête invalide: ${errorText}`);
      }
      
      throw new Error(
        `Erreur API OpenAI (${response.status}): ${errorText || response.statusText}`
      );
    }

    const result = await response.json() as InvokeResult;
    console.log("[LLM] API Success - Response ID:", result.id);
    return result;
  } catch (fetchError: any) {
    console.error("[LLM] Fetch Error:", fetchError);
    if (fetchError.message) {
      throw fetchError;
    }
    throw new Error(`Erreur de connexion à l'API OpenAI: ${fetchError.message || fetchError}`);
  }
}
