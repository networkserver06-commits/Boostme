CREATE TABLE `auditEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorUserId` int,
	`action` varchar(120) NOT NULL,
	`entityType` varchar(80) NOT NULL,
	`entityId` varchar(80),
	`details` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`serviceId` int NOT NULL,
	`providerOrderId` varchar(120),
	`targetLink` varchar(1000) NOT NULL,
	`quantity` int NOT NULL,
	`charge` decimal(14,2) NOT NULL,
	`startCount` int,
	`remains` int,
	`status` enum('pending','in_progress','completed','canceled','partial','failed') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`email` varchar(320),
	`balance` decimal(14,2) NOT NULL DEFAULT '0.00',
	`apiKey` varchar(96),
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `profiles_userId_unique` UNIQUE(`userId`),
	CONSTRAINT `profiles_apiKey_unique` UNIQUE(`apiKey`)
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`providerId` int,
	`providerServiceId` varchar(80),
	`name` varchar(220) NOT NULL,
	`platform` varchar(40) NOT NULL,
	`category` varchar(80) NOT NULL,
	`description` text,
	`wholesaleRatePer1k` decimal(12,4) NOT NULL DEFAULT '0.00',
	`retailRatePer1k` decimal(12,4) NOT NULL DEFAULT '0.00',
	`minQuantity` int NOT NULL DEFAULT 100,
	`maxQuantity` int NOT NULL DEFAULT 100000,
	`tags` varchar(500),
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `services_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `smmProviders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`apiUrl` varchar(500) NOT NULL,
	`apiKey` varchar(500) NOT NULL,
	`isActive` int NOT NULL DEFAULT 1,
	`lastSyncAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `smmProviders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `syncRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`providerId` int,
	`kind` enum('catalog','orders') NOT NULL,
	`status` enum('running','completed','failed') NOT NULL,
	`itemsProcessed` int NOT NULL DEFAULT 0,
	`errorMessage` text,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`finishedAt` timestamp,
	CONSTRAINT `syncRuns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `walletTransactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`amount` decimal(14,2) NOT NULL,
	`type` enum('deposit','order_charge','refund','adjustment') NOT NULL,
	`status` enum('pending','completed','failed') NOT NULL DEFAULT 'completed',
	`reference` varchar(160) NOT NULL,
	`paymentMethod` varchar(80),
	`balanceAfter` decimal(14,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `walletTransactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `orders_user_idx` ON `orders` (`userId`);--> statement-breakpoint
CREATE INDEX `orders_status_idx` ON `orders` (`status`);--> statement-breakpoint
CREATE INDEX `profiles_user_idx` ON `profiles` (`userId`);--> statement-breakpoint
CREATE INDEX `services_active_idx` ON `services` (`isActive`);--> statement-breakpoint
CREATE INDEX `wallet_user_idx` ON `walletTransactions` (`userId`);