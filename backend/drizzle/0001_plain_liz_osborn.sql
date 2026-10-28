DROP INDEX "chat_userId_idx";--> statement-breakpoint
DROP INDEX "message_chatId_idx";--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_account_unique" ON "account" USING btree ("providerId","accountId");--> statement-breakpoint
CREATE INDEX "chat_userId_updatedAt_idx" ON "chat" USING btree ("userId","updatedAt");--> statement-breakpoint
CREATE INDEX "message_chatId_createdAt_idx" ON "message" USING btree ("chatId","createdAt");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");