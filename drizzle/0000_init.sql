CREATE TABLE `admissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`patient_id` integer NOT NULL,
	`doctor_id` integer NOT NULL,
	`ward_id` integer NOT NULL,
	`bed_no` text NOT NULL,
	`reason` text NOT NULL,
	`admitted_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`discharged_at` text,
	`discharge_summary` text,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ward_id`) REFERENCES `wards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admissions_code_unique` ON `admissions` (`code`);--> statement-breakpoint
CREATE TABLE `appointments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`patient_id` integer NOT NULL,
	`doctor_id` integer NOT NULL,
	`date` text NOT NULL,
	`time` text NOT NULL,
	`mode` text NOT NULL,
	`status` text DEFAULT 'booked' NOT NULL,
	`reason` text,
	`fee` integer NOT NULL,
	`payment_status` text DEFAULT 'paid' NOT NULL,
	`token_no` integer,
	`cancel_reason` text,
	`cancelled_by` text,
	`checked_in_at` text,
	`started_at` text,
	`completed_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `appointments_code_unique` ON `appointments` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `appt_doctor_slot_uq` ON `appointments` (`doctor_id`,`date`,`time`) WHERE status <> 'cancelled';--> statement-breakpoint
CREATE UNIQUE INDEX `appt_patient_slot_uq` ON `appointments` (`patient_id`,`date`,`time`) WHERE status <> 'cancelled';--> statement-breakpoint
CREATE INDEX `appt_doctor_date_idx` ON `appointments` (`doctor_id`,`date`);--> statement-breakpoint
CREATE INDEX `appt_patient_idx` ON `appointments` (`patient_id`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`actor_name` text,
	`role` text,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`entity_ref` text,
	`detail` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_created_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `call_signals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`appointment_id` integer NOT NULL,
	`sender` text NOT NULL,
	`type` text NOT NULL,
	`payload` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `signal_appt_idx` ON `call_signals` (`appointment_id`,`id`);--> statement-breakpoint
CREATE TABLE `care_plans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`prescription_id` integer NOT NULL,
	`patient_id` integer NOT NULL,
	`doctor_id` integer NOT NULL,
	`diet_type` text NOT NULL,
	`calories` integer,
	`meals` text DEFAULT '{}' NOT NULL,
	`include` text,
	`avoid` text,
	`hydration` text,
	`exercise` text,
	`lifestyle` text,
	`sleep` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`prescription_id`) REFERENCES `prescriptions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `care_plans_prescription_id_unique` ON `care_plans` (`prescription_id`);--> statement-breakpoint
CREATE TABLE `cart_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`patient_id` integer NOT NULL,
	`medicine_id` integer NOT NULL,
	`prescription_item_id` integer,
	`quantity` integer NOT NULL,
	`added_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`medicine_id`) REFERENCES `medicines`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`prescription_item_id`) REFERENCES `prescription_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cart_patient_medicine_uq` ON `cart_items` (`patient_id`,`medicine_id`);--> statement-breakpoint
