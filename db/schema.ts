import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const reviews = sqliteTable("reviews", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  submissionId: text("submission_id").unique(),
  rating: integer("rating").notNull(),
  text: text("review_text").notNull(),
  published: integer("published", { mode: "boolean" }).notNull().default(false),
  date: text("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`),
}, table => [
  check("rating_range", sql`${table.rating} between 1 and 5`),
  check("review_length", sql`length(${table.text}) between 1 and 2000`),
]);
