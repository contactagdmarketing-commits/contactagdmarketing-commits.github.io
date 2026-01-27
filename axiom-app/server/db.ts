import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, candidateSessions, CandidateSession, InsertCandidateSession, conversationMessages, InsertConversationMessage, behaviorTracking, InsertBehaviorTracking, recruiterNotifications, InsertRecruiterNotification } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// ============ MOCK STORAGE (pour développement sans DB) ============
const mockSessions = new Map<string, CandidateSession>();
const mockMessages = new Map<string, Array<typeof conversationMessages.$inferSelect>>();
const mockBehaviorTracking: Array<typeof behaviorTracking.$inferSelect> = [];
let mockSessionIdCounter = 0;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============ CANDIDATE SESSION HELPERS ============

export async function createCandidateSession(data: InsertCandidateSession): Promise<CandidateSession | null> {
  const db = await getDb();
  if (!db) {
    // Mode mock : stockage en mémoire
    try {
      console.warn("[Database] Database not available, using mock storage");
      const now = new Date();
      const mockSession: CandidateSession = {
        id: ++mockSessionIdCounter,
        sessionId: data.sessionId,
        email: data.email,
        name: data.name ?? null,
        phase: data.phase ?? "axiom",
        currentBloc: data.currentBloc ?? 1,
        axiomSynthesis: data.axiomSynthesis ?? null,
        matchingResult: data.matchingResult ?? null,
        createdAt: now,
        updatedAt: now,
        completedAt: data.completedAt ?? null,
      };
      mockSessions.set(data.sessionId, mockSession);
      mockMessages.set(data.sessionId, []);
      console.log("[Database] Mock session created:", data.sessionId);
      return mockSession;
    } catch (error) {
      console.error("[Database] Error creating mock session:", error);
      return null;
    }
  }

  try {
    const result = await db.insert(candidateSessions).values(data);
    const sessionId = data.sessionId;
    const sessions = await db.select().from(candidateSessions).where(eq(candidateSessions.sessionId, sessionId)).limit(1);
    return sessions.length > 0 ? sessions[0] : null;
  } catch (error) {
    console.error("[Database] Failed to create session:", error);
    throw error;
  }
}

export async function getCandidateSession(sessionId: string): Promise<CandidateSession | null> {
  const db = await getDb();
  if (!db) {
    // Mode mock : récupération depuis la mémoire
    return mockSessions.get(sessionId) ?? null;
  }

  try {
    const result = await db.select().from(candidateSessions).where(eq(candidateSessions.sessionId, sessionId)).limit(1);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("[Database] Failed to get session:", error);
    throw error;
  }
}

export async function updateCandidateSession(sessionId: string, data: Partial<InsertCandidateSession>): Promise<CandidateSession | null> {
  const db = await getDb();
  if (!db) {
    // Mode mock : mise à jour en mémoire
    const session = mockSessions.get(sessionId);
    if (!session) return null;
    const updatedSession: CandidateSession = {
      ...session,
      ...data,
      updatedAt: new Date(),
    } as CandidateSession;
    mockSessions.set(sessionId, updatedSession);
    return updatedSession;
  }

  try {
    await db.update(candidateSessions).set(data).where(eq(candidateSessions.sessionId, sessionId));
    return getCandidateSession(sessionId);
  } catch (error) {
    console.error("[Database] Failed to update session:", error);
    throw error;
  }
}

// ============ CONVERSATION MESSAGE HELPERS ============

export async function addConversationMessage(data: InsertConversationMessage): Promise<void> {
  const db = await getDb();
  if (!db) {
    // Mode mock : ajout en mémoire
    try {
      const messages = mockMessages.get(data.sessionId) ?? [];
      const mockMessage: typeof conversationMessages.$inferSelect = {
        id: messages.length + 1,
        sessionId: data.sessionId,
        role: data.role,
        content: data.content,
        bloc: data.bloc ?? null,
        phase: data.phase ?? "axiom",
        createdAt: new Date(),
      };
      messages.push(mockMessage);
      mockMessages.set(data.sessionId, messages);
      console.log("[Database] Mock message added for session:", data.sessionId);
      return;
    } catch (error) {
      console.error("[Database] Error adding mock message:", error);
      // Ne pas throw pour ne pas bloquer l'application
      return;
    }
  }

  try {
    await db.insert(conversationMessages).values(data);
  } catch (error) {
    console.error("[Database] Failed to add message:", error);
    throw error;
  }
}

export async function getConversationHistory(sessionId: string, phase?: string) {
  const db = await getDb();
  if (!db) {
    // Mode mock : récupération depuis la mémoire
    const messages = mockMessages.get(sessionId) ?? [];
    if (phase) {
      return messages.filter(msg => msg.phase === phase);
    }
    return messages;
  }

  try {
    const result = await db.select().from(conversationMessages).where(eq(conversationMessages.sessionId, sessionId));
    if (phase) {
      return result.filter(msg => msg.phase === phase);
    }
    return result;
  } catch (error) {
    console.error("[Database] Failed to get history:", error);
    throw error;
  }
}

// ============ BEHAVIOR TRACKING HELPERS ============

export async function trackBehavior(data: InsertBehaviorTracking): Promise<void> {
  const db = await getDb();
  if (!db) {
    // Mode mock : ajout en mémoire
    const mockTracking: typeof behaviorTracking.$inferSelect = {
      id: mockBehaviorTracking.length + 1,
      sessionId: data.sessionId,
      eventType: data.eventType,
      eventData: data.eventData ?? null,
      timestamp: new Date(),
    };
    mockBehaviorTracking.push(mockTracking);
    return;
  }

  try {
    await db.insert(behaviorTracking).values(data);
  } catch (error) {
    console.error("[Database] Failed to track behavior:", error);
    // Don't throw - tracking should not break the app
  }
}

// ============ RECRUITER NOTIFICATION HELPERS ============

export async function createRecruiterNotification(data: InsertRecruiterNotification): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create notification: database not available");
    return;
  }

  try {
    await db.insert(recruiterNotifications).values(data);
  } catch (error) {
    console.error("[Database] Failed to create notification:", error);
    throw error;
  }
}

export async function updateNotificationStatus(id: number, status: "pending" | "sent" | "failed", errorMessage?: string): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update notification: database not available");
    return;
  }

  try {
    await db.update(recruiterNotifications).set({ status, errorMessage }).where(eq(recruiterNotifications.id, id));
  } catch (error) {
    console.error("[Database] Failed to update notification:", error);
    throw error;
  }
}