CREATE TABLE `departments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`summary` text NOT NULL,
	`description` text NOT NULL,
	`services` text DEFAULT '' NOT NULL,
	`icon` text DEFAULT 'Stethoscope' NOT NULL,
	`location` text,
	`extension` text,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `departments_slug_unique` ON `departments` (`slug`);--> statement-breakpoint
CREATE TABLE `dispense_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`dispense_id` integer NOT NULL,
	`medicine_id` integer NOT NULL,
	`prescription_item_id` integer,
	`name` text NOT NULL,
	`batch_no` text,
	`quantity` integer NOT NULL,
	`unit_price` real NOT NULL,
	`line_total` real NOT NULL,
	FOREIGN KEY (`dispense_id`) REFERENCES `dispenses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`medicine_id`) REFERENCES `medicines`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`prescription_item_id`) REFERENCES `prescription_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `dispenses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`prescription_id` integer,
	`patient_id` integer,
	`customer_name` text,
	`customer_phone` text,
	`pharmacist_id` integer NOT NULL,
	`subtotal` real NOT NULL,
	`discount` real DEFAULT 0 NOT NULL,
	`total` real NOT NULL,
	`payment_method` text NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`prescription_id`) REFERENCES `prescriptions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pharmacist_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dispenses_code_unique` ON `dispenses` (`code`);--> statement-breakpoint
CREATE INDEX `dispense_rx_idx` ON `dispenses` (`prescription_id`);--> statement-breakpoint
CREATE INDEX `dispense_created_idx` ON `dispenses` (`created_at`);--> statement-breakpoint
CREATE TABLE `doctor_leaves` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`doctor_id` integer NOT NULL,
	`date` text NOT NULL,
	`reason` text,
	FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `leave_doctor_date_uq` ON `doctor_leaves` (`doctor_id`,`date`);--> statement-breakpoint
CREATE TABLE `doctor_schedules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`doctor_id` integer NOT NULL,
	`weekday` integer NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`mode` text DEFAULT 'both' NOT NULL,
	FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sched_doctor_idx` ON `doctor_schedules` (`doctor_id`,`weekday`);--> statement-breakpoint
CREATE TABLE `doctors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`code` text NOT NULL,
	`department_id` integer NOT NULL,
	`designation` text NOT NULL,
	`qualifications` text NOT NULL,
	`experience_years` integer DEFAULT 0 NOT NULL,
	`languages` text DEFAULT 'English, Hindi' NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`expertise` text DEFAULT '' NOT NULL,
	`room` text,
	`registration_no` text,
	`in_person_fee` integer DEFAULT 500 NOT NULL,
	`video_fee` integer DEFAULT 350 NOT NULL,
	`slot_minutes` integer DEFAULT 15 NOT NULL,
	`video_enabled` integer DEFAULT true NOT NULL,
	`avatar_color` text DEFAULT '#0f6e7c' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `doctors_user_id_unique` ON `doctors` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `doctors_code_unique` ON `doctors` (`code`);--> statement-breakpoint
CREATE TABLE `enquiries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`topic` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `feedback` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`appointment_id` integer NOT NULL,
	`patient_id` integer NOT NULL,
	`doctor_id` integer NOT NULL,
	`rating` integer NOT NULL,
	`comment` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feedback_appointment_id_unique` ON `feedback` (`appointment_id`);--> statement-breakpoint
