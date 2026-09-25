import { pgTable, text, timestamp, doublePrecision, primaryKey, integer, bigint } from 'drizzle-orm/pg-core';
export const measurements = pgTable('hive_measurements', {
  hiveKey: text('hive_key').notNull(), hiveName: text('hive_name').notNull(),
  measuredAt: timestamp('measured_at', {withTimezone:true}).notNull(), weightKg: doublePrecision('weight_kg').notNull()
}, t=>[primaryKey({columns:[t.hiveKey,t.measuredAt]})]);
export const syncState = pgTable('bee_sync_state', {
  channel: integer('channel').primaryKey(), cursor:timestamp('cursor_at',{withTimezone:true}),
  attempted:timestamp('attempted_at',{withTimezone:true}), succeeded:timestamp('succeeded_at',{withTimezone:true}),
  error:text('last_error'), inserted:bigint('inserted', {mode:'number'}).notNull().default(0)
});
