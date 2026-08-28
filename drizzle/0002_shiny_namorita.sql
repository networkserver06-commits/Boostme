CREATE TABLE `syncSchedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`kind` enum('catalog','orders') NOT NULL,
	`taskUid` varchar(65) NOT NULL,
	`cron` varchar(80) NOT NULL,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `syncSchedules_id` PRIMARY KEY(`id`),
	CONSTRAINT `syncSchedules_kind_unique` UNIQUE(`kind`),
	CONSTRAINT `syncSchedules_taskUid_unique` UNIQUE(`taskUid`)
);
