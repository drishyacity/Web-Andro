import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  inputType: text("input_type").notNull(), // 'url' or 'files'
  websiteUrl: text("website_url"),
  packageName: text("package_name").notNull(),
  appName: text("app_name").notNull(),
  version: text("version").notNull().default("1.0.0"),
  versionCode: integer("version_code").notNull().default(1),
  versionName: text("version_name").notNull().default("1.0"),
  minSdkVersion: integer("min_sdk_version").notNull().default(21),
  targetSdkVersion: integer("target_sdk_version").notNull().default(34),
  iconPath: text("icon_path"),
  logoPath: text("logo_path"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const builds = pgTable("builds", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id).notNull(),
  status: text("status").notNull(), // 'pending', 'building', 'success', 'failed'
  buildType: text("build_type").notNull(), // 'apk' or 'aab'
  outputPath: text("output_path"),
  aabPath: text("aab_path"),
  keystorePath: text("keystore_path"),
  errorMessage: text("error_message"),
  progress: integer("progress").default(0),
  buildStep: text("build_step"),
  buildMessage: text("build_message"),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const projectFiles = pgTable("project_files", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id).notNull(),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const signingConfigs = pgTable("signing_configs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id).notNull(),
  keystorePath: text("keystore_path"),
  keystorePassword: text("keystore_password").notNull(),
  keyAlias: text("key_alias").notNull(),
  keyPassword: text("key_password").notNull(),
  developerName: text("developer_name"),
  organizationName: text("organization_name"),
  city: text("city"),
  state: text("state"),
  country: text("country"),
  keystoreValidity: integer("keystore_validity").default(10000),
  createdAt: timestamp("created_at").defaultNow(),
});

export const buildStats = pgTable("build_stats", {
  id: serial("id").primaryKey(),
  totalBuilds: integer("total_builds").notNull().default(0),
  successfulBuilds: integer("successful_builds").notNull().default(0),
  failedBuilds: integer("failed_builds").notNull().default(0),
  lastBuildAt: timestamp("last_build_at"),
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBuildSchema = createInsertSchema(builds).omit({
  id: true,
  startedAt: true,
  completedAt: true,
});

export const insertProjectFileSchema = createInsertSchema(projectFiles).omit({
  id: true,
  uploadedAt: true,
});

export const insertSigningConfigSchema = createInsertSchema(signingConfigs).omit({
  id: true,
  createdAt: true,
});

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertBuild = z.infer<typeof insertBuildSchema>;
export type Build = typeof builds.$inferSelect;
export type InsertProjectFile = z.infer<typeof insertProjectFileSchema>;
export type ProjectFile = typeof projectFiles.$inferSelect;
export type InsertSigningConfig = z.infer<typeof insertSigningConfigSchema>;
export type SigningConfig = typeof signingConfigs.$inferSelect;
export type BuildStats = typeof buildStats.$inferSelect;

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
