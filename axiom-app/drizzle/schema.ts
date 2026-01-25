import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Candidate sessions for AXIOM profiling
 */
export const candidateSessions = mysqlTable("candidateSessions", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 64 }).notNull().unique(),
  email: varchar("email", { length: 320 }).notNull(),
  name: varchar("name", { length: 255 }),
  phase: mysqlEnum("phase", ["axiom", "matching", "completed"]).default("axiom").notNull(),
  currentBloc: int("currentBloc").default(1).notNull(),
  axiomSynthesis: text("axiomSynthesis"),
  matchingResult: text("matchingResult"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type CandidateSession = typeof candidateSessions.$inferSelect;
export type InsertCandidateSession = typeof candidateSessions.$inferInsert;

/**
 * Conversation messages between candidate and AXIOM
 */
export const conversationMessages = mysqlTable("conversationMessages", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 64 }).notNull(),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  bloc: int("bloc"),
  phase: mysqlEnum("phase", ["axiom", "matching"]).default("axiom").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ConversationMessage = typeof conversationMessages.$inferSelect;
export type InsertConversationMessage = typeof conversationMessages.$inferInsert;

/**
 * Behavioral tracking for candidates
 */
export const behaviorTracking = mysqlTable("behaviorTracking", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 64 }).notNull(),
  eventType: mysqlEnum("eventType", ["page_view", "scroll", "message_sent", "bloc_completed", "page_left", "time_spent"]).notNull(),
  eventData: text("eventData"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export type BehaviorTracking = typeof behaviorTracking.$inferSelect;
export type InsertBehaviorTracking = typeof behaviorTracking.$inferInsert;

/**
 * Recruiter notifications log
 */
export const recruiterNotifications = mysqlTable("recruiterNotifications", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: varchar("sessionId", { length: 64 }).notNull(),
  candidateEmail: varchar("candidateEmail", { length: 320 }).notNull(),
  candidateName: varchar("candidateName", { length: 255 }),
  notificationType: mysqlEnum("notificationType", ["profile_completed", "matching_completed"]).notNull(),
  emailSent: timestamp("emailSent").defaultNow().notNull(),
  status: mysqlEnum("status", ["pending", "sent", "failed"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
});

export type RecruiterNotification = typeof recruiterNotifications.$inferSelect;
export type InsertRecruiterNotification = typeof recruiterNotifications.$inferInsert;