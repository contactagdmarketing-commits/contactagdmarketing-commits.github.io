CREATE TABLE `behaviorTracking` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`eventType` enum('page_view','scroll','message_sent','bloc_completed','page_left','time_spent') NOT NULL,
	`eventData` text,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `behaviorTracking_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `candidateSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`email` varchar(320) NOT NULL,
	`name` varchar(255),
	`phase` enum('axiom','matching','completed') NOT NULL DEFAULT 'axiom',
	`currentBloc` int NOT NULL DEFAULT 1,
	`axiomSynthesis` text,
	`matchingResult` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`completedAt` timestamp,
	CONSTRAINT `candidateSessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `candidateSessions_sessionId_unique` UNIQUE(`sessionId`)
);
--> statement-breakpoint
CREATE TABLE `conversationMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`role` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`bloc` int,
	`phase` enum('axiom','matching') NOT NULL DEFAULT 'axiom',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `conversationMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recruiterNotifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`candidateEmail` varchar(320) NOT NULL,
	`candidateName` varchar(255),
	`notificationType` enum('profile_completed','matching_completed') NOT NULL,
	`emailSent` timestamp NOT NULL DEFAULT (now()),
	`status` enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	CONSTRAINT `recruiterNotifications_id` PRIMARY KEY(`id`)
);