CREATE TABLE `health_packages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`audience` text NOT NULL,
	`price` integer NOT NULL,
	`mrp` integer NOT NULL,
	`tests` text NOT NULL,
	`highlight` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `health_packages_slug_unique` ON `health_packages` (`slug`);--> statement-breakpoint
CREATE TABLE `medicine_batches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`medicine_id` integer NOT NULL,
	`batch_no` text NOT NULL,
	`expiry_date` text NOT NULL,
	`quantity` integer NOT NULL,
	`received_qty` integer NOT NULL,
	`cost_price` real NOT NULL,
	`supplier` text,
	`invoice_no` text,
	`received_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`medicine_id`) REFERENCES `medicines`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `batch_medicine_idx` ON `medicine_batches` (`medicine_id`,`expiry_date`);--> statement-breakpoint
CREATE TABLE `medicines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sku` text NOT NULL,
	`name` text NOT NULL,
	`generic_name` text NOT NULL,
	`manufacturer` text NOT NULL,
	`category` text NOT NULL,
	`form` text NOT NULL,
	`strength` text,
	`unit_label` text NOT NULL,
	`unit_price` real NOT NULL,
	`rx_required` integer DEFAULT true NOT NULL,
	`stock` integer DEFAULT 0 NOT NULL,
	`reorder_level` integer DEFAULT 50 NOT NULL,
	`rack` text,
	`hsn` text,
	`gst_percent` integer DEFAULT 12 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `medicines_sku_unique` ON `medicines` (`sku`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`href` text,
	`read` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `notif_user_idx` ON `notifications` (`user_id`,`read`);--> statement-breakpoint
CREATE TABLE `package_bookings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`package_id` integer NOT NULL,
	`patient_id` integer NOT NULL,
	`date` text NOT NULL,
	`status` text DEFAULT 'booked' NOT NULL,
	`amount` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`package_id`) REFERENCES `health_packages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `package_bookings_code_unique` ON `package_bookings` (`code`);--> statement-breakpoint
CREATE TABLE `patients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`uhid` text NOT NULL,
	`dob` text,
	`gender` text,
	`blood_group` text,
	`address` text,
	`city` text,
	`pincode` text,
	`emergency_name` text,
	`emergency_relation` text,
	`emergency_phone` text,
	`allergies` text,
	`chronic_conditions` text,
	`height_cm` real,
	`weight_kg` real,
	`insurance_provider` text,
	`insurance_policy_no` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `patients_user_id_unique` ON `patients` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `patients_uhid_unique` ON `patients` (`uhid`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`patient_id` integer,
	`purpose` text NOT NULL,
	`reference` text NOT NULL,
	`description` text NOT NULL,
	`amount` real NOT NULL,
	`method` text NOT NULL,
	`status` text DEFAULT 'success' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_code_unique` ON `payments` (`code`);--> statement-breakpoint
CREATE INDEX `payment_patient_idx` ON `payments` (`patient_id`);--> statement-breakpoint
CREATE INDEX `payment_created_idx` ON `payments` (`created_at`);--> statement-breakpoint
CREATE TABLE `pharmacy_order_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`medicine_id` integer NOT NULL,
	`prescription_item_id` integer,
	`name` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price` real NOT NULL,
	`line_total` real NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `pharmacy_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`medicine_id`) REFERENCES `medicines`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`prescription_item_id`) REFERENCES `prescription_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pharmacy_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`patient_id` integer NOT NULL,
	`status` text DEFAULT 'placed' NOT NULL,
	`fulfilment` text NOT NULL,
	`delivery_address` text,
	`subtotal` real NOT NULL,
	`discount` real DEFAULT 0 NOT NULL,
	`delivery_fee` real DEFAULT 0 NOT NULL,
	`total` real NOT NULL,
	`payment_method` text NOT NULL,
	`payment_status` text DEFAULT 'paid' NOT NULL,
	`handled_by` integer,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`handled_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pharmacy_orders_code_unique` ON `pharmacy_orders` (`code`);--> statement-breakpoint
CREATE INDEX `order_patient_idx` ON `pharmacy_orders` (`patient_id`);--> statement-breakpoint
CREATE INDEX `order_status_idx` ON `pharmacy_orders` (`status`);--> statement-breakpoint
CREATE TABLE `prescription_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`prescription_id` integer NOT NULL,
	`medicine_id` integer,
	`medicine_name` text NOT NULL,
	`dosage` text,
	`frequency` text NOT NULL,
	`timing` text,
	`duration_days` integer NOT NULL,
	`quantity` integer NOT NULL,
	`instructions` text,
	FOREIGN KEY (`prescription_id`) REFERENCES `prescriptions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`medicine_id`) REFERENCES `medicines`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `rx_items_rx_idx` ON `prescription_items` (`prescription_id`);--> statement-breakpoint
CREATE TABLE `prescriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`appointment_id` integer,
	`patient_id` integer NOT NULL,
	`doctor_id` integer NOT NULL,
	`chief_complaints` text,
	`diagnosis` text NOT NULL,
	`clinical_notes` text,
	`advice` text,
	`lab_tests` text DEFAULT '[]' NOT NULL,
	`follow_up_date` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prescriptions_code_unique` ON `prescriptions` (`code`);--> statement-breakpoint
CREATE INDEX `rx_patient_idx` ON `prescriptions` (`patient_id`);--> statement-breakpoint
CREATE INDEX `rx_doctor_idx` ON `prescriptions` (`doctor_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`medicine_id` integer NOT NULL,
	`batch_id` integer,
	`type` text NOT NULL,
	`quantity` integer NOT NULL,
	`balance_after` integer NOT NULL,
	`reference` text,
	`note` text,
	`user_id` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`medicine_id`) REFERENCES `medicines`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`batch_id`) REFERENCES `medicine_batches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `movement_medicine_idx` ON `stock_movements` (`medicine_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`role` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`password_hash` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`last_login_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_code_unique` ON `users` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `vitals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`patient_id` integer NOT NULL,
	`appointment_id` integer,
	`recorded_by` integer,
	`bp_systolic` integer,
	`bp_diastolic` integer,
	`pulse` integer,
	`temperature_f` real,
	`spo2` integer,
	`respiratory_rate` integer,
	`weight_kg` real,
	`height_cm` real,
	`blood_sugar` integer,
	`sugar_type` text,
	`recorded_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `vitals_patient_idx` ON `vitals` (`patient_id`);--> statement-breakpoint
CREATE TABLE `wards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`floor` text NOT NULL,
	`total_beds` integer NOT NULL,
	`daily_rate` integer NOT NULL
);
